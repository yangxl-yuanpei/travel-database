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

test("Nanchang keeps city nodes and deep nodes", async () => {
  const data = await atlas();
  const places = data.city_places.city_nanchang;
  assert.equal(places.length, 7);
  assert.ok(places.some((place) => place.id === "nc_haihunhou_museum" && place.children.length >= 10));
  assert.ok(places.some((place) => place.id === "nc_jx_museum" && place.children.length === 6));
});
