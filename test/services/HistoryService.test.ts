/**
 * Unit tests for HistoryService
 * Tests message history persistence, loading, formatting, and cleanup
 */

import * as fs from 'fs';
import * as path from 'path';
import { HistoryService } from '../../src/services/HistoryService';
import { ChatMessage } from '../../src/services/types';

describe('HistoryService', () => {
  let historyService: HistoryService;
  let testDataDir: string;
  let testRoomId: string;

  beforeEach(() => {
    // Use a temp directory for testing
    testDataDir = path.join('/tmp', 'chat-room-test', Date.now().toString());
    testRoomId = 'test-room';
    historyService = new HistoryService(testDataDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('M4.1.1 - getHistoryPath', () => {
    it('should return correct history path for a room', () => {
      const roomId = 'general';
      const expectedPath = path.join(testDataDir, roomId, 'history.txt');
      const result = historyService.getHistoryPath(roomId);
      expect(result).toBe(expectedPath);
    });

    it('should handle room IDs with special characters', () => {
      const roomId = 'dev-team-123';
      const expectedPath = path.join(testDataDir, roomId, 'history.txt');
      const result = historyService.getHistoryPath(roomId);
      expect(result).toBe(expectedPath);
    });

    it('should create parent directory if it does not exist', () => {
      const roomId = 'new-room';
      const expectedDir = path.join(testDataDir, roomId);
      expect(fs.existsSync(expectedDir)).toBe(false);
      historyService.getHistoryPath(roomId);
      expect(fs.existsSync(expectedDir)).toBe(true);
    });
  });

  describe('M4.1.4 - formatMessageLine', () => {
    it('should format normal message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hello everyone!',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };

      const result = historyService.formatMessageLine(message);
      expect(result).toBe('[2026-04-07 10:30:00] Alice: Hello everyone!');
    });

    it('should format system message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'system',
        roomId: 'general',
        senderId: 'system',
        senderNickname: '系统',
        content: 'Alice 加入了聊天室',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };

      const result = historyService.formatMessageLine(message);
      expect(result).toBe('[2026-04-07 10:30:00] 系统: Alice 加入了聊天室');
    });

    it('should format reply message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-003',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Bob',
        content: 'Thanks for the info!',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
        replyTo: {
          originalMessageId: 'msg-original',
          originalSenderNickname: 'Charlie',
          originalContent: 'Here is the info',
        },
      };

      const result = historyService.formatMessageLine(message);
      expect(result).toBe('[2026-04-07 10:30:00] Bob [回复 Charlie: Here is the info]: Thanks for the info!');
    });

    it('should format mention message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-004',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Dave',
        content: 'Hey there!',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
        mentions: ['user-002'],
      };

      const result = historyService.formatMessageLine(message);
      expect(result).toBe('[2026-04-07 10:30:00] Dave: @user-002 Hey there!');
    });

    it('should handle multi-byte characters (Chinese)', () => {
      const message: ChatMessage = {
        id: 'msg-005',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: '张三',
        content: '你好，世界！',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };

      const result = historyService.formatMessageLine(message);
      expect(result).toBe('[2026-04-07 10:30:00] 张三: 你好，世界！');
    });

    it('should pad single digit hours, minutes, and seconds with zeros', () => {
      const message: ChatMessage = {
        id: 'msg-006',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Test',
        content: 'Test message',
        timestamp: new Date('2026-04-07T01:05:09').getTime(),
      };

      const result = historyService.formatMessageLine(message);
      expect(result).toBe('[2026-04-07 01:05:09] Test: Test message');
    });
  });

  describe('M4.1.5 - parseMessageLine', () => {
    it('should parse normal message correctly', () => {
      const line = '[2026-04-07 10:30:00] Alice: Hello everyone!';
      const result = historyService.parseMessageLine(line);

      expect(result).not.toBeNull();
      expect(result!.senderNickname).toBe('Alice');
      expect(result!.content).toBe('Hello everyone!');
    });

    it('should parse system message correctly', () => {
      const line = '[2026-04-07 10:30:00] 系统: Alice 加入了聊天室';
      const result = historyService.parseMessageLine(line);

      expect(result).not.toBeNull();
      expect(result!.senderNickname).toBe('系统');
      expect(result!.content).toBe('Alice 加入了聊天室');
    });

    it('should parse reply message correctly', () => {
      const line = '[2026-04-07 10:30:00] Bob [回复 Charlie: Here is the info]: Thanks for the info!';
      const result = historyService.parseMessageLine(line);

      expect(result).not.toBeNull();
      expect(result!.senderNickname).toBe('Bob');
      expect(result!.content).toBe('Thanks for the info!');
      expect(result!.replyTo).toBeDefined();
      expect(result!.replyTo!.originalSenderNickname).toBe('Charlie');
      expect(result!.replyTo!.originalContent).toBe('Here is the info');
    });

    it('should parse mention message correctly', () => {
      const line = '[2026-04-07 10:30:00] Dave: @user-002 Hey there!';
      const result = historyService.parseMessageLine(line);

      expect(result).not.toBeNull();
      expect(result!.senderNickname).toBe('Dave');
      expect(result!.content).toBe('@user-002 Hey there!');
    });

    it('should return null for invalid format', () => {
      const invalidLine = 'This is not a valid message format';
      const result = historyService.parseMessageLine(invalidLine);
      expect(result).toBeNull();
    });

    it('should return null for empty line', () => {
      const result = historyService.parseMessageLine('');
      expect(result).toBeNull();
    });

    it('should handle multi-byte characters', () => {
      const line = '[2026-04-07 10:30:00] 张三: 你好，世界！';
      const result = historyService.parseMessageLine(line);

      expect(result).not.toBeNull();
      expect(result!.senderNickname).toBe('张三');
      expect(result!.content).toBe('你好，世界！');
    });

    it('should handle message content with colons', () => {
      const line = '[2026-04-07 10:30:00] Alice: URL: http://example.com';
      const result = historyService.parseMessageLine(line);

      expect(result).not.toBeNull();
      expect(result!.senderNickname).toBe('Alice');
      expect(result!.content).toBe('URL: http://example.com');
    });
  });

  describe('M4.1.2 - save method', () => {
    it('should save message to file', async () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: testRoomId,
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hello!',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };

      await historyService.save(testRoomId, message);

      const historyPath = historyService.getHistoryPath(testRoomId);
      expect(fs.existsSync(historyPath)).toBe(true);
      const content = fs.readFileSync(historyPath, 'utf-8');
      expect(content).toBe('[2026-04-07 10:30:00] Alice: Hello!\n');
    });

    it('should append message to existing history', async () => {
      const message1: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: testRoomId,
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'First message',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };

      const message2: ChatMessage = {
        id: 'msg-002',
        type: 'normal',
        roomId: testRoomId,
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Second message',
        timestamp: new Date('2026-04-07T10:31:00').getTime(),
      };

      await historyService.save(testRoomId, message1);
      await historyService.save(testRoomId, message2);

      const historyPath = historyService.getHistoryPath(testRoomId);
      const content = fs.readFileSync(historyPath, 'utf-8');
      expect(content).toBe('[2026-04-07 10:30:00] Alice: First message\n[2026-04-07 10:31:00] Bob: Second message\n');
    });

    it('should create directory if it does not exist', async () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'brand-new-room',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hello!',
        timestamp: new Date('2026-04-07T10:30:00').getTime(),
      };

      const expectedDir = path.join(testDataDir, 'brand-new-room');
      expect(fs.existsSync(expectedDir)).toBe(false);

      await historyService.save('brand-new-room', message);

      expect(fs.existsSync(expectedDir)).toBe(true);
    });
  });

  describe('M4.1.3 - loadHistory', () => {
    it('should load messages from history file', async () => {
      const historyPath = path.join(testDataDir, testRoomId, 'history.txt');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, '[2026-04-07 10:30:00] Alice: Hello!\n[2026-04-07 10:31:00] Bob: Hi!\n');

      const messages = await historyService.loadHistory(testRoomId);

      expect(messages.length).toBe(2);
      expect(messages[0].senderNickname).toBe('Alice');
      expect(messages[0].content).toBe('Hello!');
      expect(messages[1].senderNickname).toBe('Bob');
      expect(messages[1].content).toBe('Hi!');
    });

    it('should return empty array if history file does not exist', async () => {
      const messages = await historyService.loadHistory('non-existent-room');
      expect(messages).toEqual([]);
    });

    it('should limit to 500 messages', async () => {
      const historyPath = path.join(testDataDir, testRoomId, 'history.txt');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });

      // Write 600 messages
      const lines: string[] = [];
      for (let i = 0; i < 600; i++) {
        lines.push(`[2026-04-07 10:30:00] User${i}: Message ${i}\n`);
      }
      fs.writeFileSync(historyPath, lines.join(''));

      const messages = await historyService.loadHistory(testRoomId);

      expect(messages.length).toBe(500);
    });

    it('should return most recent 500 messages when limit is exceeded', async () => {
      const historyPath = path.join(testDataDir, testRoomId, 'history.txt');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });

      // Write 600 messages with incrementing timestamps
      for (let i = 0; i < 600; i++) {
        const hour = Math.floor(i / 60);
        const minute = i % 60;
        const line = `[2026-04-07 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00] User${i}: Message ${i}\n`;
        fs.appendFileSync(historyPath, line);
      }

      const messages = await historyService.loadHistory(testRoomId);

      expect(messages.length).toBe(500);
      // Should have the most recent messages (100-599)
      expect(messages[0].content).toBe('Message 100');
      expect(messages[499].content).toBe('Message 599');
    });
  });

  describe('M4.1.6 - cleanupOldMessages', () => {
    it('should delete messages older than 30 days', async () => {
      const historyPath = path.join(testDataDir, testRoomId, 'history.txt');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });

      // Write old message (31 days ago)
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const oldLine = `[${thirtyOneDaysAgo.toISOString().substr(0, 19).replace('T', ' ')}] Alice: Old message\n`;
      fs.writeFileSync(historyPath, oldLine);

      // Write recent message (10 days ago)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const recentLine = `[${tenDaysAgo.toISOString().substr(0, 19).replace('T', ' ')}] Bob: Recent message\n`;
      fs.appendFileSync(historyPath, recentLine);

      await historyService.cleanupOldMessages(testRoomId);

      const remaining = fs.readFileSync(historyPath, 'utf-8');
      expect(remaining).toBe(recentLine);
    });

    it('should handle non-existent history file', async () => {
      // Should not throw
      await expect(historyService.cleanupOldMessages('non-existent')).resolves.not.toThrow();
    });

    it('should keep messages within 30 days', async () => {
      const historyPath = path.join(testDataDir, testRoomId, 'history.txt');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });

      // Write recent message (10 days ago)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const line = `[${tenDaysAgo.toISOString().substr(0, 19).replace('T', ' ')}] Alice: Recent message\n`;
      fs.writeFileSync(historyPath, line);

      await historyService.cleanupOldMessages(testRoomId);

      const remaining = fs.readFileSync(historyPath, 'utf-8');
      expect(remaining).toBe(line);
    });
  });

  describe('M4.1.7 - startupCleanup', () => {
    it('should cleanup old messages for all rooms', async () => {
      const room1Path = path.join(testDataDir, 'room1', 'history.txt');
      const room2Path = path.join(testDataDir, 'room2', 'history.txt');
      fs.mkdirSync(path.dirname(room1Path), { recursive: true });
      fs.mkdirSync(path.dirname(room2Path), { recursive: true });

      // Write old messages (31 days ago)
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const oldLine = `[${thirtyOneDaysAgo.toISOString().substr(0, 19).replace('T', ' ')}] Alice: Old message\n`;

      // Write recent messages (10 days ago)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const recentLine = `[${tenDaysAgo.toISOString().substr(0, 19).replace('T', ' ')}] Bob: Recent message\n`;

      fs.writeFileSync(room1Path, oldLine + recentLine);
      fs.writeFileSync(room2Path, oldLine + recentLine);

      await historyService.startupCleanup();

      const room1Remaining = fs.readFileSync(room1Path, 'utf-8');
      const room2Remaining = fs.readFileSync(room2Path, 'utf-8');

      expect(room1Remaining).toBe(recentLine);
      expect(room2Remaining).toBe(recentLine);
    });

    it('should handle rooms with no history files', async () => {
      // Should not throw
      await expect(historyService.startupCleanup()).resolves.not.toThrow();
    });
  });

  describe('M4.2.4 - local history browsing', () => {
    it('should allow browsing history when offline', async () => {
      // This tests that loadHistory works independently of network
      const historyPath = path.join(testDataDir, testRoomId, 'history.txt');
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, '[2026-04-07 10:30:00] Alice: Hello!\n');

      // Even without network, we should be able to load history
      const messages = await historyService.loadHistory(testRoomId);
      expect(messages.length).toBe(1);
      expect(messages[0].senderNickname).toBe('Alice');
    });
  });
});
