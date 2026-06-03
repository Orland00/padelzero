#!/usr/bin/env node

const targetUrl = process.env.STAGING_URL;

if (!targetUrl) {
  console.error("STAGING_URL is required.");
  process.exit(1);
}

let url;
try {
  url = new URL(targetUrl);
} catch {
  console.error("STAGING_URL must be a valid absolute URL.");
  process.exit(1);
}

const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

if (url.protocol !== "https:" && !(isLocalhost && url.protocol === "http:")) {
  console.error("STAGING_URL must use https, except localhost checks may use http.");
  process.exit(1);
}

async function fetchText(pathname) {
  const response = await fetch(new URL(pathname, url), {
    redirect: "follow",
    headers: {
      "user-agent": "padelzero-staging-smoke/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`);
  }

  return response.text();
}

try {
  const html = await fetchText("/");

  if (!html.includes('<div id="root"></div>')) {
    throw new Error("Root app container was not found.");
  }

  if (!html.includes("padelzero.win")) {
    throw new Error("Expected app title marker was not found.");
  }

  const manifest = await fetchText("/manifest.webmanifest");

  if (!manifest.includes('"short_name":"PADEL"')) {
    throw new Error("Expected manifest marker was not found.");
  }

  console.log("Staging URL smoke test passed.");
} catch (error) {
  console.error(`Staging URL smoke test failed: ${error.message}`);
  process.exit(1);
}
