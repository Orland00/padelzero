import { spawnSync } from "node:child_process";

const required = [
  "REQUIRE_HUMAN_APPROVAL",
  "REQUIRE_VERIFIED_BACKUP",
  "REQUIRE_STAGING_GREEN",
];

const missing = required.filter((name) => process.env[name] !== "true");

if (missing.length > 0) {
  console.error("Production preflight is blocked until these controls are explicitly true:");
  for (const name of missing) {
    console.error(`- ${name}=true`);
  }
  process.exit(1);
}

const result = spawnSync("node", ["scripts/staging-preflight.js"], { stdio: "inherit" });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Production preflight passed. No release action was performed.");
