/**
 * HistoryService - Manages chat message history persistence
 *
 * Handles saving messages to local files, loading history,
 * message formatting/parsing, and cleanup of old messages.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ChatMessage, ReplyInfo } from './types';

const MAX_HISTORY_MESSAGES = 500;
const MESSAGE_RETENTION_DAYS = 30;

export interface ParsedMessage {
  senderNickname: string;
  content: string;
  timestamp: number;
  replyTo?: ReplyInfo;
  type: 'normal' | 'system' | 'mention' | 'reply';
}

export class HistoryService {
  private dataDir: string;

  constructor(dataDir: string = '/tmp/chat-room') {
    this.dataDir = dataDir;
  }

  /**
   * M4.1.1 - Get the history file path for a room
   * @param roomId The room ID
   * @returns The full path to the history file
   */
  getHistoryPath(roomId: string): string {
    const roomDir = path.join(this.dataDir, roomId);

    // Ensure directory exists
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }

    return path.join(roomDir, 'history.txt');
  }

  /**
   * M4.1.4 - Format a ChatMessage into a single line for storage
   * Format: [YYYY-MM-DD HH:mm:ss] nickname: content
   * Reply format: [YYYY-MM-DD HH:mm:ss] nickname [回复 sender: originalContent]: content
   * @param message The chat message to format
   * @returns Formatted message line
   */
  formatMessageLine(message: ChatMessage): string {
    const time = this.formatTimestamp(message.timestamp);
    const nickname = message.senderNickname;
    const content = message.content;

    switch (message.type) {
      case 'reply':
        if (message.replyTo) {
          return `${time} ${nickname} [回复 ${message.replyTo.originalSenderNickname}: ${message.replyTo.originalContent}]: ${content}`;
        }
        return `${time} ${nickname}: ${content}`;

      case 'mention':
        const mentionStr = message.mentions ? message.mentions.map((m) => `@${m}`).join(' ') : '';
        return `${time} ${nickname}: ${mentionStr} ${content}`.trim();

      case 'system':
        return `${time} 系统: ${content}`;

      case 'normal':
      default:
        return `${time} ${nickname}: ${content}`;
    }
  }

  /**
   * M4.1.5 - Parse a message line back into message data
   * Format: [YYYY-MM-DD HH:mm:ss] nickname: content
   * Reply format: [YYYY-MM-DD HH:mm:ss] nickname [回复 sender: originalContent]: content
   * @param line The message line to parse
   * @returns Parsed message data or null if invalid
   */
  parseMessageLine(line: string): ParsedMessage | null {
    if (!line || typeof line !== 'string') {
      return null;
    }

    // Check for reply message first - has ']: ' closing pattern
    const closingPattern = ']: ';
    const closingIndex = line.indexOf(closingPattern);

    if (closingIndex !== -1) {
      // This is a reply message
      // Extract timestamp from the beginning
      const timestampMatch = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/.exec(line);
      if (!timestampMatch) {
        return null;
      }

      const timestamp = timestampMatch[1];
      const beforeClosing = line.substring(0, closingIndex);
      const afterTimestamp = beforeClosing.substring(timestampMatch[0].length);

      // Find ' [回复' to separate nickname from reply info
      const bracketIndex = afterTimestamp.indexOf(' [回复');
      if (bracketIndex === -1) {
        return null;
      }

      const senderNickname = afterTimestamp.substring(0, bracketIndex).trim();

      // Reply info is after ' [回复' (4 characters: space + [回复)
      const replyPart = afterTimestamp.substring(bracketIndex + 4);
      const replyColonIndex = replyPart.indexOf(':');
      if (replyColonIndex === -1) {
        return null;
      }

      const originalSenderNickname = replyPart.substring(0, replyColonIndex).trim();
      const originalContent = replyPart.substring(replyColonIndex + 1).trim();
      const content = line.substring(closingIndex + closingPattern.length);

      return {
        senderNickname,
        content,
        timestamp: this.parseTimestamp(timestamp),
        replyTo: {
          originalMessageId: '',
          originalSenderNickname,
          originalContent,
        },
        type: 'reply',
      };
    }

    // Normal message or system message - no ']: ' closing pattern
    const timestampMatch = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/.exec(line);
    if (!timestampMatch) {
      return null;
    }

    const timestamp = timestampMatch[1];
    const afterTimestamp = line.substring(timestampMatch[0].length);

    // Find the first ': ' (colon space) that separates nickname from content
    const colonSpaceIndex = afterTimestamp.indexOf(': ');
    if (colonSpaceIndex === -1) {
      return null;
    }

    const senderNickname = afterTimestamp.substring(0, colonSpaceIndex).trim();
    const content = afterTimestamp.substring(colonSpaceIndex + 2);

    if (senderNickname === '系统') {
      return {
        senderNickname,
        content,
        timestamp: this.parseTimestamp(timestamp),
        type: 'system',
      };
    }

    // Check if it's a mention (contains @)
    if (content.includes('@')) {
      return {
        senderNickname,
        content,
        timestamp: this.parseTimestamp(timestamp),
        type: 'mention',
      };
    }

    return {
      senderNickname,
      content,
      timestamp: this.parseTimestamp(timestamp),
      type: 'normal',
    };
  }

  /**
   * M4.1.2 - Save a message to the room's history file
   * @param roomId The room ID
   * @param message The message to save
   */
  async save(roomId: string, message: ChatMessage): Promise<void> {
    const historyPath = this.getHistoryPath(roomId);
    const formattedLine = this.formatMessageLine(message);

    // Append to file
    await fs.promises.appendFile(historyPath, formattedLine + '\n', 'utf-8');
  }

  /**
   * M4.1.3 - Load message history for a room
   * @param roomId The room ID
   * @returns Array of parsed messages (most recent MAX_HISTORY_MESSAGES)
   */
  async loadHistory(roomId: string): Promise<ParsedMessage[]> {
    const historyPath = this.getHistoryPath(roomId);

    // Check if file exists
    if (!fs.existsSync(historyPath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(historyPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);

      const messages: ParsedMessage[] = [];

      for (const line of lines) {
        const parsed = this.parseMessageLine(line);
        if (parsed) {
          messages.push(parsed);
        }
      }

      // Return only the most recent messages
      if (messages.length > MAX_HISTORY_MESSAGES) {
        return messages.slice(-MAX_HISTORY_MESSAGES);
      }

      return messages;
    } catch (error) {
      // If there's an error reading, return empty
      return [];
    }
  }

  /**
   * M4.1.6 - Cleanup messages older than MESSAGE_RETENTION_DAYS
   * @param roomId The room ID
   */
  async cleanupOldMessages(roomId: string): Promise<void> {
    const historyPath = this.getHistoryPath(roomId);

    if (!fs.existsSync(historyPath)) {
      return;
    }

    try {
      const content = await fs.promises.readFile(historyPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);

      const cutoffTime = Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const recentLines: string[] = [];

      for (const line of lines) {
        const parsed = this.parseMessageLine(line);
        if (parsed && parsed.timestamp >= cutoffTime) {
          // Find the original line that matches this parsed message
          recentLines.push(line);
        }
      }

      // Rewrite the file with only recent messages
      await fs.promises.writeFile(historyPath, recentLines.join('\n') + '\n', 'utf-8');
    } catch (error) {
      // If there's an error, don't throw - cleanup should be resilient
    }
  }

  /**
   * M4.1.7 - Run cleanup on startup for all rooms
   */
  async startupCleanup(): Promise<void> {
    if (!fs.existsSync(this.dataDir)) {
      return;
    }

    try {
      const entries = await fs.promises.readdir(this.dataDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const roomId = entry.name;
          await this.cleanupOldMessages(roomId);
        }
      }
    } catch (error) {
      // If there's an error, don't throw - startup should be resilient
    }
  }

  /**
   * Format timestamp to YYYY-MM-DD HH:mm:ss
   * @param timestamp Unix timestamp in milliseconds
   * @returns Formatted timestamp string
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
  }

  /**
   * Parse a timestamp string back to milliseconds
   * @param timestampStr YYYY-MM-DD HH:mm:ss format
   * @returns Unix timestamp in milliseconds
   */
  private parseTimestamp(timestampStr: string): number {
    const [datePart, timePart] = timestampStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    return date.getTime();
  }
}
