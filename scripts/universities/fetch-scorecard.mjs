#!/usr/bin/env node
/**
 * fetch-scorecard — pages the College Scorecard schools endpoint and caches
 * every page under data/universities/raw/ (gitignored). Re-runnable: cached
 * pages are reused, so an interrupted run resumes.
 *
 * Key handling: the API key is read from SCORECARD_API_KEY (load with
 * `node --env-file=.env.local` or export it) and sent ONLY in the
 * `X-Api-Key` header — it is never placed in a URL, log, or file.
 *
 * Usage:
 *   node --env-file=.env.local scripts/universities/fetch-scorecard.mjs [--refresh]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAW = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/universities/raw",
);
const ALL = join(RAW, "scorecard-all.json");
const API_KEY = process.env.SCORECARD_API_KEY;
const refresh = process.argv.includes("--refresh");

if (!API_KEY) {
  console.error(
    "SCORECARD_API_KEY is not set — run with `node --env-file=.env.local` or export it.",
  );
  process.exit(1);
}
mkdirSync(RAW, { recursive: true });

const FIELDS = [
  "id",
  "school.name",
  "school.alias",
  "school.city",
  "school.state",
  "school.school_url",
  "school.operating",
  "school.degrees_awarded.predominant",
  "latest.student.size",
].join(",");

const params = (page) =>
  new URLSearchParams({
    "school.operating": "1",
    fields: FIELDS,
    per_page: "100",
    page: String(page),
  });
const url = (page) =>
  `https://api.data.gov/ed/collegescorecard/v1/schools?${params(page)}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPage(page) {
  for (let attempt = 0; attempt <= 4; attempt++) {
    const res = await fetch(url(page), {
      headers: { "X-Api-Key": API_KEY },
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      const wait = 2000 * 2 ** attempt;
      console.log(`  page ${page}: HTTP ${res.status}, retry in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    throw new Error(`page ${page}: HTTP ${res.status} ${await res.text()}`);
  }
  throw new Error(`page ${page}: gave up after retries`);
}

// figure out total pages first (page 0 is fetched/cached anyway)
const pages = [];
const fileFor = (p) => join(RAW, `scorecard-page-${p}.json`);

let total = 0;
let perPage = 100;
for (let p = 0; ; p++) {
  let body;
  const f = fileFor(p);
  if (!refresh && existsSync(f)) {
    body = JSON.parse(readFileSync(f, "utf8"));
  } else {
    body = await getPage(p);
    writeFileSync(f, JSON.stringify(body));
    await sleep(300); // be polite; api.data.gov default ~1000/hr
  }
  total = body.metadata.total;
  perPage = body.metadata.per_page;
  pages.push(...body.results);
  if ((p + 1) * perPage >= total || body.results.length === 0) break;
  if (p % 10 === 9) console.log(`  fetched through page ${p}…`);
}

writeFileSync(ALL, JSON.stringify(pages));
console.log(`fetched ${pages.length} schools (${total} reported), ` +
  `${Math.ceil(total / perPage)} pages, cached in ${RAW}`);

// filter decision input — build.mjs applies whichever is chosen
const byDeg = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, null: 0 };
for (const s of pages) {
  const d = s["school.degrees_awarded.predominant"];
  byDeg[d in byDeg ? d : "null"]++;
}
const sum = (ks) => ks.reduce((a, k) => a + byDeg[k], 0);
console.log(`
predominant-degree counts (operating schools):
  0 not classified : ${byDeg[0]}
  1 certificate    : ${byDeg[1]}
  2 associate      : ${byDeg[2]}
  3 bachelor's     : ${byDeg[3]}
  4 graduate       : ${byDeg[4]}
  (null/missing)   : ${byDeg.null}

filter options:
  predominant >= 1 (incl. certificate-only): ${sum([1, 2, 3, 4])}
  predominant >= 2 (associate+, proposed):   ${sum([2, 3, 4])}
  predominant >= 3 (bachelor's+):            ${sum([3, 4])}
`);
