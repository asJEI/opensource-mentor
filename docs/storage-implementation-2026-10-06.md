# 服务端进度存储实现与验收

日期：2026-10-06。范围：保留 Web，先统一数据库与进度存储；本次未实现或安装 Skill。

## 已实现的行为

登录用户的仓库选择、仓库分析、贡献指南与章节完成状态、聊天记录、PR 草稿、代码审查状态通过 Worker 保存到 Supabase。以账号隔离，以 `owner/repo#issueNumber` 隔离贡献任务；仅仓库任务使用 `#0`，当前选择保存于账号级 `workspace`。切换任务时恢复各自草稿和进度。

浏览器缓存只用于快速恢复和待同步队列，服务端是已提交进度的权威来源。登录、页面重新打开、重新聚焦及网络恢复时读取或同步；界面显示恢复、保存、失败、冲突状态。尚未实现实时跨设备推送。

每份文档使用递增版本，写入携带预期版本及唯一操作 ID。数据库事务提供版本比较、请求去重和原子提交。网络丢失响应后重试同一操作不会重复写入；不同设备同时编辑发生冲突时展示两份内容，由用户选择，避免静默覆盖。

缓存和待同步队列按账号分离。账号或任务切换会使旧异步请求失效，避免生成结果落入另一任务。旧浏览器无账号归属的数据仅在用户确认后导入，不会自动上传。已经丢失的内存或会话存储无法追溯恢复。

登录用户的代码审查完整结果在返回成功前写入数据库，按账号读取；访客仍使用原临时缓存。指南按已收到的章节保存，恢复时对中断的生成显示重试状态，不能保证关闭网页后的生成自动继续。

## 数据库与访问边界

迁移文件：`supabase/migrations/20261006062317_workspace_persistence.sql`，已应用到项目 OpenSource Mentor（`tdgnlirrpvtutosnbgwt`）。新增：

| 表 | 用途 |
| --- | --- |
| `workspace_contexts` | 用户与任务的稳定上下文 ID |
| `workspace_documents` | 各类进度快照及版本 |
| `workspace_operations` | 操作去重摘要及响应元数据 |
| `workspace_review_runs` | 用户私有代码审查结果 |

沿用现有 GitHub OAuth 与签名 Cookie 身份机制，不将它误当作 Supabase Auth。Worker 从验证后的会话取得用户 ID，不接受客户端指定所属账号。新表启用 RLS，并撤销匿名及普通客户端角色权限，由服务端密钥访问。保存函数为 SECURITY INVOKER，固定 search_path，仅 service_role 可执行。写接口检查来源、JSON 类型、大小和允许字段，排除 BYOK 等凭证。

当前实现针对 Cloudflare Worker 部署路径；Express / Docker 后端没有接入同一账号认证与存储接口，不能宣称两种后端均支持云端进度。访客继续使用设备本地进度。用户 BYOK 密钥不进入这些表。

操作去重记录及审查结果当前没有自动清理策略。应根据实际数据量制定保留期限；清理操作记录时应同时确定客户端重试窗口，避免破坏去重语义。当前单份文档上限为 2 MiB，聊天与大型报告需关注增长。

## 验证结果

- 48 项测试通过：执行真实迁移的 PostgreSQL 测试、权限和账号隔离、版本冲突、重复写入、网络响应丢失重试、刷新竞争、任务与账号切换、私有审查持久化等。
- `npm run build` 通过，包含前端及 Worker TypeScript 检查和生产构建；`npm run typecheck:server` 通过。
- 实际 Supabase 以 service_role 执行回滚事务，确认保存、读取、重复请求去重、冲突和账号隔离，测试数据全部回滚。
- 验证后原有用户 13 条、开发者档案 10 条；四张新表均为 0 条。确认新表匿名及 authenticated 无 SELECT 权限，service_role 可访问。

安全顾问另报告已有数据库对象的问题：`set_updated_at` 的 [search_path 可变](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)，以及 `rls_auto_enable` 的 SECURITY DEFINER 函数可由 [anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) 和 [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) 执行。本次未修改这些既有对象；新增表没有策略的提示对应刻意禁止客户端直连的访问设计。

## 上线与浏览器验收

数据库已更新，前端及 Worker 代码尚未部署。按 `DEPLOY-CLOUDFLARE.md` 的流程发布后才能在网页启用。生产 Worker 需要 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`SESSION_SECRET` 及原 GitHub OAuth 配置；不要把服务端密钥写入前端。本地现有 `.dev.vars` 缺少数据库与会话配置，因此尚未完成真实登录浏览器端到端验收。

本地迁移版本已与本次远端迁移一致。仓库较早的 `20260829_user_persistence.sql` 与现有远端基线并不完全一致，不能直接对生产执行全部历史迁移；后续应先梳理基线与迁移历史。

部署后执行：

1. 登录账号 A，选择仓库与 Issue，完成一个指南章节，发送聊天并编辑 PR 草稿，等待“已同步”。
2. 关闭浏览器重新登录，确认选择、章节和草稿恢复；切换 Issue 后再切回，确认任务独立。
3. 在另一设备登录同一账号，确认恢复；两设备同时编辑同一草稿，确认冲突需显式处理。
4. 断网编辑，再恢复网络，确认待同步内容写入；提交中刷新，确认无重复或回退。
5. 切换账号 B，确认看不到 A 的私有内容；尝试读取 A 的审查 ID，确认拒绝。
6. 检查旧浏览器任务须确认导入，BYOK 凭证不出现在进度请求或数据表中。

下一阶段应先完成上述真实浏览器验收，再考虑 Skill 共用此服务端数据。此前的需求和优化文档保留为后续设计参考。
