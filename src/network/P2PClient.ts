/**
 * P2P Client
 * Client for connecting to peers and sending/receiving messages
 */

import * as net from 'net';
import { P2PTransport } from './P2PTransport';
import { P2PMessage } from '../services/types';

export class P2PClient {
  private transport: P2PTransport;
  private connections: net.Socket[] = [];
  private connected: boolean = false;

  constructor(transport: P2PTransport) {
    this.transport = transport;
  }

  /**
   * Connect to a peer at the specified address
   * @param ip IP address of the peer
   * @param port Port number of the peer
   */
  async connect(ip: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: ip, port }, () => {
        this.connections.push(socket);
        this.connected = true;
        resolve();
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.on('close', () => {
        const index = this.connections.indexOf(socket);
        if (index !== -1) {
          this.connections.splice(index, 1);
        }
        this.connected = this.connections.length > 0;
      });
    });
  }

  /**
   * Disconnect from all connected peers
   */
  disconnect(): void {
    this.connections.forEach((socket) => {
      socket.destroy();
    });
    this.connections = [];
    this.connected = false;
  }

  /**
   * Send a message to a specific peer
   * @param message The P2P message to send
   */
  async send(message: P2PMessage): Promise<void> {
    if (this.connections.length === 0) {
      throw new Error('No active connections');
    }

    const encoded = this.transport.encode(message);

    return new Promise((resolve, reject) => {
      const socket = this.connections[0];
      const success = socket.write(encoded, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      if (!success) {
        reject(new Error('Write failed'));
      }
    });
  }

  /**
   * Broadcast a message to all connected peers
   * @param message The P2P message to broadcast
   */
  broadcast(message: P2PMessage): void {
    const encoded = this.transport.encode(message);

    this.connections.forEach((socket) => {
      socket.write(encoded);
    });
  }

  /**
   * Get the number of active connections
   * @returns Number of connected peers
   */
  getConnectionCount(): number {
    return this.connections.length;
  }

  /**
   * Check if the client is connected to any peers
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected;
  }
}
