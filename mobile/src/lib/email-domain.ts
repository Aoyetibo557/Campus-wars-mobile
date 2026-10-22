/**
 * Client-side port of public.email_domain_matches (migration
 * 20261014212218_school_verification.sql). The SAME rule lives here for UX
 * only — the database is the authority.
 *
 * Dot-boundary match: the email's domain must equal a school domain or be a
 * subdomain of it, so `evilvirginia.edu` and `virginia.edu.evil.com` both
 * fail while `cs.virginia.edu` passes. Case-insensitive, trims whitespace.
 */

export function emailMatchesDomainList(
  email: string,
  domains: string[],
): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at === -1) return false;
  const domain = normalized.slice(at + 1);
  return domains.some((d) => {
    const school = d.trim().toLowerCase();
    return domain === school || domain.endsWith(`.${school}`);
  });
}

/** Display hint: first two domains, "+N more" beyond that. */
export function domainHint(domains: string[]): string {
  if (domains.length === 0) return "";
  const shown = domains.slice(0, 2);
  const extra = domains.length - shown.length;
  return shown.join(", ") + (extra > 0 ? ` +${extra} more` : "");
}
