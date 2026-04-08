/**
 * Type definitions for Chat Room application
 */

// ============ Config Types ============

export interface Config {
  zkAddresses: string[];
  currentRoomId: string;
  nickname: string;
  recentRooms: string[];
  port: number;
  dataDir: string;
  logDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ============ Member Types ============

export interface Member {
  userId: string;
  nickname: string;
  status: 'online' | 'offline';
  ip: string;
  port: number;
  joinedAt: number;
}

export interface MemberNodeData {
  nickname: string;
  status: 'online';
  ip: string;
  port: number;
  userId: string;
  joinedAt: number;
}

// ============ Message Types ============

export type MessageType = 'normal' | 'system' | 'mention' | 'reply';

export interface ReplyInfo {
  originalMessageId: string;
  originalSenderNickname: string;
  originalContent: string;
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  roomId: string;
  senderId: string;
  senderNickname: string;
  content: string;
  timestamp: number;
  replyTo?: ReplyInfo;
  mentions?: string[];
}

// ============ Room Types ============

export interface Room {
  roomId: string;
  members: Member[];
  createdAt: Date;
}

// ============ P2P Message Types ============

export type P2PMessageType = 'chat' | 'join' | 'leave' | 'nick_change' | 'ping' | 'pong';

export interface ChatPayload {
  messageId: string;
  content: string;
  replyTo?: ReplyPayload;
  mentions?: string[];
}

export interface ReplyPayload {
  originalMessageId: string;
  originalSenderNickname: string;
  originalContent: string;
}

export interface JoinPayload {
  ip: string;
  port: number;
}

export interface NickChangePayload {
  oldNickname: string;
  newNickname: string;
}

export interface P2PMessage {
  type: P2PMessageType;
  senderId: string;
  senderNickname: string;
  roomId: string;
  timestamp: number;
  payload: ChatPayload | JoinPayload | NickChangePayload | Record<string, unknown>;
}

// ============ Event Types ============

export type EventType =
  | 'message'
  | 'member_join'
  | 'member_leave'
  | 'nick_change'
  | 'room_joined'
  | 'room_left'
  | 'zk_connected'
  | 'zk_disconnected'
  | 'zk_reconnected'
  | 'zk_session_expired'
  | 'warning'
  | 'error';

export interface EventPayload {
  message: ChatMessage;
  member_join: Member;
  member_leave: { userId: string };
  nick_change: { userId: string; oldNickname: string; newNickname: string };
  room_joined: { roomId: string };
  room_left: { roomId: string };
  zk_connected: void;
  zk_disconnected: void;
  zk_reconnected: void;
  zk_session_expired: void;
  warning: { message: string };
  error: { error: Error };
}

// ============ CLI Types ============

export interface CLIOptions {
  'zk-addresses': string;
  port: number;
  config: string;
  nickname: string;
  'data-dir': string;
  'log-dir': string;
  'log-level': 'debug' | 'info' | 'warn' | 'error';
  help: boolean;
}
