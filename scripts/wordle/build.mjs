#!/usr/bin/env node
/**
 * build — generates the Wordle word lists (D27).
 *
 *   node scripts/wordle/build.mjs
 *
 * Inputs  (data/wordle/):
 *   source-cache/enable1.txt   ENABLE master word list (public domain;
 *                            fetched on demand, sha256-verified)
 *   answers-source.txt         hand-curated answer list (~800+ words, ours)
 *   guess-exclusions.txt       hand-written removals (slurs/crude terms)
 *   overrides.json             add/remove for answers and guesses; wins always
 *   review.json                owner review flag; status is printed to stdout
 *
 * Outputs (data/wordle/):
 *   valid-guesses.txt          every word the game accepts as a guess
 *   answers.txt                the daily-answer pool, alphabetical
 *   report.md                  counts per stage, rejected answers, exclusions
 *
 * Hard checks — any failure exits non-zero and writes nothing:
 *   every word is ^[a-z]{5}$; no duplicates; answers ⊆ guesses;
 *   answers >= 600; no exclusion-list word in either list.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../data/wordle");
const CACHE = join(DIR, "source-cache");
const ENABLE_URL =
  "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt";
const ENABLE_SHA256 =
  "3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89";
const MIN_ANSWERS = 600;
const FIVE = /^[a-z]{5}$/;

const fail = (msg) => {
  console.error(`build failed: ${msg}`);
  process.exit(1);
};

const review = JSON.parse(readFileSync(join(DIR, "review.json"), "utf8"));
console.log(
  `review status: ${review.reviewed ? "REVIEWED (hosted loads allowed)" : "NOT REVIEWED (hosted loads blocked)"}`,
);

const readLines = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#"));

// ── fetch + verify ENABLE ─────────────────────────────────────────────────
const cacheFile = join(CACHE, "enable1.txt");
mkdirSync(CACHE, { recursive: true });
if (!existsSync(cacheFile)) {
  console.log("fetching ENABLE master list...");
  const res = await fetch(ENABLE_URL);
  if (!res.ok) fail(`ENABLE fetch failed: HTTP ${res.status}`);
  writeFileSync(cacheFile, Buffer.from(await res.arrayBuffer()));
}
const raw = readFileSync(cacheFile);
const sha = createHash("sha256").update(raw).digest("hex");
if (sha !== ENABLE_SHA256) fail(`enable1.txt sha256 mismatch: got ${sha}`);

const counts = [];
const track = (label, set) => {
  counts.push([label, set.size]);
  return set;
};

// ── candidates ────────────────────────────────────────────────────────────
const enableAll = track(
  "ENABLE words (raw)",
  new Set(raw.toString("utf8").split("\n").map((w) => w.trim()).filter(Boolean)),
);
const enable5 = track(
  "ENABLE five-letter lowercase a–z",
  new Set([...enableAll].filter((w) => FIVE.test(w))),
);

const exclusions = new Set(readLines(join(DIR, "guess-exclusions.txt")));
track("guess-exclusions.txt entries", exclusions);

const overrides = JSON.parse(
  readFileSync(join(DIR, "overrides.json"), "utf8"),
);
for (const key of ["add_answers", "remove_answers", "add_guesses", "remove_guesses"])
  if (!Array.isArray(overrides[key])) fail(`overrides.${key} must be an array`);

const source = new Set(readLines(join(DIR, "answers-source.txt")));
track("answers-source.txt words", source);

// ── build lists ───────────────────────────────────────────────────────────
let guesses = new Set(enable5);
let answers = new Set(source);

const exclusionsApplied = { guesses: [], answers: [] };
for (const w of exclusions) {
  if (guesses.delete(w)) exclusionsApplied.guesses.push(w);
  if (answers.delete(w)) exclusionsApplied.answers.push(w);
}
track("guesses after exclusions", guesses);
track("answers after exclusions", answers);

for (const w of overrides.remove_guesses) guesses.delete(w);
for (const w of overrides.add_guesses) guesses.add(w);
for (const w of overrides.remove_answers) answers.delete(w);
for (const w of overrides.add_answers) answers.add(w);
track("guesses after overrides", guesses);
track("answers after overrides", answers);

// ── hard checks ───────────────────────────────────────────────────────────
for (const [name, list] of [["answers-source", source], ["overrides", new Set([...overrides.add_answers, ...overrides.add_guesses])]])
  for (const w of list) if (!FIVE.test(w)) fail(`${name}: "${w}" is not five lowercase a–z letters`);
for (const w of [...guesses, ...answers])
  if (!FIVE.test(w)) fail(`"${w}" is not five lowercase a–z letters`);

const notInEnable = [...answers].filter((w) => !enable5.has(w));
const notGuesses = [...answers].filter((w) => !guesses.has(w));
if (notInEnable.length)
  console.log(
    `note: ${notInEnable.length} answer(s) not in ENABLE (added via add_guesses or pending your call): ${notInEnable.join(", ")}`,
  );
if (notGuesses.length)
  fail(`answers missing from valid-guesses: ${notGuesses.join(", ")}`);
if (answers.size < MIN_ANSWERS)
  fail(`only ${answers.size} answers (minimum ${MIN_ANSWERS})`);
for (const w of exclusions) {
  if (guesses.has(w)) fail(`exclusion "${w}" still present in guesses`);
  if (answers.has(w)) fail(`exclusion "${w}" still present in answers`);
}

// ── write outputs ─────────────────────────────────────────────────────────
const sortedGuesses = [...guesses].sort();
const sortedAnswers = [...answers].sort();
writeFileSync(join(DIR, "valid-guesses.txt"), sortedGuesses.join("\n") + "\n");
writeFileSync(join(DIR, "answers.txt"), sortedAnswers.join("\n") + "\n");

const sample = sortedAnswers.filter((_, i) => i % Math.ceil(sortedAnswers.length / 100) === 0);
const md = `# Wordle word lists — build report

**Review status:** ${review.reviewed ? "REVIEWED" : "NOT REVIEWED — hosted loads are blocked until review.json is set to true"}

Generated: ${new Date().toISOString()}
ENABLE source: ${ENABLE_URL}
sha256: \`${sha}\`

## Counts per stage
${counts.map(([k, n]) => `| ${k} | ${n} |`).join("\n").replace(/^/, "| stage | count |\n|---|---|\n")}

## Guess exclusions
${exclusionsApplied.guesses.length} removed from guesses: ${exclusionsApplied.guesses.sort().join(", ") || "(none)"}
${exclusionsApplied.answers.length} removed from answers: ${exclusionsApplied.answers.sort().join(", ") || "(none)"}

## Answers not present in ENABLE
${notInEnable.length ? notInEnable.join(", ") + " — covered by overrides.add_guesses" : "none"}

## Sample of 100 answers (every Nth of the alphabetical list)
${sample.join(", ")}

## Final counts
- answers: ${answers.size}
- valid guesses: ${guesses.size}
`;
writeFileSync(join(DIR, "report.md"), md);

console.log(`wrote answers.txt (${answers.size}) + valid-guesses.txt (${guesses.size}) + report.md`);
