/**
 * P2P Server
 * TCP server for handling incoming peer connections and messages
 */

import * as net from 'net';
import { P2PTransport } from './P2PTransport';
import { P2PMessage } from '../services/types';

export class P2PServer {
  private server: net.Server | null = null;
  private transport: P2PTransport;
  private messageHandlers: Array<(message: P2PMessage, socket: net.Socket) => void> = [];
  private connectionHandlers: Array<(socket: net.Socket) => void> = [];

  constructor(transport: P2PTransport) {
    this.transport = transport;
  }

  /**
   * Start the TCP server on the specified port
   * @param port Port number to listen on
   */
  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(port, () => {
        resolve();
      });
    });
  }

  /**
   * Stop the TCP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Register a handler for incoming messages
   * @param callback Function to call when message is received
   * @returns Unsubscribe function
   */
  onMessage(callback: (message: P2PMessage, socket: net.Socket) => void): () => void {
    this.messageHandlers.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(callback);
      if (index !== -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Clear all message handlers
   */
  clearMessageHandlers(): void {
    this.messageHandlers = [];
  }

  /**
   * Register a handler for new connections
   * @param callback Function to call when a new peer connects
   * @returns Unsubscribe function
   */
  onConnection(callback: (socket: net.Socket) => void): () => void {
    this.connectionHandlers.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.connectionHandlers.indexOf(callback);
      if (index !== -1) {
        this.connectionHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Handle a new peer connection
   * @param socket The connected socket
   */
  private handleConnection(socket: net.Socket): void {
    // Notify connection handlers
    this.connectionHandlers.forEach((handler) => handler(socket));

    let buffer = Buffer.alloc(0);

    socket.on('data', (data: Buffer) => {
      // Accumulate data
      buffer = Buffer.concat([buffer, data]);

      // Process complete messages
      while (buffer.length >= 6) {
        // Read length from header (bytes 2-5)
        const payloadLength = buffer.readUInt32BE(2);
        const totalMessageLength = 6 + payloadLength;

        // Check if we have a complete message
        if (buffer.length < totalMessageLength) {
          break;
        }

        // Extract and decode message
        const messageBuffer = buffer.slice(0, totalMessageLength);
        try {
          const message = this.transport.decode(messageBuffer);

          // Notify message handlers
          this.messageHandlers.forEach((handler) => handler(message, socket));
        } catch (err) {
          console.error('Failed to decode message:', err);
        }

        // Remove processed message from buffer
        buffer = buffer.slice(totalMessageLength);
      }
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });

    socket.on('close', () => {
      // Socket closed
    });
  }
}
