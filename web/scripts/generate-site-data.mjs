import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, "..");
const databaseRoot = resolve(webRoot, "..", "data");
const outputDir = join(webRoot, "app", "generated");

async function collectJsonFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

const nodes = new Map();
for (const path of await collectJsonFiles(databaseRoot)) {
  const node = JSON.parse(await readFile(path, "utf8"));
  nodes.set(node.id, node);
}

function referencedChildren(node) {
  const result = [];
  for (const ids of Object.values(node?.child_nodes ?? {})) {
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      const child = nodes.get(id);
      if (child) result.push(child);
    }
  }
  return result;
}

const journey = nodes.get("journey_2026_national_day_jiangxi");
if (!journey) throw new Error("Missing journey_2026_national_day_jiangxi");

const cityIds = [...journey.structure.origin_city_ids, ...journey.structure.main_city_sequence];
const cities = cityIds.map((id) => {
  const city = nodes.get(id);
  if (!city) throw new Error(`Missing city node: ${id}`);
  return city;
});
const transports = journey.structure.transport_node_ids.map((id) => {
  const transport = nodes.get(id);
  if (!transport) throw new Error(`Missing transport node: ${id}`);
  return transport;
});
const itineraries = (journey.structure.itinerary_node_ids ?? []).map((id) => {
  const itinerary = nodes.get(id);
  if (!itinerary) throw new Error(`Missing itinerary node: ${id}`);
  return itinerary;
});

const cityPlaces = Object.fromEntries(cities.map((city) => [
  city.id,
  referencedChildren(city).filter((child) => child.node_type !== "transport").map((place, index) => ({
    ...place,
    map_index: String(index + 1).padStart(2, "0"),
    children: referencedChildren(place),
  })),
]));
const cityTransports = Object.fromEntries(cities.map((city) => [
  city.id,
  referencedChildren(city).filter((child) => child.node_type === "transport"),
]));
const places = cityPlaces.city_nanchang ?? [];
const atlas = { journey, cities, transports, itineraries, city_places: cityPlaces, city_transports: cityTransports };
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, "atlas.json"), `${JSON.stringify(atlas, null, 2)}\n`, "utf8");
await writeFile(join(outputDir, "places.json"), `${JSON.stringify(places, null, 2)}\n`, "utf8");
const publishedCities = Object.entries(cityPlaces).filter(([, cityNodes]) => cityNodes.length > 0).map(([id, cityNodes]) => `${id}:${cityNodes.length}`).join(", ");
console.log(`Generated ${relative(webRoot, join(outputDir, "atlas.json"))}: ${cities.length} cities, ${transports.length} links, ${itineraries.length} itineraries, detailed nodes ${publishedCities}.`);
