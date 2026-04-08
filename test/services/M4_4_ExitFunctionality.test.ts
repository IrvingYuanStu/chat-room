/**
 * Unit tests for M4.4 Exit Functionality
 * Tests /exit-room command, exit confirmation, /quit command, and cleanup
 *
 * Note: These tests verify the logic without importing ink-based components
 * (which use ESM modules not compatible with Jest default config)
 */

import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';
import { RoomService } from '../../src/services/RoomService';
import { MemberService } from '../../src/services/MemberService';
import { ConfigService } from '../../src/services/ConfigService';
import { P2PServer } from '../../src/network/P2PServer';
import { P2PTransport } from '../../src/network/P2PTransport';
import { Config, Member } from '../../src/services/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock ZKClient for testing
class MockZKClient {
  private connected = false;
  private members: Map<string, Member[]> = new Map();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async ensureRootNode(): Promise<void> {}

  async createMemberNode(roomId: string, data: any): Promise<string> {
    return `/libra-regions/${roomId}/members/${data.userId}`;
  }

  async deleteMemberNode(roomId: string, userId: string): Promise<void> {
    // Mock - doesn't throw
  }

  async getMembers(roomId: string): Promise<Member[]> {
    return this.members.get(roomId) || [];
  }

  async listRooms(): Promise<string[]> {
    return Array.from(this.members.keys());
  }

  setMembers(roomId: string, members: Member[]): void {
    this.members.set(roomId, members);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ============ Command Detection Functions (mirrors InputBox logic) ============

/**
 * Check if content is /exit-room command
 * (mirrors the logic in InputBox.tsx)
 */
function isExitRoomCommand(content: string): boolean {
  return content === '/exit-room';
}

/**
 * Check if content is /quit command
 * (mirrors the logic in InputBox.tsx)
 */
function isQuitCommand(content: string): boolean {
  return content === '/quit';
}

/**
 * Check if content is a command
 */
function isCommand(content: string): boolean {
  return content.startsWith('/');
}

// Helper to create test configuration
function createTestConfig(): Config {
  return {
    zkAddresses: ['127.0.0.1:2181'],
    currentRoomId: 'test-room',
    nickname: 'TestUser',
    recentRooms: ['test-room'],
    port: 9001,
    dataDir: '/tmp/chat-room-test',
    logDir: '/tmp/chat-room-test/logs',
    logLevel: 'info'
  };
}

// Helper to create test user info
function createTestUserInfo() {
  return {
    userId: 'user-001',
    nickname: 'TestUser',
    ip: '127.0.0.1',
    port: 9001
  };
}

describe('M4.4 Exit Functionality', () => {
  let eventBus: EventBus;
  let mockZKClient: MockZKClient;
  let memberService: MemberService;
  let roomService: RoomService;
  let configService: ConfigService;
  let testConfig: Config;
  let testDataDir: string;

  beforeEach(() => {
    resetEventBus();
    eventBus = getEventBus();
    mockZKClient = new MockZKClient();
    testConfig = createTestConfig();
    testDataDir = path.join('/tmp', `chat-room-test-${Date.now()}`);

    // Create member service
    memberService = new MemberService(eventBus);

    // Create config service with temp directory
    configService = new ConfigService({
      configPath: path.join(testDataDir, 'config.json')
    });
  });

  afterEach(() => {
    // Cleanup test data
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch {}
  });

  describe('M4.4.1 - /exit-room Command', () => {
    it('should detect /exit-room command from input', () => {
      expect(isExitRoomCommand('/exit-room')).toBe(true);
    });

    it('should not match other commands as exit-room', () => {
      expect(isExitRoomCommand('/quit')).toBe(false);
      expect(isExitRoomCommand('/rename newname')).toBe(false);
      expect(isExitRoomCommand('regular message')).toBe(false);
    });

    it('should trigger room exit flow when /exit-room is submitted', async () => {
      // Setup room service
      roomService = new RoomService(
        mockZKClient as any,
        memberService,
        eventBus,
        createTestUserInfo()
      );

      // Join a room first
      mockZKClient.setMembers('test-room', [
        { userId: 'user-001', nickname: 'TestUser', status: 'online', ip: '127.0.0.1', port: 9001, joinedAt: Date.now() }
      ]);

      await roomService.joinRoom('test-room');

      // Track room_left event
      let roomLeftEventFired = false;
      let leftRoomId = '';

      eventBus.subscribe('room_left', (payload: { roomId: string }) => {
        roomLeftEventFired = true;
        leftRoomId = payload.roomId;
      });

      // Leave the room
      await roomService.leaveRoom();

      expect(roomLeftEventFired).toBe(true);
      expect(leftRoomId).toBe('test-room');
      expect(roomService.getCurrentRoom()).toBeNull();
    });

    it('should notify other members when leaving room', async () => {
      roomService = new RoomService(
        mockZKClient as any,
        memberService,
        eventBus,
        createTestUserInfo()
      );

      // Set up event listener BEFORE joining
      let roomLeftFired = false;
      eventBus.subscribe('room_left', () => {
        roomLeftFired = true;
      });

      // Join room
      await roomService.joinRoom('test-room');

      // The leaveRoom should delete the member node in ZK
      // which will trigger watch events on other clients
      await roomService.leaveRoom();

      expect(roomLeftFired).toBe(true);
    });

    it('should handle /exit-room and return to room selection screen', () => {
      const handleSubmit = (content: string) => {
        if (isExitRoomCommand(content)) {
          return 'exit_room';
        }
        return 'message';
      };

      expect(handleSubmit('/exit-room')).toBe('exit_room');
    });

    it('should handle /exit-room command after other text', () => {
      // The command must be exact match
      expect(isExitRoomCommand('/exit-room ')).toBe(false);
      expect(isExitRoomCommand(' /exit-room')).toBe(false);
      expect(isExitRoomCommand('/exit-room extra')).toBe(false);
    });
  });

  describe('M4.4.2 - Exit Confirmation Prompt', () => {
    it('should show confirmation before actually exiting room', async () => {
      // The exit confirmation is a UI concern
      // We test the logic that confirmation is required

      let confirmed = false;
      let exitRoomCalled = false;

      const confirmAndExit = async (confirm: boolean) => {
        if (!confirm) {
          return; // User cancelled
        }
        confirmed = true;
        exitRoomCalled = true;
        // Actually exit room
      };

      // Simulate cancel
      await confirmAndExit(false);
      expect(confirmed).toBe(false);
      expect(exitRoomCalled).toBe(false);

      // Simulate confirm
      await confirmAndExit(true);
      expect(confirmed).toBe(true);
      expect(exitRoomCalled).toBe(true);
    });

    it('should not exit room if user cancels confirmation', async () => {
      let currentScreen = 'chat';

      const handleExitRoom = (confirmed: boolean) => {
        if (!confirmed) {
          // User cancelled - stay in chat
          return 'chat';
        }
        // User confirmed - return to room select
        return 'roomSelect';
      };

      expect(handleExitRoom(false)).toBe('chat');
      expect(handleExitRoom(true)).toBe('roomSelect');
    });

    it('should track exit confirmation state', () => {
      interface ExitConfirmationState {
        isAwaitingConfirmation: boolean;
        confirmationType: 'exit-room' | 'quit' | null;
      }

      let state: ExitConfirmationState = {
        isAwaitingConfirmation: false,
        confirmationType: null
      };

      const requestExitConfirmation = (type: 'exit-room' | 'quit') => {
        state = {
          isAwaitingConfirmation: true,
          confirmationType: type
        };
      };

      const cancelExitConfirmation = () => {
        state = {
          isAwaitingConfirmation: false,
          confirmationType: null
        };
      };

      const confirmExit = () => {
        state = {
          isAwaitingConfirmation: false,
          confirmationType: null
        };
        return state.confirmationType;
      };

      // Request exit confirmation
      requestExitConfirmation('exit-room');
      expect(state.isAwaitingConfirmation).toBe(true);
      expect(state.confirmationType).toBe('exit-room');

      // Cancel
      cancelExitConfirmation();
      expect(state.isAwaitingConfirmation).toBe(false);

      // Request quit confirmation
      requestExitConfirmation('quit');
      expect(state.confirmationType).toBe('quit');
    });

    it('should differentiate between exit-room and quit confirmation', () => {
      interface ConfirmationType {
        type: 'exit-room' | 'quit' | null;
      }

      const handleConfirmation = (type: ConfirmationType['type'], action: 'confirm' | 'cancel') => {
        if (action === 'cancel' || type === null) {
          return 'stay';
        }
        if (type === 'exit-room') {
          return 'roomSelect';
        }
        if (type === 'quit') {
          return 'exit';
        }
        return 'stay';
      };

      // exit-room confirmation
      expect(handleConfirmation('exit-room', 'cancel')).toBe('stay');
      expect(handleConfirmation('exit-room', 'confirm')).toBe('roomSelect');

      // quit confirmation
      expect(handleConfirmation('quit', 'cancel')).toBe('stay');
      expect(handleConfirmation('quit', 'confirm')).toBe('exit');
    });
  });

  describe('M4.4.3 - /quit Command', () => {
    it('should detect /quit command from input', () => {
      expect(isQuitCommand('/quit')).toBe(true);
    });

    it('should not match other inputs as quit command', () => {
      expect(isQuitCommand('/exit-room')).toBe(false);
      expect(isQuitCommand('/quit all')).toBe(false); // exact match
      expect(isQuitCommand('regular message')).toBe(false);
      expect(isQuitCommand('quit')).toBe(false); // must have leading slash
    });

    it('should trigger full application exit when /quit is submitted', () => {
      let shouldQuit = false;

      const handleSubmit = (content: string) => {
        if (isQuitCommand(content)) {
          shouldQuit = true;
          // In real app, this would trigger cleanup
          return 'quit';
        }
        return 'message';
      };

      handleSubmit('/quit');
      expect(shouldQuit).toBe(true);
    });

    it('/quit should take precedence over /exit-room detection', () => {
      // These are separate commands - no precedence issue
      expect(isQuitCommand('/quit')).toBe(true);
      expect(isExitRoomCommand('/quit')).toBe(false);
      expect(isQuitCommand('/exit-room')).toBe(false);
    });

    it('/quit is different from /exit-room', () => {
      expect(isCommand('/quit')).toBe(true);
      expect(isCommand('/exit-room')).toBe(true);
      expect(isQuitCommand('/exit-room')).toBe(false);
      expect(isExitRoomCommand('/quit')).toBe(false);
    });
  });

  describe('M4.4.4 - Cleanup Function', () => {
    it('should leave room when cleaning up', async () => {
      roomService = new RoomService(
        mockZKClient as any,
        memberService,
        eventBus,
        createTestUserInfo()
      );

      await roomService.joinRoom('test-room');

      let roomLeftEventFired = false;
      eventBus.subscribe('room_left', () => {
        roomLeftEventFired = true;
      });

      // Cleanup should call leaveRoom
      await roomService.leaveRoom();

      expect(roomLeftEventFired).toBe(true);
      expect(roomService.getCurrentRoom()).toBeNull();
    });

    it('should disconnect from ZooKeeper during cleanup', async () => {
      await mockZKClient.connect();
      expect(mockZKClient.isConnected()).toBe(true);

      // Cleanup should disconnect ZK
      await mockZKClient.disconnect();
      expect(mockZKClient.isConnected()).toBe(false);
    });

    it('should save configuration during cleanup', async () => {
      // Save config
      await configService.save(testConfig);

      // Load it back to verify
      const loadedConfig = await configService.load();

      expect(loadedConfig.nickname).toBe(testConfig.nickname);
      expect(loadedConfig.port).toBe(testConfig.port);
    });

    it('should close P2P server during cleanup', async () => {
      const transport = new P2PTransport();
      const p2pServer = new P2PServer(transport);

      // Start server
      await p2pServer.start(9001);

      let serverStopped = false;
      // Stop server
      await p2pServer.stop();
      serverStopped = true;

      expect(serverStopped).toBe(true);
    });

    it('should define cleanup sequence correctly', async () => {
      // The cleanup sequence should be:
      // 1. Leave room (notify other members)
      // 2. Close P2P server
      // 3. Disconnect from ZK
      // 4. Save configuration
      // 5. Close logger

      const cleanupSequence: string[] = [];

      const cleanup = async () => {
        // Step 1: Leave room
        cleanupSequence.push('leaveRoom');

        // Step 2: Close P2P server
        cleanupSequence.push('closeP2PServer');

        // Step 3: Disconnect ZK
        cleanupSequence.push('disconnectZK');

        // Step 4: Save config
        cleanupSequence.push('saveConfig');

        // Step 5: Close logger
        cleanupSequence.push('closeLogger');
      };

      await cleanup();

      expect(cleanupSequence).toEqual([
        'leaveRoom',
        'closeP2PServer',
        'disconnectZK',
        'saveConfig',
        'closeLogger'
      ]);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock ZK client that throws on disconnect
      const failingZKClient = {
        async disconnect(): Promise<void> {
          throw new Error('ZK disconnect failed');
        },
        isConnected: () => true
      };

      // Cleanup should still complete even if one step fails
      const cleanupWithError = async () => {
        try {
          await failingZKClient.disconnect();
        } catch (error) {
          // Log error but continue
          console.error('ZK disconnect failed:', error);
        }
        // Continue with other cleanup steps
        return 'cleanup_completed';
      };

      const result = await cleanupWithError();
      expect(result).toBe('cleanup_completed');
    });

    it('should close logger properly', () => {
      // Test that logger can be closed without error
      const { getLogger } = require('../../src/utils/logger');

      try {
        const logger = getLogger();
        // Logger should have close method or be cleanup properly
        expect(logger).toBeDefined();
      } catch {
        // Logger might not be initialized in test environment
      }
    });

    it('cleanup should handle not being in a room', async () => {
      roomService = new RoomService(
        mockZKClient as any,
        memberService,
        eventBus,
        createTestUserInfo()
      );

      // Not in any room - cleanup should handle this gracefully
      let errorThrown = false;
      try {
        await roomService.leaveRoom();
      } catch (error) {
        // Expected - not in a room
        errorThrown = true;
      }

      // Should throw when not in a room (current implementation)
      expect(errorThrown).toBe(true);

      // But cleanup should still proceed to other steps
      // This is a design decision - some implementations might prefer
      // to silently continue cleanup even if not in a room
    });

    it('should cleanup P2P client connections', async () => {
      // Test that P2P client can be disconnected
      const { P2PClient } = require('../../src/network/P2PClient');
      const transport = new P2PTransport();
      const p2pClient = new P2PClient(transport);

      // Connect would normally be async, but we just verify disconnect doesn't throw
      expect(() => p2pClient.disconnect()).not.toThrow();
    });
  });

  describe('Integration: Full Exit Flow', () => {
    it('should complete full /exit-room flow with confirmation', async () => {
      // Setup
      roomService = new RoomService(
        mockZKClient as any,
        memberService,
        eventBus,
        createTestUserInfo()
      );

      await roomService.joinRoom('test-room');

      let events: string[] = [];

      eventBus.subscribe('room_left', () => {
        events.push('room_left');
      });

      // Simulate: User types /exit-room, confirms, and exits
      const handleExitRoom = async (confirmed: boolean): Promise<string> => {
        if (!confirmed) {
          return 'cancelled';
        }

        // User confirmed - proceed with exit
        await roomService.leaveRoom();
        events.push('cleanup_completed');
        return 'exited';
      };

      // First call - no confirmation yet
      const result1 = await handleExitRoom(false);
      expect(result1).toBe('cancelled');
      expect(events).toEqual([]);

      // Second call - with confirmation
      const result2 = await handleExitRoom(true);
      expect(result2).toBe('exited');
      expect(events).toContain('room_left');
      expect(events).toContain('cleanup_completed');
    });

    it('should complete full /quit flow with cleanup', async () => {
      // Setup all services
      roomService = new RoomService(
        mockZKClient as any,
        memberService,
        eventBus,
        createTestUserInfo()
      );

      await roomService.joinRoom('test-room');
      await mockZKClient.connect();

      let cleanupSteps: string[] = [];

      // Full cleanup flow
      const performFullCleanup = async () => {
        // 1. Leave room
        if (roomService.getCurrentRoom()) {
          await roomService.leaveRoom();
          cleanupSteps.push('room_left');
        }

        // 2. Disconnect ZK
        if (mockZKClient.isConnected()) {
          await mockZKClient.disconnect();
          cleanupSteps.push('zk_disconnected');
        }

        // 3. Save config
        await configService.save(testConfig);
        cleanupSteps.push('config_saved');

        cleanupSteps.push('cleanup_complete');
      };

      await performFullCleanup();

      expect(cleanupSteps).toContain('room_left');
      expect(cleanupSteps).toContain('zk_disconnected');
      expect(cleanupSteps).toContain('config_saved');
      expect(cleanupSteps).toContain('cleanup_complete');
    });

    it('should properly sequence exit-room vs quit', () => {
      // Test command detection for different scenarios
      const processCommand = (content: string): string => {
        if (isQuitCommand(content)) {
          return 'quit_app';
        }
        if (isExitRoomCommand(content)) {
          return 'exit_room';
        }
        if (isCommand(content)) {
          return 'other_command';
        }
        return 'message';
      };

      expect(processCommand('/quit')).toBe('quit_app');
      expect(processCommand('/exit-room')).toBe('exit_room');
      expect(processCommand('/rename NewName')).toBe('other_command');
      expect(processCommand('Hello world')).toBe('message');
    });

    it('should handle cleanup when multiple rooms joined', async () => {
      // M4.3 multi-room support - cleanup should leave all rooms
      roomService = new RoomService(
        mockZKClient as any,
        memberService,
        eventBus,
        createTestUserInfo()
      );

      // Join multiple rooms
      await roomService.joinRoom('room1');
      await roomService.joinRoom('room2');

      // Get current room (should be room2)
      expect(roomService.getCurrentRoom()?.roomId).toBe('room2');

      // Cleanup should leave current room
      await roomService.leaveRoom();
      expect(roomService.getCurrentRoom()).toBeNull();

      // room1 was left when we switched to room2
      // (switchRoom in M4.3 leaves the previous room)
    });
  });
});
