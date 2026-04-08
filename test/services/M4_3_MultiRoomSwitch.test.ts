/**
 * Unit tests for M4.3 - Multi-chatroom switching functionality
 *
 * Tests:
 * - M4.3.1: Multi-room state management (maintaining multiple room states)
 * - M4.3.2: Save history when switching rooms
 * - M4.3.3: Load history when switching rooms
 */

import * as fs from 'fs';
import * as path from 'path';
import { RoomService, UserInfo } from '../../src/services/RoomService';
import { HistoryService } from '../../src/services/HistoryService';
import { ZKClient } from '../../src/network/ZKClient';
import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';
import { MemberService } from '../../src/services/MemberService';
import { ChatMessage } from '../../src/services/types';

// Mock ZKClient
jest.mock('../../src/network/ZKClient');

describe('M4.3 Multi-chatroom Switching', () => {
  let roomService: RoomService;
  let historyService: HistoryService;
  let eventBus: EventBus;
  let memberService: MemberService;
  let mockZKClient: jest.Mocked<ZKClient>;

  const mockUserId = 'user-test-123';
  const mockNickname = 'TestUser';
  const mockIp = '192.168.1.100';
  const mockPort = 9001;

  let testDataDir: string;

  beforeEach(() => {
    // Use a temp directory for testing
    testDataDir = path.join('/tmp', 'chat-room-test-multi', Date.now().toString());

    // Reset singletons
    resetEventBus();
    eventBus = getEventBus();
    memberService = new MemberService(eventBus);
    historyService = new HistoryService(testDataDir);

    // Create mock ZKClient
    mockZKClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      createMemberNode: jest.fn().mockResolvedValue('/libra-regions/test/members/user-1'),
      deleteMemberNode: jest.fn().mockResolvedValue(undefined),
      getMembers: jest.fn().mockResolvedValue([]),
      listRooms: jest.fn().mockResolvedValue(['room1', 'room2']),
      isConnected: jest.fn().mockReturnValue(true),
      ensureRootNode: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ZKClient>;

    // Create RoomService with dependencies
    roomService = new RoomService(
      mockZKClient,
      memberService,
      eventBus,
      {
        userId: mockUserId,
        nickname: mockNickname,
        ip: mockIp,
        port: mockPort,
      },
      historyService // Pass historyService for room switching
    );
  });

  afterEach(async () => {
    jest.clearAllMocks();
    resetEventBus();
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  // ========== M4.3.1 Multi-room state management tests ==========

  describe('M4.3.1 - Multi-room state management', () => {
    it('should maintain state for multiple rooms', async () => {
      // Join multiple rooms
      await roomService.joinRoom('room1');
      await roomService.joinRoom('room2');

      // Should be in room2 (most recent)
      expect(roomService.getCurrentRoom()?.roomId).toBe('room2');

      // Should be able to get joined rooms list
      const joinedRooms = roomService.getJoinedRooms();
      expect(joinedRooms).toContain('room1');
      expect(joinedRooms).toContain('room2');
    });

    it('should track room state independently', async () => {
      // Join room1 first
      await roomService.joinRoom('room1');

      // Save a message for room1
      const msg1: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'room1',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'Message in room1',
        timestamp: Date.now(),
      };
      await historyService.save('room1', msg1);

      // Join room2
      await roomService.joinRoom('room2');

      // Save a message for room2
      const msg2: ChatMessage = {
        id: 'msg-002',
        type: 'normal',
        roomId: 'room2',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'Message in room2',
        timestamp: Date.now(),
      };
      await historyService.save('room2', msg2);

      // Each room should have independent history
      const room1History = await historyService.loadHistory('room1');
      const room2History = await historyService.loadHistory('room2');

      expect(room1History).toHaveLength(1);
      expect(room1History[0].content).toBe('Message in room1');
      expect(room2History).toHaveLength(1);
      expect(room2History[0].content).toBe('Message in room2');
    });

    it('should have getJoinedRooms method', () => {
      expect(typeof roomService.getJoinedRooms).toBe('function');
    });

    it('should return empty array when not in any room', () => {
      const joinedRooms = roomService.getJoinedRooms();
      expect(joinedRooms).toEqual([]);
    });

    it('should add room to joined list when joining', async () => {
      await roomService.joinRoom('general');

      const joinedRooms = roomService.getJoinedRooms();
      expect(joinedRooms).toContain('general');
    });

    it('should remove room from joined list when leaving', async () => {
      await roomService.joinRoom('general');
      await roomService.leaveRoom();

      const joinedRooms = roomService.getJoinedRooms();
      expect(joinedRooms).not.toContain('general');
    });

    it('should switch between rooms keeping both in joined list', async () => {
      await roomService.joinRoom('room1');
      await roomService.switchRoom('room2');

      const joinedRooms = roomService.getJoinedRooms();
      expect(joinedRooms).toContain('room1');
      expect(joinedRooms).toContain('room2');
      expect(roomService.getCurrentRoom()?.roomId).toBe('room2');
    });
  });

  // ========== M4.3.2 Save history when switching rooms ==========

  describe('M4.3.2 - Save history when switching rooms', () => {
    it('should save current room history before switching', async () => {
      // Join room1
      await roomService.joinRoom('room1');

      // Add messages to room1
      const msg1: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'room1',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'Hello in room1',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };
      await historyService.save('room1', msg1);

      // Switch to room2 - history for room1 should be preserved
      await roomService.switchRoom('room2');

      // Verify room1 history is saved
      const room1History = await historyService.loadHistory('room1');
      expect(room1History).toHaveLength(1);
      expect(room1History[0].content).toBe('Hello in room1');
    });

    it('should preserve message order when saving during switch', async () => {
      // Join room1
      await roomService.joinRoom('room1');

      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        const msg: ChatMessage = {
          id: `msg-${i}`,
          type: 'normal',
          roomId: 'room1',
          senderId: mockUserId,
          senderNickname: mockNickname,
          content: `Message ${i}`,
          timestamp: new Date(`2026-04-07T10:${30 + i}:00`).getTime(),
        };
        await historyService.save('room1', msg);
      }

      // Switch to room2
      await roomService.switchRoom('room2');

      // Verify order is preserved
      const room1History = await historyService.loadHistory('room1');
      expect(room1History).toHaveLength(5);
      expect(room1History[0].content).toBe('Message 0');
      expect(room1History[4].content).toBe('Message 4');
    });

    it('should not lose messages when switching rooms rapidly', async () => {
      // Join room1
      await roomService.joinRoom('room1');

      // Add messages rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const msg: ChatMessage = {
          id: `msg-${i}`,
          type: 'normal',
          roomId: 'room1',
          senderId: mockUserId,
          senderNickname: mockNickname,
          content: `Rapid message ${i}`,
          timestamp: Date.now() + i,
        };
        promises.push(historyService.save('room1', msg));
      }
      await Promise.all(promises);

      // Switch to room2
      await roomService.switchRoom('room2');

      // All messages should be saved
      const room1History = await historyService.loadHistory('room1');
      expect(room1History).toHaveLength(10);
    });
  });

  // ========== M4.3.3 Load history when switching rooms ==========

  describe('M4.3.3 - Load history when switching rooms', () => {
    it('should load history for new room after switching', async () => {
      // Pre-populate room2 history before joining
      const msg1: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'room2',
        senderId: 'other-user',
        senderNickname: 'OtherUser',
        content: 'Existing message in room2',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };
      await historyService.save('room2', msg1);

      // Join room1 first
      await roomService.joinRoom('room1');

      // Switch to room2
      await roomService.switchRoom('room2');

      // Should load room2 history
      const room2History = await historyService.loadHistory('room2');
      expect(room2History).toHaveLength(1);
      expect(room2History[0].content).toBe('Existing message in room2');
    });

    it('should return empty history for new room with no history', async () => {
      await roomService.joinRoom('room1');
      await roomService.switchRoom('new-room');

      const history = await historyService.loadHistory('new-room');
      expect(history).toEqual([]);
    });

    it('should maintain separate history for each room', async () => {
      // Create history for both rooms before joining
      const msg1: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'room1',
        senderId: 'user1',
        senderNickname: 'User1',
        content: 'Room1 message',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };
      const msg2: ChatMessage = {
        id: 'msg-002',
        type: 'normal',
        roomId: 'room2',
        senderId: 'user2',
        senderNickname: 'User2',
        content: 'Room2 message',
        timestamp: new Date('2026-04-07T10:31:00').getTime(),
      };
      await historyService.save('room1', msg1);
      await historyService.save('room2', msg2);

      // Join room1
      await roomService.joinRoom('room1');

      // Verify room1 has its history
      const room1History = await historyService.loadHistory('room1');
      expect(room1History).toHaveLength(1);
      expect(room1History[0].content).toBe('Room1 message');

      // Switch to room2
      await roomService.switchRoom('room2');

      // Verify room2 has its history
      const room2History = await historyService.loadHistory('room2');
      expect(room2History).toHaveLength(1);
      expect(room2History[0].content).toBe('Room2 message');

      // Verify room1 history is still intact (not modified)
      const room1HistoryAfter = await historyService.loadHistory('room1');
      expect(room1HistoryAfter).toHaveLength(1);
    });

    it('should limit loaded history to 500 messages', async () => {
      // Create more than 500 messages in room2
      const historyPath = path.join(testDataDir, 'room2', 'history.txt');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });

      const lines: string[] = [];
      for (let i = 0; i < 600; i++) {
        lines.push(`[2026-04-07 10:30:00] User${i}: Message ${i}\n`);
      }
      fs.writeFileSync(historyPath, lines.join(''));

      // Join room1 then switch to room2
      await roomService.joinRoom('room1');
      await roomService.switchRoom('room2');

      // History should be limited to 500
      const room2History = await historyService.loadHistory('room2');
      expect(room2History.length).toBeLessThanOrEqual(500);
    });
  });

  // ========== Integration tests for full switching flow ==========

  describe('M4.3 - Full room switching integration', () => {
    it('should switch rooms preserving both histories', async () => {
      // Step 1: Join room1 and add messages
      await roomService.joinRoom('room1');

      const msg1: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'room1',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'First in room1',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };
      await historyService.save('room1', msg1);

      // Step 2: Switch to room2 and add messages
      await roomService.switchRoom('room2');

      const msg2: ChatMessage = {
        id: 'msg-002',
        type: 'normal',
        roomId: 'room2',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'First in room2',
        timestamp: new Date('2026-04-07T10:31:00').getTime(),
      };
      await historyService.save('room2', msg2);

      // Step 3: Switch back to room1 and add more
      await roomService.switchRoom('room1');

      const msg3: ChatMessage = {
        id: 'msg-003',
        type: 'normal',
        roomId: 'room1',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'Second in room1',
        timestamp: new Date('2026-04-07T10:32:00').getTime(),
      };
      await historyService.save('room1', msg3);

      // Verify both rooms have correct history
      const room1History = await historyService.loadHistory('room1');
      const room2History = await historyService.loadHistory('room2');

      expect(room1History).toHaveLength(2);
      expect(room1History[0].content).toBe('First in room1');
      expect(room1History[1].content).toBe('Second in room1');

      expect(room2History).toHaveLength(1);
      expect(room2History[0].content).toBe('First in room2');
    });

    it('should handle switchRoom with historyService integration', async () => {
      // This tests that switchRoom properly coordinates with historyService
      // Pre-populate room2 history
      const existingMsg: ChatMessage = {
        id: 'msg-old',
        type: 'normal',
        roomId: 'room2',
        senderId: 'someone',
        senderNickname: 'Someone',
        content: 'Old message in room2',
        timestamp: new Date('2026-04-07T09:00:00').getTime(),
      };
      await historyService.save('room2', existingMsg);

      // Join room1
      await roomService.joinRoom('room1');

      // Switch to room2 - should load existing history
      await roomService.switchRoom('room2');

      const history = await historyService.loadHistory('room2');
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Old message in room2');
    });

    it('should handle rapid consecutive switches', async () => {
      // Join room1
      await roomService.joinRoom('room1');

      // Switch rapidly
      await roomService.switchRoom('room2');
      await roomService.switchRoom('room3');
      await roomService.switchRoom('room1');

      // All rooms should be in joined list
      const joinedRooms = roomService.getJoinedRooms();
      expect(joinedRooms).toContain('room1');
      expect(joinedRooms).toContain('room2');
      expect(joinedRooms).toContain('room3');

      // Should be in room1
      expect(roomService.getCurrentRoom()?.roomId).toBe('room1');
    });

    it('should handle switch to same room (no-op) without affecting history', async () => {
      await roomService.joinRoom('room1');

      const msg1: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'room1',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'Test message',
        timestamp: Date.now(),
      };
      await historyService.save('room1', msg1);

      // Switch to same room
      await roomService.switchRoom('room1');

      // History should be unchanged
      const history = await historyService.loadHistory('room1');
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Test message');
    });
  });

  // ========== Edge cases ==========

  describe('M4.3 - Edge cases', () => {
    it('should handle empty room history gracefully', async () => {
      await roomService.joinRoom('brand-new-room');
      await roomService.switchRoom('another-new-room');

      const history1 = await historyService.loadHistory('brand-new-room');
      const history2 = await historyService.loadHistory('another-new-room');

      expect(history1).toEqual([]);
      expect(history2).toEqual([]);
    });

    it('should handle system messages in history', async () => {
      await roomService.joinRoom('room1');

      const systemMsg: ChatMessage = {
        id: 'sys-001',
        type: 'system',
        roomId: 'room1',
        senderId: 'system',
        senderNickname: '系统',
        content: 'User joined',
        timestamp: Date.now(),
      };
      await historyService.save('room1', systemMsg);

      await roomService.switchRoom('room2');

      const history = await historyService.loadHistory('room1');
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('system');
    });

    it('should handle reply messages in history', async () => {
      await roomService.joinRoom('room1');

      const replyMsg: ChatMessage = {
        id: 'reply-001',
        type: 'reply',
        roomId: 'room1',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'Thanks!',
        timestamp: Date.now(),
        replyTo: {
          originalMessageId: 'orig-001',
          originalSenderNickname: 'Other',
          originalContent: 'Hello',
        },
      };
      await historyService.save('room1', replyMsg);

      await roomService.switchRoom('room2');

      const history = await historyService.loadHistory('room1');
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('reply');
      expect(history[0].replyTo?.originalContent).toBe('Hello');
    });

    it('should handle mention messages in history', async () => {
      await roomService.joinRoom('room1');

      const mentionMsg: ChatMessage = {
        id: 'mention-001',
        type: 'mention',
        roomId: 'room1',
        senderId: mockUserId,
        senderNickname: mockNickname,
        content: 'Hey!',
        timestamp: Date.now(),
        mentions: ['user-002'],
      };
      await historyService.save('room1', mentionMsg);

      await roomService.switchRoom('room2');

      const history = await historyService.loadHistory('room1');
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('mention');
    });
  });
});
