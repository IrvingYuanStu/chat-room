/**
 * Unit tests for P2PServer
 * Tests TCP server functionality for P2P communication
 */

import { P2PServer } from '../../src/network/P2PServer';
import { P2PTransport } from '../../src/network/P2PTransport';
import { P2PMessage } from '../../src/services/types';
import * as net from 'net';

describe('P2PServer', () => {
  let server: P2PServer;
  let transport: P2PTransport;
  const testPort = 19999;
  const testHost = '127.0.0.1';

  beforeEach(() => {
    transport = new P2PTransport();
    server = new P2PServer(transport);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('start and stop', () => {
    it('should start server on specified port', async () => {
      await server.start(testPort);

      const isListening = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.connect(testPort, testHost, () => {
          resolve(true);
          socket.destroy();
        });
        socket.on('error', () => {
          resolve(false);
        });
      });

      expect(isListening).toBe(true);
    });

    it('should stop server successfully', async () => {
      await server.start(testPort);
      await server.stop();

      const isListening = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.connect(testPort, testHost, () => {
          resolve(true);
          socket.destroy();
        });
        socket.on('error', () => {
          resolve(false);
        });
        // Timeout to ensure connection attempt fails
        setTimeout(() => resolve(false), 1000);
      });

      expect(isListening).toBe(false);
    });

    it('should emit connection event when client connects', async () => {
      const connectionPromise = new Promise<net.Socket>((resolve) => {
        server.onConnection((socket) => {
          resolve(socket);
        });
      });

      await server.start(testPort);

      // Connect a client
      const clientSocket = new net.Socket();
      await new Promise<void>((resolve, reject) => {
        clientSocket.connect(testPort, testHost, () => {
          resolve();
        });
        clientSocket.on('error', reject);
      });

      // Wait for connection event
      const socket = await connectionPromise;
      expect(socket).toBeInstanceOf(net.Socket);

      clientSocket.destroy();
    });
  });

  describe('message handling', () => {
    it('should receive and decode messages from connected client', async () => {
      const messagePromise = new Promise<P2PMessage>((resolve) => {
        server.onMessage((message) => {
          resolve(message);
        });
      });

      await server.start(testPort);

      const testMessage: P2PMessage = {
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

      const clientSocket = new net.Socket();
      await new Promise<void>((resolve, reject) => {
        clientSocket.connect(testPort, testHost, () => {
          resolve();
        });
        clientSocket.on('error', reject);
      });

      const encoded = transport.encode(testMessage);
      clientSocket.write(encoded);

      const received = await messagePromise;
      expect(received.type).toBe('chat');
      expect(received.senderId).toBe('user-001');
      expect(received.senderNickname).toBe('Alice');
      expect(received.roomId).toBe('general');
      expect((received.payload as any).content).toBe('Hello');

      clientSocket.destroy();
    });

    it('should handle multiple messages from same client', async () => {
      let messageCount = 0;
      const messagePromise = new Promise<void>((resolve) => {
        server.onMessage(() => {
          messageCount++;
          if (messageCount === 2) {
            resolve();
          }
        });
      });

      await server.start(testPort);

      const messages: P2PMessage[] = [
        {
          type: 'chat',
          senderId: 'user-001',
          senderNickname: 'Alice',
          roomId: 'general',
          timestamp: 1743200000000,
          payload: { messageId: 'msg-001', content: 'First' },
        },
        {
          type: 'chat',
          senderId: 'user-001',
          senderNickname: 'Alice',
          roomId: 'general',
          timestamp: 1743200000001,
          payload: { messageId: 'msg-002', content: 'Second' },
        },
      ];

      const clientSocket = new net.Socket();
      await new Promise<void>((resolve, reject) => {
        clientSocket.connect(testPort, testHost, () => {
          resolve();
        });
        clientSocket.on('error', reject);
      });

      messages.forEach((msg) => {
        const encoded = transport.encode(msg);
        clientSocket.write(encoded);
      });

      await messagePromise;
      clientSocket.destroy();
    });

    it('should handle different message types', async () => {
      const messagePromise = new Promise<P2PMessage>((resolve) => {
        server.onMessage((message) => {
          resolve(message);
        });
      });

      await server.start(testPort);

      const joinMessage: P2PMessage = {
        type: 'join',
        senderId: 'user-002',
        senderNickname: 'Bob',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: { ip: '192.168.1.100', port: 9001 },
      };

      const clientSocket = new net.Socket();
      await new Promise<void>((resolve, reject) => {
        clientSocket.connect(testPort, testHost, () => {
          resolve();
        });
        clientSocket.on('error', reject);
      });

      const encoded = transport.encode(joinMessage);
      clientSocket.write(encoded);

      const received = await messagePromise;
      expect(received.type).toBe('join');
      expect((received.payload as any).port).toBe(9001);

      clientSocket.destroy();
    });
  });

  describe('error handling', () => {
    it('should fail to start on already used port', async () => {
      const server1 = new P2PServer(transport);
      await server1.start(testPort);

      const server2 = new P2PServer(transport);
      await expect(server2.start(testPort)).rejects.toThrow();

      await server1.stop();
    });
  });
});
