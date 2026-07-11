# OpenSource Mentor — AI 开源贡献导师

> 每个开发者身边的 AI 开源导师，帮助你迈出参与开源的第一步。

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Docker-✓-2496ed?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/TRAE-🤖-a855f7" alt="Built with TRAE" />
</p>

---

## 👋 关于这个项目

大家好，我是一名计算机科学与技术专业的大三学生，也是一名正在探索 AI 应用开发的独立开发者。

过去一段时间，我一直在尝试将 AI 技术应用到真实开发场景中。在学习 GitHub 开源项目和参与技术社区的过程中，我发现很多新人并不是没有学习能力，而是不知道如何迈出参与开源的第一步。

因此，我尝试使用 **TRAE** 将自己的想法快速转化成一个可以真实体验的产品 Demo。

> **OpenSource Mentor = 每个开发者身边的 AI 开源导师**

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

### ③ AI 开源贡献指导

围绕开源贡献流程提供辅助：

- 分析 Issue 需求
- 提供代码修改思路
- 指导 Pull Request 编写

帮助用户完成第一次开源贡献。

### ④ 个性化学习路线

根据项目特点和用户水平，生成定制化的开源贡献学习路径，引导用户从了解项目到提交 PR，逐步推进。

### ⑤ AI 导师对话

随时向 AI 导师提问，解答关于项目、技术、贡献流程等各种问题。

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 状态管理 | Zustand |
| 后端框架 | Express.js |
| 语言 | TypeScript |
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
│   │   ├── Roadmap/        # 学习路线页
│   │   └── AiMentor/       # AI 导师对话页
│   ├── store/              # 状态管理（Zustand）
│   ├── services/           # API 服务层
│   └── styles/             # 全局样式
├── server/                 # 后端源码
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   └── app.ts          # 入口文件
│   └── package.json
├── Dockerfile              # 前端 Dockerfile
├── Dockerfile.server       # 后端 Dockerfile
├── docker-compose.yml      # Docker Compose 配置
├── nginx.conf              # Nginx 配置
└── DEPLOY.md               # 部署文档
```

---

## 💡 创作思路

### 灵感来源

这个项目来源于我自己学习 AI 开发以及探索 GitHub 开源项目时的真实体验。

在尝试参与开源项目时，我发现最大的困难并不是不会写代码，而是面对一个陌生仓库时不知道：

- 应该先看什么？
- 哪些 Issue 适合自己？
- 如何符合社区规范提交贡献？

很多新人看到 GitHub 上优秀的开源项目，会产生参与兴趣，但最终因为学习成本过高而放弃。

### 想解决的问题

目前新人参与开源通常需要经历：

```
阅读 README → 理解项目结构 → 寻找 Issue → 学习开发规范 → 修改代码 → 提交 PR
```

整个过程信息分散，需要大量经验积累。

OpenSource Mentor 希望利用 AI 的理解和分析能力，把复杂的开源参与流程变成一个更加友好的学习路径。

### 为什么选择这个方向

随着 AI Coding 工具的发展，代码生成越来越容易。

但是未来开发者真正需要提升的能力，不只是生成代码，而是：

- 理解真实项目
- 学习工程规范
- 参与团队协作

因此，我希望探索 AI 在开发者成长和开源生态中的价值，让 AI 不只是代码助手，也成为开发者成长过程中的导师。

---

## 🤖 与 TRAE 一起开发

在开发 OpenSource Mentor 的过程中，我和 TRAE 的合作方式更像是一位产品搭档。

最开始，我只是告诉 TRAE 我的想法：

> "我希望做一个能够帮助新人参与 GitHub 开源项目的 AI 导师。"

然后通过不断拆解需求，让 TRAE 帮助我完善：

- 🎯 产品功能设计
- 🎨 页面交互规划
- 💻 前后端代码实现
- 🔧 功能调试优化

整个开发过程分为三个阶段：

### 第一阶段：产品设计与需求拆解

通过自然语言描述需求，让 TRAE 协助完成产品原型设计，明确目标用户、使用流程、核心功能和页面结构。

### 第二阶段：AI 辅助开发

使用 TRAE 完成前端页面搭建、组件开发、后端接口设计、GitHub API 接入以及 AI 分析流程实现。

开发过程中，我不断通过自然语言描述需求：

- "我希望这个页面增加什么功能"
- "这个流程应该如何优化"
- "这里出现的问题应该如何解决"

然后结合实际运行效果持续迭代。

### 第三阶段：测试、优化与部署

完成基础功能后，通过 TRAE 继续进行 Bug 排查、UI 优化、交互调整和部署问题解决，最终完成在线 Demo 部署。

> 它让我真正感受到，AI Coding 工具并不是简单生成代码，而是能够帮助开发者降低从"想法"到"产品"的距离。

---

## 📝 License

MIT License

---

<p align="center">
  Made with ❤️ and 🤖 TRAE
</p>
