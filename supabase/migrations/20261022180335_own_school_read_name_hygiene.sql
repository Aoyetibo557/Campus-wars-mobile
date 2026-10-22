-- Own-school read (D26) + display-name invisible-character rejection (D27)
--
-- 1. A user can always read the university referenced by their own profile,
--    even if it later becomes unlisted (a data refresh could empty its
--    email_domains). The existing "read listed universities" policy and the
--    safe-column grant are unchanged — policies OR, so this only ADDS the
--    user's own school to what authenticated users can see.
create policy "read own university" on public.universities
  for select to authenticated
  using (
    id = (select university_id
            from public.profiles
           where id = auth.uid())
  );

-- 2. Display-name hygiene: reject zero-width, bidirectional-control and
--    blank-looking characters rather than silently normalizing (D27). The
--    check runs inside profiles_check_display_name BEFORE the blocklist
--    check, so a rejected name never reaches the profanity scan — and
--    since invisible chars are code points, the 2–20 length check now
--    measures only what the user sees.
--
--    Variation selectors (U+FE00–FE0F) are deliberately NOT rejected —
--    they're legitimate parts of emoji sequences. ZWJ-dependent emoji
--    (e.g. 👨‍👩‍👧) are rejected; plain emoji (🎓) are not.

create or replace function public.profiles_check_display_name()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text := lower(btrim(new.display_name));
begin
  -- Rejected set (U&'' escapes — PG ARE does not support \x{} syntax):
  --   \00A0 NBSP            \115F \1160 Hangul fillers   \1680 Ogham space
  --   \2000-\200F           thin spaces, ZWSP/ZWNJ/ZWJ, LRM/RLM
  --   \202A-\202E           bidi embeddings & overrides
  --   \202F narrow NBSP     \205F math space
  --   \2060-\2069           word joiner, invisible operators, bidi isolates
  --   \2800 braille blank   \3000 ideographic space
  --   \3164 \FFA0 fillers   \FEFF BOM/ZWNBSP
  if new.display_name ~
     U&'[\00A0\115F\1160\1680\2000-\200F\202A-\202E\202F\205F\2060-\2069\2800\3000\3164\FEFF\FFA0]'
  then
    raise exception 'display_name contains invalid characters';
  end if;

  if exists (
    select 1
      from public.profanity_blocklist b
     where v_name ~*
       ('\m' || regexp_replace(b.term, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
  ) then
    raise exception 'display_name is not allowed';
  end if;
  return new;
end $$;

revoke execute on function public.profiles_check_display_name()
  from public, anon, authenticated;
