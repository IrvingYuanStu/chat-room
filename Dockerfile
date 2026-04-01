# 多阶段构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY src ./src

# 编译 TypeScript
RUN npm run build

# 生产镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 从构建阶段复制编译后的代码和依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 创建配置目录
RUN mkdir -p /app/.chat-room

# 暴露 P2P 端口
EXPOSE 9000

# 设置环境变量
ENV NODE_ENV=production
ENV ZK_ADDRESS=zookeeper:2181

# 启动应用
CMD ["node", "dist/index.js"]
