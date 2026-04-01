import type { ChatMessage } from "./types.js";
import { HistoryStore } from "../store/HistoryStore.js";

const MESSAGE_RETENTION_DAYS = 30;

export class HistoryService {
  private store: HistoryStore;

  constructor(store?: HistoryStore) {
    this.store = store || new HistoryStore();
  }

  /**
   * Append a message to persistent storage
   */
  async appendMessage(msg: ChatMessage): Promise<void> {
    if (!msg.roomId) {
      console.warn("Cannot save message without roomId");
      return;
    }
    await this.store.appendMessage(msg.roomId, msg);
  }

  /**
   * Load room history messages
   */
  async loadHistory(roomId: string, limit: number = 500): Promise<ChatMessage[]> {
    const messages = await this.store.loadHistory(roomId, limit);

    // Fill in missing roomId for parsed messages
    return messages.map((msg) => ({
      ...msg,
      roomId: msg.roomId || roomId,
    }));
  }

  /**
   * Clean up old messages (30 days)
   */
  async cleanupOldMessages(roomId: string): Promise<void> {
    const cutoff = Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    await this.store.cleanupExpired(roomId, cutoff);
  }

  /**
   * Get message retention cutoff timestamp
   */
  getCutoffTimestamp(): number {
    return Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  }
}
