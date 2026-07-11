# Docker 部署指南

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
| `GITHUB_TOKEN` | 推荐 | GitHub Personal Access Token，提高 API 速率限制 |
| `LLM_API_KEY` | 推荐 | LLM API Key（如 DeepSeek），不填则使用 Mock 数据 |
| `VITE_USE_MOCK` | 否 | 前端是否使用 Mock，默认 `true` |

> 演示/测试用：保持 `VITE_USE_MOCK=true`，不填密钥也能跑（Mock 模式）。

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
4. 定期更新基础镜像：`docker compose build --pull`
