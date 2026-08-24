import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataRoot = join(root, "data");
const cityIds = {
  "北京": "city_beijing",
  "上海": "city_shanghai",
  "珠海": "city_zhuhai",
  "南昌": "city_nanchang",
  "景德镇": "city_jingdezhen",
  "上饶": "city_shangrao",
};

const statusMap = {
  draft: ["draft", "unverified", "medium"],
  candidate: ["candidate", "unverified", "high"],
  experience_verified: ["complete", "experience_only", "medium"],
  third_party_verified: ["complete", "third_party", "high"],
  time_sensitive: ["complete", "mixed", "critical"],
  verified: ["complete", "official", "medium"],
  needs_update: ["needs_update", "mixed", "high"],
  archived: ["archived", "historical", "low"],
  planning_reference: ["complete", "mixed", "critical"],
};

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

for (const path of await filesUnder(dataRoot)) {
  const node = JSON.parse(await readFile(path, "utf8"));
  const oldMetadata = node.metadata ?? {};
  const [contentStatus, verificationLevel, timeSensitivity] = statusMap[oldMetadata.data_status] ?? ["draft", "unverified", "medium"];
  const recheckWindow = Array.isArray(node.holiday_reference?.recheck_window) ? node.holiday_reference.recheck_window : [];

  node.aliases = Array.isArray(node.aliases) ? node.aliases : [];
  node.category = Array.isArray(node.category) ? node.category : [];
  node.tags = Array.isArray(node.tags) ? node.tags : [];
  node.sources = Array.isArray(node.sources) ? node.sources : [];
  if (!node.city_id && cityIds[node.city]) node.city_id = cityIds[node.city];
  node.metadata = {
    schema_version: "2.0",
    content_status: contentStatus,
    verification_level: verificationLevel,
    time_sensitivity: timeSensitivity,
    last_verified_at: oldMetadata.last_verified_at ?? null,
    next_review_at: recheckWindow[0] ?? null,
    ...Object.fromEntries(Object.entries(oldMetadata).filter(([key]) => !["schema_version", "data_status", "last_verified_at"].includes(key))),
  };

  await writeFile(path, `${JSON.stringify(node, null, 2)}\n`, "utf8");
}

console.log("Migrated all travel nodes to Schema 2.0");
