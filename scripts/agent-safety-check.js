import fs from "node:fs";
import path from "node:path";

const requiredPolicyPath = "AGENTS.md";
const requiredPolicyTerms = [
  "op run",
  "op inject",
  "op item get",
  "op read",
  "printenv",
  "deployment commands",
  "credential rotation commands",
];

const scanRoots = [".github/workflows", "scripts"];
const forbiddenExecutablePatterns = [
  { label: "1Password value read", pattern: /\bop\s+(read|item\s+get)\b/ },
  { label: "1Password injection", pattern: /\bop\s+(run|inject)\b/ },
  { label: "environment dump", pattern: /(^|[;&|]\s*)(env|printenv)(\s|$)/ },
  { label: "production deploy", pattern: /\b(deploy|wrangler\s+deploy|supabase\s+db\s+push|supabase\s+functions\s+deploy)\b/i },
  { label: "credential rotation", pattern: /\b(rotate|rotation)\b.*\b(secret|credential|token|key)\b/i },
];

const allowedExecutablePatterns = [
  {
    file: ".github/workflows/staging-publish.yml",
    label: "production deploy",
    pattern:
      /^\s*run: npx --yes wrangler pages deploy dist --project-name "\$CLOUDFLARE_PAGES_PROJECT_NAME" --branch "\$CLOUDFLARE_PAGES_BRANCH"\s*$/,
  },
];

function listFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const stat = fs.statSync(root);
  if (stat.isFile()) {
    return [root];
  }

  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", ".git"].includes(entry.name)) {
        return [];
      }

      return listFiles(fullPath);
    }

    return entry.isFile() ? [fullPath] : [];
  });
}

const errors = [];

if (!fs.existsSync(requiredPolicyPath)) {
  errors.push(`${requiredPolicyPath} is required for agent safety policy.`);
} else {
  const policy = fs.readFileSync(requiredPolicyPath, "utf8");

  for (const term of requiredPolicyTerms) {
    if (!policy.includes(term)) {
      errors.push(`${requiredPolicyPath} must mention forbidden term: ${term}`);
    }
  }
}

const executableFiles = [
  "package.json",
  ...scanRoots.flatMap(listFiles),
].filter((file, index, files) => files.indexOf(file) === index)
  .filter((file) => file !== "scripts/agent-safety-check.js");

for (const file of executableFiles) {
  const content = fs.readFileSync(file, "utf8");

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const { label, pattern } of forbiddenExecutablePatterns) {
      if (pattern.test(line)) {
        const allowed = allowedExecutablePatterns.some((allow) =>
          allow.file === file && allow.label === label && allow.pattern.test(line)
        );

        if (allowed) {
          continue;
        }

        errors.push(`${file}:${index + 1} contains forbidden executable pattern (${label}).`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Agent safety check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Agent safety check passed.");
