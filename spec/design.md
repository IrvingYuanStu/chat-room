# Chat Room 技术设计文档

| 文档版本 | 1.0 |
|---------|-----|
| 创建日期 | 2026-04-03 |
| 文档状态 | 初始版本 |
| 基于规格 | chat-room-spec.md v1.0 |

---

## 1. 技术栈概述

### 1.1 核心技术选型

| 类别 | 技术选型 | 版本要求 | 说明 |
|-----|---------|---------|-----|
| 开发语言 | TypeScript | 4.9+ | 类型安全，IDE 支持好 |
| 运行时 | Node.js | 16+ | LTS 版本 |
| 终端UI组件 | Ink | 4.x | React 风格的终端UI库 |
| ZooKeeper 客户端 | zookeeper | 3.5.9 | 官方推荐客户端 |
| 命令行解析 | yargs | 17.x | 参数解析 |
| 日志库 | pino | 8.x | 高性能日志 |
| 打包工具 | pkg | 5.x | 二进制打包 |
| 包管理器 | npm | 8+ | 包管理 |

### 1.2 项目结构

```
chat-room/
├── src/
│   ├── index.ts              # 入口文件
│   ├── cli.ts                # 命令行参数定义
│   ├── App.tsx               # 主应用组件
│   ├── components/           # Ink UI 组件
│   │   ├── ChatView.tsx       # 聊天消息显示区
│   │   ├── InputBox.tsx       # 消息输入框
│   │   ├── MemberList.tsx     # 成员列表
│   │   ├── SystemBar.tsx       # 系统状态栏
│   │   └── screens/           # 界面屏幕
│   │       ├── ConfigScreen.tsx    # 配置界面
│   │       ├── RoomSelectScreen.tsx # 聊天室选择
│   │       └── ChatScreen.tsx      # 聊天室主界面
│   ├── services/             # 业务服务层
│   │   ├── ChatService.ts     # 聊天服务
│   │   ├── ConfigService.ts   # 配置服务
│   │   ├── EventBus.ts        # 事件总线
│   │   ├── HistoryService.ts  # 历史记录服务
│   │   ├── MemberService.ts   # 成员管理服务
│   │   ├── MentionService.ts  # @提醒服务
│   │   ├── PeerService.ts     # P2P连接服务
│   │   ├── RoomService.ts     # 聊天室服务
│   │   └── types.ts          # 服务类型定义
│   ├── network/              # 网络层
│   │   ├── P2PClient.ts       # P2P客户端
│   │   ├── P2PServer.ts       # P2P服务器
│   │   ├── P2PTransport.ts    # P2P传输层
│   │   ├── PeerConnection.ts  # 对等连接
│   │   └── ZKClient.ts        # ZooKeeper客户端
│   ├── store/                # 状态管理
│   │   ├── ConfigStore.ts     # 配置状态
│   │   └── HistoryStore.ts    # 历史记录状态
│   └── utils/                # 工具函数
│       ├── logger.ts          # 日志工具
│       └── parser.ts          # 消息解析
├── spec/
│   ├── chat-room-spec.md     # 产品需求文档
│   └── design.md             # 本文档
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chat Room App                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     UI Layer (Ink)                      │    │
│  │  ┌─────────────┬─────────────┬─────────────────────┐   │    │
│  │  │ ChatView    │ MemberList  │     InputBox        │   │    │
│  │  └─────────────┴─────────────┴─────────────────────┘   │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │              Screen Manager                      │   │    │
│  │  │  ConfigScreen | RoomSelectScreen | ChatScreen   │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Service Layer                          │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │    │
│  │  │ ChatService  │ │ MemberService │ │ RoomService  │   │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │    │
│  │  │HistoryService│ │ MentionService│ │ ConfigService│   │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Network Layer                         │    │
│  │  ┌────────────────────┐  ┌────────────────────────────┐  │    │
│  │  │   ZKClient         │  │    P2P Network             │  │    │
│  │  │   (Service Register)│ │  ┌─────────┐ ┌─────────┐  │  │    │
│  │  │                    │  │  │P2PServer│ │P2PClient│  │  │    │
│  │  └────────────────────┘  │  └─────────┘ └─────────┘  │  │    │
│  │                          └────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Event Bus (Pub/Sub)                    │    │
│  │  Events: message, member_join, member_leave, nick_change │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │        ZooKeeper              │
              │   (Node Discovery)            │
              │   127.0.0.1:2181              │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     Other Chat Room Nodes     │
              │     (P2P Communication)        │
              └───────────────────────────────┘
```

### 2.2 核心模块职责

| 模块 | 职责 | 关键类/文件 |
|-----|------|------------|
| ZKClient | 连接ZooKeeper，节点注册与发现 | `src/network/ZKClient.ts` |
| P2PServer | 启动TCP服务器，监听连接 | `src/network/P2PServer.ts` |
| P2PClient | 主动连接其他节点 | `src/network/P2PClient.ts` |
| PeerService | 管理所有P2P连接 | `src/services/PeerService.ts` |
| RoomService | 聊天室CRUD，成员管理 | `src/services/RoomService.ts` |
| ChatService | 消息发送接收 | `src/services/ChatService.ts` |
| HistoryService | 消息持久化 | `src/services/HistoryService.ts` |
| ConfigService | 配置文件读写 | `src/services/ConfigService.ts` |

### 2.3 数据流向

```
用户输入消息
     │
     ▼
InputBox ──> ChatService.sendMessage()
     │              │
     │              ▼
     │         P2PClient.broadcast()  ──> TCP连接 ──> 其他节点
     │                                          │
     │                                          ▼
     │                              P2PServer.receive()
     │                                          │
     │                                          ▼
     │                                  EventBus.publish('message')
     │                                          │
     │                                          ▼
     │                              ChatView.render() ◄── HistoryStore
     │
     ▼
HistoryService.save()
     │
     ▼
本地文件 /tmp/chat-room/{roomId}/history.txt
```

---

## 3. 功能设计（按用户故事组织）

### 3.1 配置与启动（US-001, US-002, US-003）

#### US-001: 首次启动与配置

**功能描述:**
- 检测 `~/.chat-room/config.json` 是否存在
- 不存在时启动 ConfigScreen，引导用户输入 ZooKeeper 地址
- 支持多地址逗号分隔
- 配置保存到文件

**关键代码结构:**

```typescript
// src/services/ConfigService.ts
interface Config {
  zkAddresses: string[];      // ZooKeeper 地址列表
  currentRoomId: string;      // 当前聊天室ID
  nickname: string;           // 用户昵称
  recentRooms: string[];      // 最近访问的聊天室
}

class ConfigService {
  private configPath: string;
  private config: Config;

  async load(): Promise<Config>
  async save(config: Config): Promise<void>
  async promptConfig(): Promise<Config>  // 交互式配置
}
```

**流程:**
```
启动 --> 检测配置文件
           │
           ├─ 不存在 --> ConfigScreen --> 用户输入ZK地址
           │                         --> 保存配置文件
           │
           └─ 存在 --> 显示已保存配置 --> 用户确认/修改
```

#### US-002: 选择聊天室

**功能描述:**
- 从 ZooKeeper 的 `/libra-regions/{roomId}/members` 获取已有聊天室列表
- 用户输入新ID自动创建

**关键代码结构:**

```typescript
// src/services/RoomService.ts
interface Room {
  roomId: string;
  members: Member[];
  createdAt: Date;
}

class RoomService {
  async listRooms(): Promise<string[]>   // 从ZK获取所有聊天室
  async joinRoom(roomId: string): Promise<void>
  async leaveRoom(): Promise<void>
  async switchRoom(newRoomId: string): Promise<void>
}
```

#### US-003: 多聊天室切换

**功能描述:**
- 维护多个聊天室状态
- 切换时保存当前聊天历史，加载新聊天室历史
- 各聊天室消息历史独立

**流程:**
```
用户输入 /exit-room
         │
         ▼
RoomService.leaveRoom() --> ZK删除临时节点
                        --> 通知其他成员
                        --> 返回 RoomSelectScreen

用户选择新聊天室
         │
         ▼
RoomService.joinRoom() --> ZK创建临时节点
                        --> 加载历史消息
                        --> 进入 ChatScreen
```

---

### 3.2 消息收发（US-004, US-005, US-006, US-007）

#### US-004: 发送纯文本消息

**功能描述:**
- 输入框显示当前用户昵称
- Enter 发送，Shift+Enter 换行
- 发送后立即显示在聊天区

**关键代码结构:**

```typescript
// src/services/ChatService.ts
interface ChatMessage {
  id: string;              // 消息唯一ID (UUID)
  type: 'normal' | 'system' | 'mention' | 'reply';
  roomId: string;
  senderId: string;        // 发送者 userId
  senderNickname: string;
  content: string;
  timestamp: number;       // Unix timestamp ms
  replyTo?: string;        // 被回复的消息ID
  mentions?: string[];     // 被@的用户ID列表
}

interface ReplyInfo {
  originalMessageId: string;
  originalSenderNickname: string;
  originalContent: string;
}

class ChatService {
  async sendMessage(content: string, replyTo?: ReplyInfo): Promise<void>
  broadcast(message: ChatMessage): void  // 通过P2P广播
}
```

**消息发送流程:**
```
用户输入文本并按 Enter
        │
        ▼
InputBox.onSubmit(content)
        │
        ▼
ChatService.sendMessage(content, replyTo)
        │
        ├─> 构造 ChatMessage 对象
        │
        ├─> HistoryService.save(message)  // 本地持久化
        │
        ├─> EventBus.publish('message', message)  // 本地渲染
        │
        └─> PeerService.broadcast(message)  // 广播给其他节点
                │
                ▼
           TCP --> P2PClient.send()
                │
                ▼
           其他节点收到后走同样流程
```

#### US-005: 接收并显示消息

**功能描述:**
- 新消息自动出现在聊天区底部
- 消息格式：`[HH:mm:ss] 昵称: 消息内容`
- 有新消息时终端标题闪烁

**关键代码结构:**

```typescript
// src/components/ChatView.tsx
interface ChatViewProps {
  messages: ChatMessage[];
  onReply: (messageId: string) => void;
  onMention: (userId: string) => void;
}

// 消息渲染格式
function formatMessage(msg: ChatMessage): string {
  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  switch (msg.type) {
    case 'system':
      return `${time} 系统: ${msg.content}`;
    case 'reply':
      return `${time} ${msg.senderNickname} [回复 ${msg.replyTo.originalSenderNickname}]: ${msg.content}`;
    case 'mention':
      return `${time} ${msg.senderNickname}: @${msg.mentions.join(' ')} ${msg.content}`;
    default:
      return `${time} ${msg.senderNickname}: ${msg.content}`;
  }
}
```

#### US-006: @ 用户

**功能描述:**
- 输入 `@` 后弹出在线成员列表
- 支持键盘/鼠标选择补全
- 被@消息高亮显示

**关键代码结构:**

```typescript
// src/services/MentionService.ts
class MentionService {
  private在线成员列表: Member[];

  processInput(input: string): {
    isMentioning: boolean;
    members: Member[];
  }

  parseMentions(content: string): string[]  // 解析消息中的@用户
  highlightMentions(content: string, mentions: string[]): ReactNode  // 高亮
}
```

**@补全流程:**
```
用户输入 @
        │
        ▼
InputBox 检测到 @ 字符
        │
        ▼
MentionService.processInput() --> 返回在线成员列表
        │
        ▼
显示自动补全浮层
        │
        ▼
用户选择成员 --> 插入完整 @nickname
```

#### US-007: 回复消息

**功能描述:**
- 鼠标选中消息点击"回复"
- 回复消息显示引用内容
- 格式：`[HH:mm:ss] 昵称 [回复 原消息]: 回复内容`

**关键代码结构:**

```typescript
// src/components/ChatView.tsx
interface MessageItemProps {
  message: ChatMessage;
  isSelected: boolean;
  onReply: () => void;
  onHover: () => void;
}

// 渲染回复消息
function renderReplyMessage(msg: ChatMessage): ReactNode {
  if (msg.type !== 'reply' || !msg.replyTo) {
    return <Text>{msg.content}</Text>;
  }

  return (
    <Box>
      <Text dimColor>「 {msg.replyTo.originalSenderNickname}: {msg.replyTo.originalContent} 」</Text>
      <Text>{msg.content}</Text>
    </Box>
  );
}
```

---

### 3.3 用户状态（US-008, US-009, US-010, US-011）

#### US-008 & US-009: 上线/下线通知

**功能描述:**
- 成员加入/离开时显示系统消息
- 右侧成员列表实时更新

**关键代码结构:**

```typescript
// src/services/MemberService.ts
interface Member {
  userId: string;
  nickname: string;
  status: 'online' | 'offline';
  ip: string;
  port: number;
  joinedAt: number;
}

class MemberService {
  private members: Map<string, Member>;

  async updateMembers(): Promise<void>      // 从ZK同步成员列表
  onMemberJoin(member: Member): void        // 处理成员加入
  onMemberLeave(memberId: string): void     // 处理成员离开
  broadcastStatus(): void                  // 广播自身状态
}

// ZK 临时节点数据结构
interface MemberNodeData {
  nickname: string;
  status: 'online';
  ip: string;
  port: number;
  userId: string;
}
```

**上下线流程:**
```
新节点启动
        │
        ▼
ZKClient.createEphemeralNode()  --> ZK /libra-regions/{roomId}/members/{userId}
        │
        ▼
其他节点 ZK Watch 触发
        │
        ▼
MemberService.onMemberJoin()
        │
        ├─> EventBus.publish('member_join', member)
        │         │
        │         ▼
        │    ChatScreen 显示系统消息 "[HH:mm:ss] 系统: {nickname} 加入了聊天室"
        │
        └─> 更新 MemberList 组件

节点断开（包括正常退出和异常断开）
        │
        ▼
ZK 临时节点自动删除
        │
        ▼
其他节点 ZK Watch 触发
        │
        ▼
MemberService.onMemberLeave()
        │
        ├─> EventBus.publish('member_leave', memberId)
        │         │
        │         ▼
        │    ChatScreen 显示系统消息 "[HH:mm:ss] 系统: {nickname} 离开了聊天室"
        │
        └─> 更新 MemberList 组件（标记为离线）
```

#### US-010: 修改昵称

**功能描述:**
- 支持 `/rename 新昵称` 命令
- 修改后更新 ZK 节点数据
- 通知其他成员

**关键代码结构:**

```typescript
// src/services/MemberService.ts
async rename(newNickname: string): Promise<void> {
  // 1. 更新本地配置
  ConfigService.updateNickname(newNickname);

  // 2. 更新 ZK 节点数据（更新临时节点内容，而非删除重建）
  await ZKClient.setNodeData(path, {
    ...currentData,
    nickname: newNickname
  });

  // 3. 广播昵称变更通知
  PeerService.broadcast({
    type: 'nick_change',
    userId: this.userId,
    oldNickname: this.nickname,
    newNickname: newNickname
  });
}
```

#### US-011: 查看成员状态

**功能描述:**
- 右侧成员列表显示所有成员
- 在线绿色，离线灰色
- 按加入时间排序

**关键代码结构:**

```typescript
// src/components/MemberList.tsx
interface MemberListProps {
  members: Member[];
  currentUserId: string;
}

function MemberList({ members, currentUserId }: MemberListProps) {
  const sortedMembers = [...members].sort((a, b) => b.joinedAt - a.joinedAt);

  return (
    <Box flexDirection="column">
      <Text bold>成员列表 ({members.length})</Text>
      {sortedMembers.map(member => (
        <Box key={member.userId}>
          <Text
            color={member.status === 'online' ? 'green' : 'gray'}
          >
            {member.status === 'online' ? '●' : '○'}
          </Text>
          <Text
            color={member.userId === currentUserId ? 'blue' : 'white'}
          >
            {member.nickname}
            {member.userId === currentUserId && ' (我)'}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

---

### 3.4 数据持久化（US-012, US-013, US-014）

#### US-012: 消息本地存储

**存储路径:** `/tmp/chat-room/{roomId}/history.txt`

**存储格式:**
```
[14:30:25] 系统: 张三 加入了聊天室
[14:30:28] 张三: 大家好
[14:30:35] 李四: @张三 欢迎！
[14:30:40] 张三 [回复 李四]: 谢谢！
```

**关键代码结构:**

```typescript
// src/services/HistoryService.ts
interface HistoryConfig {
  dataDir: string;           // 默认 /tmp/chat-room
  maxMessages: number;       // 默认 500
  retentionDays: number;     // 默认 30 天
}

class HistoryService {
  private config: HistoryConfig;

  getHistoryPath(roomId: string): string {
    return `${this.config.dataDir}/${roomId}/history.txt`;
  }

  async save(message: ChatMessage): Promise<void> {
    const path = this.getHistoryPath(message.roomId);
    const line = this.formatMessageLine(message) + '\n';

    await fs.promises.appendFile(path, line, 'utf-8');
  }

  formatMessageLine(msg: ChatMessage): string {
    const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    if (msg.type === 'system') {
      return `[${time}] 系统: ${msg.content}`;
    }

    if (msg.type === 'reply' && msg.replyTo) {
      return `[${time}] ${msg.senderNickname} [回复 ${msg.replyTo.originalSenderNickname}]: ${msg.content}`;
    }

    return `[${time}] ${msg.senderNickname}: ${msg.content}`;
  }
}
```

#### US-013: 历史消息加载

**关键代码结构:**

```typescript
// src/services/HistoryService.ts
async loadHistory(roomId: string, limit: number = 500): Promise<ChatMessage[]> {
  const path = this.getHistoryPath(roomId);

  if (!await this.fileExists(path)) {
    return [];
  }

  const content = await fs.promises.readFile(path, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // 取最后 limit 条
  const recentLines = lines.slice(-limit);

  return recentLines.map(line => this.parseMessageLine(line));
}

parseMessageLine(line: string): ChatMessage {
  // 解析 [HH:mm:ss] 昵称: 内容 格式
  const match = line.match(/\[(\d{2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.+)/);
  if (!match) {
    // 系统消息 [HH:mm:ss] 系统: 内容
    const sysMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\]\s*系统:\s*(.+)/);
    if (sysMatch) {
      return {
        id: generateUUID(),
        type: 'system',
        content: sysMatch[2],
        timestamp: this.parseTime(sysMatch[1])
      };
    }
    throw new Error(`Invalid message line: ${line}`);
  }

  return {
    id: generateUUID(),
    type: 'normal',
    roomId: this.currentRoomId,
    senderNickname: match[2],
    content: match[3],
    timestamp: this.parseTime(match[1])
  };
}
```

#### US-014: 历史消息清理

**关键代码结构:**

```typescript
// src/services/HistoryService.ts
async cleanupOldMessages(roomId: string): Promise<void> {
  const path = this.getHistoryPath(roomId);
  const cutoffDate = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

  const content = await fs.promises.readFile(path, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const validLines = lines.filter(line => {
    const msg = this.parseMessageLine(line);
    return msg.timestamp >= cutoffDate;
  });

  await fs.promises.writeFile(path, validLines.join('\n') + '\n', 'utf-8');
}

// 启动时调用
async startupCleanup(): Promise<void> {
  const roomDirs = await fs.promises.readdir(this.config.dataDir);
  for (const roomId of roomDirs) {
    await this.cleanupOldMessages(roomId);
  }
}
```

---

### 3.5 异常处理（US-015, US-016）

#### US-015: ZooKeeper 连接断开

**关键代码结构:**

```typescript
// src/network/ZKClient.ts
class ZKClient {
  private client: zk.Client;
  private reconnectInterval: number = 5000;  // 5秒
  private isConnected: boolean = false;

  async connect(addresses: string[]): Promise<void> {
    this.client = zk.createClient({
      connect: addresses.join(','),
      timeout: 10000,
      debug_level: zk.ZooKeeperLogLevel.WARN
    });

    this.client.on('connected', () => {
      this.isConnected = true;
      EventBus.publish('zk_connected');
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      EventBus.publish('zk_disconnected');
      this.scheduleReconnect();
    });

    this.client.on('expired', () => {
      EventBus.publish('zk_session_expired');
      this.scheduleReconnect();
    });

    await this.client.waitUntilConnected();
  }

  private scheduleReconnect(): void {
    setTimeout(async () => {
      try {
        await this.connect(this.addresses);
        EventBus.publish('zk_reconnected');
      } catch (err) {
        Logger.warn('ZK Reconnect failed, retrying...');
        this.scheduleReconnect();
      }
    }, this.reconnectInterval);
  }
}
```

#### US-016: 成员离线

**关键代码结构:**

```typescript
// src/services/ChatService.ts
async sendMessage(content: string): Promise<void> {
  const mentions = MentionService.parseMentions(content);
  const offlineMentions = mentions.filter(userId =>
    !MemberService.isOnline(userId)
  );

  if (offlineMentions.length > 0) {
    // 警告用户
    EventBus.publish('warning', {
      message: `以下成员不在线: ${offlineMentions.join(', ')}`
    });
  }

  // 继续发送（不保证送达）
  const message = { ... };
  await this.broadcast(message);
}
```

---

### 3.6 退出操作（US-017, US-018）

#### US-017: 退出聊天室

**流程:**
```
用户输入 /exit-room
        │
        ▼
显示确认提示
        │
        ├─ 用户取消 --> 返回聊天界面
        │
        └─ 用户确认
                │
                ▼
RoomService.leaveRoom()
        │
        ├─> ZKClient.deleteNode()  // 删除临时节点
        │
        ├─> PeerService.broadcast({ type: 'leave' })
        │
        ├─> 清空当前聊天室状态
        │
        └─> 返回 RoomSelectScreen
```

#### US-018: 退出程序

**流程:**
```
用户输入 /quit 或 Ctrl+C
        │
        ▼
显示确认提示（如果有未发送消息）
        │
        ├─ 用户取消 --> 返回
        │
        └─ 用户确认
                │
                ▼
cleanup()
        │
        ├─> RoomService.leaveRoom()  // 离开聊天室
        │
        ├─> ConfigService.save()     // 保存配置
        │
        ├─> P2PServer.close()         // 关闭TCP服务器
        │
        ├─> ZKClient.close()          // 关闭ZK连接
        │
        └─> process.exit(0)
```

---

### 3.7 开发测试支持（US-019, US-020）

#### US-019: 本地多客户端测试

**命令行参数支持:**

```typescript
// src/cli.ts
interface CLIOptions {
  'zk-addresses': string;      // ZooKeeper 地址
  port: number;                // P2P 监听端口
  config: string;              // 配置文件路径
  nickname: string;             // 客户端昵称
  'data-dir': string;          // 数据目录
  'log-dir': string;           // 日志目录
  'log-level': string;          // 日志级别
}

const argv = yargs
  .option('zk-addresses', {
    type: 'string',
    default: '127.0.0.1:2181',
    describe: 'ZooKeeper 服务器地址'
  })
  .option('port', {
    type: 'number',
    default: 9001,
    describe: 'P2P 监听端口'
  })
  .option('config', {
    type: 'string',
    default: '~/.chat-room/config.json',
    describe: '配置文件路径'
  })
  .option('nickname', {
    type: 'string',
    default: '',
    describe: '客户端昵称'
  })
  .option('data-dir', {
    type: 'string',
    default: '/tmp/chat-room',
    describe: '数据存储目录'
  })
  .option('log-dir', {
    type: 'string',
    default: '/tmp/chat-room/logs',
    describe: '日志输出目录'
  })
  .option('log-level', {
    type: 'string',
    default: 'info',
    choices: ['debug', 'info', 'warn', 'error'],
    describe: '日志级别'
  })
  .parse();
```

**多客户端示例:**
```bash
# 终端1
chat-room --port 9001 --nickname "User1" --data-dir /tmp/chat-room/client1

# 终端2
chat-room --port 9002 --nickname "User2" --data-dir /tmp/chat-room/client2

# 终端3
chat-room --port 9003 --nickname "User3" --data-dir /tmp/chat-room/client3
```

#### US-020: 日志配置与输出

**关键代码结构:**

```typescript
// src/utils/logger.ts
import pino from 'pino';
import { rotateFileStream } from 'pino-rotate-file';

const LOG_MAX_SIZE = 10 * 1024 * 1024;  // 10MB

class Logger {
  private logger: pino.Logger;

  constructor(options: {
    logDir: string;
    logLevel: string;
    module: string;
  }) {
    const filename = `chat-room-${dateFormat(new Date(), 'YYYYMMDD-HHMMSS')}.log`;

    this.logger = pino({
      level: options.logLevel,
      transport: {
        targets: [
          {
            target: 'pino-pretty',
            options: { colorize: true },
            level: 'info'
          },
          {
            target: 'pino-rotate-file',
            options: {
              filename: path.join(options.logDir, filename),
              maxSize: LOG_MAX_SIZE,
              maxFiles: 5
            },
            level: 'debug'
          }
        ]
      },
      base: {
        module: options.module
      },
      timestamp: () => `,"time":"${new Date().toISOString()}"`
    });
  }

  debug(message: string, ...args: any[]): void {
    this.logger.debug(message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.logger.error(message, ...args);
  }
}
```

**日志格式:**
```
[2026-04-02T14:30:25.123Z] [INFO] [App] 应用启动，版本 1.0.0
[2026-04-02T14:30:25.456Z] [INFO] [Config] 加载配置文件: /Users/user/.chat-room/config.json
[2026-04-02T14:30:26.789Z] [INFO] [ZKClient] 连接 ZooKeeper: 127.0.0.1:2181
[2026-04-02T14:30:27.012Z] [DEBUG] [P2PServer] 启动 P2P 服务器，端口: 9001
[2026-04-02T14:30:27.345Z] [INFO] [Room] 加入聊天室: general
[2026-04-02T14:30:30.678Z] [WARN] [Network] 检测到网络波动，尝试重连...
[2026-04-02T14:30:31.901Z] [ERROR] [Peer] 无法连接到节点 192.168.1.100:9002
```

---

## 4. 数据模型设计

### 4.1 配置模型

**文件路径:** `~/.chat-room/config.json`

```typescript
// src/services/types.ts
interface Config {
  zkAddresses: string[];      // ["127.0.0.1:2181", "127.0.0.1:2182"]
  currentRoomId: string;      // "general"
  nickname: string;           // "User001"
  recentRooms: string[];       // ["general", "dev-team"]
  port: number;                // 9001
  dataDir: string;             // "/tmp/chat-room"
  logDir: string;              // "/tmp/chat-room/logs"
  logLevel: string;            // "info"
}
```

### 4.2 ZooKeeper 数据模型

**节点路径结构:**
```
/libra-regions                          # 根目录（需手动创建）
  /{roomId}                              # 聊天室目录
    /members                             # 成员目录
      /{userId}                          # 成员临时节点
        --> JSON: {
              "nickname": "张三",
              "status": "online",
              "ip": "192.168.1.100",
              "port": 9001,
              "userId": "uuid-xxx",
              "joinedAt": 1743200000000
            }
```

**节点类型:**
- `/libra-regions/{roomId}` - 持久化节点（聊天室目录）
- `/libra-regions/{roomId}/members/{userId}` - 临时节点（成员断开后自动删除）

### 4.3 P2P 消息协议

**消息格式 (JSON over TCP):**

```typescript
// P2P 消息类型
type P2PMessageType =
  | 'chat'           // 聊天消息
  | 'join'           // 加入聊天室
  | 'leave'          // 离开聊天室
  | 'nick_change'    // 昵称变更
  | 'ping'           // 心跳
  | 'pong';          // 心跳响应

interface P2PMessage {
  type: P2PMessageType;
  senderId: string;
  senderNickname: string;
  roomId: string;
  timestamp: number;
  payload: any;      // 类型-specific 数据
}

// Chat 消息 payload
interface ChatPayload {
  messageId: string;
  content: string;
  replyTo?: ReplyPayload;
  mentions?: string[];
}

interface ReplyPayload {
  originalMessageId: string;
  originalSenderNickname: string;
  originalContent: string;
}

// Join 消息 payload
interface JoinPayload {
  ip: string;
  port: number;
}

// Nick change payload
interface NickChangePayload {
  oldNickname: string;
  newNickname: string;
}
```

**TCP 消息封包格式:**
```
+----------------+----------------+----------------+
|  Magic (2B)    |  Length (4B)   |  Payload (N)   |
|  0xCRLF        |  BigEndian     |  JSON bytes   |
+----------------+----------------+----------------+
```

- Magic: 固定 `0x4348` ('CH')
- Length: payload 字节数（不包含 header）
- Payload: UTF-8 JSON

### 4.4 消息历史文件格式

**文件路径:** `/tmp/chat-room/{roomId}/history.txt`

**每行格式:**
```
[HH:mm:ss] 昵称: 消息内容
[HH:mm:ss] 昵称 [回复 原消息]: 回复内容
[HH:mm:ss] 系统: 系统消息内容
```

**特殊字符处理:**
- 换行符替换为空格
- `@` 保持原样
- 长度限制: 单条消息最多 4096 字符

---

## 5. API 协议设计

### 5.1 服务层 API

```typescript
// src/services/ChatService.ts
class ChatService {
  // 发送消息
  sendMessage(content: string, replyTo?: ReplyInfo): Promise<void>

  // 广播消息给所有成员
  broadcast(message: ChatMessage): Promise<void>

  // 解析消息中的@
  parseMentions(content: string): string[]

  // 格式化消息用于显示
  formatMessage(msg: ChatMessage): string
}

// src/services/RoomService.ts
class RoomService {
  // 获取所有聊天室列表
  listRooms(): Promise<string[]>

  // 加入聊天室
  joinRoom(roomId: string): Promise<void>

  // 离开当前聊天室
  leaveRoom(): Promise<void>

  // 切换聊天室
  switchRoom(newRoomId: string): Promise<void>

  // 获取当前聊天室信息
  getCurrentRoom(): Room | null
}

// src/services/MemberService.ts
class MemberService {
  // 获取所有成员
  getMembers(): Member[]

  // 获取指定成员
  getMember(userId: string): Member | undefined

  // 检查成员是否在线
  isOnline(userId: string): boolean

  // 修改昵称
  rename(newNickname: string): Promise<void>

  // 强制下线（用于测试）
  forceOffline(userId: string): void
}

// src/services/HistoryService.ts
class HistoryService {
  // 保存消息
  save(message: ChatMessage): Promise<void>

  // 加载历史消息
  loadHistory(roomId: string, limit?: number): Promise<ChatMessage[]>

  // 清理过期消息
  cleanupOldMessages(roomId: string): Promise<void>

  // 导出历史（用于调试）
  exportHistory(roomId: string): Promise<string>
}

// src/services/ConfigService.ts
class ConfigService {
  // 加载配置
  load(): Promise<Config>

  // 保存配置
  save(config: Partial<Config>): Promise<void>

  // 获取配置
  get<K extends keyof Config>(key: K): Config[K]

  // 更新配置项
  set<K extends keyof Config>(key: K, value: Config[K]): Promise<void>

  // 获取配置路径
  getConfigPath(): string
}
```

### 5.2 网络层 API

```typescript
// src/network/ZKClient.ts
class ZKClient {
  // 连接 ZooKeeper
  connect(addresses: string[]): Promise<void>

  // 断开连接
  close(): Promise<void>

  // 创建临时节点（成员注册）
  createMemberNode(roomId: string, data: MemberNodeData): Promise<string>

  // 更新节点数据（昵称变更）
  setMemberData(roomId: string, userId: string, data: MemberNodeData): Promise<void>

  // 删除临时节点（离开聊天室）
  deleteMemberNode(roomId: string, userId: string): Promise<void>

  // 获取聊天室成员列表
  getMembers(roomId: string): Promise<Member[]>

  // 获取聊天室列表
  listRooms(): Promise<string[]>

  // 监听成员变化
  watchMembers(roomId: string, callback: (members: Member[]) => void): void

  // 监听聊天室列表变化
  watchRooms(callback: (rooms: string[]) => void): void
}

// src/network/P2PServer.ts
class P2PServer {
  // 启动服务器
  start(port: number): Promise<void>

  // 停止服务器
  stop(): Promise<void>

  // 处理收到的消息
  onMessage(callback: (message: P2PMessage, connection: net.Socket) => void): void

  // 处理新连接
  onConnection(callback: (connection: net.Socket) => void): void
}

// src/network/P2PClient.ts
class P2PClient {
  // 连接到节点
  connect(ip: string, port: number): Promise<void>

  // 断开连接
  disconnect(): void

  // 发送消息
  send(message: P2PMessage): Promise<void>

  // 广播消息给所有连接
  broadcast(message: P2PMessage): void

  // 获取已连接节点数
  getConnectionCount(): number

  // 检查是否已连接
  isConnected(): boolean
}

// src/network/P2PTransport.ts
class P2PTransport {
  // 创建服务器
  createServer(): P2PServer

  // 创建客户端
  createClient(): P2PClient

  // 封包消息
  encode(message: P2PMessage): Buffer

  // 解包消息
  decode(buffer: Buffer): P2PMessage

  // 验证消息格式
  validate(message: any): message is P2PMessage
}

// src/network/PeerConnection.ts
class PeerConnection {
  // 节点信息
  userId: string;
  ip: string;
  port: number;
  socket: net.Socket | null;
  isConnected: boolean;
  lastHeartbeat: number;

  // 发送消息
  send(message: P2PMessage): Promise<void>

  // 关闭连接
  close(): void
}
```

### 5.3 事件总线 API

```typescript
// src/services/EventBus.ts
type EventType =
  | 'message'              // 新消息
  | 'member_join'          // 成员加入
  | 'member_leave'         // 成员离开
  | 'nick_change'          // 昵称变更
  | 'room_joined'          // 加入聊天室
  | 'room_left'            // 离开聊天室
  | 'zk_connected'         // ZK 连接成功
  | 'zk_disconnected'      // ZK 连接断开
  | 'zk_reconnected'       // ZK 重连成功
  | 'zk_session_expired'   // ZK session 过期
  | 'warning'              // 警告消息
  | 'error';               // 错误消息

interface EventPayload {
  message: ChatMessage;
  member_join: Member;
  member_leave: { userId: string };
  nick_change: { userId: string; oldNickname: string; newNickname: string };
  room_joined: { roomId: string };
  room_left: { roomId: string };
  warning: { message: string };
  error: { error: Error };
}

class EventBus {
  // 发布事件
  publish<T extends EventType>(event: T, payload: EventPayload[T]): void

  // 订阅事件
  subscribe<T extends EventType>(
    event: T,
    handler: (payload: EventPayload[T]) => void
  ): () => void

  // 取消订阅
  unsubscribe<T extends EventType>(
    event: T,
    handler: (payload: EventPayload[T]) => void
  ): void

  // 创建一次性订阅
  once<T extends EventType>(
    event: T,
    handler: (payload: EventPayload[T]) => void
  ): () => void
}
```

---

## 6. 工作流程与调用时序

### 6.1 应用启动流程

```
用户执行 chat-room 命令
        │
        ▼
CLI.parseArguments()  ──> 解析命令行参数
        │
        ▼
Logger.init()  ──> 初始化日志系统
        │
        ▼
ConfigService.load()  ──> 加载配置文件
        │
        ├─ 配置文件不存在 --> 提示用户输入配置
        │                   --> 保存配置文件
        │
        └─ 配置文件存在 --> 验证配置有效性
        │
        ▼
ZKClient.connect()  ──> 连接 ZooKeeper
        │
        ├─ 连接成功 --> 继续
        │
        └─ 连接失败 --> 显示错误，退出
        │
        ▼
P2PServer.start(port)  ──> 启动 P2P TCP 服务器
        │
        ▼
RoomSelectScreen.render()  ──> 显示聊天室选择界面
        │
        ├─ 用户选择已有聊天室 --> RoomService.joinRoom()
        │
        └─ 用户输入新聊天室ID --> RoomService.joinRoom() (创建)
                    │
                    ▼
            ChatScreen.render()  ──> 进入聊天室主界面
```

### 6.2 消息发送完整时序

```
用户输入 "你好" 并按 Enter
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        InputBox                                 │
│  捕获 onSubmit 事件                                              │
│  调用 ChatService.sendMessage("你好")                           │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ChatService                               │
│  1. 构造 ChatMessage 对象                                       │
│     {                                                           │
│       id: uuid(),                                               │
│       type: 'normal',                                           │
│       roomId: 'general',                                        │
│       senderId: 'user-001',                                     │
│       senderNickname: 'User001',                               │
│       content: '你好',                                          │
│       timestamp: 1743200000000                                 │
│     }                                                           │
│                                                                 │
│  2. 调用 HistoryService.save(message)  ──> 写入本地文件         │
│                                                                 │
│  3. 调用 EventBus.publish('message', message)  ──> 本地渲染     │
│                                                                 │
│  4. 调用 PeerService.broadcast(message)  ──> P2P 广播          │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PeerService                                │
│  调用 P2PClient.broadcast(message)                              │
│  遍历所有已连接的 PeerConnection                                 │
│  对每个连接调用 connection.send(encode(message))                 │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     P2PClient                                   │
│  对每个连接的 socket.write(encode(message))                     │
│  encode(message) = Buffer.from(JSON.stringify(message))        │
│  使用 TCP 发送                                                  │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  其他节点的 P2PServer                            │
│  socket.on('data')  接收到数据                                   │
│  调用 P2PTransport.decode(data)                                  │
│  调用 P2PServer.onMessage(message, socket)                      │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PeerService (接收方)                        │
│  onMessage(message)                                             │
│  判断 message.type === 'chat'                                   │
│  调用 EventBus.publish('message', message)                     │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ChatScreen (接收方)                          │
│  EventBus.subscribe('message', handler)                         │
│  更新 messages state                                            │
│  调用 ChatView.render()                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 成员加入时序

```
节点 B 启动并加入聊天室
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       节点 B                                     │
│  P2PServer.start(9002)                                          │
│  ZKClient.createMemberNode('/libra-regions/general/members/user-002', {...}) │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
ZK Watch 触发
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       节点 A (已在聊天室)                         │
│  ZKClient.watchMembers() 回调触发                               │
│  EventBus.publish('member_join', member)                        │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ChatScreen (节点 A)                          │
│  显示系统消息 "[HH:mm:ss] 系统: User002 加入了聊天室"            │
│  MemberList 更新，显示 User002 (在线)                            │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  节点 A --> P2PClient.connect('192.168.1.100', 9002)             │
│  建立 TCP 连接                                                   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
节点 A 和节点 B 现在可以通过 P2P 直接通信
```

### 6.4 @ 消息处理时序

```
用户输入 "@User002 你好"
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       InputBox                                  │
│  检测到 @ 字符                                                   │
│  调用 MentionService.processInput("@User002 你好")             │
│  返回 { isMentioning: true, members: [...] }                   │
│  显示自动补全浮层                                                │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
用户选择 User002，完成输入
        │
        ▼
InputBox.onSubmit("@User002 你好")
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ChatService                                 │
│  sendMessage("@User002 你好")                                   │
│                                                                 │
│  parseMentions("@User002 你好")  -->  ["user-002"]              │
│                                                                 │
│  message.mentions = ["user-002"]                                │
│  message.type = 'mention'                                       │
│                                                                 │
│  broadcast(message)                                             │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
其他节点收到消息后
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ChatView (渲染)                              │
│  检测 message.mentions                                          │
│  对被@的用户高亮显示                                             │
│  如当前用户是 User002，整条消息黄色高亮                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 组件设计

### 7.1 核心组件结构

```
┌─────────────────────────────────────────────────────────────────┐
│                         App                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    ScreenRouter                          │   │
│  │  ┌─────────────┐ ┌─────────────────┐ ┌───────────────┐  │   │
│  │  │ ConfigScreen│ │RoomSelectScreen│ │  ChatScreen   │  │   │
│  │  └─────────────┘ └─────────────────┘ └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ChatScreen                                │
│  ┌───────────────┬─────────────────────────┬───────────────┐  │
│  │               │                         │               │  │
│  │   ChatView    │                         │  MemberList   │  │
│  │  (70% width)  │                         │  (30% width)  │  │
│  │               │                         │               │  │
│  │               ├─────────────────────────┤               │  │
│  │               │       InputBox          │               │  │
│  │               │      (fixed bottom)      │               │  │
│  └───────────────┴─────────────────────────┴───────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SystemBar                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 组件 Props 定义

```typescript
// src/components/ChatView.tsx
interface ChatViewProps {
  messages: ChatMessage[];
  selectedMessageId?: string;
  currentUserId: string;
  onReply: (messageId: string) => void;
  onMention: (userId: string) => void;
}

interface MessageItemProps {
  message: ChatMessage;
  isSelected: boolean;
  isOwnMessage: boolean;
  mentions: string[];
  onReply: () => void;
  onHover: () => void;
}

// src/components/InputBox.tsx
interface InputBoxProps {
  nickname: string;
  isMultiLine?: boolean;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
}

// src/components/MemberList.tsx
interface MemberListProps {
  members: Member[];
  currentUserId: string;
  onMemberClick?: (userId: string) => void;
}

// src/components/SystemBar.tsx
interface SystemBarProps {
  roomId: string;
  isConnected: boolean;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  messageCount: number;
}
```

### 7.3 屏幕组件

```typescript
// src/components/screens/ConfigScreen.tsx
interface ConfigScreenProps {
  onConfigComplete: (config: Config) => void;
}

// src/components/screens/RoomSelectScreen.tsx
interface RoomSelectScreenProps {
  rooms: string[];
  recentRooms: string[];
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: (roomId: string) => void;
  onBack: () => void;
}

// src/components/screens/ChatScreen.tsx
interface ChatScreenProps {
  roomId: string;
  onExitRoom: () => void;
}
```

---

## 8. 存储设计

### 8.1 目录结构

```
~/.chat-room/                      # 用户配置目录
└── config.json                    # 配置文件

/tmp/chat-room/                    # 数据目录（可配置）
├── general/                       # 聊天室目录
│   └── history.txt               # 聊天历史
├── dev-team/
│   └── history.txt
├── logs/                          # 日志目录
│   ├── chat-room-20260402-143025.log
│   ├── chat-room-20260402-150000.log
│   └── chat-room-20260403-090000.log
└── temp/                          # 临时文件
    └── .zk-json                      # ZK 连接状态缓存
```

### 8.2 配置文件格式

**路径:** `~/.chat-room/config.json`

```json
{
  "zkAddresses": ["127.0.0.1:2181"],
  "currentRoomId": "general",
  "nickname": "User001",
  "recentRooms": ["general", "dev-team"],
  "port": 9001,
  "dataDir": "/tmp/chat-room",
  "logDir": "/tmp/chat-room/logs",
  "logLevel": "info"
}
```

### 8.3 历史消息文件

**路径:** `/tmp/chat-room/{roomId}/history.txt`

**权限:** `0644` (owner: rw, group: r, other: r)

**最大行数:** 500 条（超出后截断旧消息）

**保留期限:** 30 天

### 8.4 ZooKeeper 初始化

首次使用需要手动创建根节点：

```bash
zkCli.sh -server 127.0.0.1:2181
> create /libra-regions ""
> quit
```

或通过配置服务自动创建：

```typescript
// src/network/ZKClient.ts
async ensureRootNode(): Promise<void> {
  try {
    await this.client.create('/libra-regions', '', zk.CreateMode.PERSISTENT);
  } catch (err) {
    // 节点已存在，忽略
  }
}
```

---

## 9. 打包与发布

### 9.1 项目配置

**package.json:**

```json
{
  "name": "chat-room",
  "version": "1.0.0",
  "description": "A P2P chat room terminal tool",
  "main": "dist/index.js",
  "bin": {
    "chat-room": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.tsx",
    "clean": "rm -rf dist",
    "pkg": "pkg . --targets node16-macos-x64,node16-linux-x64 --output dist/chat-room",
    "pkg:mac": "pkg . --targets node16-macos-x64 --output dist/chat-room",
    "pkg:linux": "pkg . --targets node16-linux-x64 --output dist/chat-room"
  },
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "zookeeper": "^3.5.9",
    "yargs": "^17.7.2",
    "pino": "^8.17.2",
    "pino-pretty": "^10.3.1",
    "pino-rotate-file": "^0.0.7",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/uuid": "^9.0.7",
    "@types/yargs": "^17.0.32",
    "pkg": "^5.8.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 9.2 二进制打包配置

**pkg.config.js:**

```javascript
module.exports = {
  apps: [{
    name: 'chat-room',
    script: './dist/index.js',
    targets: [
      {
        platform: 'darwin',
        arch: 'x64',
        outputPath: 'dist/'
      },
      {
        platform: 'linux',
        arch: 'x64',
        outputPath: 'dist/'
      }
    ],
    options: {
      goHeader: '// urclimat'
    }
  }]
};
```

### 9.3 构建命令

```bash
# 安装依赖
npm install

# TypeScript 编译
npm run build

# 运行 (通过 node)
npm start

# 开发模式 (ts-node)
npm run dev

# 打包二进制 (macOS + Linux)
npm run pkg

# 仅 macOS
npm run pkg:mac

# 仅 Linux
npm run pkg:linux
```

### 9.4 发布流程

```bash
# 1. 确保测试通过
npm test

# 2. 更新版本号 (例如 1.0.1)
npm version patch

# 3. 编译
npm run build

# 4. 打包二进制
npm run pkg

# 5. 发布到 npm (需要 npm login)
npm publish --access public

# 6. 创建 Git tag
git tag v1.0.1
git push origin v1.0.1
```

### 9.5 二进制分发

打包后的文件位于 `dist/` 目录：

```
dist/
├── chat-room-macos-x64     # macOS 可执行文件
└── chat-room-linux-x64     # Linux 可执行文件
```

**安装脚本:**

```bash
#!/bin/bash
# quick-install.sh

PLATFORM=$(uname -s)
ARCH=$(uname -m)

if [ "$PLATFORM" = "Darwin" ]; then
  FILE="chat-room-macos-x64"
else
  FILE="chat-room-linux-x64"
fi

curl -L "https://example.com/chat-room/releases/latest/download/$FILE" -o chat-room
chmod +x chat-room
sudo mv chat-room /usr/local/bin/

echo "chat-room installed successfully!"
```

### 9.6 Docker 支持

**Dockerfile:**

```dockerfile
FROM node:16-alpine

RUN npm install -g chat-room

EXPOSE 9001

CMD ["chat-room", "--help"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  zookeeper:
    image: zookeeper:3.5.9
    ports:
      - "2181:2181"

  chat-room:
    image: chat-room:latest
    depends_on:
      - zookeeper
    environment:
      - ZK_ADDRESSES=zookeeper:2181
    ports:
      - "9001:9001"
    volumes:
      - chat-data:/tmp/chat-room

volumes:
  chat-data:
```

---

## 10. 安装与运行

### 10.1 环境要求

- Node.js 16+
- ZooKeeper 3.5.9
- macOS 或 Linux 操作系统

### 10.2 ZooKeeper 安装

```bash
# 使用 Docker
docker run -d --name zookeeper -p 2181:2181 zookeeper:3.5.9

# 或直接下载
curl -O https://archive.apache.org/dist/zookeeper/zookeeper-3.5.9/apache-zookeeper-3.5.9-bin.tar.gz
tar xzf apache-zookeeper-3.5.9-bin.tar.gz
cd apache-zookeeper-3.5.9-bin
cp conf/zoo_sample.cfg conf/zoo.cfg
./bin/zkServer.sh start
```

### 10.3 快速安装

```bash
# 方式1: npm 全局安装
npm install -g chat-room

# 方式2: 二进制安装
curl -L https://example.com/chat-room/install.sh | bash

# 方式3: Docker 运行
docker run -it chat-room:latest
```

### 10.4 运行示例

```bash
# 默认配置启动
chat-room

# 指定 ZK 地址
chat-room --zk-addresses "192.168.1.100:2181,192.168.1.101:2181"

# 指定端口和昵称
chat-room --port 9001 --nickname "Alice"

# 指定数据目录和日志
chat-room --data-dir ~/chat-room-data --log-dir ~/chat-room-logs --log-level debug

# 查看帮助
chat-room --help
```

---

## 11. 错误码定义

| 错误码 | 名称 | 说明 |
|-------|------|------|
| 1001 | ZK_CONNECT_FAILED | ZooKeeper 连接失败 |
| 1002 | ZK_SESSION_EXPIRED | ZooKeeper Session 过期 |
| 1003 | ZK_CREATE_NODE_FAILED | 创建 ZK 节点失败 |
| 2001 | P2P_CONNECT_FAILED | P2P 连接失败 |
| 2002 | P2P_SEND_FAILED | P2P 消息发送失败 |
| 2003 | P2P_PORT_IN_USE | P2P 端口已被占用 |
| 3001 | CONFIG_INVALID | 配置文件无效 |
| 3002 | CONFIG_NOT_FOUND | 配置文件不存在 |
| 4001 | HISTORY_LOAD_FAILED | 历史消息加载失败 |
| 4002 | HISTORY_SAVE_FAILED | 历史消息保存失败 |
| 5001 | ROOM_NOT_FOUND | 聊天室不存在 |
| 5002 | ROOM_JOIN_FAILED | 加入聊天室失败 |

---

## 12. 安全考虑

### 12.1 信任边界

- 假设局域网内所有节点可信
- 不做身份验证（简化设计）
- 不加密传输（局域网环境）

### 12.2 输入校验

- 消息内容最大长度: 4096 字符
- 昵称最大长度: 32 字符
- 聊天室 ID 格式: `/^[a-zA-Z0-9_-]+$/`

### 12.3 资源限制

- 单个聊天室最大成员: 50
- TCP 连接超时: 30 秒
- ZK 重连最大次数: 无限制
- 日志文件最大: 10MB

---

## 13. 未来扩展方向

| 功能 | 优先级 | 说明 |
|-----|-------|-----|
| 私聊 | P2 | 1对1消息 |
| 文件传输 | P3 | 通过 P2P 传输文件 |
| 消息加密 | P3 | E2E 加密 |
| 跨平台 | P2 | Windows 支持 |
| 表情包 | P4 | 文字表情 |

---

## 14. 参考资料

- [Ink 文档](https://github.com/vadimdemedes/ink)
- [ZooKeeper 3.5.9 文档](https://zookeeper.apache.org/doc/r3.5.9/)
- [Node.js 文档](https://nodejs.org/dist/latest-v16.x/docs/api/)
- [pkg 打包工具](https://github.com/vercel/pkg)
- [pino 日志库](https://github.com/pinojs/pino)
