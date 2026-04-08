import { EventType, EventPayload } from './types';

type EventHandler<T = unknown> = (payload: T) => void;

/**
 * EventBus - A simple pub/sub event system for the Chat Room application
 *
 * Allows components and services to communicate through events without
 * tight coupling.
 */
export class EventBus {
  private handlers: Map<EventType, Set<EventHandler>>;

  constructor() {
    this.handlers = new Map();
  }

  /**
   * Subscribe to an event
   * @param event - The event type to subscribe to
   * @param handler - The callback function to invoke when the event is published
   * @returns Unsubscribe function
   */
  subscribe<T extends EventType>(
    event: T,
    handler: EventHandler<EventPayload[T]>
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(event, handler as EventHandler);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event - The event type to unsubscribe from
   * @param handler - The callback function to remove
   */
  unsubscribe<T extends EventType>(
    event: T,
    handler: EventHandler<EventPayload[T]>
  ): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler as EventHandler);

      // Clean up empty handler sets
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Publish an event to all subscribers
   * @param event - The event type to publish
   * @param payload - The event payload data
   */
  publish<T extends EventType>(
    event: T,
    payload: EventPayload[T]
  ): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in event handler for '${event}':`, error);
        }
      });
    }
  }

  /**
   * Subscribe to an event only once (auto-unsubscribes after first invocation)
   * @param event - The event type to subscribe to
   * @param handler - The callback function to invoke once
   * @returns Unsubscribe function
   */
  once<T extends EventType>(
    event: T,
    handler: EventHandler<EventPayload[T]>
  ): () => void {
    const wrappedHandler: EventHandler<EventPayload[T]> = (payload) => {
      // Unsubscribe before calling the handler to prevent issues if handler throws
      this.unsubscribe(event, wrappedHandler);
      handler(payload);
    };

    return this.subscribe(event, wrappedHandler);
  }
}

// Singleton instance for application-wide use
let defaultEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!defaultEventBus) {
    defaultEventBus = new EventBus();
  }
  return defaultEventBus;
}

export function resetEventBus(): void {
  defaultEventBus = null;
}
