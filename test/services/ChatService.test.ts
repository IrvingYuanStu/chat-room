/**
 * Unit tests for ChatService
 * Tests message sending, broadcasting, and formatting functionality
 */

import { ChatService } from '../../src/services/ChatService';
import { PeerService } from '../../src/services/PeerService';
import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';
import { P2PTransport } from '../../src/network/P2PTransport';
import { P2PServer } from '../../src/network/P2PServer';
import { ChatMessage, ReplyInfo, P2PMessage } from '../../src/services/types';

describe('ChatService', () => {
  let chatService: ChatService;
  let peerService: PeerService;
  let eventBus: EventBus;
  let transport: P2PTransport;
  let server: P2PServer;

  const testPort = 18888;
  const testHost = '127.0.0.1';
  const testUserId = 'user-001';
  const testNickname = 'Alice';
  const testRoomId = 'general';

  beforeEach(() => {
    // Reset singleton event bus for clean state
    resetEventBus();
    eventBus = getEventBus();

    // Create transport and peer service
    transport = new P2PTransport();
    peerService = new PeerService(transport, testHost, testPort);

    // Create chat service
    chatService = new ChatService(peerService, eventBus, {
      userId: testUserId,
      nickname: testNickname,
      roomId: testRoomId,
    });

    // Create server for testing
    server = new P2PServer(transport);
  });

  afterEach(async () => {
    peerService.disconnectAll();
    await server.stop();
    resetEventBus();
  });

  describe('initialization', () => {
    it('should initialize with correct config', () => {
      expect(chatService.getUserId()).toBe(testUserId);
    });

    it('should have correct nickname', () => {
      expect(chatService.getNickname()).toBe(testNickname);
    });

    it('should have correct room id', () => {
      expect(chatService.getRoomId()).toBe(testRoomId);
    });
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const messages: P2PMessage[] = [];
      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const content = 'Hello, world!';
      await chatService.sendMessage(content);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('chat');
      expect((messages[0].payload as any).content).toBe(content);
    });

    it('should generate unique message id', async () => {
      const messages: P2PMessage[] = [];
      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      await chatService.sendMessage('First message');
      await chatService.sendMessage('Second message');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(2);
      expect((messages[0].payload as any).messageId).not.toBe((messages[1].payload as any).messageId);
    });

    it('should set correct sender info in message', async () => {
      const messages: P2PMessage[] = [];
      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      await chatService.sendMessage('Test message');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages[0].senderId).toBe(testUserId);
      expect(messages[0].senderNickname).toBe(testNickname);
      expect(messages[0].roomId).toBe(testRoomId);
    });

    it('should include timestamp in message', async () => {
      const messages: P2PMessage[] = [];
      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const beforeTime = Date.now();
      await chatService.sendMessage('Test message');
      const afterTime = Date.now();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(messages[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should send message with reply info when replyTo is provided', async () => {
      const messages: P2PMessage[] = [];
      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const replyInfo: ReplyInfo = {
        originalMessageId: 'msg-original-001',
        originalSenderNickname: 'Bob',
        originalContent: 'Original message content',
      };

      await chatService.sendMessage('Reply message', replyInfo);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(1);
      expect((messages[0].payload as any).replyTo).toEqual(replyInfo);
    });

    it('should handle message with empty content', async () => {
      const messages: P2PMessage[] = [];
      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      await chatService.sendMessage('');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(1);
      expect((messages[0].payload as any).content).toBe('');
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to all connected peers', async () => {
      // Use a mock to verify broadcast is called
      const mockPeerService = {
        broadcast: jest.fn(),
        getPeerCount: jest.fn().mockReturnValue(2),
      } as any;

      const chatServiceWithMock = new ChatService(mockPeerService, eventBus, {
        userId: testUserId,
        nickname: testNickname,
        roomId: testRoomId,
      });

      const chatMessage: ChatMessage = {
        id: 'msg-broadcast-001',
        type: 'normal',
        roomId: testRoomId,
        senderId: testUserId,
        senderNickname: testNickname,
        content: 'Broadcast message',
        timestamp: Date.now(),
      };

      chatServiceWithMock.broadcast(chatMessage);

      // Verify broadcast was called
      expect(mockPeerService.broadcast).toHaveBeenCalledTimes(1);

      // Verify the message structure passed to broadcast
      const broadcastCall = mockPeerService.broadcast.mock.calls[0][0];
      expect(broadcastCall.type).toBe('chat');
      expect(broadcastCall.senderId).toBe(testUserId);
      expect(broadcastCall.senderNickname).toBe(testNickname);
      expect(broadcastCall.roomId).toBe(testRoomId);
      expect((broadcastCall.payload as any).messageId).toBe('msg-broadcast-001');
      expect((broadcastCall.payload as any).content).toBe('Broadcast message');
    });

    it('should not throw when broadcasting with no peers', () => {
      const chatMessage: ChatMessage = {
        id: 'msg-broadcast-002',
        type: 'normal',
        roomId: testRoomId,
        senderId: testUserId,
        senderNickname: testNickname,
        content: 'Message with no peers',
        timestamp: Date.now(),
      };

      expect(() => chatService.broadcast(chatMessage)).not.toThrow();
    });
  });

  describe('formatMessage', () => {
    it('should format normal message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: testRoomId,
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hello everyone!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = chatService.formatMessage(message);
      expect(formatted).toBe('[10:30:00] Bob: Hello everyone!');
    });

    it('should format system message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'system',
        roomId: testRoomId,
        senderId: 'system',
        senderNickname: '系统',
        content: 'User joined the chat',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = chatService.formatMessage(message);
      expect(formatted).toBe('[10:30:00] 系统: User joined the chat');
    });

    it('should format reply message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-003',
        type: 'reply',
        roomId: testRoomId,
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Thanks for the info!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
        replyTo: {
          originalMessageId: 'msg-original',
          originalSenderNickname: 'Charlie',
          originalContent: 'Here is the info',
        },
      };

      const formatted = chatService.formatMessage(message);
      // Format: [HH:mm:ss] 昵称 [回复 原发送者: 原内容]: 回复内容
      expect(formatted).toBe('[10:30:00] Bob [回复 Charlie: Here is the info]: Thanks for the info!');
    });

    it('should format mention message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-004',
        type: 'mention',
        roomId: testRoomId,
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey there!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
        mentions: ['user-003'],
      };

      const formatted = chatService.formatMessage(message);
      expect(formatted).toBe('[10:30:00] Bob: @user-003 Hey there!');
    });

    it('should format own message correctly (using "我")', () => {
      const message: ChatMessage = {
        id: 'msg-005',
        type: 'normal',
        roomId: testRoomId,
        senderId: testUserId,
        senderNickname: testNickname, // Same as the chat service nickname
        content: 'My own message',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = chatService.formatMessage(message);
      expect(formatted).toBe('[10:30:00] 我: My own message');
    });

    it('should handle message with multi-byte characters', () => {
      const message: ChatMessage = {
        id: 'msg-006',
        type: 'normal',
        roomId: testRoomId,
        senderId: testUserId,
        senderNickname: '张三',
        content: '你好，世界！',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = chatService.formatMessage(message);
      expect(formatted).toBe('[10:30:00] 张三: 你好，世界！');
    });
  });

  describe('message event publishing', () => {
    it('should publish message event when sending', async () => {
      let publishedMessage: ChatMessage | null = null;

      eventBus.subscribe('message', (message) => {
        publishedMessage = message;
      });

      await chatService.sendMessage('Event test');

      expect(publishedMessage).not.toBeNull();
      expect(publishedMessage!.content).toBe('Event test');
      expect(publishedMessage!.senderNickname).toBe(testNickname);
    });

    it('should include mentions in published message', async () => {
      let publishedMessage: ChatMessage | null = null;

      eventBus.subscribe('message', (message) => {
        publishedMessage = message;
      });

      await chatService.sendMessage('@Bob Hello!', undefined, ['user-002']);

      expect(publishedMessage).not.toBeNull();
      expect(publishedMessage!.mentions).toContain('user-002');
    });

    it('should include reply info in published message', async () => {
      let publishedMessage: ChatMessage | null = null;

      eventBus.subscribe('message', (message) => {
        publishedMessage = message;
      });

      const replyInfo: ReplyInfo = {
        originalMessageId: 'msg-original',
        originalSenderNickname: 'Bob',
        originalContent: 'Original message',
      };

      await chatService.sendMessage('Reply content', replyInfo);

      expect(publishedMessage).not.toBeNull();
      expect(publishedMessage!.replyTo).toEqual(replyInfo);
    });
  });

  describe('updateNickname', () => {
    it('should update nickname correctly', async () => {
      const messages: P2PMessage[] = [];
      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const newNickname = 'Alice_New';
      await chatService.updateNickname(newNickname);

      expect(chatService.getNickname()).toBe(newNickname);

      await chatService.sendMessage('Message after rename');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages[0].senderNickname).toBe(newNickname);
    });
  });

  describe('error handling', () => {
    it('should handle peer service broadcast error gracefully', async () => {
      // Create a chat service with a mock peer service that throws
      const mockPeerService = {
        broadcast: jest.fn().mockImplementation(() => {
          throw new Error('Broadcast failed');
        }),
      } as any;

      const chatServiceWithMock = new ChatService(mockPeerService, eventBus, {
        userId: testUserId,
        nickname: testNickname,
        roomId: testRoomId,
      });

      const chatMessage: ChatMessage = {
        id: 'msg-error-001',
        type: 'normal',
        roomId: testRoomId,
        senderId: testUserId,
        senderNickname: testNickname,
        content: 'Test message',
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => chatServiceWithMock.broadcast(chatMessage)).not.toThrow();
    });
  });
});
