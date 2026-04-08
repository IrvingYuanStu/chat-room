/**
 * Peer Service
 * Manages all P2P connections and message broadcasting
 */

import { P2PClient } from '../network/P2PClient';
import { P2PTransport } from '../network/P2PTransport';
import { P2PMessage } from './types';

export interface PeerInfo {
  ip: string;
  port: number;
  client: P2PClient;
}

export type PeerConnectedCallback = (peer: PeerInfo) => void;
export type PeerDisconnectedCallback = (peer: PeerInfo) => void;
export type MessageCallback = (message: P2PMessage) => void;

export class PeerService {
  private transport: P2PTransport;
  private serverIp: string;
  private serverPort: number;
  private clients: Map<string, P2PClient> = new Map(); // key: "ip:port"
  private peerConnectedCallbacks: PeerConnectedCallback[] = [];
  private peerDisconnectedCallbacks: PeerDisconnectedCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];

  constructor(transport: P2PTransport, serverIp: string, serverPort: number) {
    this.transport = transport;
    this.serverIp = serverIp;
    this.serverPort = serverPort;
  }

  /**
   * Generate a unique key for a peer
   */
  private getPeerKey(ip: string, port: number): string {
    return `${ip}:${port}`;
  }

  /**
   * Connect to a peer
   * @param ip IP address of the peer
   * @param port Port number of the peer
   */
  async connectToPeer(ip: string, port: number): Promise<void> {
    const key = this.getPeerKey(ip, port);
    const client = new P2PClient(this.transport);

    await client.connect(ip, port);
    this.clients.set(key, client);

    // Notify listeners
    this.peerConnectedCallbacks.forEach((cb) => cb({ ip, port, client }));
  }

  /**
   * Disconnect from a specific peer
   * @param ip IP address of the peer
   * @param port Port number of the peer
   */
  disconnectFromPeer(ip: string, port: number): void {
    const key = this.getPeerKey(ip, port);
    const client = this.clients.get(key);

    if (client) {
      client.disconnect();
      this.clients.delete(key);

      // Notify listeners
      this.peerDisconnectedCallbacks.forEach((cb) => cb({ ip, port, client }));
    }
  }

  /**
   * Disconnect from all peers
   */
  disconnectAll(): void {
    this.clients.forEach((client) => {
      client.disconnect();
    });
    this.clients.clear();
  }

  /**
   * Broadcast a message to all connected peers
   * @param message The message to broadcast
   */
  broadcast(message: P2PMessage): void {
    if (this.clients.size === 0) {
      return;
    }

    this.clients.forEach((client) => {
      try {
        client.broadcast(message);
      } catch (error) {
        // Log error but continue broadcasting to other peers
        console.error(`Failed to broadcast to peer: ${error}`);
      }
    });
  }

  /**
   * Send a message to a specific peer
   * @param ip IP address of the peer
   * @param port Port number of the peer
   * @param message The message to send
   */
  sendToPeer(ip: string, port: number, message: P2PMessage): void {
    const key = this.getPeerKey(ip, port);
    const client = this.clients.get(key);

    if (!client) {
      throw new Error(`Peer ${ip}:${port} not found`);
    }

    client.send(message);
  }

  /**
   * Get list of all connected peers
   * @returns Array of peer info
   */
  getPeers(): PeerInfo[] {
    const peers: PeerInfo[] = [];

    this.clients.forEach((client, key) => {
      const [ip, portStr] = key.split(':');
      const port = parseInt(portStr, 10);

      peers.push({
        ip,
        port,
        client,
      });
    });

    return peers;
  }

  /**
   * Get the number of connected peers
   * @returns Number of peers
   */
  getPeerCount(): number {
    return this.clients.size;
  }

  /**
   * Check if connected to any peers
   * @returns true if connected to at least one peer
   */
  isConnected(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Get the server address
   * @returns Server address in "ip:port" format
   */
  getServerAddress(): string {
    return `${this.serverIp}:${this.serverPort}`;
  }

  /**
   * Register callback for peer connection events
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  onPeerConnected(callback: PeerConnectedCallback): void {
    this.peerConnectedCallbacks.push(callback);
  }

  /**
   * Register callback for peer disconnection events
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  onPeerDisconnected(callback: PeerDisconnectedCallback): void {
    this.peerDisconnectedCallbacks.push(callback);
  }

  /**
   * Register callback for received messages
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Remove a peer connected callback
   * @param callback Callback function to remove
   */
  removePeerConnectedCallback(callback: PeerConnectedCallback): void {
    const index = this.peerConnectedCallbacks.indexOf(callback);
    if (index !== -1) {
      this.peerConnectedCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove a peer disconnected callback
   * @param callback Callback function to remove
   */
  removePeerDisconnectedCallback(callback: PeerDisconnectedCallback): void {
    const index = this.peerDisconnectedCallbacks.indexOf(callback);
    if (index !== -1) {
      this.peerDisconnectedCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove a message callback
   * @param callback Callback function to remove
   */
  removeMessageCallback(callback: MessageCallback): void {
    const index = this.messageCallbacks.indexOf(callback);
    if (index !== -1) {
      this.messageCallbacks.splice(index, 1);
    }
  }
}
