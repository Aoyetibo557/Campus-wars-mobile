#!/usr/bin/env node
/**
 * build — matches College Scorecard schools to the Hipo US snapshot, applies
 * overrides.json, emits the curated dataset + review report, and runs the
 * validation gates. Exits non-zero if validation fails.
 *
 * No network access — reads raw/scorecard-all.json and hipo-us.json.
 *
 * Usage: node scripts/universities/build.mjs [--predominant-min N]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../data/universities");
const scorecard = JSON.parse(
  readFileSync(join(DIR, "raw/scorecard-all.json"), "utf8"),
);
const hipo = JSON.parse(readFileSync(join(DIR, "hipo-us.json"), "utf8"));
const overrides = JSON.parse(readFileSync(join(DIR, "overrides.json"), "utf8"));

const argMin = process.argv.indexOf("--predominant-min");
const predominantMin =
  argMin > -1
    ? Number(process.argv[argMin + 1])
    : (overrides.predominant_min ?? 2);

// ── normalization ────────────────────────────────────────────────────────

/** url -> host: strip scheme, port, leading www., path, trailing dot */
const hostOf = (url) => {
  if (!url) return null;
  let h = String(url).toLowerCase().trim();
  h = h.replace(/^[a-z]+:\/\//, "").split("/")[0].split("?")[0];
  h = h.split(":")[0].replace(/^www\./, "").replace(/\.$/, "");
  return h || null;
};

/** all suffixes of a host, longest first ("a.b.edu" -> [a.b.edu, b.edu, edu]) */
const suffixes = (host) => {
  const parts = host.split(".");
  return parts.map((_, i) => parts.slice(i).join("."));
};
/** registrable candidate = last 2 labels (used for .edu hosts + inference) */
const registrable2 = (host) =>
  host && host.split(".").length > 2 ? host.split(".").slice(-2).join(".") : host;

const STOP = new Set([
  "the", "of", "at", "and", "for", "in", "on", "a", "an", "de", "la",
]);
const normName = (s) =>
  (s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ");

/** domains emitted for a matched entry: hipo `domains` ONLY (amendment 4 —
 *  web_pages are a matching surface, never emitted) */
const hipoDomains = (e) => [...(e.domains ?? [])];
/** everything we match against: domains[] + web_pages hosts */
const hipoMatchDomains = (e) => {
  const out = new Set(e.domains ?? []);
  for (const w of e.web_pages ?? []) {
    const d = hostOf(w);
    if (d) out.add(d);
  }
  return [...out];
};

// ── hipo indexes ─────────────────────────────────────────────────────────

const byDomain = new Map(); // matchable domain/web host -> [entry]
const bySuffix = new Map(); // proper suffix of any hipo domain -> [entry]
const byName = new Map(); // normName -> [entry]
for (const e of hipo.schools) {
  for (const d of hipoMatchDomains(e)) {
    (byDomain.get(d) ?? byDomain.set(d, []).get(d)).push(e);
    for (const suf of suffixes(d).slice(1))
      (bySuffix.get(suf) ?? bySuffix.set(suf, []).get(suf)).push(e);
  }
  const n = normName(e.name);
  (byName.get(n) ?? byName.set(n, []).get(n)).push(e);
}

// ── short_name (D8): scorecard alias, else generated acronym, else null ──

const aliasName = (alias) => {
  const first = (alias ?? "").split(",")[0]?.trim();
  return first && first.length <= 6 && /^[a-z0-9.'&-]+$/i.test(first)
    ? first.toUpperCase()
    : null;
};
const acronym = (name) => {
  const words = (name ?? "")
    .split(/\s+/)
    .filter((w) => /^[a-z]/i.test(w) && !STOP.has(w.toLowerCase()));
  const ac = words.map((w) => w[0]).join("").slice(0, 5).toUpperCase();
  return ac.length >= 2 ? ac : null;
};

// ── match ────────────────────────────────────────────────────────────────

const excludedIds = new Set((overrides.exclude ?? []).map(String));
const perSchool = overrides.schools ?? {};

const out = [];
const ambiguous = [];
const unmatched = [];
const inferred = []; // unmatched schools with a .edu website — DNS-gated, never auto-listed (amendment 5)

for (const s of scorecard) {
  const deg = s["school.degrees_awarded.predominant"];
  if (deg == null || deg < predominantMin) continue; // filter decision

  const unitId = s.id;
  const o = perSchool[String(unitId)] ?? {};
  if (excludedIds.has(String(unitId))) continue;

  const urlHost = hostOf(s["school.school_url"]);
  let matchType = null;
  let domains = [];

  // domain match (amendment 3): dot-boundary suffix in BOTH directions —
  //   host ends with ".d"  (admissions.virginia.edu -> virginia.edu)
  //   d ends with ".host"  (cmu.edu host pulls hipo's andrew.cmu.edu entry)
  // The longest host suffix hits first (closest registrable match wins).
  if (urlHost) {
    const entries = new Set(bySuffix.get(urlHost) ?? []);
    for (const suf of suffixes(urlHost)) {
      const hits = byDomain.get(suf);
      if (hits?.length) {
        hits.forEach((h) => entries.add(h));
        break; // closest match wins
      }
    }
    if (entries.size) {
      domains = [...new Set([...entries].flatMap((h) => hipoDomains(h)))];
      matchType = "domain";
    }
  }

  // name fallback
  let nameCands = [];
  if (!domains.length) {
    nameCands = byName.get(normName(s["school.name"])) ?? [];
    if (nameCands.length === 1) {
      domains = hipoDomains(nameCands[0]);
      matchType = "name";
    }
  }

  const globalRemove = new Set(overrides.remove_domains ?? []);
  domains = domains.filter((d) => !globalRemove.has(d));
  if (o.remove_domains)
    domains = domains.filter((d) => !o.remove_domains.includes(d));
  if (o.add_domains) domains.push(...o.add_domains);
  domains = [...new Set(domains)];

  let shortName = o.short_name ?? aliasName(s["school.alias"]);
  let shortSource = o.short_name ? "override" : shortName ? "alias" : null;
  if (!shortName) {
    shortName = acronym(s["school.name"]);
    shortSource = shortName ? "generated" : null;
  }

  const row = {
    scorecard_unit_id: unitId,
    name: s["school.name"],
    short_name: shortName,
    short_name_source: shortSource,
    city: s["school.city"],
    state: s["school.state"],
    country: "US",
    website: urlHost ? `https://${urlHost}` : null,
    email_domains: domains,
    listed: domains.length > 0,
    enrollment: s["latest.student.size"] ?? 0,
    match: matchType,
    hipo_name: nameCands.length === 1 ? nameCands[0].name : null,
  };

  if (!matchType) {
    (nameCands.length > 1 ? ambiguous : unmatched).push({
      ...row,
      cands: nameCands.map((c) => `${c.name} (${hipoDomains(c).join(",")})`),
    });
    // inferred tier: school's own .edu website domain is a candidate email
    // domain — listed only after DNS check + human decision (amendment 5)
    if (!domains.length && urlHost?.endsWith(".edu")) {
      inferred.push({
        scorecard_unit_id: unitId,
        name: s["school.name"],
        state: s["school.state"],
        enrollment: s["latest.student.size"] ?? 0,
        domain: registrable2(urlHost),
      });
    }
  }
  out.push(row);
}

// ── generated short_name uniqueness (amendment 6) ────────────────────────
// A generated acronym must be unique across the whole dataset AND must not
// collide with an alias/override name — otherwise null it.

const fixed = new Set(
  out.filter((s) => s.short_name_source !== "generated" && s.short_name)
    .map((s) => s.short_name),
);
const genCount = new Map();
for (const s of out)
  if (s.short_name_source === "generated")
    genCount.set(s.short_name, (genCount.get(s.short_name) ?? 0) + 1);
for (const s of out)
  if (
    s.short_name_source === "generated" &&
    (genCount.get(s.short_name) > 1 || fixed.has(s.short_name))
  ) {
    s.short_name = null;
    s.short_name_source = null;
  }

inferred.sort((a, b) => b.enrollment - a.enrollment);
writeFileSync(
  join(DIR, "inferred-candidates.json"),
  JSON.stringify(
    {
      _meta: "Unmatched schools with .edu websites — run dns-check.mjs, then approve via overrides.json add_domains",
      count: inferred.length,
      candidates: inferred,
    },
    null,
    1,
  ),
);

out.sort((a, b) => b.enrollment - a.enrollment);
ambiguous.sort((a, b) => b.enrollment - a.enrollment);
unmatched.sort((a, b) => b.enrollment - a.enrollment);

// ── dataset ──────────────────────────────────────────────────────────────

const meta = {
  generated_at: new Date().toISOString(),
  predominant_min: predominantMin,
  inputs: {
    scorecard_schools: scorecard.length,
    hipo_us_entries: hipo.schools.length,
    hipo_pin: hipo._meta,
  },
  counts: {
    filtered_out_degree: scorecard.length - out.length - excludedIds.size,
    excluded_by_override: excludedIds.size,
    matched: out.filter((r) => r.match).length,
    ambiguous: ambiguous.length,
    unmatched: unmatched.length,
    listed: out.filter((r) => r.listed).length,
    total_emitted: out.length,
  },
};

const dataset = { _meta: meta, schools: out };
writeFileSync(join(DIR, "universities.json"), JSON.stringify(dataset, null, 1));

// ── report ───────────────────────────────────────────────────────────────

const fmt = (s) =>
  `| ${s.name} | ${s.enrollment.toLocaleString()} | ${s.state ?? ""} | ${s.email_domains.join(", ") || "—"} | ${s.hipo_name ?? ""} |`;

const nonEdu = out.flatMap((s) =>
  s.email_domains.filter((d) => !d.endsWith(".edu")).map((d) => `${d} (${s.name})`),
);
const generated = out.filter((s) => s.short_name_source === "generated");
const spotNames = [
  "university of virginia", "virginia polytechnic institute state university",
  "carnegie mellon university", "massachusetts institute technology",
  "pennsylvania state university", "university michigan ann arbor",
  "ohio state university", "georgia institute technology",
  "university texas austin", "duke university", "stanford university",
  "harvard university", "cornell university", "new york university",
  "university southern california", "purdue university",
  "rutgers university new brunswick", "university maryland college park",
  "united states military academy", "northern virginia community college",
];
const norm = (s) => normName(s).replace(/\s+(main campus|ann arbor|college park|new brunswick)$/, "");
const spot = spotNames.map((want) => {
  const hit = out.find((s) => norm(s.name).includes(want) || want.includes(norm(s.name)));
  return `| ${want} | ${hit ? hit.name : "NOT FOUND"} | ${hit ? hit.email_domains.join(", ") || "— (unlisted)" : "—"} |`;
});

const report = `# Universities dataset review — ${meta.generated_at}

## Counts

| stage | n |
|---|---|
| scorecard fetched (operating) | ${meta.inputs.scorecard_schools} |
| filtered out (predominant < ${predominantMin}) | ${meta.counts.filtered_out_degree} |
| excluded by override | ${meta.counts.excluded_by_override} |
| matched (domain/name) | ${meta.counts.matched} |
| ambiguous | ${meta.counts.ambiguous} |
| unmatched | ${meta.counts.unmatched} |
| emitted (listed) | ${meta.counts.listed} |
| emitted total | ${meta.counts.total_emitted} |

## short_name coverage

- alias: ${out.filter((s) => s.short_name_source === "alias").length}
- override: ${out.filter((s) => s.short_name_source === "override").length}
- generated (review these): ${generated.length}
- none (app should show truncated full name): ${out.filter((s) => !s.short_name).length}

## non-.edu domains (${nonEdu.length})

${nonEdu.length ? nonEdu.map((d) => `- ${d}`).join("\n") : "none"}

## Inferred candidates (awaiting decision — amendment 5)

${inferred.length} unmatched schools have .edu websites. After
\`dns-check.mjs\`, approve any via \`overrides.json\` \`add_domains\`.
See \`inferred-candidates.json\` + \`inferred-report.json\`.

| name | enrollment | state | candidate domain |
|---|---|---|---|
${inferred.slice(0, 40).map((s) => `| ${s.name} | ${s.enrollment.toLocaleString()} | ${s.state ?? ""} | ${s.domain} |`).join("\n") || "| — | | |"}

## Shared domains — campuses/systems (largest groups first)

${(() => {
  const groups = new Map();
  for (const s of out)
    for (const d of s.email_domains)
      (groups.get(d) ?? groups.set(d, []).get(d)).push(s);
  const rows = [...groups.entries()]
    .filter(([, ss]) => ss.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 40)
    .map(
      ([d, ss]) =>
        `| ${d} | ${ss.length} | ${ss.map((x) => `${x.name} (${x.enrollment.toLocaleString()})`).join("; ")} |`,
    );
  return `| domain | schools | members (enrollment) |\n|---|---|---|\n${rows.join("\n") || "| — | |"}`;
})()}

## Ambiguous (largest first) — resolve via overrides.json

| name | enrollment | state | candidates |
|---|---|---|---|
${ambiguous.slice(0, 60).map((s) => `| ${s.name} | ${s.enrollment.toLocaleString()} | ${s.state ?? ""} | ${s.cands.join("; ")} |`).join("\n") || "| — | | |"}

## Unmatched (largest first)

| name | enrollment | state | hipo domains | hipo name |
|---|---|---|---|---|
${unmatched.slice(0, 60).map(fmt).join("\n") || "| — | | | |"}

## Spot check (20 well-known schools)

| lookup | matched name | domains |
|---|---|---|
${spot.join("\n")}
`;
writeFileSync(join(DIR, "report.md"), report);

// ── validation gates ─────────────────────────────────────────────────────

const { violations, warnings } = validate(out, overrides);
for (const w of warnings) console.warn(`WARN ${w}`);
console.log(
  `\nmatched ${meta.counts.matched} / ambiguous ${ambiguous.length} / ` +
    `unmatched ${unmatched.length} / listed ${meta.counts.listed} / ` +
    `emitted ${out.length}`,
);
console.log(`short_name: ${generated.length} generated (see report), ` +
  `${out.filter((s) => !s.short_name).length} none`);
if (violations.length) {
  for (const v of violations) console.error(`FAIL ${v}`);
  process.exit(1);
}
console.log("validation gates passed");
