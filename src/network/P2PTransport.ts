/**
 * P2P Transport Layer
 * Handles message encoding/decoding with Magic + Length + Payload format
 */

import { P2PMessage } from '../services/types';

// Magic bytes: 0x4348 ('CH')
const MAGIC_BYTES = 0x4348;
const HEADER_SIZE = 6; // 2 bytes magic + 4 bytes length

export class P2PTransport {
  /**
   * Encode a P2PMessage into a buffer with Magic + Length + Payload format
   * @param message The P2P message to encode
   * @returns Buffer containing encoded message
   */
  encode(message: P2PMessage): Buffer {
    const payload = JSON.stringify(message);
    const payloadBytes = Buffer.byteLength(payload, 'utf-8');
    const totalSize = HEADER_SIZE + payloadBytes;

    const buffer = Buffer.alloc(totalSize);

    // Write magic bytes (big-endian)
    buffer.writeUInt16BE(MAGIC_BYTES, 0);

    // Write payload length (big-endian)
    buffer.writeUInt32BE(payloadBytes, 2);

    // Write payload
    buffer.write(payload, HEADER_SIZE, payloadBytes, 'utf-8');

    return buffer;
  }

  /**
   * Decode a buffer into a P2PMessage
   * @param buffer The buffer to decode
   * @returns Decoded P2PMessage
   */
  decode(buffer: Buffer): P2PMessage {
    // Verify magic bytes
    const magic = buffer.readUInt16BE(0);
    if (magic !== MAGIC_BYTES) {
      throw new Error(`Invalid magic bytes: expected 0x${MAGIC_BYTES.toString(16)}, got 0x${magic.toString(16)}`);
    }

    // Read payload length
    const payloadLength = buffer.readUInt32BE(2);

    // Read payload
    const payloadBuffer = buffer.slice(HEADER_SIZE, HEADER_SIZE + payloadLength);
    const payloadString = payloadBuffer.toString('utf-8');
    const message = JSON.parse(payloadString);

    return message as P2PMessage;
  }

  /**
   * Validate that an object is a valid P2PMessage
   * @param obj The object to validate
   * @returns true if valid P2PMessage, false otherwise
   */
  validate(obj: any): obj is P2PMessage {
    if (obj === null || obj === undefined) {
      return false;
    }

    if (typeof obj !== 'object') {
      return false;
    }

    // Check required fields
    if (typeof obj.type !== 'string') {
      return false;
    }

    if (typeof obj.senderId !== 'string') {
      return false;
    }

    if (typeof obj.senderNickname !== 'string') {
      return false;
    }

    if (typeof obj.roomId !== 'string') {
      return false;
    }

    if (typeof obj.timestamp !== 'number') {
      return false;
    }

    if (typeof obj.payload !== 'object' || obj.payload === null) {
      return false;
    }

    return true;
  }
}
