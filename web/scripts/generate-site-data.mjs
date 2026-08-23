import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, "..");
const databaseRoot = resolve(webRoot, "..", "data");
const outputPath = join(webRoot, "app", "generated", "places.json");
const featuredIds = ["nc_jx_museum", "nc_tengwangge", "nc_bayi_memorial"];

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
  for (const ids of Object.values(node.child_nodes ?? {})) {
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      const child = nodes.get(id);
      if (child) result.push(child);
    }
  }
  return result;
}

const places = featuredIds.map((id, index) => {
  const node = nodes.get(id);
  if (!node) throw new Error(`Missing featured node: ${id}`);
  return { ...node, map_index: String(index + 1).padStart(2, "0"), children: referencedChildren(node) };
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(places, null, 2)}\n`, "utf8");
console.log(`Generated ${relative(webRoot, outputPath)} from ${places.length} featured places.`);
