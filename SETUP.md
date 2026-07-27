# CRM-YG 空白系统 · 搭建指南

一套和原系统功能完全一样、但**数据空白且独立**的 CRM。数据存在你自己的
Supabase 项目里，支持多人 / 多设备共享。

项目文件：

| 文件 | 说明 |
|---|---|
| `index.html` | 主程序（登录、仪表盘、客户/拜访/公海等全部页面） |
| `supabase-schema.sql` | 一键建表脚本 |
| `supabase-create-user.sql` | 管理员新增账号的数据库函数 |
| `supabase-delete-user.sql` | 管理员删除账号的数据库函数 |

---

## 后端配置（本项目已迁移完成）

- Supabase 项目：`zcl-crm`（region: ap-southeast-1）
- Project URL：`https://plhyrkyjzpvljcuqctik.supabase.co`
- 前端配置已写入 `index.html` 的 `SB_URL` / `SB_KEY`

数据库表结构 / 用户管理函数已通过迁移执行，无需再手动跑 SQL。

---

## 创建第一个管理员账号

1. 去 Supabase **Authentication → Users → Add user**，手动新建一个用户（邮箱如 `admin@zcl.crm`，设个密码，勾选 Auto Confirm）。
2. 在 **SQL Editor** 把它提升为主管：
   ```sql
   update public.profiles
   set role = 'admin', name = '主管'
   where id = (select id from auth.users where email = 'admin@zcl.crm');
   ```
3. 用这个邮箱密码登录网站 → 进入后在「用户管理」页就能继续添加业务员账号。

---

## 本地预览

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 发布到 GitHub Pages

仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save，
稍等出现 `https://lovewss.github.io/ZCL-CRM/` 即可访问。
