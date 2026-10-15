# DSH 接入报告审核与修订（2026-10-15）

原报告本地基线是 main `423bc6f`；远程服务实现位于 `codex/remote-mcp-oauth`。
请区分本地安装版本、文档版本和线上服务状态。审核不代表重新执行了原报告全部实验。

后续进度：维护者已要求将此分支合并 main，下文“尚需合并”描述保留原审核时点。
许可证后续最终确定为 MIT；下文未选择许可证的描述保留原审核时点。npm 包尚未发布。

## Issue 1：明确 DSH 补丁层新增插件格式

成立。DSH 44.0.0 内置 `@deepseek-ai/dsh-mcp-client` 0.2.0-rc.2 的官方模板使用
`insert:`。需要修改的是 `cordis.patch.yml` 中新增插件的示例；基础插件清单仍使用裸
条目。用“仅警告且未加载工具”替代“静默忽略”。中英文文档已修正，并保留显式 env
转发说明、补充无需模型 Key 的 Agent 模式。

宿主模型不需要 AI Key，不代表远程登录或私有仓库访问也不需要认证。

## Issue 2：统一远程接入文档和分支发布状态

成立。2026-10-15 核查远程 `/mcp` 返回 401，授权服务器元数据返回 200。
通用安装文档仍否认远程托管，现已修正，并增加远程 OAuth 和静态凭证入口。
这些修改尚需维护者合并到 main，不能把分支更新当成主分支已经更新。

旧网页 API origin 与远程 MCP URL 不同，这条区分应保留。

## Issue 3：npm 发布准备与非 OAuth 宿主说明

应拆开描述。静态凭证已经存在：REMOTE_ACCESS_TOKENS 摘要注册表支持每用户独立
身份和权限。缺少的是自助管理和清晰文档，不是完全不支持非 OAuth 宿主。
说明已补充，包含 DSH HTTP headers、静态凭证撤销、注册表整体替换和身份隔离注意事项。
单独增加 device-code grant 并不能让不支持该协议的宿主自动认证。

npm 包尚未发布，registry 核查返回 404；缺少 bin 的问题属实。stdio.mjs 在旧基线中
已经有 shebang，无需重复添加。现已补 bin、files 和 publishConfig，继续保留
private:true 防止意外发布。发布前仍需作者决定许可证、核查包名和发布权限、执行
打包/安装及真实 Windows DSH npx 测试，获得发布授权后再移除 private 并发布。
因此当前文档仍明确不提供可用的 `npx opensource-mentor-mcp` 安装承诺。

此次验证：`npm run test:mcp` 的 16 项测试通过；子包打包包含 README、package.json
和六个 src 模块，共八个文件，不包含前端、Worker 或本机凭据。Windows 上使用
`npx.cmd --yes --package=<本地tgz绝对路径> opensource-mentor-mcp`，通过真实 SDK
完成初始化及 tools/list，返回 17 个工具。这是本地 tarball 启动验证，不是 npm registry
发布，也不是 DSH 桥接的 npx 端到端验证。

## 其他说明

- 未发现项目自有 LICENSE 或 package license 字段；许可证由作者选择，不在此次修订中代选。
- PowerShell 的 npm.cmd 是有效环境提示；切换 Git SSL backend 只适用于对应环境排障，不能作为普遍要求。
- printf 写入协议消息后立即 EOF 会导致竞态；应使用 SDK 客户端握手并等待响应。
  现有 `npm run test:mcp` 包含真实协议客户端和 stdio 子进程回归，可作为稳定自检入口。
- 未重新核实原报告的 README 字符数、依赖包数量和各版本 HMR 行为；文档将实测记录与版本范围分开说明。
- 未发布 GitHub Issue、npm 包，未修改许可证、生产配置或线上部署。
