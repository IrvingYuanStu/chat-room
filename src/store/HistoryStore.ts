import fs from "node:fs";
import path from "node:path";
import type { ChatMessage } from "../services/types.js";

const BASE_PATH = "/tmp/chat-room";

export class HistoryStore {
  private readonly basePath: string;

  constructor(basePath: string = BASE_PATH) {
    this.basePath = basePath;
  }

  /**
   * Append a message to the history file
   */
  async appendMessage(roomId: string, message: ChatMessage): Promise<void> {
    const roomPath = path.join(this.basePath, roomId);
    const historyPath = path.join(roomPath, "history.txt");

    try {
      // Ensure directory exists
      fs.mkdirSync(roomPath, { recursive: true });

      // Format and append message
      const formatted = this.formatMessage(message);
      fs.appendFileSync(historyPath, formatted + "\n", "utf-8");
    } catch (err) {
      // Silently fail on write errors
      console.warn(`Failed to append message to ${historyPath}:`, err);
    }
  }

  /**
   * Load history messages from file
   */
  async loadHistory(roomId: string, limit: number = 500): Promise<ChatMessage[]> {
    const historyPath = path.join(this.basePath, roomId, "history.txt");

    try {
      const content = fs.readFileSync(historyPath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim() !== "");

      // Parse all lines first
      const messages: ChatMessage[] = [];
      for (const line of lines) {
        const msg = this.parseLine(line);
        if (msg) {
          messages.push(msg);
        }
      }

      // Return last N messages
      const start = Math.max(0, messages.length - limit);
      return messages.slice(start);
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      console.warn(`Failed to load history from ${historyPath}:`, err);
      return [];
    }
  }

  /**
   * Clean up expired messages (before a timestamp)
   */
  async cleanupExpired(roomId: string, beforeTimestamp: number): Promise<void> {
    const historyPath = path.join(this.basePath, roomId, "history.txt");
    const tempPath = historyPath + ".tmp";

    try {
      const content = fs.readFileSync(historyPath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim() !== "");

      // Filter lines: keep messages with timestamp >= beforeTimestamp
      const keepLines: string[] = [];
      for (const line of lines) {
        const msg = this.parseLine(line);
        if (msg && msg.timestamp >= beforeTimestamp) {
          keepLines.push(line);
        }
      }

      // Write to temp file then rename (atomic)
      if (keepLines.length < lines.length) {
        fs.writeFileSync(tempPath, keepLines.join("\n") + "\n", "utf-8");
        fs.renameSync(tempPath, historyPath);
      }
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      console.warn(`Failed to cleanup expired messages in ${historyPath}:`, err);
    }
  }

  /**
   * Format a ChatMessage as a single line text
   * Format: [HH:mm:ss] 昵称: 内容
   */
  private formatMessage(msg: ChatMessage): string {
    const date = new Date(msg.timestamp);
    const time = date.toTimeString().split(" ")[0]; // HH:mm:ss

    switch (msg.type) {
      case "system":
      case "join":
      case "leave":
      case "rename":
        return `[${time}] 系统: ${msg.content}`;

      case "reply": {
        const quote = msg.replyTo
          ? `[回复 ${msg.replyTo.senderNickname}: ${msg.replyTo.content}]`
          : "";
        return `[${time}] ${msg.senderNickname} ${quote}: ${msg.content}`;
      }

      case "text":
      default:
        return `[${time}] ${msg.senderNickname}: ${msg.content}`;
    }
  }

  /**
   * Parse a single line text back to ChatMessage
   * Format: [HH:mm:ss] 昵称: 内容
   */
  private parseLine(line: string): ChatMessage | null {
    try {
      // Match [HH:mm:ss] prefix
      const timeMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s+(.+)$/);
      if (!timeMatch) return null;

      const [, timeStr, rest] = timeMatch;

      // Parse timestamp (use today's date with the time)
      const [hours, minutes, seconds] = timeStr.split(":").map(Number);
      const date = new Date();
      date.setHours(hours, minutes, seconds, 0);
      const timestamp = date.getTime();

      // Parse "系统: xxx" or "昵称: xxx"
      const colonIndex = rest.indexOf(":");
      if (colonIndex === -1) return null;

      const sender = rest.substring(0, colonIndex).trim();
      const content = rest.substring(colonIndex + 1).trim();

      // Check if it's a system message
      if (sender === "系统") {
        return {
          id: this.generateId(),
          type: "system",
          senderId: "system",
          senderNickname: "系统",
          content,
          roomId: "",
          timestamp,
        };
      }

      // Check for reply format: "昵称 [回复 xxx]: xxx"
      const replyMatch = sender.match(/^(.+)\s+\[回复\s+(.+):\s*(.+)\]$/);
      if (replyMatch) {
        const [, nickname, replyToNickname, replyToContent] = replyMatch;
        return {
          id: this.generateId(),
          type: "reply",
          senderId: nickname,
          senderNickname: nickname,
          content,
          roomId: "",
          timestamp,
          replyTo: {
            messageId: this.generateId(),
            senderNickname: replyToNickname,
            content: replyToContent,
          },
        };
      }

      // Regular message
      return {
        id: this.generateId(),
        type: "text",
        senderId: sender,
        senderNickname: sender,
        content,
        roomId: "",
        timestamp,
      };
    } catch {
      return null;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
