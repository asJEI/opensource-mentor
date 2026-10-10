# 中英双语国际化审计与交付记录

日期：2026-10-10。

## 仓库同步

开始时本地 `main` 没有未提交改动，比 `origin/main` 落后 2 个提交。执行 `git fetch origin` 与 `git merge --ff-only origin/main`，从 `c5ab81a` 快进到 `9cd8ad7` 后开展审计。没有强制重置、推送、部署或修改生产数据。

## 实施前审计

- 技术栈：React 19、TypeScript、Vite、Zustand；Cloudflare Worker 与 Express 两套后端，共享代码审查与工作空间契约。
- 前端没有可用 i18n 实现。清点到 941 条含中文的静态文案和插值模板，覆盖落地页、导航、画像引导、工作台、设置、表单、Toast、错误、同步状态、加载与空状态。
- `src/store/user.ts` 已持久化 `preferences.language`，但默认固定为 `zh-CN`，没有语言入口或功能联动。复用该字段作为 locale，不另建状态或数据库。
- Worker、Express、Issue 候选分析、开发者画像、共享 PR 审查 Prompt 均存在中文要求。部分响应校验器会将贡献章节标题重新固定为中文。
- Issue 卡片把英文摘要判定为需要中文重生成；Issue 分析缓存与贡献指南浏览器缓存未区分语言。
- Worker 已支持 Supabase 账户和任务进度同步；Express 尚未接入对应账户存储。语言保存于现有浏览器用户偏好，不增加表、迁移、RLS 或服务端配置字段。
- 现有命令包括测试、前端/Worker typecheck 与 build、Express typecheck 与 build；没有 lint 脚本。

## 实现与覆盖

### 轻量实现

不新增依赖。`shared/locale.ts` 定义 `zh-CN` / `en-US`、浏览器和请求语言解析、统一 AI 输出语言政策。`src/i18n/index.ts` 根据现有用户状态翻译文案，使用中文源文案作为稳定词典键，插值值原样保留。模块级静态选项使用 getter，快捷问题在渲染时翻译，避免语言切换后仍使用初始化文本。

`src/i18n/en-US.json` 管理前端英文文案；`shared/generated.en-US.json` 管理后端校验默认值、候选 Issue 可用性和匹配说明、画像规则回退、Express 开发模式回退文案；确定性审查的文案放在 `shared/core/code-review/messages.ts`。

后端回退翻译只应用于应用生成的结果字段，不对 GitHub 仓库或原始 Issue 对象整体翻译。代码、命令、路径、文件名、技术名称及 schema 枚举保持原值。AI 结果中不属于已知应用文案的内容保持原样。

### 用户语言

- 首次访问：浏览器首选语言以 `zh` 开头时选择中文，其余选择英文。
- 落地页导航与工作台页头都有显式语言菜单。
- 选择保存在现有 `opensource-mentor:user-profile` 的 `preferences.language`；刷新、退出登录、恢复登录状态不重置选择。
- HTML `lang`、页面标题、描述元数据与日期格式跟随选择。
- 页面内当前表单值、BYOK 会话密钥和业务状态不因语言切换而刷新或重建。
- 已显示的应用 Toast 与错误消息也能使用当前语言呈现。

### 界面

覆盖落地页、Issue 发现与评估、仓库分析、我的贡献、贡献指南、AI 导师、代码审查、PR 生成器、设置、画像与偏好引导、404，以及对应导航、操作、表单说明、校验、加载/空状态、Toast、同步与冲突提示。

### API 与 AI

- Axios 与手工 fetch 的统一请求头包含 `Accept-Language`，包含贡献指南 SSE 请求；响应 JSON 字段、机器错误码、状态码保持原契约。
- Worker 从请求头将 locale 绑定到请求专属 AI 客户端，普通与流式 completion 都应用同一输出政策。
- Express 用 AsyncLocalStorage 隔离并发请求语言，并在 provider 客户端创建时捕获 locale，避免异步或后台审查混用语言。
- 导师、仓库分析、Issue 推荐/解释、学习路线、贡献章节、PR 草稿、PR Review、开发者画像的新生成自然语言遵循用户偏好。Prompt 不再强制中文；代码、技术名词、Issue 引文与 JSON 字段/枚举仍保留。
- GitHub OAuth 的可选 locale 参数与短期非敏感语言 Cookie，只将界面选择传递给后台画像生成；授权 scope、state 校验与会话逻辑不变。
- 贡献指南和 Worker Issue 分析缓存键增加 locale，避免不同语言请求复用错误语言的缓存。
- 英文 Issue 摘要不再被英文界面判定为需要中文重生成。
- Worker 与 Express 错误通过原机器错误码选择英文提示，保留中文体验。
- 确定性 PR 审查与 Express 开发模式 fallback 也有英文输出。

### 文档

README 改为英文主入口，介绍价值、主要功能、贡献流程、运行与配置方法、架构、验证命令和语言行为。原中文说明保留为 `README.zh-CN.md`，两个版本互相链接。

## 验证

最终检查结果见本文件末尾的验证记录。

| 检查 | 结果 |
| --- | --- |
| `npm test` | 13 个测试文件、76 个测试全部通过（原有 48 个 + 新增 28 个） |
| `npm run typecheck` | 前端与 Worker 通过 |
| `npm run typecheck:server` | Express 通过 |
| `npm run build` | 前端与 Worker 构建通过；客户端 bundle 大小提示为非阻塞警告 |
| `npm --prefix server run build` | Express 构建通过 |
| lint | 仓库未配置 lint 脚本，未声称 lint 通过 |
| `git diff --check` | 通过；按 Windows CRLF 行尾检查 |

已补充回归测试：中文浏览器变体、非中文默认英文、支持的 locale 校验、旧客户端默认中文、迁移与非法已存语言、刷新/退出/恢复登录后的选择、统一 API 请求头、词典键覆盖、占位符一致性、已有 Toast 回切、普通和 SSE completion、平台/BYOK locale 传递、Express 并发隔离、代码/路径/原文保留和确定性审查双语输出。

浏览器手动检查：落地页即时中英切换与刷新保留；Issue 入口、画像引导、跳过 Toast、设置页；仓库分析、我的贡献、指南、导师、审查、PR 生成器的英文导航与空状态；中文回切；中英文非法仓库输入校验。英文工作台视觉检查无明显布局溢出。

## 明确边界与遗留项

- 语言偏好保存在当前浏览器，未扩展为跨设备账户偏好。符合复用既有状态、不新增数据库的范围。
- 已有对话、用户输入、旧 AI 结果、GitHub 原始 Issue 内容不自动翻译。新请求使用当前语言；语言切换不抹除已有贡献进度。
- 真实 OAuth 登录与在线模型生成没有使用生产账户执行端到端验收；本地测试模拟了登录状态恢复和两套后端的真实请求构造，未写入生产 Supabase。
- 现有 Express 开发模式模拟数据保留现有逻辑，仅翻译文案；模拟的仓库内容应以真实 GitHub 数据核验。部署指南仍为原中文资料，英文 README 已提供运行与配置步骤。
- 构建成功，但 Vite 提示主客户端 bundle 超过 500 kB。没有为本次国际化引入拆包或无关架构重构。
- 没有新增运行时依赖，没有修改认证权限、生产数据或部署服务。修改保留在本地工作区，未推送远端。

## 修改文件清单

按功能包括：用户偏好与语言入口、所有主要页面和业务/UI 组件、API 请求与错误显示、Worker/Express AI 客户端和 Prompt、生成结果校验与回退、Issue/画像语言处理、共享审查与 locale、README、编译器 JSON 支持和回归测试。完整文件清单附后。

- `docs/i18n-implementation.md`
- `index.html`
- `README.md`
- `README.zh-CN.md`
- `server/src/app.ts`
- `server/src/middlewares/errorHandler.ts`
- `server/src/middlewares/localeContext.ts`
- `server/src/services/ai/analyzeRepository.ts`
- `server/src/services/ai/client.ts`
- `server/src/services/ai/explainIssue.ts`
- `server/src/services/ai/generatePR.ts`
- `server/src/services/ai/generateRoadmap.ts`
- `server/src/services/ai/locale.ts`
- `server/src/services/ai/mentorChat.ts`
- `server/src/services/ai/parsers.ts`
- `server/src/services/ai/recommendIssues.ts`
- `server/src/services/ai/reviewPr.ts`
- `server/src/utils/prompts.ts`
- `shared/core/code-review/llmReview.ts`
- `shared/core/code-review/messages.ts`
- `shared/core/code-review/ruleReview.ts`
- `shared/core/locale.test.ts`
- `shared/errors.ts`
- `shared/generated.en-US.json`
- `shared/generatedLocale.ts`
- `shared/locale.ts`
- `src/App.tsx`
- `src/components/business/AiPageError/AiPageError.tsx`
- `src/components/business/AISummaryCard/AISummaryCard.tsx`
- `src/components/business/ContextMentor.tsx`
- `src/components/business/IssueContextCard/index.tsx`
- `src/components/business/IssueExplainModal/IssueExplainModal.tsx`
- `src/components/business/IssueRow/IssueRow.tsx`
- `src/components/business/JourneyActions/JourneyActions.tsx`
- `src/components/business/NextStepCard/NextStepCard.tsx`
- `src/components/business/ProfileOnboarding/ProfileOnboarding.tsx`
- `src/components/business/ProgressOverview/ProgressOverview.tsx`
- `src/components/business/PrResultPanel/PrResultPanel.tsx`
- `src/components/business/PrTypeSelector/PrTypeSelector.tsx`
- `src/components/business/RepoInfoCard/RepoInfoCard.tsx`
- `src/components/business/ReviewActionBar/index.tsx`
- `src/components/business/ReviewIssueCard/index.tsx`
- `src/components/business/ReviewProgress/index.tsx`
- `src/components/business/ReviewResultPanel/index.tsx`
- `src/components/business/ReviewWorkspace/index.tsx`
- `src/components/business/RoadmapTimeline/RoadmapTimeline.tsx`
- `src/components/business/StatCard/StatCard.tsx`
- `src/components/layout/AppHeader/AppHeader.tsx`
- `src/components/layout/AppLayout/AppLayout.tsx`
- `src/components/layout/Footer/Footer.tsx`
- `src/components/layout/Navbar/Navbar.tsx`
- `src/components/layout/Sidebar/Sidebar.tsx`
- `src/components/layout/TaskContext.tsx`
- `src/components/layout/WorkspaceSyncStatus.tsx`
- `src/components/ui/Modal/Modal.tsx`
- `src/components/ui/Toast/Toast.tsx`
- `src/constants/userProfile.ts`
- `src/i18n/catalog.test.ts`
- `src/i18n/en-US.json`
- `src/i18n/index.ts`
- `src/i18n/LanguageSwitcher.tsx`
- `src/i18n/locale.test.ts`
- `src/pages/AiMentor/index.tsx`
- `src/pages/CodeReview/index.tsx`
- `src/pages/Contribution/index.tsx`
- `src/pages/Dashboard/components.tsx`
- `src/pages/Dashboard/DashboardPage.tsx`
- `src/pages/Issues/index.tsx`
- `src/pages/Landing/sections.tsx`
- `src/pages/NotFound/index.tsx`
- `src/pages/PrGenerator/index.tsx`
- `src/pages/Roadmap/index.tsx`
- `src/pages/Settings/components.tsx`
- `src/pages/Settings/index.tsx`
- `src/services/aiService.ts`
- `src/services/authService.ts`
- `src/services/errors.ts`
- `src/services/request.ts`
- `src/services/workspaceService.ts`
- `src/store/chat.ts`
- `src/store/codeReview.ts`
- `src/store/pr.ts`
- `src/store/repository.ts`
- `src/store/roadmap.ts`
- `src/store/user.ts`
- `src/styles/layout.css`
- `src/sync/workspaceBridge.ts`
- `src/sync/workspaceSync.ts`
- `src/types/user.ts`
- `tsconfig.json`
- `tsconfig.worker.json`
- `worker/ai/analyze.ts`
- `worker/ai/chat.ts`
- `worker/ai/client.ts`
- `worker/ai/explain.ts`
- `worker/ai/generatePr.ts`
- `worker/ai/locale.test.ts`
- `worker/ai/prompts/analysis.ts`
- `worker/ai/prompts/chat.ts`
- `worker/ai/prompts/explain.ts`
- `worker/ai/prompts/pr.ts`
- `worker/ai/prompts/recommend.ts`
- `worker/ai/prompts/roadmap.ts`
- `worker/ai/providers.ts`
- `worker/ai/recommend.ts`
- `worker/ai/resolveConfig.test.ts`
- `worker/ai/resolveConfig.ts`
- `worker/ai/roadmap.ts`
- `worker/ai/validate.ts`
- `worker/code-review/routes.ts`
- `worker/github/candidateIssues.ts`
- `worker/github/oauth.ts`
- `worker/http.ts`
- `worker/index.ts`
