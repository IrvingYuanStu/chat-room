import {
  Config,
  Member,
  ChatMessage,
  Room,
  P2PMessage,
  EventPayload,
  EventType,
  ReplyInfo,
  MemberNodeData,
  ChatPayload,
  ReplyPayload,
  JoinPayload,
  NickChangePayload,
  MessageType,
} from '../../src/services/types';

describe('M1.2 Types', () => {
  describe('Config', () => {
    it('should have all required fields', () => {
      const config: Config = {
        zkAddresses: ['127.0.0.1:2181'],
        currentRoomId: 'general',
        nickname: 'TestUser',
        recentRooms: ['general', 'dev'],
        port: 9001,
        dataDir: '/tmp/chat-room',
        logDir: '/tmp/chat-room/logs',
        logLevel: 'info',
      };

      expect(config.zkAddresses).toBeDefined();
      expect(config.currentRoomId).toBeDefined();
      expect(config.nickname).toBeDefined();
      expect(config.recentRooms).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.dataDir).toBeDefined();
      expect(config.logDir).toBeDefined();
      expect(config.logLevel).toBeDefined();
    });

    it('should accept array of zk addresses', () => {
      const config: Config = {
        zkAddresses: ['127.0.0.1:2181', '127.0.0.1:2182', '127.0.0.1:2183'],
        currentRoomId: 'test',
        nickname: 'User1',
        recentRooms: [],
        port: 9001,
        dataDir: '/tmp',
        logDir: '/tmp/logs',
        logLevel: 'debug',
      };

      expect(config.zkAddresses.length).toBe(3);
    });

    it('should have correct default values structure', () => {
      const config: Config = {
        zkAddresses: ['127.0.0.1:2181'],
        currentRoomId: '',
        nickname: '',
        recentRooms: [],
        port: 9001,
        dataDir: '/tmp/chat-room',
        logDir: '/tmp/chat-room/logs',
        logLevel: 'info',
      };

      expect(typeof config.port).toBe('number');
      expect(config.port).toBe(9001);
    });
  });

  describe('Member', () => {
    it('should have all required fields', () => {
      const member: Member = {
        userId: 'user-123',
        nickname: 'John',
        status: 'online',
        ip: '192.168.1.100',
        port: 9001,
        joinedAt: Date.now(),
      };

      expect(member.userId).toBe('user-123');
      expect(member.nickname).toBe('John');
      expect(member.status).toBe('online');
      expect(member.ip).toBe('192.168.1.100');
      expect(member.port).toBe(9001);
      expect(member.joinedAt).toBeDefined();
    });

    it('should allow offline status', () => {
      const member: Member = {
        userId: 'user-456',
        nickname: 'Jane',
        status: 'offline',
        ip: '192.168.1.101',
        port: 9002,
        joinedAt: Date.now(),
      };

      expect(member.status).toBe('offline');
    });
  });

  describe('ChatMessage', () => {
    it('should have all required fields for normal message', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-123',
        senderNickname: 'John',
        content: 'Hello world',
        timestamp: Date.now(),
      };

      expect(message.id).toBe('msg-001');
      expect(message.type).toBe('normal');
      expect(message.roomId).toBe('general');
      expect(message.senderId).toBe('user-123');
      expect(message.senderNickname).toBe('John');
      expect(message.content).toBe('Hello world');
      expect(message.timestamp).toBeDefined();
    });

    it('should support reply message type', () => {
      const replyInfo: ReplyInfo = {
        originalMessageId: 'msg-000',
        originalSenderNickname: 'Jane',
        originalContent: 'Original message',
      };

      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-123',
        senderNickname: 'John',
        content: 'This is a reply',
        timestamp: Date.now(),
        replyTo: replyInfo,
      };

      expect(message.type).toBe('reply');
      expect(message.replyTo).toBeDefined();
      expect(message.replyTo?.originalSenderNickname).toBe('Jane');
    });

    it('should support mention message type', () => {
      const message: ChatMessage = {
        id: 'msg-003',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-123',
        senderNickname: 'John',
        content: '@Jane Hello!',
        timestamp: Date.now(),
        mentions: ['user-456'],
      };

      expect(message.type).toBe('mention');
      expect(message.mentions).toBeDefined();
      expect(message.mentions).toContain('user-456');
    });

    it('should support system message type', () => {
      const message: ChatMessage = {
        id: 'msg-004',
        type: 'system',
        roomId: 'general',
        senderId: 'system',
        senderNickname: '系统',
        content: 'User joined the chat',
        timestamp: Date.now(),
      };

      expect(message.type).toBe('system');
    });
  });

  describe('Room', () => {
    it('should have all required fields', () => {
      const room: Room = {
        roomId: 'general',
        members: [],
        createdAt: new Date(),
      };

      expect(room.roomId).toBe('general');
      expect(room.members).toBeDefined();
      expect(Array.isArray(room.members)).toBe(true);
      expect(room.createdAt).toBeDefined();
    });

    it('should hold member list', () => {
      const members: Member[] = [
        {
          userId: 'user-1',
          nickname: 'Alice',
          status: 'online',
          ip: '192.168.1.1',
          port: 9001,
          joinedAt: Date.now(),
        },
        {
          userId: 'user-2',
          nickname: 'Bob',
          status: 'online',
          ip: '192.168.1.2',
          port: 9002,
          joinedAt: Date.now(),
        },
      ];

      const room: Room = {
        roomId: 'test-room',
        members,
        createdAt: new Date(),
      };

      expect(room.members.length).toBe(2);
    });
  });

  describe('P2PMessage', () => {
    it('should have all required fields', () => {
      const p2pMessage: P2PMessage = {
        type: 'chat',
        senderId: 'user-123',
        senderNickname: 'John',
        roomId: 'general',
        timestamp: Date.now(),
        payload: {
          messageId: 'msg-001',
          content: 'Hello',
        } as ChatPayload,
      };

      expect(p2pMessage.type).toBe('chat');
      expect(p2pMessage.senderId).toBe('user-123');
      expect(p2pMessage.senderNickname).toBe('John');
      expect(p2pMessage.roomId).toBe('general');
      expect(p2pMessage.timestamp).toBeDefined();
      expect(p2pMessage.payload).toBeDefined();
    });

    it('should support join payload', () => {
      const p2pMessage: P2PMessage = {
        type: 'join',
        senderId: 'user-123',
        senderNickname: 'John',
        roomId: 'general',
        timestamp: Date.now(),
        payload: {
          ip: '192.168.1.100',
          port: 9001,
        } as JoinPayload,
      };

      expect(p2pMessage.type).toBe('join');
      expect((p2pMessage.payload as JoinPayload).ip).toBe('192.168.1.100');
      expect((p2pMessage.payload as JoinPayload).port).toBe(9001);
    });

    it('should support nick_change payload', () => {
      const p2pMessage: P2PMessage = {
        type: 'nick_change',
        senderId: 'user-123',
        senderNickname: 'John',
        roomId: 'general',
        timestamp: Date.now(),
        payload: {
          oldNickname: 'John',
          newNickname: 'Johnny',
        } as NickChangePayload,
      };

      expect(p2pMessage.type).toBe('nick_change');
      expect((p2pMessage.payload as NickChangePayload).oldNickname).toBe('John');
      expect((p2pMessage.payload as NickChangePayload).newNickname).toBe('Johnny');
    });
  });

  describe('EventType', () => {
    it('should include all required event types', () => {
      const eventTypes: EventType[] = [
        'message',
        'member_join',
        'member_leave',
        'nick_change',
        'room_joined',
        'room_left',
        'zk_connected',
        'zk_disconnected',
        'zk_reconnected',
        'zk_session_expired',
        'warning',
        'error',
      ];

      expect(eventTypes).toContain('message');
      expect(eventTypes).toContain('member_join');
      expect(eventTypes).toContain('member_leave');
      expect(eventTypes).toContain('nick_change');
      expect(eventTypes).toContain('room_joined');
      expect(eventTypes).toContain('room_left');
      expect(eventTypes).toContain('zk_connected');
      expect(eventTypes).toContain('zk_disconnected');
      expect(eventTypes).toContain('zk_reconnected');
      expect(eventTypes).toContain('zk_session_expired');
      expect(eventTypes).toContain('warning');
      expect(eventTypes).toContain('error');
    });
  });

  describe('EventPayload', () => {
    it('should have correct payload for message event', () => {
      const payload: EventPayload['message'] = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-123',
        senderNickname: 'John',
        content: 'Hello',
        timestamp: Date.now(),
      };

      expect(payload.id).toBe('msg-001');
      expect(payload.content).toBe('Hello');
    });

    it('should have correct payload for member_join event', () => {
      const payload: EventPayload['member_join'] = {
        userId: 'user-123',
        nickname: 'John',
        status: 'online',
        ip: '192.168.1.100',
        port: 9001,
        joinedAt: Date.now(),
      };

      expect(payload.nickname).toBe('John');
    });

    it('should have correct payload for member_leave event', () => {
      const payload: EventPayload['member_leave'] = {
        userId: 'user-123',
      };

      expect(payload.userId).toBe('user-123');
    });

    it('should have correct payload for nick_change event', () => {
      const payload: EventPayload['nick_change'] = {
        userId: 'user-123',
        oldNickname: 'John',
        newNickname: 'Johnny',
      };

      expect(payload.oldNickname).toBe('John');
      expect(payload.newNickname).toBe('Johnny');
    });

    it('should have correct payload for warning event', () => {
      const payload: EventPayload['warning'] = {
        message: 'Offline member mentioned',
      };

      expect(payload.message).toBe('Offline member mentioned');
    });

    it('should have correct payload for error event', () => {
      const error = new Error('Connection failed');
      const payload: EventPayload['error'] = {
        error,
      };

      expect(payload.error).toBe(error);
    });
  });

  describe('MessageType', () => {
    it('should include all message types', () => {
      const messageTypes: MessageType[] = ['normal', 'system', 'mention', 'reply'];

      expect(messageTypes).toContain('normal');
      expect(messageTypes).toContain('system');
      expect(messageTypes).toContain('mention');
      expect(messageTypes).toContain('reply');
    });
  });
});
