# OpenSource Mentor — AI 开源贡献导师

> 每个开发者身边的 AI 开源导师，帮助你迈出参与开源的第一步。

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646cff?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Docker-✓-2496ed?logo=docker" alt="Docker" />
</p>

---

## 👋 项目简介

很多开发者在面对 GitHub 上优秀的开源项目时，会产生参与兴趣，却因为学习成本过高最终放弃。最大的困难往往不是不会写代码，而是面对一个陌生仓库时不知道：

- 应该先看什么？
- 哪些 Issue 适合自己？
- 如何符合社区规范提交贡献？

OpenSource Mentor 希望利用 AI 的理解和分析能力，把复杂的开源参与流程变成一条更加友好的学习路径，让 AI 不只是代码助手，也成为开发者成长过程中的导师。

---

## ✨ 核心功能

### ① GitHub 项目智能分析

用户输入 GitHub 仓库地址后，AI 可以帮助快速了解：

- 项目定位与背景
- 技术栈构成
- 文件结构概览
- 核心模块解析

降低阅读陌生项目的门槛。

### ② AI Issue 推荐

根据 GitHub Issue 信息，结合用户能力水平，帮助筛选：

- 适合新手的 `good first issue`
- 当前可以参与的问题
- 推荐贡献方向

避免新人面对大量 Issue 无从选择。

### ③ AI 代码审查

围绕代码质量与贡献流程提供辅助：

- 分析 Issue 需求
- 提供代码修改思路
- 审查 Pull Request 改动

帮助用户完成符合规范的开源贡献。

### ④ PR 生成辅助

根据 Issue 描述与代码上下文，辅助生成 Pull Request 的标题、描述与改动说明，让新手也能写出规范的 PR。

### ⑤ 个性化学习路线

根据项目特点和用户水平，生成定制化的开源贡献学习路径，引导用户从了解项目到提交 PR，逐步推进。

### ⑥ AI 导师对话

随时向 AI 导师提问，解答关于项目、技术、贡献流程等各种问题。

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite |
| 路由 | React Router |
| 状态管理 | Zustand |
| 后端框架 | Express.js |
| 请求校验 | Zod |
| AI 能力 | LLM API（DeepSeek 兼容 OpenAI 格式） |
| 数据来源 | GitHub API |
| 部署 | Docker + Nginx |

---

## 🚀 快速开始

### 在线体验

🌐 **[点击访问在线 Demo](http://119.45.237.47:8082/)**

### 本地运行

#### 前置要求

- Node.js >= 20
- npm 或 pnpm
- GitHub Personal Access Token（可选，用于调用真实 GitHub API）
- LLM API Key（可选，用于真实 AI 分析）

#### 1. 克隆项目

```bash
git clone https://github.com/asJEI/opensource-mentor.git
cd opensource-mentor
```

#### 2. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd server
npm install
cd ..
```

#### 3. 配置环境变量

```bash
# 前端
cp .env.example .env
# 编辑 .env，填入你的配置

# 后端
cp server/.env.example server/.env
# 编辑 server/.env，填入你的配置
```

> 💡 **快速体验**：保持 `VITE_USE_MOCK=true`，无需任何密钥即可使用 Mock 数据体验全部界面。

#### 4. 启动开发服务器

```bash
# 启动前端（终端 1）
npm run dev

# 启动后端（终端 2）
cd server
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端运行在 `http://localhost:3001`。

---

## 🐳 Docker 部署

### 一键部署

```bash
# 克隆项目
git clone https://github.com/asJEI/opensource-mentor.git
cd opensource-mentor

# 配置环境变量
cp .env.docker.example .env
# 编辑 .env 填入你的配置

# 启动服务
docker compose up -d --build
```

访问 `http://你的服务器IP:8082` 即可使用。

### 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_USE_MOCK` | 是否使用 Mock 数据 | `true` |
| `GITHUB_TOKEN` | GitHub API Token | *(空)* |
| `LLM_API_KEY` | 大模型 API Key | *(空)* |
| `LLM_MODEL` | 使用的模型 | `deepseek-chat` |

更多配置请参考 [DEPLOY.md](./DEPLOY.md)。

---

## 📁 项目结构

```
opensource-mentor/
├── src/                    # 前端源码
│   ├── components/         # 通用组件
│   ├── pages/              # 页面组件
│   │   ├── Dashboard/      # 项目分析页
│   │   ├── Issues/         # Issue 推荐页
│   │   ├── CodeReview/     # 代码审查页
│   │   ├── PrGenerator/    # PR 生成辅助页
│   │   ├── Roadmap/        # 学习路线页
│   │   ├── AiMentor/       # AI 导师对话页
│   │   ├── Settings/       # 设置页
│   │   └── Landing/        # 落地页
│   ├── store/              # 状态管理（Zustand）
│   ├── services/           # API 服务层
│   └── styles/             # 全局样式
├── server/                 # 后端源码（BFF 层）
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 业务逻辑
│   │   ├── middlewares/    # 中间件
│   │   ├── utils/          # 工具与 Prompt
│   │   ├── config/         # 配置
│   │   └── app.ts          # 入口文件
│   └── package.json
├── Dockerfile              # 前端 Dockerfile
├── Dockerfile.server       # 后端 Dockerfile
├── docker-compose.yml      # Docker Compose 配置
├── nginx.conf              # Nginx 配置
└── DEPLOY.md               # 部署文档
```

---

## 💡 设计思路

### 想解决的问题

新人参与开源通常需要经历：

```
阅读 README → 理解项目结构 → 寻找 Issue → 学习开发规范 → 修改代码 → 提交 PR
```

整个过程信息分散，需要大量经验积累。OpenSource Mentor 希望将这条路径上的关键节点交给 AI 辅助，让初次参与开源的开发者不再孤单。

### 为什么选择这个方向

随着 AI Coding 工具的发展，代码生成越来越容易。但未来开发者真正需要提升的能力，不只是生成代码，而是：

- 理解真实项目
- 学习工程规范
- 参与团队协作

因此本项目希望探索 AI 在开发者成长和开源生态中的价值，让 AI 成为开源贡献路上的导师，而不仅仅是代码补全工具。

---

## 📝 License

MIT License

---

<p align="center">
  Made with ❤️
</p>
