# Docker / 腾讯云部署指南

本文档对应 Docker Compose + Nginx + Express 部署。Cloudflare Workers 部署见 [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md)。

## 项目结构

```
opensource-mentor/
├── Dockerfile              # 前端镜像（多阶段构建 + Nginx）
├── Dockerfile.server       # 后端镜像（Node.js）
├── docker-compose.yml      # 编排配置
├── nginx.conf              # Nginx 配置（静态文件 + API 代理）
├── .dockerignore           # Docker 构建忽略文件
├── .env.docker.example     # 环境变量示例
└── ...
```

## 端口说明

| 服务 | 容器内端口 | 宿主机端口 | 说明 |
|------|-----------|-----------|------|
| Nginx (前端) | 80 | **8082** | 页面访问 + API 代理入口 |
| Express (后端) | 3001 | 不暴露 | 仅内部网络通信 |

> 外部只需访问 `http://服务器IP:8082` 即可，API 请求自动代理到后端。

## 部署步骤

### 1. 准备环境

确保服务器已安装：
- Docker 20+
- Docker Compose v2+

```bash
docker --version
docker compose version
```

### 2. 上传项目代码

将整个项目目录上传到服务器，或者从 GitHub 克隆：

```bash
git clone https://github.com/asJEI/opensource-mentor.git
cd opensource-mentor
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker.example .env

# 编辑环境变量（填入你的密钥）
vim .env
```

**关键配置项：**

| 变量 | 必填 | 说明 |
|------|------|------|
| `PLATFORM_GITHUB_TOKEN` | 推荐 | GitHub Personal Access Token，提高 API 速率限制 |
| `PLATFORM_LLM_API_KEY` | AI 功能需要 | 平台默认 LLM API Key |
| `DEFAULT_LLM_PROVIDER` | 否 | 默认模型提供方，如 `deepseek` |
| `DEFAULT_LLM_BASE_URL` | 否 | OpenAI-compatible API 地址 |
| `DEFAULT_LLM_MODEL` | 否 | 默认模型名称 |
| `LLM_TIMEOUT_MS` | 否 | LLM 请求超时，单位毫秒 |

旧的 `GITHUB_TOKEN`、`LLM_API_KEY` 等变量仍作为兼容别名接受，新部署应使用上表中的变量。没有 LLM Key 时不能假定全部 AI 功能都能返回真实结果。

### 4. 构建并启动

```bash
# 构建镜像并后台启动
docker compose up -d --build

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 5. 验证部署

```bash
# 检查健康状态
curl http://localhost:8082/api/health

# 预期返回：{"success":true,"data":{"status":"ok",...}}
```

浏览器访问：`http://你的服务器IP:8082`

## 常用命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f        # 所有服务
docker compose logs -f web    # 仅前端
docker compose logs -f server # 仅后端

# 重新构建并启动
docker compose up -d --build

# 进入容器
docker compose exec server sh
docker compose exec web sh
```

## 更新代码

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker compose up -d --build

# 查看日志确认启动成功
docker compose logs -f --tail=50
```

## 故障排查

### 页面打不开
```bash
# 检查容器是否在运行
docker compose ps

# 检查端口是否被占用
netstat -tlnp | grep 8082
```

### API 请求失败
```bash
# 查看后端日志
docker compose logs -f server

# 检查健康检查
curl http://localhost:8082/api/health
```

### 修改端口

编辑 `docker-compose.yml`，修改 `web` 服务的 `ports`：

```yaml
ports:
  - "8082:80"   # 左边是宿主机端口，改成你想要的
```

然后重启：
```bash
docker compose up -d
```

## 安全建议

1. **不要把 .env 文件提交到 Git**（已在 .gitignore 中排除）
2. 生产环境建议配置 HTTPS（可用 Nginx 反向代理 + Let's Encrypt）
3. 限制 `GITHUB_TOKEN` 的权限范围
4. Express 已对平台 AI 请求按客户端限制为每分钟 10 次；BYOK 请求不占用平台额度
5. 定期更新基础镜像：`docker compose build --pull`
