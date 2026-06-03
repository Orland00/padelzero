import fs from "node:fs";

const runbookPath = "SECURITY_RUNBOOK.md";
const requiredTerms = [
  "backup",
  "restore",
  "verified backup",
  "manual approval",
  "staging",
  "production",
  "rollback",
];

if (!fs.existsSync(runbookPath)) {
  console.error(`${runbookPath} is required before staging or production gates can run.`);
  process.exit(1);
}

const runbook = fs.readFileSync(runbookPath, "utf8").toLowerCase();
const missing = requiredTerms.filter((term) => !runbook.includes(term));

if (missing.length > 0) {
  console.error("Backup/restore runbook gate failed. Missing required runbook terms:");
  for (const term of missing) {
    console.error(`- ${term}`);
  }
  process.exit(1);
}

console.log("Backup/restore runbook gate passed.");
