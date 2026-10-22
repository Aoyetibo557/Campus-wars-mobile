#!/usr/bin/env node
/**
 * load — imports data/universities/universities.json into a database.
 * Idempotent: rows upsert on scorecard_unit_id.
 *
 * LOCAL (default, no flags):
 *   node scripts/universities/load.mjs
 *   Pipes chunked INSERT ... ON CONFLICT into `docker exec` psql inside the
 *   Supabase container — no host psql install and no credentials needed.
 *   Re-run after `supabase db reset`.
 *
 * HOSTED (explicit only):
 *   node scripts/universities/load.mjs --hosted \
 *     --url https://<ref>.supabase.co
 *   with SUPABASE_SERVICE_ROLE_KEY in the environment (--env-file).
 *   Uses batched REST upserts (500 rows/request) — the service-role key is
 *   read from the env var only, never written anywhere.
 *
 * SAFETY: refuses non-local targets without --hosted.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../data/universities");
const data = JSON.parse(readFileSync(join(DIR, "universities.json"), "utf8"));

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
} else if (!hostedUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "--hosted needs --url https://<ref>.supabase.co AND SUPABASE_SERVICE_ROLE_KEY set (--env-file)",
  );
  process.exit(1);
}

const rows = data.schools.map((s) => ({
  name: s.name,
  short_name: s.short_name,
  state: s.state,
  country: "US",
  website: s.website,
  scorecard_unit_id: s.scorecard_unit_id,
  email_domains: s.email_domains,
}));

// ── hosted: batched REST upserts ─────────────────────────────────────────

if (hosted) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await fetch(
      `${hostedUrl}/rest/v1/universities?on_conflict=scorecard_unit_id`,
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

const lit = (v) => (v == null ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const arrLit = (a) =>
  a.length
    ? `'{${a.map((d) => `"${d}"`).join(",")}}'::text[]`
    : `array[]::text[]`;

const row = (s) =>
  `(${lit(s.name)}, ${lit(s.short_name)}, ${lit(s.state)}, 'US', ` +
  `${lit(s.website)}, ${s.scorecard_unit_id}, ${arrLit(s.email_domains)})`;

const CHUNK = 500;
const statements = [];
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows.slice(i, i + CHUNK).map(row).join(",\n");
  statements.push(
    `insert into public.universities\n` +
      `  (name, short_name, state, country, website, scorecard_unit_id, email_domains)\n` +
      `values\n${batch}\n` +
      `on conflict (scorecard_unit_id) do update set\n` +
      `  name = excluded.name,\n  short_name = excluded.short_name,\n` +
      `  state = excluded.state,\n  website = excluded.website,\n` +
      `  email_domains = excluded.email_domains;`,
  );
}

// find the db container for this project (name ends with _campus-wars-mobile
// or is the only supabase_db_* container)
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
  { input: statements.join("\n\n"), encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] },
);

const check = execFileSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
   "-tAc",
   `select count(*) filter (where cardinality(email_domains) > 0), ` +
     `count(*) filter (where cardinality(email_domains) = 0), count(*) ` +
     `from public.universities`],
  { encoding: "utf8" },
).trim();
const [listed, unlisted, total] = check.split("|");
console.log(
  `loaded: ${total} universities (${listed} listed, ${unlisted} unlisted)`,
);
