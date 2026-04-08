/**
 * Chat Service
 * Handles message sending, receiving, broadcasting, and formatting
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  ReplyInfo,
  P2PMessage,
  ChatPayload,
  MessageType,
} from './types';
import { PeerService } from './PeerService';
import { EventBus } from './EventBus';

export interface ChatServiceConfig {
  userId: string;
  nickname: string;
  roomId: string;
}

// Interface for member status checking (to avoid circular dependencies)
export interface MemberStatusChecker {
  isOnline: (userId: string) => boolean;
  getMember: (userId: string) => { userId: string; nickname: string; status: 'online' | 'offline' } | undefined;
}

export class ChatService {
  private peerService: PeerService;
  private eventBus: EventBus;
  private userId: string;
  private nickname: string;
  private roomId: string;

  constructor(
    peerService: PeerService,
    eventBus: EventBus,
    config: ChatServiceConfig
  ) {
    this.peerService = peerService;
    this.eventBus = eventBus;
    this.userId = config.userId;
    this.nickname = config.nickname;
    this.roomId = config.roomId;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get the current nickname
   */
  getNickname(): string {
    return this.nickname;
  }

  /**
   * Get the current room ID
   */
  getRoomId(): string {
    return this.roomId;
  }

  /**
   * Update the nickname
   * @param newNickname The new nickname to use
   */
  async updateNickname(newNickname: string): Promise<void> {
    this.nickname = newNickname;
  }

  /**
   * Send a message
   * @param content The message content
   * @param replyTo Optional reply information
   * @param mentions Optional list of mentioned user IDs
   */
  async sendMessage(
    content: string,
    replyTo?: ReplyInfo,
    mentions?: string[]
  ): Promise<void> {
    const message: ChatMessage = {
      id: uuidv4(),
      type: this.determineMessageType(mentions, replyTo),
      roomId: this.roomId,
      senderId: this.userId,
      senderNickname: this.nickname,
      content,
      timestamp: Date.now(),
      replyTo,
      mentions,
    };

    // Save to local history (if HistoryService is available)
    this.saveToHistory(message);

    // Publish message event for local rendering
    this.eventBus.publish('message', message);

    // Broadcast to all peers via P2P
    this.broadcastP2PMessage(message);
  }

  /**
   * Broadcast a chat message to all connected peers
   * @param message The chat message to broadcast
   */
  broadcast(message: ChatMessage): void {
    try {
      this.broadcastP2PMessage(message);
    } catch (error) {
      // Log error but don't throw - broadcast should be resilient
      console.error('Failed to broadcast message:', error);
    }
  }

  /**
   * Broadcast a P2P message to all connected peers
   * @param message The chat message to broadcast
   */
  private broadcastP2PMessage(message: ChatMessage): void {
    const payload: ChatPayload = {
      messageId: message.id,
      content: message.content,
      replyTo: message.replyTo
        ? {
            originalMessageId: message.replyTo.originalMessageId,
            originalSenderNickname: message.replyTo.originalSenderNickname,
            originalContent: message.replyTo.originalContent,
          }
        : undefined,
      mentions: message.mentions,
    };

    const p2pMessage: P2PMessage = {
      type: 'chat',
      senderId: message.senderId,
      senderNickname: message.senderNickname,
      roomId: message.roomId,
      timestamp: message.timestamp,
      payload,
    };

    this.peerService.broadcast(p2pMessage);
  }

  /**
   * Save message to local history
   * This is a placeholder that can be extended when HistoryService is implemented
   * @param message The message to save
   */
  private saveToHistory(message: ChatMessage): void {
    // HistoryService will be integrated here
    // For now, this is a no-op placeholder
  }

  /**
   * Determine the message type based on mentions and reply info
   * @param mentions List of mentioned user IDs
   * @param replyTo Reply information
   * @returns The determined message type
   */
  private determineMessageType(
    mentions?: string[],
    replyTo?: ReplyInfo
  ): MessageType {
    if (replyTo) {
      return 'reply';
    }
    if (mentions && mentions.length > 0) {
      return 'mention';
    }
    return 'normal';
  }

  /**
   * Format a message for display
   * @param message The chat message to format
   * @returns Formatted message string
   */
  formatMessage(message: ChatMessage): string {
    const time = this.formatTimestamp(message.timestamp);
    const displayNickname =
      message.senderNickname === this.nickname ? '我' : message.senderNickname;

    switch (message.type) {
      case 'system':
        return `${time} 系统: ${message.content}`;

      case 'reply':
        if (message.replyTo) {
          // Format: [HH:mm:ss] 昵称 [回复 原发送者: 原内容]: 回复内容
          return `${time} ${displayNickname} [回复 ${message.replyTo.originalSenderNickname}: ${message.replyTo.originalContent}]: ${message.content}`;
        }
        return `${time} ${displayNickname}: ${message.content}`;

      case 'mention':
        const mentionStr = message.mentions
          ? message.mentions.map((m) => `@${m}`).join(' ')
          : '';
        return `${time} ${displayNickname}: ${mentionStr} ${message.content}`.trim();

      case 'normal':
      default:
        return `${time} ${displayNickname}: ${message.content}`;
    }
  }

  /**
   * Format timestamp to HH:mm:ss format
   * @param timestamp Unix timestamp in milliseconds
   * @returns Formatted time string with brackets
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
  }

  /**
   * Parse mentions from message content
   * Extracts @username patterns from the content
   * @param content The message content to parse
   * @returns List of mentioned usernames
   */
  parseMentions(content: string): string[] {
    const mentionRegex = /@(\S+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  /**
   * M4.2.3 - Check for offline mentions and warn if necessary
   * When sending a message with @ mentions, check if any mentioned members are offline
   * and publish a warning if so
   * @param mentions List of mentioned user IDs
   * @param memberStatusChecker Object that can check member online status
   */
  checkOfflineMentions(
    mentions: string[],
    memberStatusChecker: MemberStatusChecker
  ): void {
    for (const userId of mentions) {
      const member = memberStatusChecker.getMember(userId);
      if (member && !memberStatusChecker.isOnline(userId)) {
        // Publish warning for offline member
        this.eventBus.publish('warning', {
          message: `给离线成员 ${member.nickname} 发送的消息可能无法送达`,
        });
      }
    }
  }
}
