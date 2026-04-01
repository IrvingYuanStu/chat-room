import type { P2PProtocolMessage } from "../services/types.js";

const MAGIC = Buffer.from([0x43, 0x52]); // "CR" for Chat Room
const HEADER_SIZE = 6; // 2 (magic) + 4 (length)
const MAX_FRAME_SIZE = 1024 * 1024; // 1MB max frame

export class P2PTransport {
  static encode(message: P2PProtocolMessage): Buffer {
    const payload = Buffer.from(JSON.stringify(message), "utf-8");
    const frame = Buffer.alloc(HEADER_SIZE + payload.length);
    MAGIC.copy(frame, 0);
    frame.writeUInt32BE(payload.length, 2);
    payload.copy(frame, HEADER_SIZE);
    return frame;
  }

  static createFrameReassembler(): FrameReassembler {
    return new FrameReassembler();
  }
}

export class FrameReassembler {
  private buffer: Uint8Array = new Uint8Array(0);

  feed(data: Buffer): P2PProtocolMessage[] {
    const combined = new Uint8Array(this.buffer.length + data.length);
    combined.set(this.buffer);
    combined.set(data, this.buffer.length);
    this.buffer = combined;

    const messages: P2PProtocolMessage[] = [];

    while (this.buffer.length >= HEADER_SIZE) {
      if (this.buffer[0] !== MAGIC[0] || this.buffer[1] !== MAGIC[1]) {
        this.buffer = this.skipToNextMagic();
        continue;
      }

      const payloadLength = (this.buffer[2] << 24) | (this.buffer[3] << 16) | (this.buffer[4] << 8) | this.buffer[5];

      if (payloadLength > MAX_FRAME_SIZE) {
        this.buffer = this.buffer.subarray(HEADER_SIZE);
        continue;
      }

      const totalFrameSize = HEADER_SIZE + payloadLength;

      if (this.buffer.length < totalFrameSize) {
        break;
      }

      const payload = this.buffer.subarray(HEADER_SIZE, totalFrameSize);
      this.buffer = this.buffer.subarray(totalFrameSize);

      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload)) as P2PProtocolMessage;
        messages.push(message);
      } catch {
        continue;
      }
    }

    return messages;
  }

  private skipToNextMagic(): Uint8Array {
    for (let i = 1; i <= this.buffer.length - 2; i++) {
      if (this.buffer[i] === MAGIC[0] && this.buffer[i + 1] === MAGIC[1]) {
        return this.buffer.subarray(i);
      }
    }
    if (this.buffer.length > 0) {
      return this.buffer.subarray(this.buffer.length - 1);
    }
    return new Uint8Array(0);
  }

  reset(): void {
    this.buffer = new Uint8Array(0);
  }
}
