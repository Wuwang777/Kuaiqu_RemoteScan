# 使用官方 Node.js (基于 Alpine 环境更轻量)
FROM node:18-alpine

# 安装 canvas 的构建依赖 (canvas 库可能需要环境编译)
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# 创建并设置工作目录
WORKDIR /app

# 复制 package.json 等依赖描述文件
COPY package*.json ./

# 安装项目依赖 (只安装生产依赖)
RUN npm install --production

# 复制项目所有文件到工作目录
COPY . .

# 动态暴露容器的运行端口
ARG PORT=80
EXPOSE ${PORT}

# 启动命令
CMD ["node", "server.js"]
