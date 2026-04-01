# Chat Room Terminal Tool - 技术设计文档

| 文档版本 | 1.0 |
|---------|-----|
| 创建日期 | 2026-04-01 |
| 技术栈 | TypeScript + Node.js 22 + ZooKeeper 3.5.9 |

---

## 目录

1. [整体架构设计](#1-整体架构设计)
2. [目录结构与模块划分](#2-目录结构与模块划分)
3. [数据模型设计](#3-数据模型设计)
4. [ZooKeeper 存储设计](#4-zookeeper-存储设计)
5. [P2P 通信协议设计](#5-p2p-通信协议设计)
6. [功能设计（按用户故事）](#6-功能设计按用户故事)
7. [异常处理与可靠性](#7-异常处理与可靠性)
8. [第三方依赖清单](#8-第三方依赖清单)
9. [构建与部署](#9-构建与部署)

---

## 1. 整体架构设计

### 1.1 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                        Chat Room Client                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    UI Layer (Ink/React)                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │  ChatView     │  │ MemberList   │  │  InputView       │ │  │
│  │  │  聊天消息展示  │  │ 成员状态列表  │  │  消息输入/命令   │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │  │
│  └─────────┼─────────────────┼─────────────────────┼───────────┘  │
│            │                 │                     │              │
│  ┌─────────▼─────────────────▼─────────────────────▼───────────┐  │
│  │                   Service Layer                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │  ChatService  │  │  PeerService │  │  MemberService   │ │  │
│  │  │  消息调度/路由  │  │  P2P连接管理  │  │  成员状态管理    │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │  RoomService  │  │  ConfigService│  │  HistoryService  │ │  │
│  │  │  聊天室管理    │  │  配置读写    │  │  消息持久化      │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│            │                                     │               │
│  ┌─────────▼─────────────────┐   ┌──────────────▼──────────────┐ │
│  │    Network Layer          │   │    Storage Layer            │ │
│  │  ┌──────────────────────┐ │   │  ┌────────────────────────┐ │ │
│  │  │  ZKClient            │ │   │  │  HistoryStore          │ │ │
│  │  │  ZooKeeper连接/发现   │ │   │  │  本地文件读写          │ │ │
│  │  └──────────────────────┘ │   │  └────────────────────────┘ │ │
│  │  ┌──────────────────────┐ │   │  ┌────────────────────────┐ │ │
│  │  │  P2PServer/Client    │ │   │  │  ConfigStore           │ │ │
│  │  │  TCP连接/消息收发     │ │   │  │  配置文件读写          │ │ │
│  │  └──────────────────────┘ │   │  └────────────────────────┘ │ │
│  └────────────────────────────┘   └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
  ┌─────────────┐                     ┌─────────────────┐
  │  ZooKeeper   │                     │  Local Filesystem│
  │  3.5.9       │                     │  ~/.chat-room/   │
  └─────────────┘                     │  /tmp/chat-room/ │
                                       └─────────────────┘
```

### 1.2 核心设计原则

| 原则 | 说明 |
|-----|------|
| 分层架构 | UI → Service → Network/Storage，职责清晰，各层可独立测试 |
| 事件驱动 | 各模块通过 EventEmitter 解耦，Service 层发布事件，UI 层订阅渲染 |
| P2P Mesh | 同一聊天室内所有节点两两建立 TCP 连接，形成全互联拓扑 |
| ZooKeeper 仅用于发现 | ZK 负责节点注册和成员发现，不承载消息传输 |
| 单进程多协程 | 基于 Node.js 22 的事件循环处理并发，不引入 worker 线程 |

### 1.3 P2P 拓扑结构

```
  Peer A ──────── Peer B
    │  ╲           ╱  │
    │    ╲       ╱    │
    │      ╲   ╱      │
  Peer D ──── Peer C ──── Peer E

每个节点与同一聊天室内的所有其他节点建立 TCP 连接。
新节点加入时：从 ZK 获取在线成员列表 → 逐一建立连接。
节点离开时：ZK 临时节点自动删除 → 其他节点通过 watcher 感知 → 关闭连接。
```

---

## 2. 目录结构与模块划分

```
chat-room/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 程序入口
│   │
│   ├── ui/                         # UI 层
│   │   ├── App.tsx                 # Ink 根组件，路由管理
│   │   ├── screens/
│   │   │   ├── ConfigScreen.tsx    # 首次配置界面
│   │   │   ├── RoomSelectScreen.tsx# 聊天室选择界面
│   │   │   └── ChatScreen.tsx      # 主聊天界面
│   │   └── components/
│   │       ├── ChatView.tsx        # 聊天消息列表
│   │       ├── MemberList.tsx      # 成员列表
│   │       ├── InputBox.tsx        # 输入框（含 @补全）
│   │       └── SystemBar.tsx       # 顶部状态栏
│   │
│   ├── services/                   # Service 层
│   │   ├── types.ts                # 共享类型定义
│   │   ├── EventBus.ts             # 全局事件总线
│   │   ├── ConfigService.ts        # 配置管理
│   │   ├── RoomService.ts          # 聊天室管理
│   │   ├── MemberService.ts        # 成员状态管理
│   │   ├── ChatService.ts          # 消息调度核心
│   │   ├── PeerService.ts          # P2P 连接管理
│   │   ├── HistoryService.ts       # 消息持久化
│   │   └── MentionService.ts       # @ 补全与回复
│   │
│   ├── network/                    # Network 层
│   │   ├── ZKClient.ts             # ZooKeeper 连接管理
│   │   ├── P2PServer.ts            # TCP 服务端（接收连接）
│   │   ├── P2PClient.ts            # TCP 客户端（主动连接）
│   │   ├── P2PTransport.ts         # 消息编解码与帧协议
│   │   └── PeerConnection.ts       # 单条 P2P 连接封装
│   │
│   └── store/                      # Storage 层
│       ├── ConfigStore.ts          # 配置文件读写
│       └── HistoryStore.ts         # 历史消息文件读写
│
├── spec/
│   ├── chat-room-spec.md           # 产品需求文档
│   └── plan.md                     # 本技术文档
│
└── tests/                          # 测试
    ├── services/
    ├── network/
    └── store/
```

---

## 3. 数据模型设计

### 3.1 核心类型定义

```typescript
// ===== 用户与节点 =====

/** 用户唯一标识，首次启动时 UUID 生成，持久化到 config */
type UserId = string;

/** 节点网络地址 */
interface PeerAddress {
  ip: string;   // 本机局域网 IP
  port: number; // P2P 监听端口 (9001 起)
}

// ===== 配置模型 =====

/** 全局配置文件 ~/.chat-room/config.json */
interface AppConfig {
  userId: UserId;
  nickname: string;
  zkAddresses: string[];       // ["127.0.0.1:2181", "127.0.0.1:2182"]
  p2pPort: number;             // 默认 9001
  currentRoomId: string | null;
  recentRooms: string[];
}

// ===== 聊天室与成员 =====

/** 成员状态 */
type MemberStatus = "online" | "offline";

/** 成员信息 */
interface Member {
  userId: UserId;
  nickname: string;
  status: MemberStatus;
  address: PeerAddress;
  joinedAt: number;  // Unix timestamp (ms)
}

/** 聊天室元数据 */
interface Room {
  roomId: string;
  members: Map<UserId, Member>;
  createdAt: number;
}

// ===== 消息模型 =====

/** 消息类型 */
type MessageType = "text" | "system" | "join" | "leave" | "rename" | "reply";

/** 聊天消息 */
interface ChatMessage {
  id: string;               // UUID
  type: MessageType;
  senderId: UserId;
  senderNickname: string;
  content: string;
  roomId: string;
  timestamp: number;        // Unix timestamp (ms)
  // 回复相关
  replyTo?: {
    messageId: string;
    senderNickname: string;
    content: string;
  };
  // @ 相关
  mentions?: string[];      // 被 @ 的 userId 列表
}

// ===== P2P 网络协议模型 =====

/** P2P 协议消息（线路格式） */
interface P2PProtocolMessage {
  version: 1;
  type: P2PMessageType;
  payload: unknown;
  timestamp: number;
  senderId: UserId;
}

type P2PMessageType =
  | "handshake"       // 连接握手
  | "chat"            // 聊天消息转发
  | "join"            // 成员加入通知
  | "leave"           // 成员离开通知
  | "rename"          // 昵称修改通知
  | "sync-request"    // 消息同步请求（新节点加入时拉取在线成员列表）
  | "sync-response"   // 消息同步响应
  | "heartbeat"       // 心跳
  | "ack";            // 确认

/** 握手请求 */
interface HandshakePayload {
  userId: UserId;
  nickname: string;
  roomId: string;
  address: PeerAddress;
}

/** 握手响应 */
interface HandshakeResponsePayload {
  userId: UserId;
  nickname: string;
  roomId: string;
  address: PeerAddress;
  members: Member[]; // 当前在线成员列表
}

/** 心跳负载 */
interface HeartbeatPayload {
  sequence: number;
}
```

### 3.2 消息流转模型

```
用户输入
  │
  ▼
InputBox ──parse──▶ CommandHandler (/rename, /exit-room, /quit)
  │
  ├─ 普通文本 ──▶ ChatService.send()
  │                    │
  │                    ├─ 生成 ChatMessage (id, type, sender, content, mentions)
  │                    ├─ HistoryService.append()  (写本地)
  │                    ├─ EventBus.emit("new-message")  (通知 UI)
  │                    └─ PeerService.broadcast()  (转发给所有 peer)
  │                           │
  │                           └─ 对每个 PeerConnection:
  │                                P2PTransport.encode(P2PProtocolMessage)
  │                                → TCP socket.write()
  │
接收方向:
  P2PServer (socket "data")
    │
    ▼
  P2PTransport.decode()
    │
    ▼
  PeerConnection.onMessage()
    │
    ├─ handshake → PeerService.handleHandshake()
    ├─ chat      → ChatService.handleIncoming()
    │                  ├─ HistoryService.append()
    │                  └─ EventBus.emit("new-message")
    ├─ join/leave/rename → MemberService.handleUpdate()
    │                           └─ EventBus.emit("members-changed")
    └─ heartbeat → PeerConnection.updateLastSeen()
```

---

## 4. ZooKeeper 存储设计

### 4.1 ZK 节点树结构

```
/libra-regions                          (持久节点)
  /{roomId}                          (持久节点)
    /members                         (持久节点, 容器节点 Container)
      /{userId}                      (EPHEMERAL_SEQUENTIAL 临时节点)
        → JSON: {"nickname":"张三","status":"online","ip":"192.168.1.100","port":9001}
```

**设计说明：**

| 节点 | 类型 | 生命周期 | 说明 |
|-----|------|---------|------|
| `/libra-regions` | Persistent | 永久 | 根节点，首次运行时创建 |
| `/libra-regions/{roomId}` | Persistent | 永久 | 聊天室节点，创建聊天室时自动创建 |
| `/libra-regions/{roomId}/members` | Container | 空时自动删除 | 成员容器，无成员时自动清理 |
| `/libra-regions/{roomId}/members/{userId}` | Ephemeral | 客户端断开时删除 | 成员注册节点，断连自动摘除 |

### 4.2 ZK 操作与 Watch 策略

| 操作 | 触发场景 | ZK API | 说明 |
|-----|---------|--------|------|
| 列出聊天室 | 进入聊天室选择界面 | `getChildren("/libra-regions")` | 获取子节点列表作为可选聊天室 |
| 创建聊天室 | 用户输入新的 roomId | `create("/libra-regions/{roomId}", ..., PERSISTENT)` | 同时创建 members 容器节点 |
| 加入聊天室 | 用户选择聊天室 | `create(..., EPHEMERAL)` | 注册成员节点，数据为 JSON |
| 监听成员变化 | 加入聊天室后持续 | `getChildren("/libra-regions/{roomId}/members", watch)` | Children watcher，成员变动时回调 |
| 更新昵称 | /rename 命令 | `setData("/libra-regions/{roomId}/members/{userId}", ...)` | 更新节点数据中的 nickname |
| 退出聊天室 | /exit-room 命令 | `remove("/libra-regions/{roomId}/members/{userId}")` | 主动删除临时节点 |
| 监听成员数据 | 成员昵称变更 | `getData("/libra-regions/{roomId}/members/{userId}", watch)` | Data watcher |

### 4.3 ZKClient 核心接口

```typescript
class ZKClient {
  private client: Zookeeper;  // node-zookeeper-client
  private connected: boolean = false;

  /** 连接 ZK 集群 */
  async connect(addresses: string[]): Promise<void>;

  /** 断开连接 */
  async disconnect(): Promise<void>;

  /** 获取所有聊天室 ID */
  async listRooms(): Promise<string[]>;

  /** 创建聊天室（如不存在） */
  async createRoom(roomId: string): Promise<void>;

  /** 加入聊天室（注册临时节点） */
  async joinRoom(roomId: string, memberInfo: MemberInfo): Promise<void>;

  /** 离开聊天室（删除临时节点） */
  async leaveRoom(roomId: string, userId: string): Promise<void>;

  /** 更新成员信息（昵称修改） */
  async updateMember(roomId: string, userId: string, data: string): Promise<void>;

  /** 监听成员变化 */
  watchMembers(roomId: string, callback: (members: Member[]) => void): void;

  /** 监听连接状态 */
  onStateChange(callback: (state: "connected" | "disconnected" | "expired") => void): void;

  /** 重连 */
  async reconnect(): Promise<void>;
}
```

---

## 5. P2P 通信协议设计

### 5.1 传输层帧格式

采用 **长度前缀 + JSON Body** 的帧协议，基于 TCP 字节流实现消息边界划分。

```
┌──────────────┬──────────────┬──────────────────────────┐
│  Magic (2B)  │  Length (4B) │  JSON Payload (NB)       │
│  0xCR 0x4D   │  Big-Endian  │  UTF-8 encoded           │
└──────────────┴──────────────┴──────────────────────────┘

Magic: 固定 0xCR4D ("CR" for Chat Room)，用于帧同步
Length: JSON Payload 的字节长度，Big-Endian 无符号 32 位整数
Payload: P2PProtocolMessage 的 JSON 序列化
```

**设计理由：**
- 长度前缀方案实现简单、解析高效，适合局域网低延迟场景
- Magic bytes 可检测帧错位，提供基本的完整性校验
- JSON 格式便于调试（可 human-readable），局域网内带宽充裕，无需二进制序列化

### 5.2 连接建立时序

```
Peer A (新加入)                    Peer B (已有成员)                ZooKeeper
     │                                  │                            │
     │  1. joinRoom(roomId, memberA)    │                            │
     │──────────────────────────────────────────────────────────────▶│
     │                                  │                            │
     │  2. watchMembers 回调触发        │                            │
     │◀──────────────────────────────────────────────────────────────│
     │  members = [B, C, D]            │                            │
     │                                  │                            │
     │  3. TCP connect(B.ip, B.port)    │                            │
     │─────────────────────────────────▶│                            │
     │                                  │                            │
     │  4. Handshake {userId, nickname, │                            │
     │     roomId, address}             │                            │
     │─────────────────────────────────▶│                            │
     │                                  │  验证 roomId 匹配           │
     │                                  │                            │
     │  5. HandshakeResponse {userId,   │                            │
     │     nickname, address, members}  │                            │
     │◀─────────────────────────────────│                            │
     │                                  │                            │
     │  6. 连接就绪，可双向通信          │                            │
     │◀────────────────────────────────▶│                            │
```

### 5.3 消息广播流程

```
Peer A 发送消息 "大家好"

Peer A                          Peer B              Peer C
   │                               │                    │
   │  chat: {id, content, ...}     │                    │
   │──────────────────────────────▶│                    │
   │  chat: {id, content, ...}     │                    │
   │───────────────────────────────────────────────────▶│
   │                               │                    │
   │  ack                           │                    │
   │◀──────────────────────────────│                    │
   │  ack                           │                    │
   │◀───────────────────────────────────────────────────│

说明：
- Peer A 向所有已连接的 peer 广播消息
- 收到 ack 后确认投递成功（用于判断对方是否在线）
- 不要求所有 ack，不阻塞发送
```

### 5.4 心跳机制

```
参数:
- 心跳间隔: 30 秒
- 超时判定: 90 秒（连续 3 次未收到心跳）
- 心跳负载: { sequence: number } 递增序列号

流程:
  每个连接独立维护心跳:
  1. 每 30s 发送 heartbeat
  2. 收到对方 heartbeat 时更新 lastSeen
  3. 定时检查: now - lastSeen > 90s → 判定断线
  4. 断线处理: 关闭连接, 从 peers map 移除, 通知 MemberService
```

---

## 6. 功能设计（按用户故事）

### 6.1 US-001: 首次启动与配置

**关联模块：** `ConfigService` + `ConfigStore` + `ConfigScreen`

**流程：**

```
启动程序
  │
  ▼
ConfigStore.load()
  │
  ├─ 文件不存在 ──▶ ConfigScreen（首次配置界面）
  │                   ├─ 提示输入 ZK 地址（支持逗号分隔多个）
  │                   ├─ 提示输入昵称
  │                   ├─ 生成 userId (uuid)
  │                   └─ ConfigStore.save() → ~/.chat-room/config.json
  │
  └─ 文件存在 ──▶ ConfigScreen（确认/修改界面）
                    ├─ 显示当前配置
                    ├─ 用户确认 or 修改
                    └─ ConfigStore.save()
```

**ConfigStore 接口：**

```typescript
class ConfigStore {
  private readonly configPath = path.join(os.homedir(), ".chat-room", "config.json");

  async load(): Promise<AppConfig | null>;
  async save(config: AppConfig): Promise<void>;
  getConfigPath(): string;
}
```

---

### 6.2 US-002: 选择聊天室

**关联模块：** `RoomService` + `ZKClient` + `RoomSelectScreen`

**流程：**

```
配置完成 → RoomSelectScreen
  │
  ▼
ZKClient.listRooms()
  │
  ├─ 有聊天室列表 ──▶ 渲染列表供用户选择
  │                    格式: "1. general (3 members)"
  │
  └─ 无聊天室 ──▶ 提示用户输入新聊天室 ID
                    │
                    ▼
              ZKClient.createRoom(roomId) (幂等，已存在则跳过)
              → 加入该聊天室
```

**RoomService 接口：**

```typescript
class RoomService {
  /** 获取可用聊天室列表 */
  async listAvailableRooms(): Promise<RoomInfo[]>;

  /** 创建并加入聊天室 */
  async createAndJoin(roomId: string): Promise<void>;

  /** 加入已有聊天室 */
  async joinRoom(roomId: string): Promise<void>;

  /** 离开聊天室 */
  async leaveRoom(roomId: string): Promise<void>;
}

interface RoomInfo {
  roomId: string;
  memberCount: number;
}
```

---

### 6.3 US-003: 多聊天室切换

**关联模块：** `RoomService` + `PeerService` + `ChatScreen`

**设计：**

```typescript
class RoomService {
  private currentRoomId: string | null = null;
  private joinedRooms: Map<string, Room> = new Map();
  private roomMessages: Map<string, ChatMessage[]> = new Map();

  /** 切换聊天室 */
  async switchRoom(roomId: string): Promise<void>;
  // 1. 暂停当前房间的 UI 更新
  // 2. 断开当前房间的 P2P 连接
  // 3. 连接目标房间的 P2P peers
  // 4. 加载目标房间的历史消息
  // 5. 切换 UI 渲染目标
  // 6. 通知 UI 刷新

  /** 获取当前聊天室 ID */
  getCurrentRoomId(): string | null;
}
```

**状态管理：**
- 每个 joinedRoom 维护独立的 `ChatMessage[]` 缓存（内存中最多 500 条）
- 切换聊天室时，当前房间的消息列表保存在内存 map 中
- PeerService 维护 `Map<roomId, Map<userId, PeerConnection>>`，按房间隔离连接

---

### 6.4 US-004: 发送纯文本消息

**关联模块：** `ChatService` + `PeerService` + `InputBox` + `HistoryService`

**流程：**

```
用户输入文本 → Enter
  │
  ▼
InputBox 解析输入
  │
  ├─ 以 "/" 开头 ──▶ CommandHandler (见 6.10, 6.17, 6.18)
  │
  └─ 普通文本 ──▶ ChatService.send()
                      │
                      ├─ 1. 解析 @mentions (正则 /\@(\S+)/ 提取)
                      ├─ 2. 生成 ChatMessage
                      │     {
                      │       id: uuid(),
                      │       type: "text",
                      │       senderId: config.userId,
                      │       senderNickname: config.nickname,
                      │       content: "原始文本",
                      │       roomId: currentRoomId,
                      │       timestamp: Date.now(),
                      │       mentions: [matched user IDs]
                      │     }
                      ├─ 3. HistoryService.appendMessage(msg)
                      ├─ 4. EventBus.emit("new-message", msg)
                      └─ 5. PeerService.broadcast(msg)
```

**输入处理细节：**

```typescript
// InputBox 组件使用 Ink 的 useInput hook
// Enter → 发送
// Shift+Enter → 插入换行（通过维护内部 multiline state）
// @ → 触发成员补全弹窗
// Escape → 取消补全/回复模式

// 多行输入实现：
// 维护一个 string[] 存储多行内容
// 渲染时将 string[] join("\n") 显示
// Shift+Enter: push 新行
// Backspace at line start: merge with previous line
```

---

### 6.5 US-005: 接收并显示消息

**关联模块：** `ChatService` + `ChatView` + `EventBus`

**消息接收流程：**

```
PeerConnection 收到 TCP 数据
  │
  ▼
P2PTransport.decode() → P2PProtocolMessage
  │
  ▼
ChatService.handleIncoming(protocolMsg)
  │
  ├─ type === "chat"
  │    ├─ 校验 roomId 匹配
  │    ├─ 转换为 ChatMessage 对象
  │    ├─ HistoryService.appendMessage(msg)
  │    └─ EventBus.emit("new-message", msg)
  │
  ├─ type === "join"
  │    ├─ MemberService.addMember()
  │    ├─ 生成系统消息 ChatMessage { type: "join", content: "昵称 加入了聊天室" }
  │    ├─ HistoryService.appendMessage()
  │    └─ EventBus.emit("new-message")
  │
  ├─ type === "leave"
  │    ├─ MemberService.markOffline()
  │    ├─ 生成系统消息 ChatMessage { type: "leave", content: "昵称 离开了聊天室" }
  │    ├─ HistoryService.appendMessage()
  │    └─ EventBus.emit("new-message")
  │
  └─ type === "rename"
       ├─ MemberService.updateNickname()
       ├─ 生成系统消息
       └─ EventBus.emit("new-message")
```

**ChatView 渲染逻辑：**

```typescript
// ChatView 订阅 EventBus
useEffect(() => {
  const handler = (msg: ChatMessage) => {
    // 追加到消息列表
    setMessages(prev => {
      const next = [...prev, msg];
      // 裁剪到最多 500 条
      return next.length > 500 ? next.slice(-500) : next;
    });

    // 如果用户不在底部，不自动滚动
    // isAtBottom 通过滚动位置判断
    if (isAtBottom) {
      scrollToBottom();
    }

    // 设置终端标题闪烁
    flashTerminal();
  };
  eventBus.on("new-message", handler);
  return () => eventBus.off("new-message", handler);
}, []);
```

**消息格式化渲染：**

```typescript
function formatMessage(msg: ChatMessage, currentUserId: string): string {
  const time = formatTime(msg.timestamp); // HH:mm:ss
  const isSelf = msg.senderId === currentUserId;

  switch (msg.type) {
    case "text":
      if (isSelf) return `[${time}] 我: ${msg.content}`;
      return `[${time}] ${msg.senderNickname}: ${msg.content}`;

    case "system":
    case "join":
    case "leave":
    case "rename":
      return `[${time}] 系统: ${msg.content}`;

    case "reply":
      const quote = msg.replyTo
        ? `[回复 ${msg.replyTo.senderNickname}: ${msg.replyTo.content}]`
        : "";
      const prefix = isSelf ? "我" : msg.senderNickname;
      return `[${time}] ${prefix} ${quote}: ${msg.content}`;

    default:
      return "";
  }
}
```

---

### 6.6 US-006: @ 用户

**关联模块：** `MentionService` + `InputBox`

**@ 补全流程：**

```
用户输入 "@"
  │
  ▼
InputBox 检测到 "@" 字符
  │
  ▼
MentionService.getCandidates(filter: string)
  │
  ▼
渲染补全弹窗 (Ink Box 组件，浮于输入框上方)
  ┌─────────────────┐
  │ @张三  @张小明    │
  │ @李四  @赵五      │
  └─────────────────┘
  │
  ├─ 继续输入 → 过滤候选列表 (e.g., "@张" → 只显示 @张三 @张小明)
  ├─ 上下箭头 → 移动选中项
  ├─ Tab/Enter → 确认选中，替换为 "@昵称 "
  └─ Escape → 关闭补全弹窗
```

**MentionService 接口：**

```typescript
class MentionService {
  /** 获取匹配的成员候选列表 */
  getCandidates(filter: string): Member[];

  /** 解析消息中被 @ 的用户 */
  parseMentions(content: string, members: Member[]): UserId[];

  /** 检查消息是否 @ 了当前用户 */
  isMentioned(msg: ChatMessage, currentUserId: string): boolean;
}
```

**高亮渲染：**

```typescript
// ChatView 中渲染消息时，检查是否被 @
// 被 @ 的消息整体使用黄色文字渲染 (chalk.yellow)

function renderMessage(msg: ChatMessage): React.ReactElement {
  const isMentioned = mentionService.isMentioned(msg, currentUserId);
  const formatted = formatMessage(msg, currentUserId);

  return <Text color={isMentioned ? "yellow" : undefined}>{formatted}</Text>;
}
```

---

### 6.7 US-007: 回复消息

**关联模块：** `MentionService` + `InputBox` + `ChatView`

**回复流程：**

```
用户选中某条消息 (上下箭头浏览历史消息)
  │
  ▼
按 Enter 选中消息 → InputBox 进入回复模式
  │
  ▼
InputBox 顶部显示引用:
  ┌──────────────────────────────┐
  │ > 张三: 原始消息内容          │  (灰色引用)
  │ 我的回复内容_______________  │
  └──────────────────────────────┘
  │
  ▼
用户输入回复内容 → Enter 发送
  │
  ▼
ChatService.send({
  ...baseMessage,
  type: "reply",
  replyTo: {
    messageId: originalMessage.id,
    senderNickname: originalMessage.senderNickname,
    content: truncate(originalMessage.content, 50)
  }
})
```

**消息选择模式：**

```typescript
// ChatView 维护 selectedIndex
// 上下箭头键移动选中高亮
// 选中时显示 "回复 (Enter)" 提示
// Enter → 设置 InputBox 为回复模式
// Escape → 退出选中模式
// 回复消息发送后，InputBox 退出回复模式
```

---

### 6.8 US-008 / US-009: 上线/下线通知

**关联模块：** `MemberService` + `ZKClient` + `PeerService`

**上线通知流程：**

```
ZK: /libra-regions/{roomId}/members 子节点变化 (Children Watcher)
  │
  ▼
ZKClient.onMembersChanged(roomId, memberPaths)
  │
  ▼
ZKClient.getData() 逐个读取成员数据
  │
  ▼
MemberService.syncMembers(roomId, newMembers)
  │
  ├─ 新增成员:
  │    ├─ 生成系统消息: "昵称 加入了聊天室"
  │    ├─ 如果是新增的 peer (非自己):
  │    │    PeerService.connectToPeer(newMember.address)
  │    └─ EventBus.emit("new-message", systemMsg)
  │
  └─ 减少的成员:
       ├─ 生成系统消息: "昵称 离开了聊天室"
       ├─ PeerService.disconnectPeer(leftMember.userId)
       └─ EventBus.emit("new-message", systemMsg)

同时: P2P 心跳超时也可触发下线通知 (与 ZK watcher 双重检测)
```

**MemberService 接口：**

```typescript
class MemberService {
  private members: Map<string, Map<UserId, Member>> = new Map(); // roomId → members

  /** 同步成员列表（来自 ZK watcher 回调） */
  async syncMembers(roomId: string, members: Member[]): Promise<void>;

  /** 添加单个成员 */
  addMember(roomId: string, member: Member): void;

  /** 标记成员离线 */
  markOffline(roomId: string, userId: string): void;

  /** 更新成员昵称 */
  updateNickname(roomId: string, userId: string, nickname: string): void;

  /** 获取聊天室所有成员 */
  getMembers(roomId: string): Member[];

  /** 获取在线成员 */
  getOnlineMembers(roomId: string): Member[];

  /** 获取成员总数 */
  getMemberCount(roomId: string): number;
}
```

---

### 6.9 US-010: 修改昵称

**关联模块：** `ConfigService` + `ZKClient` + `MemberService` + `ChatService`

**流程：**

```
用户输入 /rename 新昵称
  │
  ▼
CommandHandler.handleRename(newNickname)
  │
  ├─ 1. 校验昵称合法性 (非空, 长度 1-20, 无特殊字符)
  │
  ├─ 2. ConfigService.updateNickname(newNickname)
  │    ├─ ConfigStore.save(config)
  │    └─ config.nickname = newNickname (内存更新)
  │
  ├─ 3. ZKClient.updateMember(roomId, userId, JSON.stringify({...oldData, nickname: newNickname}))
  │
  └─ 4. PeerService.broadcast({
         type: "rename",
         payload: { userId, oldNickname, newNickname }
       })
           │
           ▼
       其他节点收到 rename 消息
           │
           ├─ MemberService.updateNickname()
           ├─ 生成系统消息: "旧昵称 修改昵称为 新昵称"
           └─ EventBus.emit("new-message")
```

---

### 6.10 US-011: 查看成员列表

**关联模块：** `MemberList` 组件 + `MemberService`

**渲染逻辑：**

```typescript
function MemberList({ roomId }: { roomId: string }) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    // 订阅成员变化
    const handler = () => {
      setMembers(memberService.getMembers(roomId));
    };
    eventBus.on("members-changed", handler);
    setMembers(memberService.getMembers(roomId)); // 初始加载
    return () => eventBus.off("members-changed", handler);
  }, [roomId]);

  // 按 joinedAt 降序排序（最新在前）
  const sorted = [...members].sort((a, b) => b.joinedAt - a.joinedAt);

  return (
    <Box flexDirection="column">
      <Text bold>成员 ({sorted.length})</Text>
      {sorted.map(m => (
        <Box key={m.userId}>
          <Text color={m.status === "online" ? "green" : "gray"}>
            {m.status === "online" ? "●" : "○"} {m.nickname}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

---

### 6.11 US-012: 消息本地存储

**关联模块：** `HistoryService` + `HistoryStore`

**存储设计：**

```
路径: /tmp/chat-room/{roomId}/history.txt

文件格式 (每行一条消息):
[14:30:25] 系统: 张三 加入了聊天室
[14:30:28] 张三: 大家好
[14:30:35] 李四: @张三 欢迎！

追加写入 (O_APPEND):
- 每条新消息直接追加到文件末尾
- 使用 fs.appendFileSync() 确保原子性
- 写入前将 ChatMessage 格式化为单行文本
```

**HistoryStore 接口：**

```typescript
class HistoryStore {
  private readonly basePath = "/tmp/chat-room";

  /** 追加一条消息 */
  async appendMessage(roomId: string, message: ChatMessage): Promise<void>;

  /** 加载历史消息 */
  async loadHistory(roomId: string, limit: number = 500): Promise<ChatMessage[]>;

  /** 清理过期消息 */
  async cleanupExpired(roomId: string, beforeTimestamp: number): Promise<void>;

  /** 解析单行文本为 ChatMessage (反向) */
  private parseLine(line: string): ChatMessage | null;

  /** 格式化 ChatMessage 为单行文本 */
  private formatMessage(msg: ChatMessage): string;
}
```

**HistoryService 接口：**

```typescript
class HistoryService {
  constructor(private store: HistoryStore) {}

  /** 追加消息到持久化存储 */
  async appendMessage(msg: ChatMessage): Promise<void>;

  /** 加载房间历史消息 */
  async loadHistory(roomId: string): Promise<ChatMessage[]>;

  /** 清理过期消息 (启动时调用) */
  async cleanupOldMessages(roomId: string): Promise<void>;
}
```

---

### 6.12 US-013: 历史消息加载

**关联模块：** `ChatService` + `HistoryService` + `ChatScreen`

**流程：**

```
进入聊天室 (joinRoom 成功)
  │
  ▼
HistoryService.loadHistory(roomId)
  │
  ▼
HistoryStore.loadHistory(roomId, 500)
  │
  ├─ 文件存在 → 读取文件 → 按行解析 → 逆序取最近 500 条 → 正序返回
  └─ 文件不存在 → 返回空数组
  │
  ▼
ChatScreen 初始化 messages state
  │
  ▼
ChatView 渲染消息列表 → 自动滚动到底部
```

---

### 6.13 US-014: 历史消息清理

**关联模块：** `HistoryService`

**流程：**

```
应用启动
  │
  ▼
HistoryService.cleanupOldMessages(roomId)
  │
  ▼
计算截止时间: Date.now() - 30 * 24 * 60 * 60 * 1000
  │
  ▼
HistoryStore.cleanupExpired(roomId, cutoff)
  │
  ▼
逐行读取文件:
  ├─ 消息时间 >= cutoff → 保留
  └─ 消息时间 < cutoff → 跳过
  │
  ▼
将保留行写入临时文件 → rename 替换原文件
  │
  ▼
完成（对用户透明，无提示）
```

---

### 6.14 US-015: ZooKeeper 连接断开与重连

**关联模块：** `ZKClient` + `UI SystemBar`

**状态机：**

```
            connect()         session expired
  CLOSED ──────────▶ CONNECTED ──────────────▶ EXPIRED
    ▲                   │                           │
    │                   │ connection lost            │
    │                   ▼                           │
    │              DISCONNECTED                      │
    │                   │                           │
    │         reconnect() (5s interval)              │
    │                   │                           │
    └───────────────────┘                           │
                                     disconnect()  │
                                    ◀──────────────┘
```

**重连逻辑：**

```typescript
class ZKClient {
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly RECONNECT_INTERVAL = 5000;

  onConnectionLost(): void {
    // 1. EventBus.emit("zk-disconnected")
    //    → SystemBar 显示黄色警告 "ZooKeeper 连接已断开，正在重连..."
    // 2. 本地功能不受影响: 仍可查看历史消息、仍可使用已有 P2P 连接
    // 3. 启动重连定时器
    this.reconnectTimer = setInterval(() => this.reconnect(), this.RECONNECT_INTERVAL);
  }

  async reconnect(): Promise<void> {
    try {
      await this.connect(this.addresses);
      if (this.reconnectTimer) clearInterval(this.reconnectTimer);

      // 重连成功后重新注册、重新设置 watcher
      await this.joinRoom(this.currentRoomId, this.memberInfo);
      this.watchMembers(this.currentRoomId, this.membersCallback);

      // EventBus.emit("zk-reconnected")
      // → SystemBar 显示绿色 "已重新连接"
    } catch {
      // 重连失败，等待下次定时器触发
    }
  }
}
```

---

### 6.15 US-016: 离线成员消息提示

**关联模块：** `ChatService` + `MentionService`

**流程：**

```
用户发送包含 @ 的消息
  │
  ▼
MentionService.parseMentions(content, allMembers)
  │
  ▼
检查 mentions 中的 userId 是否有 offline 成员
  │
  ├─ 有离线成员 ──▶ 在发送消息后，追加一条本地提示:
  │                   (不广播，仅本地显示)
  │                   [HH:mm:ss] 系统: 用户 "李四" 当前离线，消息可能无法送达
  │
  └─ 全部在线 ──▶ 正常发送，无额外提示
```

---

### 6.16 US-017: 退出聊天室

**关联模块：** `RoomService` + `PeerService` + `ZKClient`

**流程：**

```
用户输入 /exit-room
  │
  ▼
ChatScreen 显示确认: "确定退出聊天室 {roomId}? (y/n)"
  │
  ├─ 用户确认 "y"
  │    ├─ PeerService.broadcast({ type: "leave", payload: { userId, nickname } })
  │    │    → 通知所有 peer
  │    ├─ PeerService.disconnectAll(roomId)
  │    │    → 关闭所有 P2P 连接
  │    ├─ ZKClient.leaveRoom(roomId, userId)
  │    │    → 删除 ZK 临时节点
  │    ├─ HistoryService.cleanupOldMessages(roomId)
  │    │    → 清理过期历史
  │    ├─ 更新 recentRooms 列表
  │    └─ 切换到 RoomSelectScreen
  │
  └─ 用户取消 "n" → 返回聊天界面
```

---

### 6.17 US-018: 退出程序

**关联模块：** App 入口 + `RoomService` + `ZKClient` + `ConfigService`

**流程：**

```
用户按 Ctrl+C 或输入 /quit
  │
  ▼
gracefulShutdown()
  │
  ├─ 1. 如果在聊天室中:
  │      ├─ PeerService.broadcast({ type: "leave" })
  │      ├─ PeerService.disconnectAll()
  │      ├─ ZKClient.leaveRoom()
  │
  ├─ 2. ZKClient.disconnect()
  │
  ├─ 3. ConfigService.save()
  │      └─ 保存 currentRoomId, recentRooms 等
  │
  ├─ 4. HistoryService: 消息已实时追加，无需额外保存
  │
  └─ 5. process.exit(0)
```

**信号处理：**

```typescript
// src/index.ts
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// 使用 single-shot: 防止二次 Ctrl+C 强制退出
let isShuttingDown = false;
function gracefulShutdown() {
  if (isShuttingDown) {
    process.exit(1); // 第二次强制退出
  }
  isShuttingDown = true;
  // ... 正常关闭流程
}
```

---

## 7. 异常处理与可靠性

### 7.1 错误处理策略

| 场景 | 处理方式 | 用户感知 |
|-----|---------|---------|
| ZK 连接失败（首次） | 提示用户检查地址，允许重新输入 | 错误提示 |
| ZK 会话过期 | 自动重连，重连期间 P2P 连接可用 | 状态栏警告 |
| P2P 连接建立失败 | 标记 peer 不可达，定期重试 | 静默 |
| P2P 连接中断 | 心跳超时检测，清理连接，通知成员变动 | 系统消息 |
| 消息发送失败 | 标记发送失败，本地仍可查看 | 本地失败提示 |
| 历史文件读写失败 | 降级为纯内存模式，不影响聊天 | 静默降级 |
| 配置文件损坏 | 使用默认配置重新生成 | 提示重置 |

### 7.2 并发安全

- **文件写入**: 使用 `fs.appendFileSync` 保证追加原子性，避免消息丢失
- **消息列表**: 单线程事件循环，无需锁；消息列表使用不可变更新 (`[...prev, msg]`)
- **P2P 连接**: 每个 `PeerConnection` 封装独立的 socket 和状态，通过 Map 管理

---

## 8. 第三方依赖清单

| 依赖 | 版本 | 用途 |
|-----|------|------|
| `ink` | ^5.x | React 终端 UI 渲染框架 |
| `ink-text-input` | ^6.x | 终端输入框组件 |
| `ink-spinner` | ^5.x | 加载动画 |
| `react` | ^18.x | Ink 的 peer dependency |
| `node-zookeeper-client` | ^2.x | ZooKeeper 客户端 (ZK 3.5.9 兼容) |
| `uuid` | ^10.x | 消息 ID 和用户 ID 生成 |
| `chalk` | ^5.x | 终端颜色 (Ink 内置依赖，显式声明) |
| `typescript` | ^5.x | 开发依赖 |
| `vitest` | ^2.x | 测试框架 |
| `@types/node` | ^22.x | Node.js 22 类型定义 |
| `tsx` | ^4.x | TypeScript 直接执行 |

**为什么不选其他方案：**

| 替代方案 | 不选原因 |
|---------|---------|
| blessed / blessed-contrib | API 底层，维护不活跃 |
| `zookeeper` (npm) | 纯 JS 实现，性能和兼容性不如 node-zookeeper-client |
| WebSocket | P2P 场景下 TCP 直连更简单，无需升级握手 |
| protobuf | 局域网场景 JSON 足够，protobuf 增加开发复杂度 |

---

## 9. 构建与部署

### 9.1 项目配置

**package.json 核心字段：**

```json
{
  "name": "chat-room",
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "bin": {
    "chat-room": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "lint": "eslint src/"
  }
}
```

**tsconfig.json 核心配置：**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 9.2 运行方式

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 全局安装 (可选)
npm link

# 使用
chat-room
```

### 9.3 环境要求

| 要求 | 说明 |
|-----|------|
| Node.js | >= 22.0.0 |
| ZooKeeper | 3.5.9 (需预先部署) |
| 操作系统 | macOS (Darwin) |
| 网络 | 局域网环境 |
