import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  VITE_SUPABASE_URL:
    process.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY:
    process.env.VITE_SUPABASE_ANON_KEY || "ci-test-anon-key",
  VITE_VAPID_PUBLIC_KEY:
    process.env.VITE_VAPID_PUBLIC_KEY || "ci-test-vapid-public-key",
};

const checks = [
  ["npm", ["run", "security:ci"]],
  ["node", ["scripts/check-backup-restore-runbooks.js"]],
  ["node", ["scripts/check-migration-safety.js"]],
  ["npm", ["test"]],
  ["npm", ["run", "build"]],
];

for (const [command, args] of checks) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Staging preflight passed. No release action was performed.");
