import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const candidates = [
  process.env.PYTHON,
  "python",
  "py",
  process.env.USERPROFILE ? join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe") : null,
].filter(Boolean);

for (const command of candidates) {
  const args = command === "py" ? ["-3", resolve(root, "scripts", "validate_json.py")] : [resolve(root, "scripts", "validate_json.py")];
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (!result.error) process.exit(result.status ?? 1);
}

console.error("Python 3 was not found; Schema 2.0 validation could not run.");
process.exit(1);
