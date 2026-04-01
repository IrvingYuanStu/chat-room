# Chat Room Terminal Tool

<div align="center">

**一个运行在 macOS 终端的局域网 P2P 聊天室工具**

[![Node Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

</div>

## ✨ 特性

- **🌐 去中心化 P2P 架构** - 无中心服务器，基于 TCP 全互联拓扑
- **🔍 自动节点发现** - 通过 ZooKeeper 实现自动节点注册与发现
- **💬 原生终端体验** - 完全在终端内操作，符合开发者使用习惯
- **👥 实时群聊** - 支持 50+ 成员同时在线，消息延迟 < 500ms
- **🔔 @ 提醒与回复** - 支持 @ 用户和回复消息的互动功能
- **📜 消息持久化** - 本地存储历史消息，重启后可查看
- **⚡ 轻量高效** - 内存占用 < 100MB，秒级启动

## 🎯 适用场景

- 局域网内临时沟通场景（会议、协作、培训）
- 开发团队内部交流
- 服务器运维人员实时沟通
- 需要轻量级聊天工具的小团队

## 📸 界面预览

```
┌─────────────────────────────────────────────────────────────┐
│  chat-room - [general]        ● 已连接    在线: 5            │
├─────────────────────────────┬───────────────────────────────┤
│                             │                               │
│  [14:30:25] 系统: 张三 加入了聊天室  │  成员 (5)              │
│  [14:30:28] 张三: 大家好              │  - ● 张三              │
│  [14:30:35] 李四: @张三 欢迎！         │  - ● 李四              │
│  [14:30:40] 张三 [回复 李四]: 谢谢！    │  - ● 王五              │
│  [14:31:00] 系统: 李四 离开了聊天室     │  - ● 赵六              │
│                             │  - ○ 钱七 (离线)        │
│  [我的昵称] ________________ │                               │
│                             │                               │
└─────────────────────────────┴───────────────────────────────┘
```

## 🚀 快速开始

### 前置要求

- **Node.js** >= v16
- **ZooKeeper** >= v3.6（需要可访问的 ZooKeeper 服务）

### 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/chat-room/main/install.sh | bash
```

安装脚本会自动：
- 检查 Node.js 环境
- 克隆代码仓库
- 安装依赖并编译
- 生成配置文件
- 配置 ZooKeeper 地址

### 快速安装（已有 ZooKeeper）

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/chat-room/main/quick-install.sh | bash
```

### Docker 部署

```bash
# 克隆仓库
git clone https://github.com/yourusername/chat-room.git
cd chat-room

# 配置 ZooKeeper 地址
echo "ZK_ADDRESS=your-zk-host:2181" > .env

# 启动容器
docker-compose up -d
```

### 手动安装

- **Node.js**: >= 22.0.0
- **ZooKeeper**: 3.5.9 或更高版本
- **操作系统**: macOS (Darwin)
- **网络**: 局域网环境

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd chat-room
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建项目**
   ```bash
   npm run build
   ```

4. **全局安装（可选）**
   ```bash
   npm link
   ```

### 启动 ZooKeeper

确保 ZooKeeper 服务已启动：

```bash
# 使用 Homebrew 安装的 ZooKeeper
zkServer start

# 或使用 Docker
docker run --name zookeeper -p 2181:2181 -d zookeeper:3.5.9
```

### 运行应用

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 或全局安装后直接运行
chat-room
```

## 📖 使用说明

### 首次启动

1. **配置 ZooKeeper 地址**
   ```
   请输入 ZooKeeper 集群地址，格式: host:port
   多个地址用逗号分隔，例如: 127.0.0.1:2181,127.0.0.1:2182
   > 127.0.0.1:2181
   ```

2. **配置昵称**
   ```
   请输入您的显示昵称 (1-20 个字符)
   > 张三
   ```

3. **选择或创建聊天室**
   ```
   选择聊天室:
     1. general (3 位成员)
     2. dev-team (5 位成员)
     输入聊天室 ID 创建新聊天室，或按 C 创建
   ```

### 聊天命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/rename 新昵称` | 修改昵称 | `/rename 张三` |
| `/exit-room` | 退出当前聊天室 | `/exit-room` |
| `/quit` | 退出程序 | `/quit` |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift+Enter` | 换行（多行输入） |
| `@` | 触发成员补全 |
| `↑` / `↓` | 选择消息（回复模式） |
| `Esc` | 取消当前操作 |
| `Ctrl+C` | 强制退出程序 |

## 🏗️ 技术架构

### 技术栈

- **运行时**: Node.js 22
- **语言**: TypeScript 5.9
- **UI 框架**: Ink (React for CLI)
- **协调服务**: Apache ZooKeeper 3.5.9
- **通信协议**: TCP (P2P)
- **依赖管理**: npm

### 核心模块

```
chat-room/
├── ui/                    # UI 层 (Ink/React)
│   ├── components/        # 可复用组件
│   └── screens/          # 屏幕页面
├── services/             # 业务逻辑层
│   ├── ChatService.ts    # 消息调度
│   ├── PeerService.ts    # P2P 连接管理
│   └── MemberService.ts  # 成员状态管理
├── network/              # 网络层
│   ├── ZKClient.ts       # ZooKeeper 客户端
│   └── P2PServer.ts      # TCP 服务端
└── store/                # 存储层
    ├── ConfigStore.ts    # 配置文件读写
    └── HistoryStore.ts   # 历史消息存储
```

### 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                        Chat Room Client                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    UI Layer (Ink/React)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│            │                                                     │
│  ┌─────────▼───────────────────────────────────────────────────┐  │
│  │                   Service Layer                             │  │
│  │  ChatService │ PeerService │ MemberService │ RoomService   │  │
│  └────────────────────────────────────────────────────────────┘  │
│            │                                    │               │
│  ┌─────────▼─────────────────┐   ┌─────────────▼──────────────┐ │
│  │    Network Layer          │   │    Storage Layer            │ │
│  │  ZKClient │ P2PServer/Client│   │  ConfigStore │ HistoryStore│ │
│  └────────────────────────────┘   └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 📄 文档

- [部署开发说明文档](./docs/部署开发说明文档.md) - 部署、测试、开发、打包发布指南
- [用户使用说明文档](./docs/用户使用说明文档.md) - 详细的使用教程
- [产品需求文档](./spec/chat-room-spec.md) - PRD 规格说明
- [技术设计文档](./spec/plan.md) - 技术架构设计
- [任务分解](./spec/tasks.md) - 开发任务列表

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试并监听变化
npm test -- --watch

# 生成覆盖率报告
npm test -- --coverage
```

## 🔧 开发

```bash
# 开发模式（热重载）
npm run dev

# 类型检查
npm run build -- --noEmit

# 代码检查
npm run lint
```

## 📦 打包发布

```bash
# 构建
npm run build

# 发布到 npm
npm publish

# 或创建可分发的 tarball
npm pack
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[ISC](LICENSE)

## 🙏 致谢

- [Ink](https://github.com/vadimdemedes/ink) - React for interactive CLI
- [node-zookeeper-client](https://github.com/yfgeek/node-zookeeper-client) - ZooKeeper client for Node.js
- [ZooKeeper](https://zookeeper.apache.org/) - Distributed coordination service

---

<div align="center">

**Made with ❤️ by developers, for developers**

</div>
