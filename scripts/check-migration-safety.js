import { execFileSync } from "node:child_process";
import fs from "node:fs";

const migrationPathPattern = /^supabase\/migrations\/.*\.sql$/;
const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fileAtHead(file) {
  try {
    return execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
  } catch {
    return null;
  }
}

function normalizeSqlForStructure(content) {
  return withoutSqlComments(content)
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\s+/g, " ")
    .trim();
}

function listCandidateFiles() {
  const files = new Set();

  if (baseRef) {
    try {
      git(["fetch", "--no-tags", "--depth=1", "origin", process.env.GITHUB_BASE_REF]);
      for (const file of git(["diff", "--name-only", `${baseRef}..HEAD`]).split("\n").filter(Boolean)) {
        files.add(file);
      }
    } catch {
      console.warn("Could not compare against base ref; falling back to local changed files.");
    }
  }

  if (files.size === 0) {
    for (const file of git(["diff", "--name-only", "HEAD"]).split("\n").filter(Boolean)) {
      files.add(file);
    }

    for (const file of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) {
      files.add(file);
    }
  }

  return [...files].filter((file) => {
    if (!migrationPathPattern.test(file) || !fs.existsSync(file)) {
      return false;
    }

    const previous = fileAtHead(file);
    if (previous === null) {
      return true;
    }

    return normalizeSqlForStructure(previous) !== normalizeSqlForStructure(fs.readFileSync(file, "utf8"));
  });
}

function withoutSqlComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function findRisks(file) {
  const sql = withoutSqlComments(fs.readFileSync(file, "utf8"));
  const statements = sql.split(";").map((statement) => statement.trim()).filter(Boolean);
  const risks = [];

  for (const statement of statements) {
    const compact = statement.replace(/\s+/g, " ");

    if (/\bdrop\s+(table|column|schema|function|policy|trigger|view|index|type)\b/i.test(compact)) {
      risks.push("DROP statement");
    }

    if (/\btruncate\b/i.test(compact)) {
      risks.push("TRUNCATE statement");
    }

    if (/\bdelete\s+from\b/i.test(compact) && !/\bwhere\b/i.test(compact)) {
      risks.push("DELETE without WHERE");
    }

    if (/\balter\s+table\b/i.test(compact) && /\bdrop\s+(column|constraint)\b/i.test(compact)) {
      risks.push("destructive ALTER TABLE");
    }

    if (/\b(disable|enable)\s+row\s+level\s+security\b/i.test(compact)) {
      risks.push("RLS state change");
    }

    if (/\b(create|alter|drop)\s+policy\b/i.test(compact)) {
      risks.push("policy change");
    }
  }

  return [...new Set(risks)];
}

const migrationFiles = listCandidateFiles();
const findings = migrationFiles.flatMap((file) => {
  return findRisks(file).map((risk) => ({ file, risk }));
});

if (findings.length > 0) {
  console.error("Migration safety gate failed. Risky SQL changes require verified backup and human approval:");
  for (const { file, risk } of findings) {
    console.error(`- ${file}: ${risk}`);
  }
  process.exit(1);
}

console.log(`Migration safety gate passed (${migrationFiles.length} changed migration file(s) checked).`);
