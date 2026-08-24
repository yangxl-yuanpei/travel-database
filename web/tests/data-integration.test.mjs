import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("../app/generated/atlas.json", import.meta.url);
async function atlas() { return JSON.parse(await readFile(dataUrl, "utf8")); }

test("publishes the six-city journey network", async () => {
  const data = await atlas();
  assert.equal(data.cities.length, 6);
  assert.equal(data.transports.length, 5);
  assert.deepEqual(data.journey.structure.origin_city_ids, ["city_zhuhai", "city_beijing", "city_shanghai"]);
  assert.deepEqual(data.journey.structure.main_city_sequence, ["city_nanchang", "city_jingdezhen", "city_shangrao"]);
  for (const city of data.cities) {
    assert.equal(city.location.coordinate_system, "GCJ-02");
    assert.equal(typeof city.location.latitude, "number");
    assert.equal(typeof city.location.longitude, "number");
  }
});

test("all three origins converge on Nanchang", async () => {
  const data = await atlas();
  const convergence = data.transports.filter((item) => item.route_role === "origin_to_rendezvous");
  assert.equal(convergence.length, 3);
  assert.ok(convergence.every((item) => item.to_city_id === "city_nanchang"));
});

test("rail baselines are explicit reference data", async () => {
  const data = await atlas();
  for (const transport of data.transports) {
    const rail = transport.rail_reference;
    assert.equal(rail.status, "normal_day_reference");
    assert.equal(rail.national_day_sale_status, "not_on_sale");
    assert.ok(rail.duration_minutes.minimum > 0);
    assert.ok(rail.second_class_fare_cny.minimum > 0);
    assert.ok(transport.sources.some((source) => source.name.includes("12306")));
  }
});

test("publishes the fixed four-day itinerary as structured data", async () => {
  const data = await atlas();
  assert.equal(data.itineraries.length, 1);
  const itinerary = data.itineraries[0];
  assert.equal(itinerary.id, "itinerary_4d_nanchang_jingdezhen_sanqingshan");
  assert.equal(itinerary.days.length, 4);
  assert.deepEqual(itinerary.route_city_ids, ["city_nanchang", "city_jingdezhen", "city_shangrao"]);
  assert.ok(itinerary.days[0].schedule.some((item) => item.node_id === "nc_tengwangge"));
  assert.equal(itinerary.days[2].lodging.recommended_area_id, "sr_stay_area_sanqingshan_foothill");
  assert.ok(itinerary.days[3].schedule.some((item) => item.alternative));
  assert.equal(itinerary.mountain_transfers.length, 2);
  assert.ok(itinerary.mountain_transfers.every((group) => group.options.length >= 3));
  assert.ok(itinerary.mountain_transfers.some((group) => group.direction === "return" && group.options.some((option) => option.name.includes("兴荣出行"))));
  assert.ok(itinerary.booking_checklist.length >= 5);
});

test("Nanchang keeps city nodes and deep nodes", async () => {
  const data = await atlas();
  const places = data.city_places.city_nanchang;
  const sights = places.filter((place) => ["attraction", "museum", "memorial"].includes(place.node_type));
  const foodAreas = places.filter((place) => place.node_type === "food" && place.food_scope === "area");
  const stayAreas = places.filter((place) => place.node_type === "accommodation_area");
  assert.equal(sights.length, 7);
  assert.equal(foodAreas.length, 7);
  assert.equal(stayAreas.length, 6);
  assert.equal(places.length, 20);
  assert.ok(places.some((place) => place.id === "nc_haihunhou_museum" && place.children.length >= 10));
  assert.ok(places.some((place) => place.id === "nc_jx_museum" && place.children.length === 6));
  assert.ok(foodAreas.every((area) => typeof area.location.latitude === "number" && typeof area.location.longitude === "number"));
  assert.ok(foodAreas.every((area) => area.children.length > 0));
  assert.ok(foodAreas.reduce((count, area) => count + area.children.length, 0) >= 70);
  assert.ok(stayAreas.every((area) => typeof area.location.latitude === "number" && typeof area.location.longitude === "number"));
  assert.ok(stayAreas.every((area) => area.location.coordinate_system === "GCJ-02"));
  assert.ok(stayAreas.every((area) => area.amap_integration.api_status === "proxy_verified"));
  assert.ok(stayAreas.every((area) => !area.price_range_cny));
});

test("Jingdezhen publishes the first ceramic-culture node batch", async () => {
  const data = await atlas();
  const places = data.city_places.city_jingdezhen;
  const foodAreas = places.filter((place) => place.node_type === "food" && place.food_scope === "area");
  const stayAreas = places.filter((place) => place.node_type === "accommodation_area");
  assert.equal(places.length, 19);
  assert.equal(places.filter((place) => place.node_type === "museum").length, 2);
  assert.equal(foodAreas.length, 6);
  assert.equal(stayAreas.length, 5);
  assert.ok(places.some((place) => place.id === "jdz_yaoli_ancient_town"));
  assert.ok(places.some((place) => place.id === "jdz_taoyangli" && place.children.some((child) => child.id === "jdz_imperial_kiln_museum")));
  assert.ok(places.some((place) => place.id === "jdz_china_ceramics_museum" && place.children.length === 8));
  assert.ok(places.some((place) => place.id === "jdz_imperial_kiln_museum" && place.children.length === 12));
  assert.ok(places.some((place) => place.id === "jdz_china_ceramics_museum" && place.children.some((child) => child.node_type === "artifact")));
  assert.ok(places.some((place) => place.id === "jdz_imperial_kiln_museum" && place.children.some((child) => child.node_type === "archaeological_site")));
  assert.ok(foodAreas.every((area) => area.children.length > 0));
  assert.ok(foodAreas.reduce((count, area) => count + area.children.length, 0) >= 20);
  assert.ok(stayAreas.every((area) => area.amap_integration.api_status === "proxy_verified"));
  assert.ok(stayAreas.every((area) => !area.price_range_cny));
  assert.ok(places.every((place) => typeof place.location.latitude === "number" && typeof place.location.longitude === "number"));
  assert.ok(places.every((place) => place.location.coordinate_system === "GCJ-02"));
});

test("Shangrao publishes the multi-hub county travel database", async () => {
  const data = await atlas();
  const places = data.city_places.city_shangrao;
  assert.ok(places.length >= 25);
  const sanqingshan = places.find((place) => place.id === "sr_sanqingshan");
  assert.ok(sanqingshan);
  assert.equal(sanqingshan.metadata.data_status, "verified");
  assert.equal(sanqingshan.location.coordinate_system, "GCJ-02");
  assert.equal(sanqingshan.official_info.ticket.general_admission.amount, 120);
  assert.equal(sanqingshan.reservation.required, true);
  assert.equal(sanqingshan.holiday_reference.reference_year, 2025);
  assert.equal(sanqingshan.children.filter((child) => child.node_type === "attraction").length, 4);
  assert.equal(sanqingshan.children.filter((child) => child.node_type === "transport").length, 3);
  assert.ok(sanqingshan.children.every((child) => typeof child.location.latitude === "number" && typeof child.location.longitude === "number"));
  assert.ok(["sr_sqs_nanqingyuan", "sr_sqs_west_coast", "sr_sqs_giant_python", "sr_sqs_oriental_goddess"].every((id) => places.some((place) => place.id === id)));
  assert.equal(sanqingshan.experience_layer.confidence.overall, "high");
  assert.equal(sanqingshan.remote_transport_profile.remote_level, "high");
  assert.ok(["sr_wangxiangu", "sr_wuyuan_huangling", "sr_gexian_village", "sr_yiyang_guifeng"].every((id) => places.some((place) => place.id === id)));
  const museum = places.find((place) => place.node_type === "museum" && place.id === "sr_museum");
  assert.ok(museum);
  assert.equal(museum.children.filter((child) => child.node_type === "permanent_exhibition").length, 5);
  assert.ok(places.some((place) => place.node_type === "memorial" && place.id === "sr_concentration_camp"));
  assert.ok(places.filter((place) => place.node_type === "food").length >= 3);
  assert.ok(places.filter((place) => place.node_type === "accommodation_area").length >= 5);
});
