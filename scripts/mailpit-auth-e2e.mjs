#!/usr/bin/env node
/**
 * mailpit-auth-e2e — end-to-end auth flow check against the LOCAL Supabase
 * stack, including the D23 Before User Created hook (school-domain
 * verification) and the mailbox registry (one account per mailbox at
 * confirmation time).
 *
 * Secret-free: the anon key comes from `supabase status -o env` (or
 * SUPABASE_ANON_KEY if set). Safe to run any time; uses a unique
 * @virginia.edu address per run. Requires `supabase start`.
 *
 * Usage: node scripts/mailpit-auth-e2e.mjs
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(new URL("../mobile/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const API = "http://127.0.0.1:54321";
const MAILPIT = "http://127.0.0.1:54324";
const DOMAIN = "virginia.edu"; // seeded listed school (seed.sql)

const results = [];
const check = (name, ok, extra = "") => {
  results.push([name, ok]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
};

function anonKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  const out = execSync("supabase status -o env", { encoding: "utf8" });
  const line = out
    .split("\n")
    .find((l) => /^(ANON_KEY|PUBLISHABLE_KEY)=/.test(l));
  if (!line) throw new Error("no ANON_KEY/PUBLISHABLE_KEY in `supabase status`");
  return line.split("=")[1].trim().replace(/^"|"$/g, "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function latestCodeFor(email, sinceIds = new Set()) {
  const res = await fetch(`${MAILPIT}/api/v1/messages?limit=10`);
  const { messages } = await res.json();
  for (const m of messages ?? []) {
    if (sinceIds.has(m.ID)) continue;
    const to = (m.To ?? []).map((t) => t.Address?.toLowerCase() ?? t.Address);
    if (!to.includes(email.toLowerCase())) continue;
    const full = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`);
    const body = await full.text();
    const match = body.match(/\b(\d{6})\b/);
    return { id: m.ID, code: match?.[1] ?? null };
  }
  return null;
}

async function waitForCode(email, seen, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const found = await latestCodeFor(email, seen);
    if (found?.code) return found;
    await sleep(500);
  }
  return null;
}

const supabase = createClient(API, anonKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const signUp = (email, password, data) =>
  supabase.auth.signUp({ email, password, options: data ? { data } : {} });

const ts = Date.now();
const email = `e2e-${ts}@${DOMAIN}`;
const password = "e2e-password-1";
const newPassword = "e2e-password-2";
const seen = new Set();

// ── Picker data: anon can read listed schools (D23) ─────────────────────
const { data: uni, error: uniErr } = await supabase
  .from("universities")
  .select("id, name, email_domains")
  .eq("name", "University of Virginia")
  .single();
check(
  "anon reads listed university (incl. email_domains) for the picker",
  !uniErr && uni?.id && uni.email_domains.includes("virginia.edu"),
  uniErr?.message ?? "",
);
const uniId = uni?.id;

// ── Hook rejections (no auth.users row → no confirmation email) ─────────
const { error: gmailErr } = await signUp(`e2e-${ts}@gmail.com`, password, {
  university_id: uniId,
});
check(
  "gmail signup rejected by hook",
  !!gmailErr &&
    /can't be used to sign up for this school/i.test(gmailErr.message),
  gmailErr?.message ?? "no error returned!",
);

const { error: crossErr } = await signUp(`e2e-${ts}@vt.edu`, password, {
  university_id: uniId,
});
check("another school's domain rejected", !!crossErr, crossErr?.message ?? "");

const { error: noMetaErr } = await signUp(
  `e2e-${ts}-nometa@${DOMAIN}`,
  password,
);
check("missing university_id metadata rejected", !!noMetaErr,
  noMetaErr?.message ?? "");

const rejected = await latestCodeFor(`e2e-${ts}@gmail.com`, seen);
check("rejected signup sent no email (no user row)", !rejected);

// ── Sign up (matching school email) ──────────────────────────────────────
const { data: su, error: suErr } = await signUp(email, password, {
  university_id: uniId,
});
check("signUp succeeds", !suErr, suErr?.message);
check(
  "no session before email verification (confirmations on)",
  !su?.session,
  su?.session ? "unexpected session" : "",
);

// ── OTP from Mailpit → verify ───────────────────────────────────────────
const sent = await waitForCode(email, seen);
check("signup code arrives in Mailpit", !!sent?.code);
if (sent?.id) seen.add(sent.id);
let ok = !!sent?.code;

if (ok) {
  const { error: vErr } = await supabase.auth.verifyOtp({
    email,
    token: sent.code,
    type: "signup",
  });
  check("verifyOtp(signup) succeeds", !vErr, vErr?.message);
  ok = !vErr;
}

if (ok) {
  const { data } = await supabase.auth.getSession();
  check("session established after verify", !!data.session);

  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("university_id")
    .eq("id", data.session.user.id)
    .single();
  check(
    "profile row exists via trigger, university_id = school from metadata",
    !pErr && prof?.university_id === uniId,
    pErr?.message ?? "",
  );
}

// ── Mailbox registry: +tag alias collides at confirmation, not signup ────
const alias = `e2e-${ts}+alias@${DOMAIN}`;
const { error: aliasSuErr } = await signUp(alias, password, {
  university_id: uniId,
});
check(
  "unverified alias signup allowed (no mailbox squatting / no leak)",
  !aliasSuErr,
  aliasSuErr?.message ?? "",
);

const aliasSent = await waitForCode(alias, seen);
check("alias gets a code (hook does not check mailboxes)", !!aliasSent?.code);

if (aliasSent?.code) {
  const { error: aliasVerifyErr } = await supabase.auth.verifyOtp({
    email: alias,
    token: aliasSent.code,
    type: "signup",
  });
  // Enforcement is proven by the rejection itself. Note: GoTrue wraps
  // trigger raises at confirm-time in a generic "Error confirming user" —
  // the friendly raise text is asserted at the DB layer in pgTAP
  // (auth_signup.test.sql), it does not survive the HTTP boundary.
  check(
    "alias confirmation rejected (mailbox already linked)",
    !!aliasVerifyErr,
    aliasVerifyErr?.message ?? "alias confirmed?!",
  );
}

// ── Recovery: code → verify → updatePassword → signOut(others) ──────────
const { error: rErr } = await supabase.auth.resetPasswordForEmail(email);
check("resetPasswordForEmail succeeds", !rErr, rErr?.message);

const rec = await waitForCode(email, seen);
check("recovery code arrives in Mailpit", !!rec?.code);

if (rec?.code) {
  const { error: rvErr } = await supabase.auth.verifyOtp({
    email,
    token: rec.code,
    type: "recovery",
  });
  check("verifyOtp(recovery) succeeds", !rvErr, rvErr?.message);

  const { error: uErr } = await supabase.auth.updateUser({
    password: newPassword,
  });
  check("updateUser(new password) succeeds", !uErr, uErr?.message);

  const { error: soErr } = await supabase.auth.signOut({ scope: "others" });
  check("signOut({scope:'others'}) succeeds", !soErr, soErr?.message);

  const { data } = await supabase.auth.getSession();
  check(
    "current session survives signOut({scope:'others'})",
    !!data.session,
    data.session ? "" : "session was wiped!",
  );

  // Full sign-out, then log in with the NEW password.
  await supabase.auth.signOut();
  const { data: li, error: liErr } = await supabase.auth.signInWithPassword({
    email,
    password: newPassword,
  });
  check(
    "signInWithPassword works with new password",
    !liErr && !!li.session,
    liErr?.message ?? "",
  );
}

await supabase.auth.signOut().catch(() => {});

const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
