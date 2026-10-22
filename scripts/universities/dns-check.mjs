#!/usr/bin/env node
/**
 * dns-check — optional MX/A record check for every domain in
 * universities.json. Writes data/universities/dns-report.json. Never fatal:
 * on DNS unavailability it reports and exits 0.
 *
 * Usage: node scripts/universities/dns-check.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns/promises";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../data/universities");
const data = JSON.parse(readFileSync(join(DIR, "universities.json"), "utf8"));
const inferred = JSON.parse(
  readFileSync(join(DIR, "inferred-candidates.json"), "utf8"),
);

const domains = [
  ...new Set(data.schools.flatMap((s) => s.email_domains)),
].sort();
const inferredDomains = [...new Set(inferred.candidates.map((c) => c.domain))];

const probe = async (d) => {
  try {
    const mx = await dns.resolveMx(d);
    if (mx.length) return { domain: d, mx: true };
  } catch {}
  try {
    await dns.resolve4(d);
    return { domain: d, mx: false, a: true };
  } catch {}
  return { domain: d, mx: false, a: false };
};

const runBatch = async (list) => {
  const results = [];
  const CONCURRENCY = 10;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      list.slice(i, i + CONCURRENCY).map(async (d) => {
        try {
          return await probe(d);
        } catch {
          dnsAvailable = false;
          return { domain: d, error: true };
        }
      }),
    );
    results.push(...batch);
  }
  return results;
};

let dnsAvailable = true;
const results = await runBatch(domains);

if (!dnsAvailable) {
  console.log("DNS unavailable — skipped gracefully");
  process.exit(0);
}

const noMx = results.filter((r) => !r.mx);
const report = {
  generated_at: new Date().toISOString(),
  checked: results.length,
  with_mx: results.filter((r) => r.mx).length,
  without_mx_or_a: results.filter((r) => !r.mx && !r.a),
  without_mx_but_a: results.filter((r) => !r.mx && r.a),
};
writeFileSync(join(DIR, "dns-report.json"), JSON.stringify(report, null, 1));
console.log(
  `${results.length} domains: ${report.with_mx} with MX, ` +
    `${report.without_mx_but_a.length} A-only, ` +
    `${report.without_mx_or_a.length} neither`,
);
for (const r of report.without_mx_or_a) console.log(`  no records: ${r.domain}`);

// ── inferred candidates (amendment 5): only .edu hosts with real records ──

const inf = await runBatch(inferredDomains);
const resolve = new Map(inf.map((r) => [r.domain, r.mx || r.a]));
const viable = inferred.candidates.filter((c) => resolve.get(c.domain));
const dead = inferred.candidates.filter((c) => !resolve.get(c.domain));

writeFileSync(
  join(DIR, "inferred-report.json"),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      candidates: inferred.candidates.length,
      viable: viable.length,
      no_dns_records: dead.length,
      approve_via:
        "overrides.json -> schools.<unitid>.add_domains = [domain]",
      candidates_detail: inferred.candidates.map((c) => ({
        ...c,
        resolves: !!resolve.get(c.domain),
      })),
    },
    null,
    1,
  ),
);
console.log(
  `\ninferred tier: ${inferred.candidates.length} .edu candidates — ` +
    `${viable.length} resolve (${dead.length} dead). Approve via overrides.`,
);
for (const c of viable.slice(0, 15))
  console.log(`  + ${c.domain}  ${c.name} (${c.enrollment.toLocaleString()})`);
