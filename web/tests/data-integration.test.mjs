import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("../app/generated/places.json", import.meta.url);

test("publishes three located parent nodes", async () => {
  const places = JSON.parse(await readFile(dataUrl, "utf8"));
  assert.equal(places.length, 3);
  assert.deepEqual(places.map((place) => place.id), ["nc_jx_museum", "nc_tengwangge", "nc_bayi_memorial"]);
  for (const place of places) {
    assert.equal(place.location.coordinate_system, "GCJ-02");
    assert.equal(typeof place.location.latitude, "number");
    assert.equal(typeof place.location.longitude, "number");
    assert.match(place.location.amap_poi_id, /^[A-Z0-9]+$/);
  }
});

test("includes referenced deep nodes", async () => {
  const places = JSON.parse(await readFile(dataUrl, "utf8"));
  const museum = places.find((place) => place.id === "nc_jx_museum");
  const memorial = places.find((place) => place.id === "nc_bayi_memorial");
  assert.equal(museum.children.length, 6);
  assert.equal(memorial.children.length, 9);
});

test("keeps traveler experience separate and machine-readable", async () => {
  const places = JSON.parse(await readFile(dataUrl, "utf8"));
  for (const place of places) {
    const layer = place.experience_layer;
    assert.ok(layer);
    assert.deepEqual(layer.source, ["小红书攻略", "抖音游客反馈"]);
    assert.ok(layer.positive.length >= 3);
    assert.ok(layer.avoid.length >= 3);
    assert.ok(layer.visit_tips.length >= 3);
    assert.ok(layer.recommended_duration.minimum_minutes > 0);
    assert.ok(layer.recommended_duration.recommended_max_minutes >= layer.recommended_duration.recommended_min_minutes);
    assert.equal(typeof layer.ai_note, "string");
  }
});
