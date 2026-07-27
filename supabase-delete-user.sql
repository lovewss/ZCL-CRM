-- ============================================================
-- 让「用户管理」里的删除账号按钮生效（数据库函数方式，无需 Edge Function / service_role）
-- 在 Supabase → SQL Editor 里整段粘贴运行一次即可。
-- ============================================================

-- 1) 先把所有「未确认」的账号确认掉（让 zhouh / gert 等能登录）
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;

-- 2) 管理员删除账号的函数：以定义者身份执行，内部校验调用人必须是 admin
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception '仅管理员可删除账号';
  end if;
  if target = auth.uid() then
    raise exception '不能删除当前登录的自己';
  end if;
  delete from auth.users where id = target;   -- profiles 设了级联删除，会一并清除
end;
$$;

-- 只允许已登录用户调用（函数内部再校验是否管理员）
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
