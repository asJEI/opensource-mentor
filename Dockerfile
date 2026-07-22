# ---------- 构建阶段 ----------
FROM node:20-alpine AS builder

WORKDIR /app

# 安装前端依赖
COPY package*.json ./
RUN npm ci

# 复制前端源码并构建
COPY . .
RUN npm run build

# ---------- 运行阶段 ----------
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
