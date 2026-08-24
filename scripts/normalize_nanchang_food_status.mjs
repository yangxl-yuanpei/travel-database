import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const restaurantsRoot = join(root, "data", "cities", "nanchang", "food", "restaurants");
const checkedAt = "2026-08-24";

async function jsonFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

let updated = 0;
for (const path of await jsonFiles(restaurantsRoot)) {
  const node = JSON.parse(await readFile(path, "utf8"));
  const poiId = node.location?.amap_poi_id;
  if (!poiId) throw new Error(`${node.id}: restaurant has no Amap POI after cleanup`);
  const exactChecked = node.location.status === "verified_exact_poi";
  node.business_status ??= exactChecked
    ? { value: "searchable_on_amap", checked_at: checkedAt, status: "third_party_snapshot_dynamic_recheck_required", note: "能被高德地点搜索检出不等同于承诺当日营业；临行前仍需动态复核。" }
    : { value: null, checked_at: null, status: "dynamic_check_required", note: "POI 与坐标来自高德导入快照；营业状态需要临行前重新查询。" };
  node.metadata = {
    ...node.metadata,
    schema_version: "2.0",
    content_status: "complete",
    verification_level: "third_party",
    time_sensitivity: "high",
    last_verified_at: exactChecked ? checkedAt : node.metadata.last_verified_at,
    next_review_at: node.metadata.next_review_at ?? null,
  };
  const sourceUrl = `https://www.amap.com/place/${poiId}`;
  if (!(node.sources ?? []).some((source) => source.url === sourceUrl)) {
    node.sources = [...(node.sources ?? []), { name: "高德地图POI快照", url: sourceUrl, scope: ["坐标", "POI ID", "地址快照"] }];
  }
  await writeFile(path, `${JSON.stringify(node, null, 2)}\n`, "utf8");
  updated += 1;
}

console.log(`Normalized ${updated} Nanchang restaurant nodes.`);
