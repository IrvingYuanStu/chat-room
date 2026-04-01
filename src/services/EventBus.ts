import { EventEmitter } from "node:events";
import type { ChatMessage, Member } from "./types.js";

export interface EventBusEvents {
  "new-message": (msg: ChatMessage) => void;
  "members-changed": (roomId: string) => void;
  "zk-disconnected": () => void;
  "zk-reconnected": () => void;
  "connection-lost": (roomId: string, userId: string) => void;
  "peer-connected": (roomId: string, member: Member) => void;
  "peer-disconnected": (roomId: string, userId: string) => void;
}

type EventKey = keyof EventBusEvents;
type Handler<E extends EventKey> = EventBusEvents[E];

class TypedEventEmitter {
  private emitter = new EventEmitter();

  on<E extends EventKey>(event: E, handler: Handler<E>): void {
    this.emitter.on(event, handler);
  }

  off<E extends EventKey>(event: E, handler: Handler<E>): void {
    this.emitter.off(event, handler);
  }

  emit<E extends EventKey>(event: E, ...args: Parameters<Handler<E>>): void {
    this.emitter.emit(event, ...args);
  }

  removeAllListeners(event?: EventKey): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}

export const eventBus = new TypedEventEmitter();
