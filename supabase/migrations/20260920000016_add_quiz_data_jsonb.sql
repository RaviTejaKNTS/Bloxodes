alter table public.quiz_pages
  add column if not exists quiz_data jsonb;

alter table public.quiz_pages
  drop constraint if exists quiz_pages_quiz_data_shape_check;

alter table public.quiz_pages
  add constraint quiz_pages_quiz_data_shape_check
  check (
    quiz_data is null
    or (
      jsonb_typeof(quiz_data) = 'object'
      and jsonb_typeof(quiz_data -> 'easy') = 'array'
      and jsonb_typeof(quiz_data -> 'medium') = 'array'
      and jsonb_typeof(quiz_data -> 'hard') = 'array'
    )
  );

comment on column public.quiz_pages.quiz_data is
  'Validated easy, medium, and hard question pools for the published quiz page.';
