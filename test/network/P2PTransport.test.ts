/**
 * Unit tests for P2PTransport
 * Tests encoding, decoding, and validation of P2P messages
 */

import { P2PTransport } from '../../src/network/P2PTransport';
import { P2PMessage } from '../../src/services/types';

describe('P2PTransport', () => {
  let transport: P2PTransport;

  beforeEach(() => {
    transport = new P2PTransport();
  });

  describe('encode', () => {
    it('should encode a chat message with correct magic bytes and length', () => {
      const message: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: 'Hello world',
        },
      };

      const buffer = transport.encode(message);

      // Check magic bytes (0x4348 = 'CH')
      expect(buffer[0]).toBe(0x43); // 'C'
      expect(buffer[1]).toBe(0x48); // 'H'

      // Check length (big-endian, bytes 2-5)
      const payload = JSON.stringify(message);
      const expectedLength = Buffer.byteLength(payload, 'utf-8');
      const lengthFromBuffer = buffer.readUInt32BE(2);
      expect(lengthFromBuffer).toBe(expectedLength);

      // Check payload
      const decodedPayload = buffer.slice(6).toString('utf-8');
      expect(decodedPayload).toBe(payload);
    });

    it('should encode different message types correctly', () => {
      const message: P2PMessage = {
        type: 'join',
        senderId: 'user-002',
        senderNickname: 'Bob',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          ip: '192.168.1.100',
          port: 9001,
        },
      };

      const buffer = transport.encode(message);
      expect(buffer[0]).toBe(0x43);
      expect(buffer[1]).toBe(0x48);
      expect(buffer.readUInt32BE(2)).toBe(Buffer.byteLength(JSON.stringify(message), 'utf-8'));
    });

    it('should encode ping message', () => {
      const message: P2PMessage = {
        type: 'ping',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {},
      };

      const buffer = transport.encode(message);
      expect(buffer[0]).toBe(0x43);
      expect(buffer[1]).toBe(0x48);
    });
  });

  describe('decode', () => {
    it('should decode a valid encoded message', () => {
      const originalMessage: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: 'Hello world',
        },
      };

      const buffer = transport.encode(originalMessage);
      const decoded = transport.decode(buffer);

      expect(decoded).toEqual(originalMessage);
    });

    it('should decode join message correctly', () => {
      const originalMessage: P2PMessage = {
        type: 'join',
        senderId: 'user-002',
        senderNickname: 'Bob',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          ip: '192.168.1.100',
          port: 9001,
        },
      };

      const buffer = transport.encode(originalMessage);
      const decoded = transport.decode(buffer);

      expect(decoded.type).toBe('join');
      expect(decoded.senderId).toBe('user-002');
      expect(decoded.payload).toEqual({
        ip: '192.168.1.100',
        port: 9001,
      });
    });

    it('should decode leave message correctly', () => {
      const originalMessage: P2PMessage = {
        type: 'leave',
        senderId: 'user-003',
        senderNickname: 'Charlie',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {},
      };

      const buffer = transport.encode(originalMessage);
      const decoded = transport.decode(buffer);

      expect(decoded.type).toBe('leave');
      expect(decoded.senderId).toBe('user-003');
    });

    it('should decode nick_change message correctly', () => {
      const originalMessage: P2PMessage = {
        type: 'nick_change',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          oldNickname: 'OldName',
          newNickname: 'NewName',
        },
      };

      const buffer = transport.encode(originalMessage);
      const decoded = transport.decode(buffer);

      expect(decoded.type).toBe('nick_change');
      expect(decoded.payload).toEqual({
        oldNickname: 'OldName',
        newNickname: 'NewName',
      });
    });

    it('should handle messages with special characters in content', () => {
      const originalMessage: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: '你好世界 🌍 éèê',
        },
      };

      const buffer = transport.encode(originalMessage);
      const decoded = transport.decode(buffer);

      expect(decoded.payload).toEqual({
        messageId: 'msg-001',
        content: '你好世界 🌍 éèê',
      });
    });
  });

  describe('validate', () => {
    it('should return true for valid P2PMessage', () => {
      const validMessage: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: 'Hello',
        },
      };

      expect(transport.validate(validMessage)).toBe(true);
    });

    it('should return false for object missing type', () => {
      const invalidMessage = {
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {},
      };

      expect(transport.validate(invalidMessage)).toBe(false);
    });

    it('should return false for object missing senderId', () => {
      const invalidMessage = {
        type: 'chat',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {},
      };

      expect(transport.validate(invalidMessage)).toBe(false);
    });

    it('should return false for object missing senderNickname', () => {
      const invalidMessage = {
        type: 'chat',
        senderId: 'user-001',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {},
      };

      expect(transport.validate(invalidMessage)).toBe(false);
    });

    it('should return false for object missing roomId', () => {
      const invalidMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        timestamp: 1743200000000,
        payload: {},
      };

      expect(transport.validate(invalidMessage)).toBe(false);
    });

    it('should return false for object missing timestamp', () => {
      const invalidMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        payload: {},
      };

      expect(transport.validate(invalidMessage)).toBe(false);
    });

    it('should return false for object missing payload', () => {
      const invalidMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
      };

      expect(transport.validate(invalidMessage)).toBe(false);
    });

    it('should return false for null input', () => {
      expect(transport.validate(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(transport.validate(undefined)).toBe(false);
    });

    it('should return false for primitive input', () => {
      expect(transport.validate('string' as any)).toBe(false);
      expect(transport.validate(123 as any)).toBe(false);
    });

    it('should validate all message types', () => {
      const messageTypes: P2PMessage['type'][] = ['chat', 'join', 'leave', 'nick_change', 'ping', 'pong'];

      messageTypes.forEach((type) => {
        const message: P2PMessage = {
          type,
          senderId: 'user-001',
          senderNickname: 'Alice',
          roomId: 'general',
          timestamp: 1743200000000,
          payload: {},
        };
        expect(transport.validate(message)).toBe(true);
      });
    });
  });

  describe('encode and decode roundtrip', () => {
    it('should preserve all message fields through encode/decode cycle', () => {
      const message: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: 'Test message',
          mentions: ['user-002'],
        },
      };

      const buffer = transport.encode(message);
      const decoded = transport.decode(buffer);

      expect(decoded).toEqual(message);
    });

    it('should handle large content messages', () => {
      const largeContent = 'A'.repeat(10000);
      const message: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: largeContent,
        },
      };

      const buffer = transport.encode(message);
      const decoded = transport.decode(buffer);

      expect((decoded.payload as any).content).toBe(largeContent);
    });
  });
});
