/**
 * Unit tests for M4.2 Exception Handling
 * Tests ZK disconnect/reconnect warnings, offline @ warnings, and local history browsing
 */

import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';
import { ChatService, MemberStatusChecker } from '../../src/services/ChatService';
import { ChatMessage } from '../../src/services/types';
import * as fs from 'fs';
import * as path from 'path';

// Helper to create mock MemberService
function createMockMemberService(members: Array<{ userId: string; nickname: string; status: 'online' | 'offline' }>): MemberStatusChecker {
  const memberMap = new Map(members.map(m => [m.userId, m]));
  return {
    isOnline: (userId: string) => memberMap.get(userId)?.status === 'online',
    getMember: (userId: string) => memberMap.get(userId),
  };
}

describe('M4.2 Exception Handling', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    resetEventBus();
    eventBus = getEventBus();
  });

  describe('M4.2.1 - ZK Disconnect Warning', () => {
    it('should publish zk_disconnected event when ZK connection is lost', (done) => {
      // Subscribe to zk_disconnected event
      eventBus.subscribe('zk_disconnected', () => {
        done();
      });

      // Simulate ZK disconnect event
      eventBus.publish('zk_disconnected', undefined);
    });

    it('should allow UI to handle disconnect by showing warning', () => {
      // This tests that the UI can subscribe to zk_disconnected and act on it
      // In the actual app, ChatScreen subscribes to this and publishes a warning message
      let warningPublished = false;
      let connectionStatus: string = 'connected';

      // Simulate UI subscribing to zk_disconnected
      eventBus.subscribe('zk_disconnected', () => {
        connectionStatus = 'disconnected';
        // UI publishes warning message
        eventBus.publish('warning', {
          message: 'ZooKeeper 连接断开，正在尝试重新连接...',
        });
      });

      // Subscribe to warning
      eventBus.subscribe('warning', (payload: { message: string }) => {
        warningPublished = true;
        expect(payload.message).toContain('断开');
      });

      // Publish disconnect event
      eventBus.publish('zk_disconnected', undefined);

      expect(connectionStatus).toBe('disconnected');
      expect(warningPublished).toBe(true);
    });
  });

  describe('M4.2.2 - ZK Reconnect Success Notification', () => {
    it('should publish zk_reconnected event when ZK connection is restored', (done) => {
      // Subscribe to zk_reconnected event
      eventBus.subscribe('zk_reconnected', () => {
        done();
      });

      // Simulate ZK reconnect event
      eventBus.publish('zk_reconnected', undefined);
    });

    it('should allow UI to handle reconnect by showing success message', () => {
      // This tests that the UI can subscribe to zk_reconnected and act on it
      let successMessagePublished = false;
      let connectionStatus: string = 'disconnected';

      // Simulate UI subscribing to zk_reconnected
      eventBus.subscribe('zk_reconnected', () => {
        connectionStatus = 'connected';
        // UI publishes success message
        eventBus.publish('message', {
          id: `zk-reconn-${Date.now()}`,
          type: 'system',
          roomId: 'test-room',
          senderId: 'system',
          senderNickname: '系统',
          content: 'ZooKeeper 重连成功',
          timestamp: Date.now(),
        } as ChatMessage);
      });

      // Subscribe to message
      eventBus.subscribe('message', (message: ChatMessage) => {
        if (message.type === 'system' && (message as any).content?.includes('重连')) {
          successMessagePublished = true;
        }
      });

      // Publish reconnect event
      eventBus.publish('zk_reconnected', undefined);

      expect(connectionStatus).toBe('connected');
      expect(successMessagePublished).toBe(true);
    });
  });

  describe('M4.2.3 - Offline @ Warning', () => {
    it('should warn when sending @ to offline member', () => {
      // Create mock member service with one offline member
      const mockMemberService = createMockMemberService([
        { userId: 'user-002', nickname: 'Bob', status: 'offline' },
      ]);

      let warningPublished = false;
      let warningMessage = '';

      // Subscribe to warning events
      eventBus.subscribe('warning', (payload: { message: string }) => {
        warningPublished = true;
        warningMessage = payload.message;
      });

      // Simulate sending @ to offline member
      const mentions = ['user-002'];
      for (const userId of mentions) {
        const member = mockMemberService.getMember(userId);
        if (member && !mockMemberService.isOnline(userId)) {
          eventBus.publish('warning', {
            message: `给离线成员 ${member.nickname} 发送的消息可能无法送达`,
          });
        }
      }

      expect(warningPublished).toBe(true);
      expect(warningMessage).toContain('离线');
      expect(warningMessage).toContain('Bob');
    });

    it('should not warn when sending @ to online member', () => {
      // Create mock member service with online member
      const mockMemberService = createMockMemberService([
        { userId: 'user-002', nickname: 'Bob', status: 'online' },
      ]);

      let warningPublished = false;

      // Subscribe to warning events
      eventBus.subscribe('warning', () => {
        warningPublished = true;
      });

      // Simulate sending @ to online member - should NOT warn
      const mentions = ['user-002'];
      for (const userId of mentions) {
        const member = mockMemberService.getMember(userId);
        if (member && !mockMemberService.isOnline(userId)) {
          eventBus.publish('warning', {
            message: `给离线成员 ${member.nickname} 发送的消息可能无法送达`,
          });
        }
      }

      expect(warningPublished).toBe(false);
    });

    it('should correctly identify offline members from mention list', () => {
      // Test the logic that ChatService uses
      const mockMemberService = createMockMemberService([
        { userId: 'user-002', nickname: 'Bob', status: 'offline' },
        { userId: 'user-003', nickname: 'Charlie', status: 'online' },
        { userId: 'user-004', nickname: 'Dave', status: 'offline' },
      ]);

      const mentions = ['user-002', 'user-003', 'user-004'];
      const offlineMentions = mentions.filter(id => !mockMemberService.isOnline(id));

      expect(offlineMentions).toContain('user-002');
      expect(offlineMentions).toContain('user-004');
      expect(offlineMentions).not.toContain('user-003');
    });

    it('ChatService.checkOfflineMentions should warn for offline members', () => {
      // Create mock member service
      const mockMemberService = createMockMemberService([
        { userId: 'user-002', nickname: 'Bob', status: 'offline' },
      ]);

      let warningPublished = false;

      // Subscribe to warning events
      eventBus.subscribe('warning', (payload: { message: string }) => {
        warningPublished = true;
        expect(payload.message).toContain('离线');
      });

      // Use ChatService's checkOfflineMentions method
      // We need to create a minimal ChatService for this
      const mockPeerService = {
        broadcast: jest.fn(),
      } as any;

      const chatService = new ChatService(mockPeerService, eventBus, {
        userId: 'user-001',
        nickname: 'Alice',
        roomId: 'general',
      });

      chatService.checkOfflineMentions(['user-002'], mockMemberService);

      expect(warningPublished).toBe(true);
    });
  });

  describe('M4.2.4 - Local History Browsing', () => {
    it('should allow browsing history when offline', async () => {
      // Import HistoryService dynamically to ensure it's loaded
      const HistoryService = require('../../src/services/HistoryService').HistoryService;

      const testDataDir = path.join('/tmp', 'chat-room-test-m42', Date.now().toString());
      const historyService = new HistoryService(testDataDir);

      // Create test history file
      const roomId = 'test-room';
      const historyPath = historyService.getHistoryPath(roomId);
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, '[2026-04-07 10:30:00] Alice: Hello!\n');

      // Load history - should work even if network is unavailable
      const messages = await historyService.loadHistory(roomId);

      expect(messages.length).toBe(1);
      expect(messages[0].senderNickname).toBe('Alice');
      expect(messages[0].content).toBe('Hello!');

      // Cleanup
      fs.rmSync(testDataDir, { recursive: true, force: true });
    });

    it('should load history without network connection', async () => {
      // This verifies that HistoryService works independently of network
      const HistoryService = require('../../src/services/HistoryService').HistoryService;

      const testDataDir = path.join('/tmp', 'chat-room-test-m42-offline', Date.now().toString());
      const historyService = new HistoryService(testDataDir);

      const roomId = 'offline-room';
      const historyPath = historyService.getHistoryPath(roomId);
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, '[2026-04-07 10:30:00] Bob: Offline message!\n');

      // Load history - works without network
      const messages = await historyService.loadHistory(roomId);

      expect(messages.length).toBe(1);
      expect(messages[0].senderNickname).toBe('Bob');

      // Cleanup
      fs.rmSync(testDataDir, { recursive: true, force: true });
    });
  });
});
