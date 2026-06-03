import fs from "node:fs";

const templatePath = ".env.tpl";
const examplePath = ".env.example";

const allowedSafeTplPlaceholders = new Map([
  ["VITE_RELEASE_SHA", ""],
]);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${filePath} is required for env template validation.`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const entries = new Map();

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      throw new Error(`${filePath}:${index + 1} is not a KEY=value line.`);
    }

    entries.set(match[1], match[2].trim());
  }

  return entries;
}

function unquote(value) {
  return value.replace(/^["']|["']$/g, "");
}

const tpl = parseEnvFile(templatePath);
const example = parseEnvFile(examplePath);

const tplKeys = new Set(tpl.keys());
const exampleKeys = new Set(example.keys());
const errors = [];

for (const key of tplKeys) {
  if (!exampleKeys.has(key)) {
    errors.push(`${examplePath} is missing ${key}.`);
  }
}

for (const key of exampleKeys) {
  if (!tplKeys.has(key)) {
    errors.push(`${examplePath} has ${key}, but ${templatePath} does not.`);
  }
}

for (const [key, value] of tpl.entries()) {
  const normalized = unquote(value);

  const allowedPlaceholder = allowedSafeTplPlaceholders.get(key);

  if (!normalized.startsWith("op://") && normalized !== allowedPlaceholder) {
    errors.push(`${templatePath} value for ${key} must be an op:// reference or documented safe placeholder.`);
  }
}

for (const [key, value] of example.entries()) {
  const normalized = unquote(value);

  if (normalized.startsWith("op://")) {
    errors.push(`${examplePath} must not contain op:// references (${key}).`);
  }
}

if (errors.length > 0) {
  console.error("Env template validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Env template validation passed.");
