-- Generic daily puzzle answer pages.
create table if not exists public.puzzle_pages (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  provider text not null,
  title text not null,
  seo_title text,
  meta_description text,
  intro_md text,
  answer_intro_md text,
  how_to_play_md text,
  description_md text,
  faq_json jsonb not null default '[]'::jsonb,
  source_url text,
  sort_order int not null default 100,
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_puzzle_pages_published_sort
  on public.puzzle_pages (is_published, sort_order, title);

drop trigger if exists trg_puzzle_pages_updated_at on public.puzzle_pages;
create trigger trg_puzzle_pages_updated_at
before update on public.puzzle_pages
for each row execute function public.set_updated_at();

create or replace function public.set_puzzle_page_published_at() returns trigger as $$
begin
  if new.is_published = true
     and (tg_op = 'INSERT' or old.is_published is distinct from true)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_puzzle_page_published_at on public.puzzle_pages;
create trigger trg_set_puzzle_page_published_at
before insert or update on public.puzzle_pages
for each row execute function public.set_puzzle_page_published_at();

create table if not exists public.puzzle_answers (
  id uuid primary key default uuid_generate_v4(),
  puzzle_slug text not null references public.puzzle_pages(slug) on update cascade on delete cascade,
  answer_date date not null,
  puzzle_id text,
  source_url text,
  fetched_at timestamptz not null default now(),
  extracted_from text,
  answer_summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (puzzle_slug, answer_date)
);

create index if not exists idx_puzzle_answers_slug_date
  on public.puzzle_answers (puzzle_slug, answer_date desc);
create index if not exists idx_puzzle_answers_fetched_at
  on public.puzzle_answers (fetched_at desc);

drop trigger if exists trg_puzzle_answers_updated_at on public.puzzle_answers;
create trigger trg_puzzle_answers_updated_at
before update on public.puzzle_answers
for each row execute function public.set_updated_at();

create table if not exists public.puzzle_sync_runs (
  id uuid primary key default uuid_generate_v4(),
  puzzle_slug text,
  ran_at timestamptz not null default now(),
  status text not null,
  issue text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_puzzle_sync_runs_slug_ran_at
  on public.puzzle_sync_runs (puzzle_slug, ran_at desc);
create index if not exists idx_puzzle_sync_runs_status_ran_at
  on public.puzzle_sync_runs (status, ran_at desc);

drop view if exists public.puzzle_pages_view;
create or replace view public.puzzle_pages_view as
select
  pp.*,
  coalesce(latest.latest_answer_date, null) as latest_answer_date,
  coalesce(latest.latest_fetched_at, null) as latest_fetched_at,
  greatest(
    pp.updated_at,
    coalesce(pp.published_at, pp.updated_at),
    coalesce(latest.latest_fetched_at, pp.updated_at)
  ) as content_updated_at
from public.puzzle_pages pp
left join lateral (
  select
    pa.answer_date as latest_answer_date,
    pa.fetched_at as latest_fetched_at
  from public.puzzle_answers pa
  where pa.puzzle_slug = pp.slug
  order by pa.answer_date desc
  limit 1
) latest on true;

alter table public.puzzle_pages enable row level security;
alter table public.puzzle_answers enable row level security;
alter table public.puzzle_sync_runs enable row level security;

drop policy if exists "puzzle_pages_public_read" on public.puzzle_pages;
create policy "puzzle_pages_public_read"
  on public.puzzle_pages for select
  using (is_published = true);

drop policy if exists "puzzle_pages_admin_full_access" on public.puzzle_pages;
create policy "puzzle_pages_admin_full_access"
  on public.puzzle_pages for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "puzzle_answers_public_read" on public.puzzle_answers;
create policy "puzzle_answers_public_read"
  on public.puzzle_answers for select
  using (
    exists (
      select 1
      from public.puzzle_pages pp
      where pp.slug = puzzle_answers.puzzle_slug
        and pp.is_published = true
    )
  );

drop policy if exists "puzzle_answers_admin_full_access" on public.puzzle_answers;
create policy "puzzle_answers_admin_full_access"
  on public.puzzle_answers for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "puzzle_sync_runs_admin_full_access" on public.puzzle_sync_runs;
create policy "puzzle_sync_runs_admin_full_access"
  on public.puzzle_sync_runs for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.revalidation_events
  drop constraint if exists revalidation_events_entity_type_check;

alter table public.revalidation_events
  add constraint revalidation_events_entity_type_check
  check (entity_type in ('code','article','list','author','event','checklist','tool','catalog','music','quiz','wiki','wiki_catalog','stats','puzzle'));

create or replace function public.trg_enqueue_revalidation_puzzle_pages()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_revalidation('puzzle', old.slug, 'puzzle_pages_delete');
  elsif new.is_published = true then
    perform public.enqueue_revalidation('puzzle', new.slug, 'puzzle_pages_' || lower(tg_op));
  elsif tg_op = 'UPDATE' and old.is_published = true then
    perform public.enqueue_revalidation('puzzle', old.slug, 'puzzle_pages_unpublish');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_puzzle_pages on public.puzzle_pages;
create trigger trg_enqueue_revalidation_puzzle_pages
after insert or update or delete on public.puzzle_pages
for each row execute function public.trg_enqueue_revalidation_puzzle_pages();

create or replace function public.trg_enqueue_revalidation_puzzle_answers()
returns trigger
language plpgsql
as $$
declare
  v_slug text;
  v_answer_date text;
begin
  if tg_op = 'DELETE' then
    v_slug := old.puzzle_slug;
    v_answer_date := old.answer_date::text;
  else
    v_slug := new.puzzle_slug;
    v_answer_date := new.answer_date::text;
  end if;

  perform public.enqueue_revalidation('puzzle', v_slug, 'puzzle_answers_' || lower(tg_op));
  perform public.enqueue_revalidation('puzzle', v_slug || '/' || v_answer_date, 'puzzle_answers_archive_' || lower(tg_op));
  return null;
end;
$$;

drop trigger if exists trg_enqueue_revalidation_puzzle_answers on public.puzzle_answers;
create trigger trg_enqueue_revalidation_puzzle_answers
after insert or update or delete on public.puzzle_answers
for each row execute function public.trg_enqueue_revalidation_puzzle_answers();

create or replace function public.trg_search_index_puzzle_pages()
returns trigger
language plpgsql
as $$
declare
  v_search text;
begin
  if (tg_op = 'DELETE') then
    delete from public.search_index
    where entity_type = 'puzzle'
      and entity_id = old.id::text;
    return null;
  end if;

  v_search := left(
    concat_ws(
      ' ',
      new.title,
      new.slug,
      new.provider,
      new.seo_title,
      new.meta_description,
      new.intro_md,
      new.answer_intro_md,
      new.how_to_play_md,
      new.description_md
    ),
    3000
  );

  perform public.upsert_search_index(
    'puzzle',
    new.id::text,
    new.slug,
    new.title,
    'Puzzle',
    '/puzzles/' || new.slug,
    new.updated_at,
    new.is_published,
    v_search
  );

  return null;
end;
$$;

drop trigger if exists trg_search_index_puzzle_pages on public.puzzle_pages;
create trigger trg_search_index_puzzle_pages
after insert or update or delete on public.puzzle_pages
for each row execute function public.trg_search_index_puzzle_pages();

insert into public.puzzle_pages
  (slug, provider, title, seo_title, meta_description, intro_md, answer_intro_md, how_to_play_md, description_md, faq_json, source_url, sort_order, is_published)
values
  ('wordle', 'nyt', 'Today''s Wordle Answer', 'Today''s Wordle Answer and Yesterday''s Wordle Answer', 'Get today''s Wordle answer, yesterday''s answer, puzzle number, and a quick archive of past Wordle solutions.', 'Use this page for the current Wordle answer without digging through a long article. The solved row is shown in a quick visual format, with the date and puzzle number right above it.', 'Today''s answer appears first, followed by yesterday''s answer when it is saved in the archive.', 'Wordle gives you six tries to guess one five-letter word. Each guess marks letters as correct, present in another position, or not in the word. Good opening guesses test common vowels and consonants, then each later guess should use the color feedback instead of starting over.', 'The archive links below are for checking older Wordle answers by date. Older answer pages are kept out of search results because the main page is the page that should rank for today''s answer.', '[{"q":"Does this page show spoilers?","a":"Yes. The solved answer board is visible on the page, so avoid scrolling into the answer section if you are still playing."},{"q":"Why is the archive noindex?","a":"Daily archive pages are for navigation and reference. The current answer page is the search page."}]'::jsonb, 'https://www.nytimes.com/svc/wordle/v2', 10, true),
  ('connections', 'nyt', 'Today''s NYT Connections Answer', 'Today''s NYT Connections Answer and Categories', 'See today''s NYT Connections groups, categories, answers, and yesterday''s puzzle when available.', 'Use this page when you want the Connections categories and words in one clean place. The solved groups are shown in the same color order players expect from the game.', 'The current puzzle is shown first. Yesterday''s answer appears below when it has already been collected.', 'Connections asks you to sort 16 words into four groups of four. Each group has a shared theme, and the colors usually move from easier yellow and green groups to trickier blue and purple groups.', 'Use the archive when you need a previous Connections solution by date. The daily archive pages are intentionally noindex so the main current page stays focused.', '[{"q":"Are the color groups included?","a":"Yes. The answer shows each group title with its four words."},{"q":"Does Connections always have four categories?","a":"Yes, the daily puzzle is built around four groups of four."}]'::jsonb, 'https://www.nytimes.com/svc/connections/v2', 20, true),
  ('strands', 'nyt', 'Today''s NYT Strands Answer', 'Today''s NYT Strands Answer, Spangram, and Theme Words', 'Find today''s NYT Strands spangram, theme words, clue, and solved board.', 'Use this page for the current Strands spangram and theme words. Visual board data is saved when the NYT payload includes coordinates.', 'The spangram, theme words, clue, and solved board are shown together in one visual answer section.', 'Strands gives you a letter grid and a clue. You find theme words by connecting adjacent letters, and one special spangram touches opposite sides of the board while describing the theme.', 'The archive keeps older Strands solutions by date for reference. Main Strands search traffic should land on the current answer page, not old dated pages.', '[{"q":"What is the spangram?","a":"The spangram is the answer that describes the puzzle theme and stretches across the board."},{"q":"Do you show the solved board?","a":"Yes, when the puzzle data includes coordinates."}]'::jsonb, 'https://www.nytimes.com/svc/strands/v2', 30, true),
  ('spelling-bee', 'nyt', 'Today''s NYT Spelling Bee Answers', 'Today''s NYT Spelling Bee Answers and Pangrams', 'See today''s NYT Spelling Bee center letter, outer letters, pangrams, and full accepted answer list.', 'Use this page for the current Spelling Bee answer list, including pangrams and accepted words.', 'The honeycomb, pangrams, and accepted answer list are shown together in one answer section.', 'Spelling Bee gives you seven letters in a honeycomb. Every answer must include the center letter, use only the listed letters, and meet the minimum word length. A pangram uses all seven letters at least once.', 'Older Spelling Bee answer lists can be large, so archive pages are kept as reference pages and excluded from search indexing.', '[{"q":"Do you include every accepted word?","a":"The collector saves the accepted answer list returned in the puzzle data."},{"q":"Are pangrams marked?","a":"Yes. Pangrams are shown separately and highlighted in the full list."}]'::jsonb, 'https://www.nytimes.com/puzzles/spelling-bee', 40, true),
  ('letter-boxed', 'nyt', 'Today''s NYT Letter Boxed Answer', 'Today''s NYT Letter Boxed Answer and Board Letters', 'Get today''s NYT Letter Boxed solution, board sides, and archive links.', 'Use this page for the current Letter Boxed solution and the board letters for the day.', 'The solution chain appears beside a Letter Boxed-style board path.', 'Letter Boxed places letters on four sides of a square. Make words by connecting letters, but consecutive letters cannot come from the same side. Each word must start with the last letter of the previous word, and the goal is to use every letter.', 'Archive pages store previous solution chains by date. They are for reference and are not meant to compete with the current answer page.', '[{"q":"Does the answer show the full chain?","a":"Yes. The solution is shown in order."},{"q":"Does it include par?","a":"Par is shown when it is available."}]'::jsonb, 'https://www.nytimes.com/puzzles/letter-boxed', 50, true),
  ('sudoku', 'nyt', 'Today''s NYT Sudoku Answers', 'Today''s NYT Sudoku Answers for Easy, Medium, and Hard', 'Reveal today''s NYT Sudoku solutions for Easy, Medium, and Hard puzzles.', 'Use this page for the current NYT Sudoku solutions across all three daily difficulties.', 'Easy, Medium, and Hard solutions are separated so you can check only the solved grid you need.', 'Sudoku is a 9x9 number grid. Fill every row, column, and 3x3 box with the numbers 1 through 9 without repeating a number in any row, column, or box.', 'The archive stores solved grids by date. Archive pages are noindex because the daily page should be the main search destination.', '[{"q":"Are all three NYT difficulties included?","a":"Yes. Easy, Medium, and Hard are saved together when the source data is available."},{"q":"Can I check only one difficulty?","a":"Yes. Each difficulty has its own solved grid section."}]'::jsonb, 'https://www.nytimes.com/puzzles/sudoku/easy', 60, true),
  ('pips', 'nyt', 'Today''s NYT Pips Answers', 'Today''s NYT Pips Answers for Easy, Medium, and Hard', 'See today''s NYT Pips solutions for Easy, Medium, and Hard boards.', 'Use this page for the current NYT Pips solutions, with each difficulty separated.', 'Each difficulty includes solved placement data for the visual board.', 'Pips is a domino-style logic puzzle. Place the available dominoes into the board so each region rule is satisfied. The exact clues vary by board, so checking the solved layout is usually clearer than reading only a list.', 'Archive pages keep older solved boards by date and stay noindex to keep the current answer page focused.', '[{"q":"Is Pips a LinkedIn puzzle?","a":"No. This page covers NYT Pips."},{"q":"Do you include Easy, Medium, and Hard?","a":"Yes, when all three difficulties are available in the puzzle data."}]'::jsonb, 'https://www.nytimes.com/svc/pips/v1', 70, true),
  ('contexto', 'beebom', 'Today''s Contexto Answer', 'Today''s Contexto Answer and Yesterday''s Contexto Answer', 'Find today''s Contexto answer, yesterday''s answer, and past answer archive links.', 'Use this page for the current Contexto answer in a quick visual format.', 'Today''s answer appears first, with yesterday''s answer shown when saved.', 'Contexto is a word guessing game where each guess is ranked by semantic closeness to the secret word. Lower ranks are closer, so the path to the answer is about meaning rather than spelling.', 'Contexto data depends on a third-party puzzle page, so the collector should be watched for markup changes.', '[{"q":"Is Contexto based on spelling?","a":"No. It ranks guesses by semantic closeness to the answer."},{"q":"Why might this page fail to update?","a":"The collector depends on external puzzle markup staying stable."}]'::jsonb, 'https://beebom.com/puzzle/contexto-answer-today/', 80, true),
  ('letroso', 'beebom', 'Today''s Letroso Answer', 'Today''s Letroso Answer and Yesterday''s Letroso Answer', 'Find today''s Letroso answer, yesterday''s answer, meaning, and archive links.', 'Use this page for the current Letroso answer and meaning when available.', 'Today''s Letroso answer appears first. Yesterday is shown when the archive has it.', 'Letroso is a daily word puzzle. Use the clues and letter feedback to narrow down the answer, then check the solution here when you are ready.', 'Letroso data depends on a third-party puzzle page, so the collector should be monitored for layout changes.', '[{"q":"Does the page include the meaning?","a":"Yes, when the source page exposes a meaning for the answer."},{"q":"Are old answers indexed?","a":"No. Old answer pages are noindex reference pages."}]'::jsonb, 'https://beebom.com/puzzle/letroso-answer-today/', 90, true),
  ('linkedin-zip', 'linkedin', 'Today''s LinkedIn Zip Answer', 'Today''s LinkedIn Zip Answer and Path', 'See today''s LinkedIn Zip solution path, puzzle number, and archive links.', 'Use this page for the current LinkedIn Zip path solution.', 'The solved path appears as a visual board when the LinkedIn collector succeeds.', 'Zip asks you to draw a single path through a grid while respecting numbered checkpoints and walls. The route must connect the required sequence without breaking the board rules.', 'LinkedIn puzzle collection depends on a valid LinkedIn session cookie, so these pages need monitoring.', '[{"q":"Why does LinkedIn collection need a cookie?","a":"The current collector reads LinkedIn game data through the logged-in Voyager API."},{"q":"Does the answer show the path visually?","a":"Yes. The saved solution path can be rendered as a board."}]'::jsonb, 'https://www.linkedin.com/games/view/zip/desktop/', 100, true),
  ('linkedin-crossclimb', 'linkedin', 'Today''s LinkedIn Crossclimb Answer', 'Today''s LinkedIn Crossclimb Answer and Clues', 'See today''s LinkedIn Crossclimb word ladder, clues, puzzle number, and archive links.', 'Use this page for the current Crossclimb ladder and clue list.', 'The answer table lists the solved words in order with their clues.', 'Crossclimb is a word ladder puzzle. Each rung connects through a clue, and the solved ladder is easier to verify when the words are shown in top-to-bottom order.', 'LinkedIn answer pages should be treated as operationally fragile because they depend on a logged-in collection flow.', '[{"q":"Does the answer include clues?","a":"Yes. The collector saves the solved words and matching clues."},{"q":"Is this the same as NYT puzzles?","a":"No. Crossclimb is a LinkedIn game."}]'::jsonb, 'https://www.linkedin.com/games/view/crossclimb/desktop/', 110, true),
  ('linkedin-queens', 'linkedin', 'Today''s LinkedIn Queens Answer', 'Today''s LinkedIn Queens Answer and Solved Grid', 'See today''s LinkedIn Queens queen positions, color grid, puzzle number, and archive links.', 'Use this page for the current LinkedIn Queens solved grid.', 'The solved grid shows each queen placement on the color regions.', 'Queens asks you to place queens so rows, columns, and color regions are satisfied without invalid queen adjacency. The solved board is the fastest way to check your final placement.', 'LinkedIn pages need collector monitoring because they depend on LinkedIn API shape and a valid session cookie.', '[{"q":"Does the answer show every queen?","a":"Yes. The saved solution includes one queen position per region."},{"q":"Do archive pages rank in Google?","a":"No. Archive pages are noindex reference pages."}]'::jsonb, 'https://www.linkedin.com/games/view/queens/desktop/', 120, true),
  ('linkedin-tango', 'linkedin', 'Today''s LinkedIn Tango Answer', 'Today''s LinkedIn Tango Answer and Solved Grid', 'See today''s LinkedIn Tango solved sun and moon grid, constraints, puzzle number, and archive links.', 'Use this page for the current LinkedIn Tango solved grid.', 'The answer shows the completed sun/moon board and saved equality or opposite constraints.', 'Tango is a binary logic puzzle. Fill the grid with the two symbols while satisfying row, column, and visible relationship clues between cells.', 'The collector uses LinkedIn session data, so failures should be logged and reviewed quickly.', '[{"q":"What do the two Tango symbols mean?","a":"The puzzle data stores them as two cell states. The page renders them as sun and moon symbols."},{"q":"Are constraint marks included?","a":"Yes, when the puzzle data includes them."}]'::jsonb, 'https://www.linkedin.com/games/view/tango/desktop/', 130, true),
  ('linkedin-mini-sudoku', 'linkedin', 'Today''s LinkedIn Mini Sudoku Answer', 'Today''s LinkedIn Mini Sudoku Answer and Solved Grid', 'See today''s LinkedIn Mini Sudoku solution grid, puzzle number, and archive links.', 'Use this page for the current LinkedIn Mini Sudoku solved grid.', 'The answer shows the full solution with pre-filled clue cells marked separately when available.', 'Mini Sudoku is a smaller Sudoku-style number puzzle. Fill the grid so each row, column, and box follows the puzzle rules without repeating values.', 'LinkedIn Mini Sudoku collection depends on the logged-in API response staying stable.', '[{"q":"Does the answer mark pre-filled clues?","a":"Yes, when the puzzle data includes preset cell indexes."},{"q":"Is this NYT Sudoku?","a":"No. This page covers LinkedIn Mini Sudoku."}]'::jsonb, 'https://www.linkedin.com/games/view/mini-sudoku/desktop/', 140, true)
on conflict (slug) do update
set provider = excluded.provider,
    title = excluded.title,
    seo_title = excluded.seo_title,
    meta_description = excluded.meta_description,
    intro_md = excluded.intro_md,
    answer_intro_md = excluded.answer_intro_md,
    how_to_play_md = excluded.how_to_play_md,
    description_md = excluded.description_md,
    faq_json = excluded.faq_json,
    source_url = excluded.source_url,
    sort_order = excluded.sort_order,
    is_published = excluded.is_published;
