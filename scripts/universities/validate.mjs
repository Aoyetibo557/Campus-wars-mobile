#!/usr/bin/env node
/**
 * validate — sanity gates on the curated dataset. Exits non-zero on any
 * violation, so it can fail a build step. Runs standalone or via build.mjs.
 *
 * Gates (spec §7):
 *  - every domain satisfies the DB CHECK email_domains_valid parity
 *  - no free-mail-provider or bare public-suffix domains
 *  - every non-.edu domain is allow-listed in overrides.json
 *  - every listed school has >= 1 domain
 *  - shared domains are reported (warning, not fatal)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "ymail.com", "aol.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "gmx.com", "mail.com",
  "zoho.com", "yandex.com", "qq.com", "163.com",
]);

const BARE_SUFFIXES = new Set([
  "edu", "com", "org", "net", "gov", "io", "co", "us", "info", "edu.us",
]);

// parity with public.email_domains_valid (migration 20261014212218)
export const domainValid = (d) =>
  d !== "" &&
  d === d.trim().toLowerCase() &&
  !/[@\s]/.test(d) &&
  !d.startsWith(".") &&
  !d.endsWith(".");

export function validate(schools, overrides) {
  const allowedNonEdu = new Set(
    [
      ...(overrides.allowed_non_edu_domains ?? []),
      ...Object.values(overrides.schools ?? {}).flatMap(
        (s) => s.allow_non_edu ?? [],
      ),
    ].map((d) => d.toLowerCase()),
  );

  const violations = [];
  const warnings = [];
  const owner = new Map(); // domain -> [unit ids]

  for (const s of schools) {
    for (const d of s.email_domains) {
      if (!domainValid(d))
        violations.push(`${s.scorecard_unit_id} ${s.name}: invalid domain "${d}"`);
      if (FREE_MAIL.has(d))
        violations.push(`${s.scorecard_unit_id} ${s.name}: free-mail domain "${d}"`);
      if (BARE_SUFFIXES.has(d) || !d.includes("."))
        violations.push(`${s.scorecard_unit_id} ${s.name}: bare/suffix domain "${d}"`);
      if (!d.endsWith(".edu") && !allowedNonEdu.has(d))
        violations.push(
          `${s.scorecard_unit_id} ${s.name}: non-.edu domain "${d}" not in overrides allow-list`,
        );
      (owner.get(d) ?? owner.set(d, []).get(d)).push(s.scorecard_unit_id);
    }
    if (s.listed && s.email_domains.length === 0)
      violations.push(`${s.scorecard_unit_id} ${s.name}: listed with zero domains`);
  }
  for (const [d, ids] of owner)
    if (ids.length > 1)
      warnings.push(`domain "${d}" shared by ${ids.length} schools: ${ids.join(", ")}`);

  return { violations, warnings };
}

// standalone
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const DIR = join(dirname(process.argv[1]), "../../data/universities");
  const data = JSON.parse(readFileSync(join(DIR, "universities.json"), "utf8"));
  const overrides = JSON.parse(
    readFileSync(join(DIR, "overrides.json"), "utf8"),
  );
  const { violations, warnings } = validate(data.schools, overrides);
  for (const w of warnings) console.warn(`WARN ${w}`);
  for (const v of violations) console.error(`FAIL ${v}`);
  console.log(`${violations.length} violations, ${warnings.length} warnings`);
  process.exit(violations.length ? 1 : 0);
}
