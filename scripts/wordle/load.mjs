#!/usr/bin/env node
/**
 * load — upserts data/wordle/{valid-guesses,answers}.txt into wordle_words.
 * Idempotent: rows upsert on word; rows not in the lists are deleted (local).
 *
 * LOCAL (default, no flags):
 *   node scripts/wordle/load.mjs
 *   Pipes INSERT ... ON CONFLICT into `docker exec` psql inside the Supabase
 *   container. Re-run after `supabase db reset`.
 *
 * HOSTED (explicit only, blocked until review.json.reviewed = true):
 *   node scripts/wordle/load.mjs --hosted --url https://<ref>.supabase.co
 *   Requires SUPABASE_SERVICE_ROLE_KEY in the environment. The key is read
 *   from the env var only — never a command-line argument, never printed.
 *
 * SAFETY: refuses non-local targets without --hosted.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../data/wordle");
const lines = (f) =>
  readFileSync(join(DIR, f), "utf8").split("\n").map((w) => w.trim()).filter(Boolean);

const guesses = lines("valid-guesses.txt");
const answerSet = new Set(lines("answers.txt"));
const rows = guesses.map((w) => ({ word: w, is_answer: answerSet.has(w) }));

const args = process.argv.slice(2);
const hosted = args.includes("--hosted");
const urlIdx = args.indexOf("--url");
const hostedUrl = urlIdx > -1 ? args[urlIdx + 1] : null;

const isLocal = (u) =>
  !u || /^(https?:\/\/)?(127\.0\.0\.1|localhost|\[::1\])/i.test(u);

if (!hosted) {
  if (hostedUrl && !isLocal(hostedUrl)) {
    console.error(
      "refusing: --url points at a non-local host and --hosted was not passed",
    );
    process.exit(1);
  }
} else {
  if (!hostedUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "--hosted needs --url https://<ref>.supabase.co AND SUPABASE_SERVICE_ROLE_KEY set (--env-file)",
    );
    process.exit(1);
  }
  const review = JSON.parse(readFileSync(join(DIR, "review.json"), "utf8"));
  if (review.reviewed !== true) {
    console.error(
      "refusing: data/wordle/review.json has reviewed=false — the owner must review answers.txt before hosted loads",
    );
    process.exit(1);
  }
}

// ── hosted: batched REST upserts ─────────────────────────────────────────

if (hosted) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await fetch(
      `${hostedUrl}/rest/v1/wordle_words?on_conflict=word`,
      {
        method: "POST",
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(rows.slice(i, i + CHUNK)),
      },
    );
    if (!res.ok)
      throw new Error(`batch ${i / CHUNK}: HTTP ${res.status} ${await res.text()}`);
    done += Math.min(CHUNK, rows.length - i);
    console.log(`  upserted ${done}/${rows.length}`);
  }
  console.log("hosted load complete");
  process.exit(0);
}

// ── local: docker exec psql ──────────────────────────────────────────────

const lit = (v) => `'${String(v).replaceAll("'", "''")}'`;
const CHUNK = 500;
const statements = [
  "begin",
  "create temp table _wordle_load (word text primary key, is_answer boolean)",
];
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows
    .slice(i, i + CHUNK)
    .map((r) => `(${lit(r.word)}, ${r.is_answer})`)
    .join(",\n");
  statements.push(`insert into _wordle_load values\n${batch}`);
}
statements.push(
  "insert into public.wordle_words (word, is_answer)\n" +
    "select word, is_answer from _wordle_load\n" +
    "on conflict (word) do update set is_answer = excluded.is_answer",
  "delete from public.wordle_words w where not exists\n" +
    "  (select 1 from _wordle_load l where l.word = w.word)",
  "commit",
);

const names = execFileSync(
  "docker",
  ["ps", "--format", "{{.Names}}", "--filter", "name=supabase_db"],
  { encoding: "utf8" },
).trim().split("\n").filter(Boolean);
const container =
  names.find((n) => n === "supabase_db_campus-wars-mobile") ??
  (names.length === 1 ? names[0] : null);
if (!container) {
  console.error(
    "no local supabase_db container found — run `supabase start` first",
  );
  process.exit(1);
}

execFileSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
   "-v", "ON_ERROR_STOP=1"],
  { input: statements.join(";\n") + ";\n", encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] },
);

const check = execFileSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
   "-tAc",
   "select count(*) filter (where is_answer), count(*) filter (where not is_answer), count(*) from public.wordle_words"],
  { encoding: "utf8" },
).trim();
const [answers, guessOnly, total] = check.split("|");
console.log(
  `loaded: ${total} words (${answers} answers, ${guessOnly} guess-only)`,
);
