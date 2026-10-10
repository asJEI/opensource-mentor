# 首次画像与账号同步

首次调用时，`get_user_profile` 读取已确认的画像，Agent 只询问缺失的编程语言、经验、兴趣、目标和每周时间，然后通过 `save_user_profile` 保存到本机。不会根据安装 git/npm 推断用户水平。

账号同步可选。获得用户同意后，`connect_account` 返回浏览器链接；通过现有 GitHub 登录完成登录，再返回授权标签页刷新并确认。浏览器必须与 stdio MCP 进程在同一台电脑。`account_connection_status` 检查完成状态，`get_user_profile` 读取账号已有画像。用户确认上传后，调用 `save_user_profile` 并设置 `sync: true`。登录不会自动上传旧的本机档案。`disconnect_account` 撤销授权并清除本机缓存。

凭证只允许读写画像，有效期七天，保存在仓库外的 `~/.opensource-mentor`，可通过 `OSM_STATE_DIR` 更改目录。一个账号重新连接会替换旧连接；不授予 GitHub 写入权限或网页模型额度。在云端运行且无法通过本机浏览器访问回调的 harness，暂不支持此账号连接流程。

**后端要求：**在线同步需要先部署本次版本的 Cloudflare Worker；本机画像不依赖后端部署。复用 Supabase 的 `developer_profiles.developer_profile` JSON 字段，无需新数据库或迁移。网页登录或刷新后恢复画像，保存网页偏好也会更新它。这批 MCP 工具不提供学习路线、聊天和贡献进度同步；Express 后端暂不支持账号绑定。
