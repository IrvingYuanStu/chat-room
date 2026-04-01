# Node.js 客户端安装说明

## 概述

Chat Room 是一个纯 **Node.js 客户端应用**，不包含 ZooKeeper 服务端。用户需要：

1. ✅ **Node.js 环境** - 运行客户端应用
2. ✅ **ZooKeeper 服务** - 用于节点发现和协调（可本地、Docker 或远程）

## 安装方式

### 方式 1: 一键安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/chat-room/main/install.sh | bash
```

**特点**：
- 🚀 自动检测环境
- 📝 交互式配置
- 🔧 自动生成配置文件
- 🌐 支持自定义 ZooKeeper 地址

**流程**：
1. 检查 Node.js、npm、git
2. 询问 ZooKeeper 地址
3. 克隆代码仓库
4. 安装依赖并编译
5. 生成配置文件

### 方式 2: 快速安装

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/chat-room/main/quick-install.sh | bash
```

**特点**：
- ⚡ 更快的安装速度
- 🧪 测试 ZooKeeper 连接
- 📦 最小化依赖

### 方式 3: Docker 部署

```bash
git clone https://github.com/yourusername/chat-room.git
cd chat-room

# 配置 ZooKeeper 地址
echo "ZK_ADDRESS=127.0.0.1:2181" > .env

# 启动
docker-compose up -d
```

### 方式 4: 手动安装

```bash
# 1. 克隆代码
git clone https://github.com/yourusername/chat-room.git
cd chat-room

# 2. 安装依赖
npm install

# 3. 编译
npm run build

# 4. 配置
mkdir -p ~/.chat-room
cat > ~/.chat-room/config.json << EOF
{
  "userId": "user-123",
  "nickname": "YourName",
  "p2pPort": 9000,
  "zkAddress": ["127.0.0.1:2181"],
  "recentRooms": []
}
EOF

# 5. 运行
node dist/index.js
```

## ZooKeeper 配置

### 选项 A: 本地 ZooKeeper

**macOS:**
```bash
brew install zookeeper
brew services start zookeeper
```

**Ubuntu/Debian:**
```bash
sudo apt-get install zookeeper
sudo systemctl start zookeeper
```

**验证:**
```bash
echo ruok | nc 127.0.0.1 2181
# 应返回: imok
```

### 选项 B: Docker ZooKeeper

```bash
docker run -d \
  --name zookeeper \
  -p 2181:2181 \
  zookeeper:3.8
```

### 选项 C: 远程 ZooKeeper

在配置文件中指定远程地址：

```json
{
  "zkAddress": ["192.168.1.100:2181", "192.168.1.101:2181"]
}
```

## 配置文件

位置：`~/.chat-room/config.json`

```json
{
  "userId": "user-unique-id",        // 自动生成
  "nickname": "YourNickname",         // 修改为你的昵称
  "p2pPort": 9000,                    // P2P 端口
  "zkAddress": ["127.0.0.1:2181"],   // ZooKeeper 地址
  "recentRooms": []                   // 最近访问的房间
}
```

## 启动应用

```bash
# 方式 1: 直接运行
cd ~/chat-room
node dist/index.js

# 方式 2: npm start
cd ~/chat-room
npm start

# 方式 3: 全局命令（需先 npm link）
chat-room

# 方式 4: 后台运行
nohup node dist/index.js > chat-room.log 2>&1 &

# 方式 5: PM2（推荐生产环境）
pm2 start dist/index.js --name chat-room
```

## 验证安装

启动后应该看到：

```
====================================
  Chat Room Terminal Tool
====================================

📡 Connecting to ZooKeeper at 127.0.0.1:2181...
✓ ZooKeeper connected

🏠 Available Rooms:
  (暂无聊天室)

选择聊天室 [上下键选择，Enter 加入，C 创建]:
```

## 常见问题

### Q: 提示 "ZooKeeper connection error"

**A:** 确保 ZooKeeper 正在运行：

```bash
# 检查进程
ps aux | grep zookeeper

# 测试连接
echo ruok | nc 127.0.0.1 2181

# 启动 ZooKeeper
zkServer start  # macOS
sudo systemctl start zookeeper  # Linux
```

### Q: 如何连接到团队已有的 ZooKeeper？

**A:** 修改配置文件：

```bash
vim ~/.chat-room/config.json
# 修改 "zkAddress" 为团队 ZooKeeper 地址
```

### Q: 端口 9000 被占用

**A:** 修改配置文件中的 `p2pPort`：

```json
{
  "p2pPort": 9001  // 改为其他端口
}
```

### Q: 如何在多台电脑上使用？

**A:** 确保所有电脑：
1. 安装了 Chat Room 客户端
2. 连接到同一个 ZooKeeper 服务
3. 在同一个聊天室中

## 文件结构

```
~/chat-room/
├── dist/           # 编译后的代码
├── node_modules/   # 依赖包
├── src/            # 源代码
├── package.json    # 项目配置
└── install.sh      # 安装脚本

~/.chat-room/       # 配置目录
└── config.json     # 用户配置
```

## 更新

```bash
cd ~/chat-room
git pull origin main
npm install
npm run build
```

## 卸载

```bash
# 停止应用
pm2 stop chat-room

# 删除文件
rm -rf ~/chat-room
rm -rf ~/.chat-room

# 删除全局命令
sudo npm unlink -g chat-room
```

## 相关文档

- 📖 [用户使用说明](./用户使用说明文档.md)
- 🔧 [部署开发说明](./部署开发说明文档.md)
- 📚 [API 文档](./API文档.md)
