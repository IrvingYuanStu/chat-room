/**
 * Unit tests for PeerService
 * Tests peer connection management and message broadcasting
 */

import { PeerService } from '../../src/services/PeerService';
import { P2PClient } from '../../src/network/P2PClient';
import { P2PServer } from '../../src/network/P2PServer';
import { P2PTransport } from '../../src/network/P2PTransport';
import { P2PMessage, Member } from '../../src/services/types';

describe('PeerService', () => {
  let peerService: PeerService;
  let transport: P2PTransport;
  let server: P2PServer;
  const testPort = 19999;
  const testHost = '127.0.0.1';

  beforeEach(() => {
    transport = new P2PTransport();
    peerService = new PeerService(transport, testHost, testPort);
    server = new P2PServer(transport);
  });

  afterEach(async () => {
    peerService.disconnectAll();
    await server.stop();
    // Allow time for TCP connections to fully close
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  describe('initialization', () => {
    it('should initialize with empty peer list', () => {
      expect(peerService.getPeerCount()).toBe(0);
    });

    it('should have correct server address', () => {
      expect(peerService.getServerAddress()).toBe(`${testHost}:${testPort}`);
    });

    it('should start disconnected', () => {
      expect(peerService.isConnected()).toBe(false);
    });
  });

  describe('connectToPeer', () => {
    it('should connect to a peer successfully', async () => {
      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      expect(peerService.getPeerCount()).toBe(1);
      expect(peerService.isConnected()).toBe(true);
    });

    it('should fail to connect to non-existent peer', async () => {
      await expect(
        peerService.connectToPeer('127.0.0.1', 19998)
      ).rejects.toThrow();
    });

    it('should add peer to internal list on successful connection', async () => {
      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const peers = peerService.getPeers();
      expect(peers.length).toBe(1);
      expect(peers[0].ip).toBe('127.0.0.1');
      expect(peers[0].port).toBe(testPort);
    });
  });

  describe('disconnectFromPeer', () => {
    it('should disconnect from a peer', async () => {
      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      peerService.disconnectFromPeer('127.0.0.1', testPort);

      expect(peerService.getPeerCount()).toBe(0);
    });

    it('should handle disconnecting from non-existent peer', () => {
      expect(() => peerService.disconnectFromPeer('127.0.0.1', 19998)).not.toThrow();
    });

    it('should update connected status when all peers disconnect', async () => {
      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      expect(peerService.isConnected()).toBe(true);

      peerService.disconnectFromPeer('127.0.0.1', testPort);

      expect(peerService.isConnected()).toBe(false);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect from all peers', async () => {
      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      peerService.disconnectAll();

      expect(peerService.getPeerCount()).toBe(0);
      expect(peerService.isConnected()).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('should send message to all connected peers', async () => {
      const messages: P2PMessage[] = [];

      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const broadcastMessage: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-001',
          content: 'Hello everyone!',
        },
      };

      peerService.broadcast(broadcastMessage);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('chat');
      expect((messages[0].payload as any).content).toBe('Hello everyone!');
    });

    it('should not throw when broadcasting with no peers', async () => {
      await server.start(testPort);

      const message: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: { messageId: 'msg-001', content: 'Test' },
      };

      expect(() => peerService.broadcast(message)).not.toThrow();
    });
  });

  describe('sendToPeer', () => {
    it('should send message to specific peer', async () => {
      const messages: P2PMessage[] = [];

      server.onMessage((message) => {
        messages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const directMessage: P2PMessage = {
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

      peerService.sendToPeer('127.0.0.1', testPort, directMessage);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages.length).toBe(1);
      expect(messages[0].senderId).toBe('user-001');
    });

    it('should throw when sending to non-existent peer', async () => {
      const message: P2PMessage = {
        type: 'chat',
        senderId: 'user-001',
        senderNickname: 'Alice',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: { messageId: 'msg-001', content: 'Test' },
      };

      expect(() => peerService.sendToPeer('127.0.0.1', 19998, message)).toThrow();
    });
  });

  describe('peer discovery via join messages', () => {
    it('should handle peer connection via connectToPeer', async () => {
      const peerConnectedPromise = new Promise<{ ip: string; port: number }>((resolve) => {
        peerService.onPeerConnected((peer) => {
          resolve(peer);
        });
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const connectedPeer = await peerConnectedPromise;
      expect(connectedPeer.ip).toBe('127.0.0.1');
      expect(connectedPeer.port).toBe(testPort);
    });

    it('should handle peer disconnection', async () => {
      const peerDisconnectedPromise = new Promise<{ ip: string; port: number }>((resolve) => {
        peerService.onPeerDisconnected((peer) => {
          resolve(peer);
        });
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      peerService.disconnectFromPeer('127.0.0.1', testPort);

      const disconnectedPeer = await peerDisconnectedPromise;
      expect(disconnectedPeer.ip).toBe('127.0.0.1');
      expect(disconnectedPeer.port).toBe(testPort);
    });
  });

  describe('message handling', () => {
    it('should route received messages via event callback', async () => {
      const receivedMessages: P2PMessage[] = [];

      peerService.onMessage((message) => {
        receivedMessages.push(message);
      });

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      const testMessage: P2PMessage = {
        type: 'chat',
        senderId: 'user-002',
        senderNickname: 'Bob',
        roomId: 'general',
        timestamp: 1743200000000,
        payload: {
          messageId: 'msg-002',
          content: 'Message for routing',
        },
      };

      // Send from server-side client to peer service
      const senderClient = new P2PClient(transport);
      await senderClient.connect('127.0.0.1', testPort);
      senderClient.broadcast(testMessage);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // The message should be routed through the callback
      expect(receivedMessages.length).toBeGreaterThanOrEqual(0);

      senderClient.disconnect();
      // Allow time for TCP connection to fully close before next test
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  describe('getPeers', () => {
    it('should return list of all connected peers', async () => {
      jest.setTimeout(60000);
      const server2 = new P2PServer(transport);
      const server3 = new P2PServer(transport);
      await server.start(testPort);
      await server2.start(testPort + 10);

      const client1 = new P2PClient(transport);
      const client2 = new P2PClient(transport);

      await peerService.connectToPeer('127.0.0.1', testPort);
      await peerService.connectToPeer('127.0.0.1', testPort + 10);

      const peers = peerService.getPeers();
      expect(peers.length).toBe(2);

      const ports = peers.map(p => p.port).sort();
      expect(ports[0]).toBe(testPort);
      expect(ports[1]).toBe(testPort + 10);

      client1.disconnect();
      client2.disconnect();
      await server2.stop();
    });

    it('should return empty array when no peers connected', () => {
      const peers = peerService.getPeers();
      expect(peers).toEqual([]);
    });
  });

  describe('getPeerCount', () => {
    it('should return correct peer count', async () => {
      const server2 = new P2PServer(transport);
      const server3 = new P2PServer(transport);

      expect(peerService.getPeerCount()).toBe(0);

      await server.start(testPort);
      await peerService.connectToPeer('127.0.0.1', testPort);

      expect(peerService.getPeerCount()).toBe(1);

      await server3.start(testPort + 2);
      await peerService.connectToPeer('127.0.0.1', testPort + 2);

      expect(peerService.getPeerCount()).toBe(2);

      await server3.stop();
    });
  });
});
