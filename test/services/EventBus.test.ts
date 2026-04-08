import { EventBus } from '../../src/services/EventBus';
import { EventType, EventPayload, Member, ChatMessage } from '../../src/services/types';

describe('M1.6 EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    // Clean up all subscriptions
    eventBus = new EventBus();
  });

  describe('M1.6.1 EventBus class structure and publish/subscribe/unsubscribe', () => {
    it('should export EventBus class', () => {
      expect(EventBus).toBeDefined();
      expect(typeof EventBus).toBe('function');
    });

    it('should create EventBus instance', () => {
      const bus = new EventBus();
      expect(bus).toBeDefined();
    });

    it('should have publish method', () => {
      expect(typeof eventBus.publish).toBe('function');
    });

    it('should have subscribe method', () => {
      expect(typeof eventBus.subscribe).toBe('function');
    });

    it('should have unsubscribe method', () => {
      expect(typeof eventBus.unsubscribe).toBe('function');
    });

    it('should call subscriber when event is published', () => {
      const handler = jest.fn();
      eventBus.subscribe('message', handler);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      eventBus.publish('message', testMessage);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(testMessage);
    });

    it('should call multiple subscribers when event is published', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.subscribe('message', handler1);
      eventBus.subscribe('message', handler2);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      eventBus.publish('message', testMessage);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not call subscriber after unsubscribe', () => {
      const handler = jest.fn();
      eventBus.subscribe('message', handler);
      eventBus.unsubscribe('message', handler);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      eventBus.publish('message', testMessage);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe for non-existent handler gracefully', () => {
      const handler = jest.fn();
      // Unsubscribe a handler that was never subscribed
      expect(() => eventBus.unsubscribe('message', handler)).not.toThrow();
    });

    it('should support multiple event types', () => {
      const messageHandler = jest.fn();
      const memberJoinHandler = jest.fn();

      eventBus.subscribe('message', messageHandler);
      eventBus.subscribe('member_join', memberJoinHandler);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      const testMember: Member = {
        userId: 'user-2',
        nickname: 'NewUser',
        status: 'online',
        ip: '192.168.1.100',
        port: 9001,
        joinedAt: Date.now()
      };

      eventBus.publish('message', testMessage);
      eventBus.publish('member_join', testMember);

      expect(messageHandler).toHaveBeenCalledWith(testMessage);
      expect(memberJoinHandler).toHaveBeenCalledWith(testMember);
    });

    it('should handle different event types correctly', () => {
      const handlers: Record<string, jest.Mock> = {};

      // Subscribe handlers for each event type
      const eventTypes: EventType[] = [
        'message', 'member_join', 'member_leave', 'nick_change',
        'room_joined', 'room_left', 'zk_connected', 'zk_disconnected',
        'zk_reconnected', 'zk_session_expired', 'warning', 'error'
      ];

      eventTypes.forEach(type => {
        handlers[type] = jest.fn();
        eventBus.subscribe(type, handlers[type]);
      });

      // Publish each event type
      eventBus.publish('zk_connected', undefined as unknown as EventPayload['zk_connected']);
      eventBus.publish('zk_disconnected', undefined as unknown as EventPayload['zk_disconnected']);
      eventBus.publish('warning', { message: 'Test warning' });

      expect(handlers['zk_connected']).toHaveBeenCalledTimes(1);
      expect(handlers['zk_disconnected']).toHaveBeenCalledTimes(1);
      expect(handlers['warning']).toHaveBeenCalledWith({ message: 'Test warning' });
    });

    it('should pass correct payload types for each event', () => {
      // Test message event
      const messageHandler = jest.fn();
      eventBus.subscribe('message', messageHandler);

      const chatMessage: ChatMessage = {
        id: 'msg-123',
        type: 'normal',
        roomId: 'test-room',
        senderId: 'sender-1',
        senderNickname: 'Sender',
        content: 'Test content',
        timestamp: 1234567890
      };

      eventBus.publish('message', chatMessage);
      expect(messageHandler).toHaveBeenCalledWith(expect.objectContaining({
        id: 'msg-123',
        content: 'Test content'
      }));

      // Test member_join event
      const memberJoinHandler = jest.fn();
      eventBus.subscribe('member_join', memberJoinHandler);

      const member: Member = {
        userId: 'user-new',
        nickname: 'NewMember',
        status: 'online',
        ip: '192.168.1.50',
        port: 9005,
        joinedAt: Date.now()
      };

      eventBus.publish('member_join', member);
      expect(memberJoinHandler).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-new',
        nickname: 'NewMember'
      }));

      // Test member_leave event
      const memberLeaveHandler = jest.fn();
      eventBus.subscribe('member_leave', memberLeaveHandler);

      eventBus.publish('member_leave', { userId: 'user-left' });
      expect(memberLeaveHandler).toHaveBeenCalledWith({ userId: 'user-left' });

      // Test nick_change event
      const nickChangeHandler = jest.fn();
      eventBus.subscribe('nick_change', nickChangeHandler);

      eventBus.publish('nick_change', {
        userId: 'user-1',
        oldNickname: 'OldName',
        newNickname: 'NewName'
      });
      expect(nickChangeHandler).toHaveBeenCalledWith({
        userId: 'user-1',
        oldNickname: 'OldName',
        newNickname: 'NewName'
      });

      // Test error event
      const errorHandler = jest.fn();
      eventBus.subscribe('error', errorHandler);

      const testError = new Error('Test error');
      eventBus.publish('error', { error: testError });
      expect(errorHandler).toHaveBeenCalledWith({ error: testError });
    });
  });

  describe('M1.6.2 once() one-time subscription', () => {
    it('should have once method', () => {
      expect(typeof eventBus.once).toBe('function');
    });

    it('should call subscriber only once with once()', () => {
      const handler = jest.fn();
      eventBus.once('message', handler);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'First',
        timestamp: Date.now()
      };

      // Publish multiple times
      eventBus.publish('message', testMessage);
      eventBus.publish('message', { ...testMessage, id: 'msg-2', content: 'Second' });
      eventBus.publish('message', { ...testMessage, id: 'msg-3', content: 'Third' });

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(testMessage);
    });

    it('should auto-unsubscribe after calling handler once', () => {
      const handler = jest.fn();
      eventBus.once('message', handler);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      eventBus.publish('message', testMessage);

      // Publish again - should not call handler since it was auto-unsubscribed
      eventBus.publish('message', { ...testMessage, id: 'msg-2' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should work with different event types for once()', () => {
      const handler = jest.fn();
      eventBus.once('zk_connected', handler);

      eventBus.publish('zk_connected', undefined as unknown as EventPayload['zk_connected']);
      eventBus.publish('zk_connected', undefined as unknown as EventPayload['zk_connected']);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('once() should return unsubscribe function', () => {
      const handler = jest.fn();

      // once() returns an unsubscribe function
      const unsubscribe = eventBus.once('message', handler);
      expect(typeof unsubscribe).toBe('function');

      // Call the returned unsubscribe function
      unsubscribe();

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      eventBus.publish('message', testMessage);

      // Handler should not have been called since we manually unsubscribed
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle once() with no event published', () => {
      const handler = jest.fn();
      eventBus.once('message', handler);

      // Don't publish any event

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('EventBus edge cases and error handling', () => {
    it('should handle publishing to event with no subscribers', () => {
      // Should not throw
      expect(() => {
        eventBus.publish('message', { id: 'msg-1', type: 'normal', roomId: 'r', senderId: 's', senderNickname: 'n', content: 'c', timestamp: 1 });
      }).not.toThrow();
    });

    it('should handle unsubscribe from event with no subscribers', () => {
      const handler = jest.fn();
      expect(() => eventBus.unsubscribe('message', handler)).not.toThrow();
    });

    it('should support subscribing the same handler to multiple events', () => {
      const handler = jest.fn();
      eventBus.subscribe('message', handler);
      eventBus.subscribe('member_join', handler);

      eventBus.publish('message', null as unknown as EventPayload['message']);
      eventBus.publish('member_join', null as unknown as EventPayload['member_join']);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should maintain separate handler lists for each event type', () => {
      const messageHandler = jest.fn();
      const memberJoinHandler = jest.fn();

      eventBus.subscribe('message', messageHandler);
      eventBus.subscribe('member_join', memberJoinHandler);

      eventBus.publish('message', null as unknown as EventPayload['message']);

      expect(messageHandler).toHaveBeenCalledTimes(1);
      expect(memberJoinHandler).not.toHaveBeenCalled();
    });

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const handler = jest.fn();

      eventBus.subscribe('message', handler);
      eventBus.unsubscribe('message', handler);
      eventBus.subscribe('message', handler);

      eventBus.publish('message', null as unknown as EventPayload['message']);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple rapid publish calls', () => {
      const handler = jest.fn();
      eventBus.subscribe('message', handler);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      for (let i = 0; i < 100; i++) {
        eventBus.publish('message', { ...testMessage, id: `msg-${i}` });
      }

      expect(handler).toHaveBeenCalledTimes(100);
    });
  });

  describe('EventBus memory management', () => {
    it('should allow garbage collection after all handlers are unsubscribed', () => {
      const handlers: Array<() => void> = [];

      // Create many subscriptions
      for (let i = 0; i < 10; i++) {
        const handler = jest.fn();
        handlers.push(handler);
        eventBus.subscribe('message', handler);
      }

      // Unsubscribe all
      handlers.forEach(handler => {
        eventBus.unsubscribe('message', handler);
      });

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      eventBus.publish('message', testMessage);

      // No handlers should be called
      handlers.forEach(handler => {
        expect(handler).not.toHaveBeenCalled();
      });
    });

    it('should handle subscribe after unsubscribe with same handler', () => {
      const handler = jest.fn();

      eventBus.subscribe('message', handler);
      eventBus.unsubscribe('message', handler);
      eventBus.subscribe('message', handler);

      const testMessage: ChatMessage = {
        id: 'msg-1',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-1',
        senderNickname: 'TestUser',
        content: 'Hello',
        timestamp: Date.now()
      };

      eventBus.publish('message', testMessage);

      // Handler should be called since it was re-subscribed
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
