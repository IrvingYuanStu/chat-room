# Chat Room - 任务分解

> 基于 `spec/plan.md` 技术设计文档和 `spec/chat-room-spec.md` 产品需求文档。
> 原子化任务列表，标注依赖关系和并行标记 `[P]`。

---

## Phase 1: Foundation（基础框架）

### 1.1 项目初始化

**Task:** 初始化 npm 项目，配置 `package.json`、`tsconfig.json`，创建目录结构。

- 创建 `package.json`（name: chat-room, type: module, engines: node>=22）
- 创建 `tsconfig.json`（target: ES2023, module: NodeNext, jsx: react-jsx）
- 创建目录结构：`src/`, `src/ui/`, `src/ui/screens/`, `src/ui/components/`, `src/services/`, `src/network/`, `src/store/`, `tests/`
- 安装依赖：ink, ink-text-input, ink-spinner, react, node-zookeeper-client, uuid, chalk, typescript, vitest, tsx, @types/node
- 配置 scripts：dev, build, start, test
- **关联 US:** 所有（前置条件）
- **依赖:** 无

---

### 1.2 核心类型定义

**Task:** 在 `src/services/types.ts` 中定义所有共享 TypeScript 类型和接口。

- `UserId`（string 类型别名）
- `PeerAddress`（ip, port）
- `AppConfig`（userId, nickname, zkAddresses, p2pPort, currentRoomId, recentRooms）
- `MemberStatus`（"online" | "offline"）
- `Member`（userId, nickname, status, address, joinedAt）
- `Room`（roomId, members Map, createdAt）
- `MessageType`（"text" | "system" | "join" | "leave" | "rename" | "reply"）
- `ChatMessage`（id, type, senderId, senderNickname, content, roomId, timestamp, replyTo?, mentions?）
- `P2PProtocolMessage`（version, type, payload, timestamp, senderId）
- `P2PMessageType`（"handshake" | "chat" | "join" | "leave" | "rename" | "sync-request" | "sync-response" | "heartbeat" | "ack"）
- `HandshakePayload`（userId, nickname, roomId, address）
- `HandshakeResponsePayload`（userId, nickname, roomId, address, members）
- `HeartbeatPayload`（sequence）
- `RoomInfo`（roomId, memberCount）
- **关联 US:** 所有（前置条件）
- **依赖:** 1.1

---

### 1.3 事件总线

**Task:** 实现 `src/services/EventBus.ts`，全局事件解耦。

- 基于 Node.js EventEmitter 封装，提供类型安全的事件订阅
- 定义事件类型映射：`"new-message"`, `"members-changed"`, `"zk-disconnected"`, `"zk-reconnected"`, `"connection-lost"`, `"peer-connected"`, `"peer-disconnected"`
- 提供 `on(event, handler)`, `off(event, handler)`, `emit(event, data)` 方法
- 导出全局单例实例
- **关联 US:** US-005, US-008, US-009, US-010, US-011, US-015
- **依赖:** 1.1 `[P]`

---

### 1.4 配置存储

**Task:** 实现 `src/store/ConfigStore.ts`，配置文件读写。

- 配置路径：`~/.chat-room/config.json`
- `load()`: 读取配置文件，文件不存在返回 null，JSON 解析失败时抛出异常
- `save(config)`: 写入配置文件，自动创建目录（`fs.mkdir` recursive）
- `getConfigPath()`: 返回配置文件路径
- 处理目录不存在的情况（首次运行时自动创建 `~/.chat-room/`）
- **关联 US:** US-001
- **依赖:** 1.2

---

## Phase 2: Network Layer（网络层）

### 2.1 P2P 帧协议编解码

**Task:** 实现 `src/network/P2PTransport.ts`，TCP 消息帧的编解码。

- 帧格式：Magic（2B, 0xCR 0x4D）+ Length（4B, Big-Endian uint32）+ JSON Payload（NB, UTF-8）
- `encode(message: P2PProtocolMessage): Buffer`：序列化 JSON + 添加帧头
- `decode(data: Buffer)`：从字节流中提取完整帧，处理粘包/半包
- 实现帧重组器（FrameReassembler）：缓存不完整数据，收到足够数据后返回完整帧
- Magic 校验：帧头不匹配时丢弃数据并寻找下一个有效帧头
- **关联 US:** US-004, US-005
- **依赖:** 1.2

---

### 2.2 ZooKeeper 客户端

**Task:** 实现 `src/network/ZKClient.ts`，ZooKeeper 连接与节点管理。

- `connect(addresses: string[])`: 连接 ZK 集群
- `disconnect()`: 断开连接
- `ensureBasePath()`: 确保 `/libra-regions` 根节点存在
- `listRooms(): Promise<string[]>`: 获取 `/libra-regions` 下的子节点列表作为聊天室 ID
- `createRoom(roomId: string)`: 创建 `/libra-regions/{roomId}` 和 `/libra-regions/{roomId}/members`（幂等）
- `joinRoom(roomId, memberInfo)`: 在 `/libra-regions/{roomId}/members/` 下创建 EPHEMERAL 临时节点，数据为成员 JSON
- `leaveRoom(roomId, userId)`: 删除临时节点
- `updateMember(roomId, userId, data)`: 更新节点数据（setData）
- `watchMembers(roomId, callback)`: 设置 Children Watcher，成员变化时读取所有成员数据并回调
- `getRoomMembers(roomId): Promise<Member[]>`: 读取聊天室所有成员信息
- 连接状态管理：监听 ZK client 的 state 事件，维护 `connected` / `disconnected` / `expired` 状态
- `onStateChange(callback)`: 注册连接状态变更回调
- **关联 US:** US-002, US-008, US-009, US-010, US-015, US-017
- **依赖:** 1.2 `[P]`

---

### 2.3 单条 P2P 连接封装

**Task:** 实现 `src/network/PeerConnection.ts`，封装单条 TCP 连接的全生命周期。

- 构造：接收 socket（已有连接）或远程地址参数
- `send(message: P2PProtocolMessage)`: 通过 P2PTransport 编码后写入 socket
- `onMessage(callback)`: 注册消息接收回调，内部通过 P2PTransport 解码
- 握手状态管理：`pending` → `handshaking` → `ready` → `closed`
- `initiateHandshake(localInfo)`: 作为客户端发起握手（发送 HandshakePayload）
- `handleHandshake(remoteInfo)`: 作为服务端处理握手（验证 roomId，返回 HandshakeResponsePayload）
- 心跳机制：
  - 每 30s 发送 `heartbeat` 消息（递增 sequence）
  - 收到对方 `heartbeat` 时更新 `lastSeen`
  - 启动定时检查：`now - lastSeen > 90s` → 触发 `onTimeout` 回调
- `close()`: 关闭 socket，清理心跳定时器
- `getRemoteInfo()`: 返回远端成员信息（userId, nickname, address）
- `isAlive(): boolean`: 判断连接是否存活
- **关联 US:** US-004, US-005, US-008, US-009
- **依赖:** 2.1

---

### 2.4 P2P 服务端

**Task:** 实现 `src/network/P2PServer.ts`，TCP 监听与接入管理。

- 使用 `net.createServer()` 监听配置端口（默认 9001）
- 接受新连接时创建 `PeerConnection` 实例
- 触发 `onConnection(callback: (conn: PeerConnection) => void)` 回调
- 处理端口占用（EADDRINUSE）时自动尝试端口 +1（端口范围 9001-9010）
- `start(port)`: 开始监听
- `stop()`: 关闭服务器，断开所有已接入连接
- `getPort(): number`: 返回实际监听端口
- **关联 US:** US-004, US-005, US-008
- **依赖:** 2.3

---

### 2.5 P2P 客户端

**Task:** 实现 `src/network/P2PClient.ts`，主动建立 TCP 连接。

- `connect(address: PeerAddress): Promise<PeerConnection>`：连接远端节点
- 连接成功后自动创建 `PeerConnection` 实例
- 连接失败时抛出异常（由调用方处理重试逻辑）
- `connectWithRetry(address, maxRetries, interval)`: 带重试的连接，指数退避
- **关联 US:** US-002, US-008
- **依赖:** 2.3

---

## Phase 3: Service Layer（服务层）

### 3.1 历史消息存储

**Task:** 实现 `src/store/HistoryStore.ts`，本地历史消息文件读写。

- 存储路径：`/tmp/chat-room/{roomId}/history.txt`
- `appendMessage(roomId, message)`: 追加一条消息到文件末尾（O_APPEND）
  - 使用 `fs.appendFileSync()` 确保原子性
  - 调用 `formatMessage()` 格式化为单行文本
- `loadHistory(roomId, limit = 500): Promise<ChatMessage[]>`:
  - 文件不存在返回空数组
  - 按行读取文件，调用 `parseLine()` 解析每行
  - 逆序取最近 limit 条，然后正序返回
- `cleanupExpired(roomId, beforeTimestamp)`:
  - 逐行读取，保留时间 >= cutoff 的行
  - 写入临时文件后 rename 替换原文件
- `formatMessage(msg): string`: 将 ChatMessage 格式化为 `[HH:mm:ss] 昵称: 内容` 单行文本
- `parseLine(line): ChatMessage | null`: 解析单行文本为 ChatMessage，解析失败返回 null
- 自动创建目录 `/tmp/chat-room/{roomId}/`
- **关联 US:** US-012, US-013, US-014
- **依赖:** 1.2 `[P]`

---

### 3.2 配置服务

**Task:** 实现 `src/services/ConfigService.ts`，配置管理。

- 构造函数接收 `ConfigStore` 实例
- `load(): Promise<AppConfig | null>`: 从 ConfigStore 加载配置
- `save(): Promise<void>`: 保存当前配置到 ConfigStore
- `init(zkAddresses, nickname)`: 首次配置，生成 userId（uuid），创建 AppConfig 并保存
- `getUserId()`, `getNickname()`, `getZkAddresses()`, `getP2pPort()` 等访问器
- `updateNickname(newNickname)`: 更新昵称并保存
- `updateCurrentRoom(roomId)`: 更新当前聊天室 ID 并保存
- `addRecentRoom(roomId)`: 添加到 recentRooms 列表（去重，最多保留 10 个）
- 配置损坏时的降级处理：返回 null，让上层触发重新配置流程
- **关联 US:** US-001, US-010
- **依赖:** 1.4

---

### 3.3 历史消息服务

**Task:** 实现 `src/services/HistoryService.ts`，消息持久化业务逻辑。

- 构造函数接收 `HistoryStore` 实例
- `appendMessage(msg: ChatMessage)`: 追加消息到持久化存储
- `loadHistory(roomId: string): Promise<ChatMessage[]>`: 加载房间历史消息
- `cleanupOldMessages(roomId: string)`: 清理 30 天前的消息
  - 计算截止时间：`Date.now() - 30 * 24 * 60 * 60 * 1000`
  - 调用 HistoryStore.cleanupExpired()
- 写入失败时静默降级（console.warn），不影响聊天功能
- **关联 US:** US-012, US-013, US-014
- **依赖:** 3.1

---

### 3.4 成员服务

**Task:** 实现 `src/services/MemberService.ts`，成员状态管理。

- 内部维护 `Map<string, Map<UserId, Member>>`（roomId → members）
- `syncMembers(roomId, members)`: 同步成员列表（来自 ZK watcher 回调）
  - 对比新旧列表，识别新增/减少的成员
  - 新增成员：调用 `addMember()`，emit 事件
  - 减少成员：调用 `markOffline()`，emit 事件
- `addMember(roomId, member)`: 添加单个成员
- `markOffline(roomId, userId)`: 标记成员离线
- `updateNickname(roomId, userId, nickname)`: 更新成员昵称
- `getMembers(roomId): Member[]`: 获取聊天室所有成员
- `getOnlineMembers(roomId): Member[]`: 获取在线成员
- `getMemberCount(roomId): number`: 获取成员总数
- `getMemberByUserId(roomId, userId): Member | undefined`: 按用户 ID 查找
- 成员变化时通过 EventBus emit `"members-changed"` 事件
- **关联 US:** US-008, US-009, US-010, US-011, US-016
- **依赖:** 1.3, 2.2

---

### 3.5 聊天室服务

**Task:** 实现 `src/services/RoomService.ts`，聊天室管理。

- 内部维护 `currentRoomId`、`joinedRooms: Map<string, Room>`、`roomMessages: Map<string, ChatMessage[]>`（每房间最多 500 条缓存）
- 构造函数接收 `ZKClient`、`PeerService`、`MemberService`、`HistoryService`、`ConfigService`
- `listAvailableRooms(): Promise<RoomInfo[]>`: 获取可用聊天室列表及各房间成员数
- `createAndJoin(roomId)`: 创建聊天室（幂等）并加入
  - 调用 ZKClient.createRoom()
  - 注册 ZK 临时节点（包含 nickname, ip, port）
  - 启动 members watcher
  - 启动 P2P Server
  - 连接已有 peers
- `joinRoom(roomId)`: 加入已有聊天室（同上流程）
- `leaveRoom(roomId)`: 离开聊天室
  - 通知所有 peer（broadcast leave 消息）
  - 断开所有 P2P 连接
  - 删除 ZK 临时节点
  - 清理历史消息
- `switchRoom(roomId)`: 切换聊天室
  - 断开当前房间的 P2P 连接
  - 连接目标房间的 P2P peers
  - 加载目标房间的历史消息
  - 切换 UI 渲染目标
- `getCurrentRoomId(): string | null`
- **关联 US:** US-002, US-003, US-017
- **依赖:** 2.2, 3.4

---

### 3.6 @ 补全与回复服务

**Task:** 实现 `src/services/MentionService.ts`，@ 补全与回复功能。

- `getCandidates(filter: string): Member[]`: 获取匹配的成员候选列表
  - 从 MemberService 获取当前房间在线成员
  - 根据 filter 字符串模糊匹配昵称（不区分大小写）
- `parseMentions(content: string, members: Member[]): UserId[]`: 解析消息中被 @ 的用户
  - 使用正则 `/@(\S+)/g` 提取 @ 文本
  - 与成员昵称匹配，返回对应的 userId 列表
- `isMentioned(msg: ChatMessage, currentUserId: string): boolean`: 检查消息是否 @ 了当前用户
  - 检查 msg.mentions 是否包含 currentUserId
- `hasOfflineMention(mentions: UserId[], members: Member[]): Member[]`: 检查被 @ 的成员中是否有离线成员
  - 返回离线成员列表（用于 US-016 提示）
- **关联 US:** US-006, US-016
- **依赖:** 3.4 `[P]`

---

### 3.7 P2P 连接管理服务

**Task:** 实现 `src/services/PeerService.ts`，P2P 连接的集中管理。

- 内部维护 `Map<roomId, Map<userId, PeerConnection>>`
- 构造函数接收 `P2PServer`、`P2PClient`、`MemberService`、`EventBus`
- `startServer(port)`: 启动 P2P 监听服务
- `connectToPeer(roomId, member: Member)`: 向指定成员建立连接
  - 通过 P2PClient 连接，完成握手
  - 握手成功后加入 peers map
  - 注册消息回调（转发到 ChatService）
  - 注册断开回调（通知 MemberService）
- `disconnectPeer(roomId, userId)`: 关闭指定 peer 连接
- `disconnectAll(roomId)`: 关闭房间内所有 peer 连接
- `broadcast(roomId, message: P2PProtocolMessage)`: 向房间内所有已连接 peer 广播消息
  - 遍历 peers map，逐个发送
  - 发送失败（连接已断开）时从 map 中移除
- `handleIncomingConnection(conn: PeerConnection)`: 处理服务端收到的新连接
  - 等待握手，验证 roomId
  - 握手成功后加入 peers map
  - 通知 MemberService 新成员加入
- `getConnections(roomId): Map<UserId, PeerConnection>`: 获取房间的所有连接
- 心跳超时处理：PeerConnection 超时时自动触发 disconnectPeer + MemberService.markOffline
- **关联 US:** US-003, US-004, US-005, US-008, US-009, US-017, US-018
- **依赖:** 2.3, 2.4, 2.5, 3.4

---

### 3.8 聊天消息服务

**Task:** 实现 `src/services/ChatService.ts`，消息调度核心。

- 构造函数接收 `HistoryService`、`PeerService`、`MentionService`、`ConfigService`、`MemberService`
- `send(roomId, content: string, replyTo?: ReplyToInfo)`: 发送消息
  - 解析 @mentions（调用 MentionService.parseMentions）
  - 生成 ChatMessage（id: uuid, type: "text"|"reply", senderId, senderNickname, content, roomId, timestamp, mentions, replyTo）
  - 调用 HistoryService.appendMessage() 持久化
  - 调用 EventBus.emit("new-message") 通知 UI
  - 调用 PeerService.broadcast() 转发给所有 peer
  - 检查是否有离线成员被 @，如有则追加本地系统提示消息（US-016）
- `handleIncoming(protocolMsg: P2PProtocolMessage)`: 处理收到的 P2P 消息
  - `type === "chat"`: 校验 roomId，转换为 ChatMessage，持久化，emit "new-message"
  - `type === "join"`: 通知 MemberService，生成系统消息 "昵称 加入了聊天室"，持久化，emit
  - `type === "leave"`: 通知 MemberService.markOffline，生成系统消息 "昵称 离开了聊天室"，持久化，emit
  - `type === "rename"`: 通知 MemberService.updateNickname，生成系统消息 "旧昵称 修改昵称为 新昵称"，持久化，emit
  - `type === "heartbeat"` / `type === "ack"`: 由 PeerConnection 层处理，不进入 ChatService
- `sendRename(oldNickname, newNickname)`: 构造 rename 消息并广播
- `sendLeave()`: 构造 leave 消息并广播
- **关联 US:** US-004, US-005, US-007, US-008, US-009, US-010, US-016
- **依赖:** 3.3, 3.6, 3.7

---

## Phase 4: UI Layer & Integration（UI 层与集成）

### 4.1 状态栏组件

**Task:** 实现 `src/ui/components/SystemBar.tsx`，顶部状态栏。

- 显示内容：当前聊天室 ID、ZK 连接状态图标、在线成员数
- ZK 连接状态：
  - 已连接：绿色文字 `● 已连接`
  - 断开中：黄色文字 `● 断开中`
  - 重连成功：短暂显示绿色 `● 已重连` 后恢复
- 订阅 EventBus 的 `"zk-disconnected"` 和 `"zk-reconnected"` 事件更新状态
- 使用 Ink `<Box>` 和 `<Text>` 布局
- **关联 US:** US-015
- **依赖:** 1.3 `[P]`

---

### 4.2 聊天消息视图组件

**Task:** 实现 `src/ui/components/ChatView.tsx`，聊天消息列表展示。

- 订阅 EventBus `"new-message"` 事件，实时追加消息
- 内部维护 `messages: ChatMessage[]` state，上限 500 条（裁剪逻辑：`next.length > 500 ? next.slice(-500) : next`）
- 消息格式化渲染 `formatMessage(msg, currentUserId)`:
  - 普通消息：`[HH:mm:ss] 昵称: 内容`（自己的消息显示"我"，昵称绿色）
  - 系统消息：`[HH:mm:ss] 系统: 内容`（灰色）
  - 回复消息：`[HH:mm:ss] 昵称 [回复 昵称: 内容]: 回复内容`（引用部分灰色）
- 被 @ 的消息整体黄色高亮（调用 MentionService.isMentioned）
- 自动滚动到底部（新消息到达且用户在底部时）
- 用户不在底部时（浏览历史消息）不自动跳转
- 新消息到达时终端标题闪烁（`process.stdout.write('\x1b]2;...')`）
- 消息选择模式（为 US-007 回复功能准备）：
  - 维护 `selectedIndex` state
  - 上下箭头移动选中高亮
  - 选中时显示 "回复 (Enter)" 提示
  - Enter 键触发回复回调
  - Escape 退出选中模式
- 使用 Ink `<Box flexDirection="column">` 渲染消息列表
- **关联 US:** US-005, US-006, US-007
- **依赖:** 1.3 `[P]`

---

### 4.3 成员列表组件

**Task:** 实现 `src/ui/components/MemberList.tsx`，右侧成员状态列表。

- 订阅 EventBus `"members-changed"` 事件，实时刷新成员列表
- 从 MemberService 获取当前房间的成员数据
- 成员按 `joinedAt` 降序排序（最新加入在前）
- 渲染格式：
  - 在线成员：`● 昵称`（绿色圆点 + 白色昵称）
  - 离线成员：`○ 昵称`（灰色圆点 + 灰色昵称）
- 标题行：`成员 (N)` 显示成员总数
- 使用 Ink `<Box flexDirection="column">` 渲染
- **关联 US:** US-011
- **依赖:** 1.3 `[P]`

---

### 4.4 输入框组件

**Task:** 实现 `src/ui/components/InputBox.tsx`，消息输入与命令输入。

- 左下角显示当前用户昵称前缀
- 文本输入与发送：
  - `Enter` 发送消息
  - `Shift+Enter` 插入换行（多行输入，维护 `string[]` 内部状态）
  - `Backspace` 在行首时与上一行合并
- 命令识别：以 `/` 开头的输入识别为命令，交由上层处理
- @ 补全功能（与 MentionService 配合）：
  - 检测到 `@` 字符时触发补全弹窗
  - 弹窗显示匹配的在线成员列表（调用 MentionService.getCandidates）
  - 继续输入时过滤候选列表
  - 上下箭头选择候选项
  - `Tab` 或 `Enter` 确认选中，替换为 `@昵称 `
  - `Escape` 关闭补全弹窗
- 回复模式（与 ChatView 配合）：
  - 进入回复模式时，输入框上方显示引用行：`> 昵称: 原始消息内容`（灰色）
  - 发送回复后自动退出回复模式
  - `Escape` 取消回复模式
- 使用 Ink `<Box>` 和 `<Text>` 布局
- **关联 US:** US-004, US-006, US-007
- **依赖:** 1.3, 3.6

---

### 4.5 配置界面

**Task:** 实现 `src/ui/screens/ConfigScreen.tsx`，首次配置与配置修改界面。

- 首次启动流程：
  - 提示输入 ZooKeeper 地址（支持逗号分隔多个地址）
  - 提示输入昵称（校验：非空，长度 1-20）
  - 自动生成 userId（uuid）
  - 调用 ConfigService.init() 保存配置
  - 配置完成后回调 `onComplete` 进入下一步
- 后续启动流程：
  - 显示当前配置（ZK 地址、昵称、当前聊天室）
  - 提供确认/修改选项
  - 修改后调用 ConfigService.save() 保存
  - ZK 地址输入错误时的错误提示与重新输入
- 使用 Ink `<Box>` 和 ink-text-input 组件
- **关联 US:** US-001
- **依赖:** 3.2, 4.1

---

### 4.6 聊天室选择界面

**Task:** 实现 `src/ui/screens/RoomSelectScreen.tsx`，聊天室列表与创建。

- 启动时调用 RoomService.listAvailableRooms() 获取聊天室列表
- 渲染列表，每行格式：`序号. 聊天室ID (N members)`
- 支持上下箭头选择 + Enter 加入
- 输入新的聊天室 ID 时：调用 RoomService.createAndJoin() 自动创建并加入
- 加载中状态显示 ink-spinner 动画
- ZK 连接失败时的错误提示
- 加入成功后回调 `onRoomJoined(roomId)` 进入聊天界面
- **关联 US:** US-002
- **依赖:** 3.5, 4.1

---

### 4.7 主聊天界面

**Task:** 实现 `src/ui/screens/ChatScreen.tsx`，主聊天界面布局与逻辑组装。

- 布局组装（Ink Flexbox）：
  ```
  ┌──────────────────────────────────┬────────────────┐
  │  SystemBar（顶部状态栏）          │                │
  ├──────────────────────────────────┤  MemberList    │
  │  ChatView（聊天消息列表，70%高度） │  （右侧30%）   │
  ├──────────────────────────────────┤                │
  │  InputBox（输入区域，30%高度）     │                │
  └──────────────────────────────────┴────────────────┘
  ```
- 进入聊天室时：
  - 调用 HistoryService.loadHistory() 加载历史消息
  - 初始化 ChatView 的 messages state
  - 自动滚动到底部
- 命令处理（在 InputBox 中识别 `/` 前缀后触发）：
  - `/rename 新昵称`：调用 ChatService.sendRename()，更新 ConfigService
  - `/exit-room`：显示确认提示 "确定退出聊天室 {roomId}? (y/n)"，确认后调用 RoomService.leaveRoom()，回调切换到 RoomSelectScreen
  - `/quit`：触发优雅退出流程
- ChatView 选中消息回复时：设置 InputBox 为回复模式，发送完成后调用 ChatService.send() with replyTo
- **关联 US:** US-003, US-004, US-005, US-017
- **依赖:** 4.2, 4.3, 4.4, 3.7, 3.8

---

### 4.8 应用根组件与路由

**Task:** 实现 `src/ui/App.tsx`，Ink 根组件与屏幕路由管理。

- 维护当前屏幕状态：`"config"` | `"room-select"` | `"chat"`
- 根据 ZK 连接状态和配置加载情况决定显示哪个屏幕
- 屏幕切换逻辑：
  - 无配置 → ConfigScreen
  - 有配置且未选房间 → RoomSelectScreen
  - 已选房间 → ChatScreen
  - 退出房间 → 返回 RoomSelectScreen
- 使用 `render()` 方法渲染 Ink 应用
- 将 Service 实例通过 props 传递给各 Screen 组件
- **关联 US:** 所有
- **依赖:** 4.5, 4.6, 4.7

---

### 4.9 程序入口与优雅退出

**Task:** 实现 `src/index.ts`，程序启动入口与生命周期管理。

- 服务实例化与依赖注入：
  - 创建 ConfigStore → ConfigService
  - 创建 HistoryStore → HistoryService
  - 创建 ZKClient
  - 创建 EventBus（全局单例）
  - 创建 MemberService → MentionService → PeerService → ChatService → RoomService
- 启动流程：
  1. 调用 ConfigService.load() 加载配置
  2. 如果有配置，连接 ZK
  3. 渲染 Ink App 组件
  4. 如果在聊天室中，调用 RoomService.switchRoom() 恢复连接
  5. 启动时调用 HistoryService.cleanupOldMessages() 清理过期消息
- 信号处理（优雅退出）：
  - `process.on("SIGINT", gracefulShutdown)`
  - `process.on("SIGTERM", gracefulShutdown)`
  - `gracefulShutdown()`:
    - 防二次触发（`isShuttingDown` 标志，第二次 Ctrl+C 强制退出 `process.exit(1)`）
    - 如果在聊天室中：PeerService.broadcast(leave) → PeerService.disconnectAll() → ZKClient.leaveRoom()
    - ZKClient.disconnect()
    - ConfigService.save()（保存 recentRooms 等）
    - P2PServer.stop()
    - `process.exit(0)`
- **关联 US:** US-018
- **依赖:** 4.8, 3.2, 3.5, 3.7

---

## 依赖关系总览

```
Phase 1: Foundation
  1.1 项目初始化
   ├── 1.2 核心类型定义
   │    ├── 1.4 配置存储
   │    │    └── 3.2 配置服务
   │    ├── 2.1 P2P 帧协议 ──────── [P]
   │    │    └── 2.3 单条 P2P 连接封装
   │    │         ├── 2.4 P2P 服务端
   │    │         └── 2.5 P2P 客户端
   │    └── 2.2 ZK 客户端 ────────── [P]
   └── 1.3 事件总线 ──────────────── [P]
        ├── 3.4 成员服务 ← 2.2
        ├── 4.1 状态栏组件 ──────── [P]
        ├── 4.2 聊天消息视图组件 ── [P]
        └── 4.3 成员列表组件 ────── [P]

Phase 2: Network Layer
  (见上方依赖)

Phase 3: Service Layer
  3.1 历史消息存储 ──────────────── [P]
   └── 3.3 历史消息服务
  3.4 成员服务
   ├── 3.5 聊天室服务 ← 2.2
   ├── 3.6 @ 补全服务 ──────────── [P]
   └── 3.7 P2P 连接管理 ← 2.3, 2.4, 2.5
        └── 3.8 聊天消息服务 ← 3.3, 3.6

Phase 4: UI Layer & Integration
  4.4 输入框组件 ← 1.3, 3.6
  4.5 配置界面 ← 3.2, 4.1
  4.6 聊天室选择界面 ← 3.5, 4.1
  4.7 主聊天界面 ← 4.2, 4.3, 4.4, 3.7, 3.8
  4.8 应用根组件 ← 4.5, 4.6, 4.7
  4.9 程序入口 ← 4.8, 3.2, 3.5, 3.7
```

---

## 任务与用户故事对照表

| 任务 | 关联用户故事 |
|------|-------------|
| 1.1 项目初始化 | 所有（前置） |
| 1.2 核心类型定义 | 所有（前置） |
| 1.3 事件总线 | US-005, US-008, US-009, US-010, US-011, US-015 |
| 1.4 配置存储 | US-001 |
| 2.1 P2P 帧协议 | US-004, US-005 |
| 2.2 ZK 客户端 | US-002, US-008, US-009, US-010, US-015, US-017 |
| 2.3 单条 P2P 连接封装 | US-004, US-005, US-008, US-009 |
| 2.4 P2P 服务端 | US-004, US-005, US-008 |
| 2.5 P2P 客户端 | US-002, US-008 |
| 3.1 历史消息存储 | US-012, US-013, US-014 |
| 3.2 配置服务 | US-001, US-010 |
| 3.3 历史消息服务 | US-012, US-013, US-014 |
| 3.4 成员服务 | US-008, US-009, US-010, US-011, US-016 |
| 3.5 聊天室服务 | US-002, US-003, US-017 |
| 3.6 @ 补全服务 | US-006, US-016 |
| 3.7 P2P 连接管理服务 | US-003, US-004, US-005, US-008, US-009, US-017, US-018 |
| 3.8 聊天消息服务 | US-004, US-005, US-007, US-008, US-009, US-010, US-016 |
| 4.1 状态栏组件 | US-015 |
| 4.2 聊天消息视图组件 | US-005, US-006, US-007 |
| 4.3 成员列表组件 | US-011 |
| 4.4 输入框组件 | US-004, US-006, US-007 |
| 4.5 配置界面 | US-001 |
| 4.6 聊天室选择界面 | US-002 |
| 4.7 主聊天界面 | US-003, US-004, US-005, US-017 |
| 4.8 应用根组件与路由 | 所有 |
| 4.9 程序入口与优雅退出 | US-018 |
