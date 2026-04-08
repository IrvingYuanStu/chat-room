# Chat Room 开发任务列表

## 任务总览

| 里程碑 | 周期 | 任务数 | 依赖关系 |
|--------|------|--------|----------|
| Milestone 1: 基础框架 | Week 1 | 25 | 无 |
| Milestone 2: 消息收发 | Week 2 | 15 | M1 |
| Milestone 3: 互动功能 | Week 3 | 12 | M2 |
| Milestone 4: 数据与异常 | Week 4 | 14 | M2 |

---

## Milestone 1: 基础框架 (Week 1)

**目标:** 可运行的终端 UI 和 ZK 连接

### 1.1 项目初始化 [P]

| 任务ID | 任务描述 | 负责文件 | 验收标准 |
|--------|----------|----------|----------|
| M1.1.1 | 初始化 package.json | package.json | 包含所有依赖：ink, react, zookeeper, yargs, pino, uuid |
| M1.1.2 | 配置 tsconfig.json | tsconfig.json | 支持 JSX、strict mode、ES2020 |
| M1.1.3 | 配置 .gitignore | .gitignore | 忽略 node_modules、dist、logs |
| M1.1.4 | 创建项目目录结构 | src/ | 按 design.md 创建完整目录结构 |

### 1.2 类型定义 [P]

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.2.1 | 定义 Config 类型 | src/services/types.ts | - | 包含 zkAddresses, currentRoomId, nickname, recentRooms, port, dataDir, logDir, logLevel |
| M1.2.2 | 定义 Member 类型 | src/services/types.ts | - | 包含 userId, nickname, status, ip, port, joinedAt |
| M1.2.3 | 定义 ChatMessage 类型 | src/services/types.ts | - | 包含 id, type, roomId, senderId, senderNickname, content, timestamp, replyTo, mentions |
| M1.2.4 | 定义 Room 类型 | src/services/types.ts | - | 包含 roomId, members, createdAt |
| M1.2.5 | 定义 P2PMessage 类型 | src/services/types.ts | - | 包含 type, senderId, senderNickname, roomId, timestamp, payload |
| M1.2.6 | 定义 EventPayload 类型 | src/services/types.ts | - | 定义所有事件类型的 payload |

### 1.3 日志系统 [P]

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.3.1 | 实现 Logger 类 | src/utils/logger.ts | - | 支持 debug/info/warn/error 方法 |
| M1.3.2 | 配置 pino 日志输出 | src/utils/logger.ts | M1.3.1 | 支持文件轮转，单文件最大 10MB |
| M1.3.3 | 实现日志格式 | src/utils/logger.ts | M1.3.1 | 格式：[YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [MODULE] Message |
| M1.3.4 | 实现日志目录创建 | src/utils/logger.ts | M1.3.1 | 自动创建日志目录 |

### 1.4 命令行参数解析

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.4.1 | 定义 CLI 选项 | src/cli.ts | M1.2 | 支持 --zk-addresses, --port, --config, --nickname, --data-dir, --log-dir, --log-level, --help |
| M1.4.2 | 实现 yargs 解析 | src/cli.ts | M1.4.1 | 默认值正确，类型验证通过 |
| M1.4.3 | 生成 CLI 帮助信息 | src/cli.ts | M1.4.1 | --help 显示完整帮助 |

### 1.5 配置服务

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.5.1 | 实现 ConfigService 类 | src/services/ConfigService.ts | M1.2, M1.3 | load() 从文件加载配置 |
| M1.5.2 | 实现 save() 方法 | src/services/ConfigService.ts | M1.5.1 | 保存配置到 ~/.chat-room/config.json |
| M1.5.3 | 实现 get/set 方法 | src/services/ConfigService.ts | M1.5.1 | 支持单独获取/设置配置项 |
| M1.5.4 | 实现 promptConfig() 方法 | src/services/ConfigService.ts | M1.5.1 | 交互式配置引导 |

### 1.6 事件总线

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.6.1 | 实现 EventBus 类 | src/services/EventBus.ts | M1.2 | publish/subscribe/unsubscribe 方法 |
| M1.6.2 | 实现 once() 一次性订阅 | src/services/EventBus.ts | M1.6.1 | 订阅一次后自动取消 |

### 1.7 ZooKeeper 客户端

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.7.1 | 实现 ZKClient 连接 | src/network/ZKClient.ts | M1.2, M1.3 | connect/disconnect 方法 |
| M1.7.2 | 实现 createMemberNode | src/network/ZKClient.ts | M1.7.1 | 创建临时节点 |
| M1.7.3 | 实现 deleteMemberNode | src/network/ZKClient.ts | M1.7.1 | 删除临时节点 |
| M1.7.4 | 实现 setMemberData | src/network/ZKClient.ts | M1.7.1 | 更新节点数据（昵称修改） |
| M1.7.5 | 实现 getMembers | src/network/ZKClient.ts | M1.7.1 | 获取成员列表 |
| M1.7.6 | 实现 listRooms | src/network/ZKClient.ts | M1.7.1 | 获取聊天室列表 |
| M1.7.7 | 实现 watchMembers | src/network/ZKClient.ts | M1.7.1 | 监听成员变化 |
| M1.7.8 | 实现 watchRooms | src/network/ZKClient.ts | M1.7.1 | 监听聊天室列表变化 |
| M1.7.9 | 实现重连逻辑 | src/network/ZKClient.ts | M1.7.1 | 断开后 5 秒重连 |
| M1.7.10 | 实现 ensureRootNode | src/network/ZKClient.ts | M1.7.1 | 确保 /libra-regions 存在 |

### 1.8 UI 组件

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.8.1 | 实现 ConfigScreen | src/ui/screens/ConfigScreen.tsx | M1.5 | 首次启动配置界面 |
| M1.8.2 | 实现 RoomSelectScreen | src/ui/screens/RoomSelectScreen.tsx | M1.7 | 显示聊天室列表，支持创建/加入 |
| M1.8.3 | 实现 SystemBar | src/ui/components/SystemBar.tsx | M1.3 | 显示状态栏（聊天室ID、连接状态） |
| M1.8.4 | 实现 ScreenRouter | src/ui/App.tsx | M1.8.1, M1.8.2 | 路由切换不同屏幕 |

### 1.9 应用入口

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M1.9.1 | 实现 index.tsx 入口 | src/index.tsx | M1.4, M1.5, M1.7 | 解析参数 → 加载配置 → 连接 ZK → 显示界面 |
| M1.9.2 | 实现 App.tsx 主组件 | src/ui/App.tsx | M1.8 | 管理屏幕状态 |

---

## Milestone 2: 消息收发 (Week 2)

**目标:** 基本的 P2P 消息收发

### 2.1 P2P 网络层

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M2.1.1 | 实现 P2PTransport.encode | src/network/P2PTransport.ts | M1.2 | 封包消息（Magic + Length + JSON） |
| M2.1.2 | 实现 P2PTransport.decode | src/network/P2PTransport.ts | M2.1.1 | 解包消息 |
| M2.1.3 | 实现 P2PTransport.validate | src/network/P2PTransport.ts | M2.1.2 | 验证消息格式 |
| M2.1.4 | 实现 P2PServer.start | src/network/P2PServer.ts | M2.1.1 | 启动 TCP 服务器 |
| M2.1.5 | 实现 P2PServer.stop | src/network/P2PServer.ts | M2.1.4 | 停止 TCP 服务器 |
| M2.1.6 | 实现 P2PServer.onMessage | src/network/P2PServer.ts | M2.1.4 | 处理收到的消息 |
| M2.1.7 | 实现 P2PServer.onConnection | src/network/P2PServer.ts | M2.1.4 | 处理新连接 |
| M2.1.8 | 实现 P2PClient.connect | src/network/P2PClient.ts | M2.1.1 | 连接到其他节点 |
| M2.1.9 | 实现 P2PClient.disconnect | src/network/P2PClient.ts | M2.1.8 | 断开连接 |
| M2.1.10 | 实现 P2PClient.send | src/network/P2PClient.ts | M2.1.8 | 发送消息 |
| M2.1.11 | 实现 P2PClient.broadcast | src/network/P2PClient.ts | M2.1.10 | 广播消息 |

### 2.2 PeerService

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M2.2.1 | 实现 PeerService 类 | src/services/PeerService.ts | M2.1 | 管理所有 P2P 连接 |
| M2.2.2 | 实现广播消息 | src/services/PeerService.ts | M2.2.1 | 遍历所有连接发送 |
| M2.2.3 | 实现连接管理 | src/services/PeerService.ts | M2.2.1 | 维护连接状态 |

### 2.3 ChatService

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M2.3.1 | 实现 sendMessage | src/services/ChatService.ts | M2.2 | 构造并发送消息 |
| M2.3.2 | 实现 broadcast | src/services/ChatService.ts | M2.3.1 | P2P 广播 |
| M2.3.3 | 实现 formatMessage | src/services/ChatService.ts | M2.3.1 | 格式化消息用于显示 |

### 2.4 MemberService

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M2.4.1 | 实现 MemberService 类 | src/services/MemberService.ts | M1.2 | 管理成员列表 |
| M2.4.2 | 实现 onMemberJoin | src/services/MemberService.ts | M2.4.1 | 处理成员加入 |
| M2.4.3 | 实现 onMemberLeave | src/services/MemberService.ts | M2.4.1 | 处理成员离开 |
| M2.4.4 | 实现 isOnline | src/services/MemberService.ts | M2.4.1 | 检查成员是否在线 |

### 2.5 RoomService

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M2.5.1 | 实现 joinRoom | src/services/RoomService.ts | M1.7 | 加入聊天室 |
| M2.5.2 | 实现 leaveRoom | src/services/RoomService.ts | M2.5.1 | 离开聊天室 |
| M2.5.3 | 实现 switchRoom | src/services/RoomService.ts | M2.5.2 | 切换聊天室 |

### 2.6 UI 组件

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M2.6.1 | 实现 ChatView | src/ui/components/ChatView.tsx | M2.3 | 显示消息列表 |
| M2.6.2 | 实现 MemberList | src/ui/components/MemberList.tsx | M2.4 | 显示成员列表 |
| M2.6.3 | 实现 InputBox | src/ui/components/InputBox.tsx | M2.3 | 消息输入框 |
| M2.6.4 | 实现 ChatScreen | src/ui/screens/ChatScreen.tsx | M2.6.1, M2.6.2, M2.6.3 | 聊天室主界面 |

---

## Milestone 3: 互动功能 (Week 3)

**目标:** @ 和回复功能

### 3.1 MentionService

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M3.1.1 | 实现 processInput | src/services/MentionService.ts | M2.4 | 检测 @ 触发自动补全 |
| M3.1.2 | 实现 parseMentions | src/services/MentionService.ts | M3.1.1 | 解析消息中的 @ 用户 |
| M3.1.3 | 实现 highlightMentions | src/services/MentionService.ts | M3.1.2 | 高亮显示被 @ 用户 |

### 3.2 @ 功能 UI

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M3.2.1 | 实现 @ 自动补全浮层 | src/ui/components/InputBox.tsx | M3.1.1 | 输入 @ 后弹出成员列表 |
| M3.2.2 | 实现成员选择 | src/ui/components/InputBox.tsx | M3.2.1 | 键盘/鼠标选择 |
| M3.2.3 | 实现 @ 消息高亮 | src/ui/components/ChatView.tsx | M3.1.3 | 被 @ 的消息黄色高亮 |

### 3.3 回复功能

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M3.3.1 | 实现消息选中状态 | src/ui/components/ChatView.tsx | M2.6.1 | 鼠标选中消息 |
| M3.3.2 | 实现点击回复 | src/ui/components/ChatView.tsx | M3.3.1 | 选中后点击回复 |
| M3.3.3 | 实现回复引用显示 | src/ui/components/ChatView.tsx | M2.3 | 显示「原消息」引用 |
| M3.3.4 | 实现回复消息格式 | src/services/ChatService.ts | M3.3.3 | [回复 原消息]: 内容 |

### 3.4 昵称修改

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M3.4.1 | 实现 /rename 命令解析 | src/ui/components/InputBox.tsx | M2.6.3 | 解析 /rename 新昵称 |
| M3.4.2 | 实现 rename 方法 | src/services/MemberService.ts | M3.4.1 | 更新 ZK 节点数据 |
| M3.4.3 | 广播昵称变更通知 | src/services/MemberService.ts | M3.4.2 | PeerService.broadcast nick_change |

---

## Milestone 4: 数据与异常 (Week 4)

**目标:** 完整的数据持久化和异常处理

### 4.1 HistoryService

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M4.1.1 | 实现 getHistoryPath | src/services/HistoryService.ts | M1.2 | 返回 /tmp/chat-room/{roomId}/history.txt |
| M4.1.2 | 实现 save 方法 | src/services/HistoryService.ts | M4.1.1 | 追加写入本地文件 |
| M4.1.3 | 实现 loadHistory | src/services/HistoryService.ts | M4.1.1 | 加载最近 500 条消息 |
| M4.1.4 | 实现 formatMessageLine | src/services/HistoryService.ts | M4.1.2 | 格式化消息行 |
| M4.1.5 | 实现 parseMessageLine | src/services/HistoryService.ts | M4.1.3 | 解析消息行 |
| M4.1.6 | 实现 cleanupOldMessages | src/services/HistoryService.ts | M4.1.5 | 清理 30 天前消息 |
| M4.1.7 | 实现 startupCleanup | src/services/HistoryService.ts | M4.1.6 | 启动时清理 |

### 4.2 异常处理

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M4.2.1 | 实现 ZK 断开警告 | src/network/ZKClient.ts | M1.7.9 | 显示断开警告 |
| M4.2.2 | 实现 ZK 重连成功提示 | src/network/ZKClient.ts | M1.7.9 | 重连后显示提示 |
| M4.2.3 | 实现离线 @ 警告 | src/services/ChatService.ts | M2.3 | 给离线成员发 @ 消息时警告 |
| M4.2.4 | 实现本地历史浏览 | src/services/HistoryService.ts | M4.1.3 | 断网时仍可查看本地历史 |

### 4.3 多聊天室切换

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M4.3.1 | 实现多聊天室状态管理 | src/services/RoomService.ts | M2.5 | 维护多个聊天室状态 |
| M4.3.2 | 实现切换时历史保存 | src/services/HistoryService.ts | M4.3.1 | 切换前保存当前聊天室历史 |
| M4.3.3 | 实现切换时历史加载 | src/services/HistoryService.ts | M4.3.2 | 切换后加载新聊天室历史 |

### 4.4 退出功能

| 任务ID | 任务描述 | 负责文件 | 依赖 | 验收标准 |
|--------|----------|----------|------|----------|
| M4.4.1 | 实现 /exit-room 命令 | src/ui/components/InputBox.tsx | M2.5.2 | 退出当前聊天室 |
| M4.4.2 | 实现退出确认提示 | src/ui/screens/ChatScreen.tsx | M4.4.1 | 退出前确认 |
| M4.4.3 | 实现 /quit 命令 | src/ui/components/InputBox.tsx | M4.4.1 | 退出程序 |
| M4.4.4 | 实现 cleanup 清理 | src/index.tsx | M4.4.3 | 清理 ZK 临时节点、保存配置、关闭服务器 |

---

## 任务依赖关系图

```
M1 (基础框架)
├── M1.1 项目初始化 [P]
├── M1.2 类型定义 [P]
├── M1.3 日志系统 [P]
├── M1.4 命令行参数 → M1.4.1-3
├── M1.5 配置服务 → M1.5.1-4 (依赖 M1.2, M1.3)
├── M1.6 事件总线 → M1.6.1-2 (依赖 M1.2)
├── M1.7 ZK客户端 → M1.7.1-10 (依赖 M1.2, M1.3)
├── M1.8 UI组件 → M1.8.1-4 (依赖 M1.5, M1.7)
└── M1.9 入口 → M1.9.1-2 (依赖 M1.4, M1.5, M1.7)

M2 (消息收发) [依赖 M1]
├── M2.1 P2P网络层 → M2.1.1-11 (依赖 M1.2)
├── M2.2 PeerService → M2.2.1-3 (依赖 M2.1)
├── M2.3 ChatService → M2.3.1-3 (依赖 M2.2)
├── M2.4 MemberService → M2.4.1-4 (依赖 M1.2)
├── M2.5 RoomService → M2.5.1-3 (依赖 M1.7)
└── M2.6 UI组件 → M2.6.1-4 (依赖 M2.3, M2.4)

M3 (互动功能) [依赖 M2]
├── M3.1 MentionService → M3.1.1-3 (依赖 M2.4)
├── M3.2 @功能UI → M3.2.1-3 (依赖 M3.1)
├── M3.3 回复功能 → M3.3.1-4 (依赖 M2.3)
└── M3.4 昵称修改 → M3.4.1-3 (依赖 M2.4)

M4 (数据与异常) [依赖 M2]
├── M4.1 HistoryService → M4.1.1-7 (依赖 M1.2)
├── M4.2 异常处理 → M4.2.1-4 (依赖 M1.7.9, M2.3)
├── M4.3 多聊天室 → M4.3.1-3 (依赖 M2.5)
└── M4.4 退出功能 → M4.4.1-4 (依赖 M2.5.2)
```

---

## 执行顺序建议

**第一阶段 (可并行):** M1.1 → M1.2 → M1.3
**第二阶段 (串行):** M1.4 → M1.5 → M1.6 → M1.7 → M1.8 → M1.9
**第三阶段 (可并行):** M2.1 → M2.2 → M2.3 → M2.4 → M2.5 → M2.6
**第四阶段 (可并行):** M3.1 → M3.2 → M3.3 → M3.4
**第五阶段 (可并行):** M4.1 → M4.2 → M4.3 → M4.4
