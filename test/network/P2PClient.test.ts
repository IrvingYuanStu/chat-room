/**
 * Unit tests for P2PClient
 * Tests P2P client functionality for connecting and communicating with peers
 */

import { P2PClient } from '../../src/network/P2PClient';
import { P2PServer } from '../../src/network/P2PServer';
import { P2PTransport } from '../../src/network/P2PTransport';
import { P2PMessage } from '../../src/services/types';
import * as net from 'net';

describe('P2PClient', () => {
  let server: P2PServer;
  let client: P2PClient;
  let transport: P2PTransport;
  const testPort = 19998;
  const testHost = '127.0.0.1';

  beforeEach(() => {
    transport = new P2PTransport();
    server = new P2PServer(transport);
    client = new P2PClient(transport);
  });

  afterEach(async () => {
    client.disconnect();
    await server.stop();
  });

  describe('connect and disconnect', () => {
    it('should connect to server successfully', async () => {
      await server.start(testPort);
      await client.connect(testHost, testPort);

      expect(client.isConnected()).toBe(true);
    });

    it('should disconnect from server', async () => {
      await server.start(testPort);
      await client.connect(testHost, testPort);
      client.disconnect();

      expect(client.isConnected()).toBe(false);
    });

    it('should fail to connect to non-existent server', async () => {
      const nonExistentPort = 19997;
      await expect(client.connect(testHost, nonExistentPort)).rejects.toThrow();
    });

    it('should report connection count after connecting', async () => {
      await server.start(testPort);
      await client.connect(testHost, testPort);

      expect(client.getConnectionCount()).toBe(1);
    });

    it('should report zero connections when disconnected', () => {
      expect(client.getConnectionCount()).toBe(0);
    });
  });

  describe('send', () => {
    it('should send message to connected server', async () => {
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
          content: 'Hello from client',
        },
      };

      await client.connect(testHost, testPort);
      await client.send(testMessage);

      const received = await messagePromise;
      expect(received.type).toBe('chat');
      expect((received.payload as any).content).toBe('Hello from client');
    });

    it('should send join message', async () => {
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
        payload: {
          ip: '192.168.1.100',
          port: 9002,
        },
      };

      await client.connect(testHost, testPort);
      await client.send(joinMessage);

      const received = await messagePromise;
      expect(received.type).toBe('join');
    });

    it('should send ping message', async () => {
      const messagePromise = new Promise<P2PMessage>((resolve) => {
        server.onMessage((message) => {
          resolve(message);
        });
      });

      await server.start(testPort);

      const pingMessage: P2PMessage = {
        type: 'ping',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {},
      };

      await client.connect(testHost, testPort);
      await client.send(pingMessage);

      const received = await messagePromise;
      expect(received.type).toBe('ping');
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to all connected peers', async () => {
      const messages: P2PMessage[] = [];

      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);

      const broadcastMessage: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: 'Broadcast message',
        },
      };

      // Connect two clients
      const client1 = new P2PClient(transport);
      const client2 = new P2PClient(transport);

      await client1.connect(testHost, testPort);
      await client2.connect(testHost, testPort);

      // Client1 broadcasts - server receives it once
      await client1.broadcast(broadcastMessage);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('chat');

      // Cleanup
      client1.disconnect();
      client2.disconnect();
    });

    it('should handle broadcast with no connected peers', async () => {
      await server.start(testPort);

      // Should not throw
      const message: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: { messageId: 'msg-001', content: 'Test' },
      };

      expect(() => client.broadcast(message)).not.toThrow();
    });
  });

  describe('multiple clients', () => {
    it('should handle multiple simultaneous connections', async () => {
      let connectedCount = 0;
      const connectionPromise = new Promise<void>((resolve) => {
        server.onConnection(() => {
          connectedCount++;
          if (connectedCount === 3) {
            resolve();
          }
        });
      });

      await server.start(testPort);

      const clients = [
        new P2PClient(transport),
        new P2PClient(transport),
        new P2PClient(transport),
      ];

      await Promise.all(
        clients.map((c) => c.connect(testHost, testPort))
      );

      await connectionPromise;

      // Cleanup
      clients.forEach((c) => c.disconnect());
    });

    it('should send message to specific peer', async () => {
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
          content: 'Direct message',
        },
      };

      await client.connect(testHost, testPort);
      await client.send(testMessage);

      const received = await messagePromise;
      expect(received.senderId).toBe('user-001');
    });
  });
});
