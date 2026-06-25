alter table public.app_sessions
  add column if not exists login_source_path text,
  add column if not exists login_return_path text;

alter table public.app_sessions
  drop constraint if exists app_sessions_login_source_path_check,
  add constraint app_sessions_login_source_path_check
    check (
      login_source_path is null
      or (
        login_source_path like '/%'
        and login_source_path not like '//%'
        and position(E'\\' in login_source_path) = 0
        and login_source_path not like '/auth/%'
      )
    );

alter table public.app_sessions
  drop constraint if exists app_sessions_login_return_path_check,
  add constraint app_sessions_login_return_path_check
    check (
      login_return_path is null
      or (
        login_return_path like '/%'
        and login_return_path not like '//%'
        and position(E'\\' in login_return_path) = 0
        and login_return_path not like '/auth/%'
      )
    );

comment on column public.app_sessions.login_source_path is
  'Sanitized same-origin path where the user initiated login.';

comment on column public.app_sessions.login_return_path is
  'Sanitized same-origin path used after login completes.';
