// ===== User & Node =====

/** User unique identifier, UUID generated on first launch, persisted in config */
export type UserId = string;

/** Peer network address */
export interface PeerAddress {
  ip: string;
  port: number;
}

// ===== Config Model =====

/** Global config file ~/.chat-room/config.json */
export interface AppConfig {
  userId: UserId;
  nickname: string;
  zkAddresses: string[];
  p2pPort: number;
  currentRoomId: string | null;
  recentRooms: string[];
}

// ===== Chat Room & Member =====

export type MemberStatus = "online" | "offline";

export interface Member {
  userId: UserId;
  nickname: string;
  status: MemberStatus;
  address: PeerAddress;
  joinedAt: number; // Unix timestamp (ms)
}

export interface Room {
  roomId: string;
  members: Map<UserId, Member>;
  createdAt: number;
}

export interface RoomInfo {
  roomId: string;
  memberCount: number;
}

// ===== Message Model =====

export type MessageType = "text" | "system" | "join" | "leave" | "rename" | "reply";

export interface ReplyToInfo {
  messageId: string;
  senderNickname: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  senderId: UserId;
  senderNickname: string;
  content: string;
  roomId: string;
  timestamp: number;
  replyTo?: ReplyToInfo;
  mentions?: UserId[];
}

// ===== P2P Protocol Model =====

export interface P2PProtocolMessage {
  version: 1;
  type: P2PMessageType;
  payload: unknown;
  timestamp: number;
  senderId: UserId;
}

export type P2PMessageType =
  | "handshake"
  | "chat"
  | "join"
  | "leave"
  | "rename"
  | "sync-request"
  | "sync-response"
  | "heartbeat"
  | "ack";

export interface HandshakePayload {
  userId: UserId;
  nickname: string;
  roomId: string;
  address: PeerAddress;
}

export interface HandshakeResponsePayload {
  userId: UserId;
  nickname: string;
  roomId: string;
  address: PeerAddress;
  members: Member[];
}

export interface HeartbeatPayload {
  sequence: number;
}

// ===== ZK Member Info (stored as JSON in ZK node data) =====

export interface MemberInfo {
  nickname: string;
  status: MemberStatus;
  ip: string;
  port: number;
}
