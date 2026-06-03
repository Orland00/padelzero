import { execFileSync } from "node:child_process";
import path from "node:path";

const allowed = new Set([".env.example", ".env.tpl"]);
const blockedBasenames = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
  ".env.test",
]);

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const violations = trackedFiles.filter((file) => {
  const basename = path.basename(file);

  if (allowed.has(file) || allowed.has(basename)) {
    return false;
  }

  if (blockedBasenames.has(basename)) {
    return true;
  }

  if (basename.startsWith(".env.")) {
    return true;
  }

  return basename.endsWith(".env");
});

if (violations.length > 0) {
  console.error("Committed env files are blocked. Move real env files out of Git:");
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Committed env file check passed.");
