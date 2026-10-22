#!/usr/bin/env node
/**
 * fetch-hipo — downloads the Hipo university-domains JSON, pins it
 * (SHA-256 + date + best-effort branch HEAD), filters to US schools, and
 * writes the small committed snapshot data/universities/hipo-us.json.
 *
 * No key needed. If the download fails (offline), place the file yourself at
 * data/universities/raw/world_universities_and_domains.json — it is reused.
 *
 * Usage: node scripts/universities/fetch-hipo.mjs [--refresh]
 */
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/universities",
);
const RAW = join(DIR, "raw");
const RAW_FILE = join(RAW, "world_universities_and_domains.json");
const OUT = join(DIR, "hipo-us.json");
const URL_MASTER =
  "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";

mkdirSync(RAW, { recursive: true });
const refresh = process.argv.includes("--refresh");

let sha = null;
if (!existsSync(RAW_FILE) || refresh) {
  let head = null;
  try {
    const r = await fetch(
      "https://api.github.com/repos/Hipo/university-domains-list/branches/master",
    );
    if (r.ok) head = (await r.json()).commit?.sha ?? null;
  } catch {}
  const url = head
    ? `https://raw.githubusercontent.com/Hipo/university-domains-list/${head}/world_universities_and_domains.json`
    : URL_MASTER;
  console.log(`downloading ${head ? `pinned ${head.slice(0, 8)}` : "master"}…`);
  const res = await fetch(url);
  if (!res.ok) {
    if (!existsSync(RAW_FILE)) {
      console.error(
        `download failed (HTTP ${res.status}) and no cached file. ` +
          `Place the file at ${RAW_FILE} yourself and re-run.`,
      );
      process.exit(1);
    }
    console.warn(`download failed (HTTP ${res.status}); using cached copy`);
  } else {
    writeFileSync(RAW_FILE, Buffer.from(await res.arrayBuffer()));
    sha = head;
  }
}

const buf = readFileSync(RAW_FILE);
const hash = createHash("sha256").update(buf).digest("hex");
const all = JSON.parse(buf.toString("utf8"));
const us = all.filter((s) => s.alpha_two_code === "US");

const meta = {
  source: "Hipo/university-domains-list",
  file: "world_universities_and_domains.json",
  url: URL_MASTER,
  commit_sha: sha ?? "unresolved (master fetch)",
  sha256: hash,
  fetched_or_cached_at: new Date().toISOString(),
  entries_total: all.length,
  entries_us: us.length,
};
writeFileSync(OUT, JSON.stringify({ _meta: meta, schools: us }, null, 1));
console.log(
  `hipo-us.json: ${us.length} US entries of ${all.length} total; sha256 ${hash.slice(0, 12)}…`,
);
