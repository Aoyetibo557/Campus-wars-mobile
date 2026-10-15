# Hosted Supabase setup checklist

Things configured in `supabase/config.toml` for local development that
must be repeated (or deliberately changed) on the hosted project.
**None of this has been done on hosted yet** — this is a checklist only.

## Auth settings (Dashboard → Authentication, or CLI config sync)

- [ ] Email confirmations **enabled** (`enable_confirmations`)
- [ ] Minimum password length **8** (`minimum_password_length`)
- [ ] OTP length **6** (`otp_length`)
- [ ] OTP expiry **900s / 15 min** (`otp_expiry`)
- [ ] Resend interval **60s** (`max_frequency`) — matches the app's
      60-second resend cooldown
- [ ] Rate limits reviewed (`email_sent`, `sign_in_sign_ups`,
      `token_verifications`) — local uses a permissive `email_sent = 30`;
      pick a production-appropriate value

## Email templates (Dashboard → Authentication → Email Templates)

- [ ] "Confirm signup" template → `supabase/templates/signup.html`
      (leads with `{{ .Token }}`, no magic link)
- [ ] "Reset password" template → `supabase/templates/recovery.html`
- [ ] **Custom SMTP/email provider** — Supabase's built-in email is
      dev-only (tiny rate cap, deliverability not guaranteed). Required
      before real users sign up.

## Database

- [ ] `pg_cron` extension enabled (required by the reset cron jobs)
- [ ] Migrations applied via CLI (`db push` / CI), never by hand

## Before User Created hook (D23 — school email verification)

- [ ] Dashboard → Authentication → Hooks (or CLI config sync): enable
      **Before User Created**, Postgres function:
      `pg-functions://postgres/public/before_user_created_hook`
- [ ] The hook expects `user_metadata.university_id` in the signup payload
      and validates the email domain against that school's `email_domains`.
- **Fails closed by design:** `handle_new_user` re-validates and aborts the
  signup if the hook is missing or disabled, so a misconfigured hosted
  project cannot let unverified signups through — it just turns friendly
  errors into raw SQL errors.
- **Known, accepted limitation:** mailbox uniqueness normalizes case and
  strips `+tags`, but different spellings of the same mailbox
  (`jsmith@` vs `john.smith@`) can't be detected — nothing server-side can
  tell them apart. Documented per D23 discussion.

## Auth URLs

- [ ] `site_url` set to the production app/site URL
- [ ] `additional_redirect_urls` reviewed (not needed for the code-entry
      flow, but OAuth/deep links later will need them)

## Abuse protection

- [ ] CAPTCHA/bot protection on signup (hCaptcha or Turnstile) — PRD §11
      wants sign-up abuse limiting; decide provider + enable on hosted
- [ ] Sign-up per-IP rate limit reviewed against the CAPTCHA choice

## Later / deferred

- [ ] Sign in with Apple (deferred — separate milestone)
- [ ] ~~`.edu` verification~~ now in MVP via D23 (school-domain signup +
      Before User Created hook, above)
