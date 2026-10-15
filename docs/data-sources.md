# Data sources — universities dataset (D24)

Build-time only. External APIs are **never** called at runtime — the app reads
`universities` from the database, which is loaded from the committed curated
dataset.

## Sources

### 1. College Scorecard (US Dept. of Education)

- **Endpoint:** `GET https://api.data.gov/ed/collegescorecard/v1/schools`
- **Auth:** free api.data.gov key in `SCORECARD_API_KEY`, sent in the
  `X-Api-Key` header (verified 200 on 2026-10-14). Never in URLs/logs.
- **Fields used:** `id` (UNITID), `school.name`, `school.alias`,
  `school.city`, `school.state`, `school.school_url`, `school.operating`,
  `school.degrees_awarded.predominant`, `latest.student.size`
- **Filter:** `school.operating=1` + `predominant >= overrides.predominant_min`
  (default 2 = associate and above; counts for alternatives are printed by
  the fetch step)
- **Terms/license:** US Government work — data published by the Department
  of Education; treated as public-domain government data. The api.data.gov
  terms apply to API access (rate limits, attribution). Exact license text
  was not re-verified page-by-page on this date — the API docs site is a
  client-rendered app; the key signup flow and api.data.gov docs describe
  public government datasets.
- **Snapshot:** raw pages cached (gitignored) under
  `data/universities/raw/scorecard-page-*.json`.

### 2. Hipo University Domains and Names list

- **File:** `world_universities_and_domains.json` in
  `Hipo/university-domains-list` (GitHub), raw file — not the hosted API.
- **URL:** `https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json`
- **Pin:** see `_meta` in `data/universities/hipo-us.json` — SHA-256 of the
  file used, fetch/cache date, and the branch HEAD commit when resolvable.
- **License:** the repository carries an MIT license. Verified from the repo
  license file on the fetch date.
- **Use:** `alpha_two_code === "US"` subset → `data/universities/hipo-us.json`
  (committed, small).

## Layout

```
scripts/universities/    fetch-scorecard, fetch-hipo, build, validate, dns-check, load
data/universities/
  raw/                   gitignored downloads + page cache
  hipo-us.json           committed US snapshot (with pin metadata)
  overrides.json         hand edits; always wins
  universities.json      committed curated dataset
  report.md              committed review report
  dns-report.json        committed, optional
```

## Refresh (annually, or after schema/decision changes)

```bash
# 1. refetch scorecard pages (uses cache; add --refresh to force)
node --env-file=.env.local scripts/universities/fetch-scorecard.mjs

# 2. refetch hipo (add --refresh to force; else reuses raw/ cache)
node scripts/universities/fetch-hipo.mjs

# 3. review/edit data/universities/overrides.json, then rebuild
node scripts/universities/build.mjs          # runs validation gates

# 4. optional: MX/A record check (also probes inferred candidates)
node scripts/universities/dns-check.mjs

# 5. load into the local database (idempotent upsert)
node scripts/universities/load.mjs
```

Local reset workflow: `supabase db reset && node scripts/universities/load.mjs`.

### Loader mechanics

- **Local (default):** chunked `INSERT ... ON CONFLICT (scorecard_unit_id)`
  piped via `docker exec -i <supabase_db container> psql -U postgres` — no
  host `psql` needed, no credentials.
- **Hosted:** `node scripts/universities/load.mjs --hosted --url
  https://<ref>.supabase.co` with `SUPABASE_SERVICE_ROLE_KEY` in the env —
  batched REST upserts (500/request), key read from env only.
- The loader **refuses any non-local target without `--hosted`**.

## Matching rules

- Scorecard `school_url` host → dot-boundary suffix matching against every
  Hipo domain **in both directions** (`admissions.virginia.edu`→`virginia.edu`,
  and `cmu.edu` pulls Hipo's `andrew.cmu.edu` entry); registrable = last two
  labels for `.edu` hosts. Matching surface = Hipo `domains[]` + `web_pages`.
- **Emitted `email_domains` come ONLY from Hipo `domains[]` + overrides** —
  website/`web_pages` domains never become email domains automatically.
- Fallback: normalized name equality → matched / ambiguous / unmatched.
- **Inferred tier (not auto-listed):** unmatched schools whose website is a
  `.edu` host land in `inferred-candidates.json`; `dns-check.mjs` verifies
  MX/A records; approval = manual `add_domains` in overrides.
- `overrides.json` wins over everything: `exclude`, global `remove_domains`
  (typos like `aloma.edu`), per-school `add_domains`/`remove_domains`/
  `short_name`/`allow_non_edu`, global `allowed_non_edu_domains`.
- `short_name`: Scorecard `alias` → generated acronym → null. Generated
  acronyms must be unique across the dataset; collisions become null.
- Ambiguous, unmatched, inferred, and shared-domain groups are all in
  `report.md`, largest enrollment first.

## Hard gates (validate.mjs — fails the build)

- Every domain passes the `email_domains_valid` parity check (lowercase,
  trimmed, no `@`/whitespace, no leading/trailing dot, non-empty).
- No free-mail providers (21-domain list) or bare public suffixes.
- Non-`.edu` domains must be explicitly allow-listed in overrides.
- Listed schools must have ≥1 domain.
- Shared domains are reported as warnings.
