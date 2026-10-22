-- DEV-ONLY seed data. Runs on `supabase db reset` locally — never push this
-- to a remote project. Real config (games, blocklist, reset_state) lives in
-- migrations, not here.

-- minimal dev universities with REAL scorecard_unit_ids — the loader
-- (scripts/universities/load.mjs) upserts on that key, so these merge into
-- real rows instead of duplicating. CMU is dual-domain (andrew.cmu.edu is a
-- real student domain, also carried in overrides.json). Tests must create
-- their own fixtures; nothing may depend on these rows.
insert into public.universities
  (name, short_name, country, state, website, scorecard_unit_id, email_domains) values
  ('University of Virginia-Main Campus', 'UVA', 'US', 'VA', 'https://virginia.edu', 234076, '{virginia.edu}'),
  ('Virginia Polytechnic Institute and State University', 'VT', 'US', 'VA', 'https://vt.edu', 233921, '{vt.edu}'),
  ('Carnegie Mellon University', 'CMU', 'US', 'PA', 'https://cmu.edu', 211440, '{cmu.edu,andrew.cmu.edu}'),
  ('University of Michigan-Ann Arbor', 'UMich', 'US', 'MI', 'https://umich.edu', 170976, '{umich.edu}'),
  ('Ohio State University-Main Campus', 'OSU', 'US', 'OH', 'https://osu.edu', 204796, '{osu.edu}');
-- university_points rows are created automatically by the insert trigger.

-- DEV trivia questions (category 'dev'). Placeholder content only — the real
-- question bank is still open (O10). correct_index stays server-side.
insert into public.trivia_questions (question, choices, correct_index, category, difficulty) values
  ('What is the largest planet in our solar system?',
   '["Jupiter","Saturn","Neptune","Mars"]', 0, 'dev', 1),
  ('What year did the first iPhone release?',
   '["2005","2006","2007","2008"]', 2, 'dev', 1),
  ('Which element has the chemical symbol "O"?',
   '["Gold","Oxygen","Silver","Iron"]', 1, 'dev', 1),
  ('How many sides does a hexagon have?',
   '["5","6","7","8"]', 1, 'dev', 1),
  ('What is the capital of France?',
   '["London","Berlin","Paris","Madrid"]', 2, 'dev', 1),
  ('Which planet is known as the Red Planet?',
   '["Venus","Mars","Jupiter","Mercury"]', 1, 'dev', 1),
  ('What is 12 x 12?',
   '["124","132","144","156"]', 2, 'dev', 2),
  ('Which ocean is the largest?',
   '["Atlantic","Indian","Arctic","Pacific"]', 3, 'dev', 1),
  ('What is the chemical formula for water?',
   '["CO2","H2O","O2","NaCl"]', 1, 'dev', 1),
  ('How many continents are there on Earth?',
   '["5","6","7","8"]', 2, 'dev', 2);

-- DEV word list for Wordle (pending real licensed lists, O11).
-- is_answer=true words can be picked as the daily answer; the rest are
-- valid guesses only. Deliberately small — ensure_wordle_daily falls back
-- to the full list once the 30-day exclusion is exhausted.
insert into public.wordle_words (word, is_answer) values
  ('crane', true),  ('slate', true),  ('brick', true),  ('flame', true),
  ('grape', true),  ('storm', true),  ('beach', true),  ('cloud', true),
  ('tiger', true),  ('plant', true),  ('mouse', true),  ('chair', true),
  ('about', false), ('other', false), ('which', false), ('their', false),
  ('there', false), ('would', false), ('could', false), ('right', false),
  ('write', false), ('light', false), ('night', false), ('fight', false),
  ('apple', false), ('bread', false), ('house', false), ('water', false),
  ('music', false), ('happy', false);
