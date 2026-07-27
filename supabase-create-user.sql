-- ============================================================
-- 让管理员在「用户管理」里新增账号（无需开放注册 Signups）
-- 在 Supabase → SQL Editor 整段粘贴运行一次即可。
-- ============================================================
create extension if not exists pgcrypto;

create or replace function public.admin_create_user(
  p_email text, p_password text, p_name text, p_role text default 'sales'
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare new_id uuid;
begin
  -- 仅管理员可调用
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception '仅管理员可新增账号';
  end if;
  if coalesce(length(p_password),0) < 6 then
    raise exception '密码至少 6 位';
  end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception '该邮箱已存在：%', p_email;
  end if;

  new_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', p_name),
    '', '', '', ''
  );
  -- handle_new_user 触发器会自动建 profile；这里补设姓名/角色
  update public.profiles set name = p_name, role = coalesce(nullif(p_role,''), 'sales') where id = new_id;
  return new_id;
end;
$$;

revoke all on function public.admin_create_user(text,text,text,text) from public, anon;
grant execute on function public.admin_create_user(text,text,text,text) to authenticated;
