import { RoomService } from '../../src/services/RoomService';
import { ZKClient } from '../../src/network/ZKClient';
import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';
import { MemberService } from '../../src/services/MemberService';
import { Member, Room, MemberNodeData } from '../../src/services/types';

// Mock ZKClient
jest.mock('../../src/network/ZKClient');

describe('M2.5 RoomService', () => {
  let roomService: RoomService;
  let eventBus: EventBus;
  let memberService: MemberService;
  let mockZKClient: jest.Mocked<ZKClient>;

  const mockUserId = 'user-test-123';
  const mockNickname = 'TestUser';
  const mockIp = '192.168.1.100';
  const mockPort = 9001;

  const createTestMember = (overrides: Partial<Member> = {}): Member => ({
    userId: 'user-1',
    nickname: 'TestMember',
    status: 'online',
    ip: '192.168.1.100',
    port: 9001,
    joinedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    // Reset singletons
    resetEventBus();
    eventBus = getEventBus();
    memberService = new MemberService(eventBus);

    // Create mock ZKClient
    mockZKClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      createMemberNode: jest.fn().mockResolvedValue('/libra-regions/test/members/user-1'),
      deleteMemberNode: jest.fn().mockResolvedValue(undefined),
      getMembers: jest.fn().mockResolvedValue([]),
      listRooms: jest.fn().mockResolvedValue(['room1', 'room2']),
      isConnected: jest.fn().mockReturnValue(true),
      ensureRootNode: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ZKClient>;

    // Create RoomService with dependencies
    roomService = new RoomService(
      mockZKClient,
      memberService,
      eventBus,
      {
        userId: mockUserId,
        nickname: mockNickname,
        ip: mockIp,
        port: mockPort,
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetEventBus();
  });

  describe('M2.5.1 RoomService class structure and methods', () => {
    it('should export RoomService class', () => {
      expect(RoomService).toBeDefined();
      expect(typeof RoomService).toBe('function');
    });

    it('should create RoomService instance', () => {
      const service = new RoomService(
        mockZKClient,
        memberService,
        eventBus,
        { userId: 'u1', nickname: 'N', ip: '1.1.1.1', port: 9001 }
      );
      expect(service).toBeDefined();
    });

    it('should have listRooms method', () => {
      expect(typeof roomService.listRooms).toBe('function');
    });

    it('should have joinRoom method', () => {
      expect(typeof roomService.joinRoom).toBe('function');
    });

    it('should have leaveRoom method', () => {
      expect(typeof roomService.leaveRoom).toBe('function');
    });

    it('should have switchRoom method', () => {
      expect(typeof roomService.switchRoom).toBe('function');
    });

    it('should have getCurrentRoom method', () => {
      expect(typeof roomService.getCurrentRoom).toBe('function');
    });
  });

  describe('M2.5.1 joinRoom() - Join a chat room', () => {
    it('should join a room successfully', async () => {
      await roomService.joinRoom('general');

      expect(mockZKClient.createMemberNode).toHaveBeenCalledWith(
        'general',
        expect.objectContaining({
          userId: mockUserId,
          nickname: mockNickname,
          ip: mockIp,
          port: mockPort,
          status: 'online',
        })
      );
    });

    it('should publish room_joined event', async () => {
      const eventHandler = jest.fn();
      eventBus.subscribe('room_joined', eventHandler);

      await roomService.joinRoom('general');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith({ roomId: 'general' });
    });

    it('should set current room after joining', async () => {
      await roomService.joinRoom('test-room');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom).toBeDefined();
      expect(currentRoom?.roomId).toBe('test-room');
    });

    it('should throw error when ZK createMemberNode fails', async () => {
      mockZKClient.createMemberNode.mockRejectedValueOnce(new Error('ZK Error'));

      await expect(roomService.joinRoom('general')).rejects.toThrow('ZK Error');
    });

    it('should call ZKClient getMembers after joining', async () => {
      const testMembers = [
        createTestMember({ userId: 'user-1', nickname: 'User1' }),
        createTestMember({ userId: 'user-2', nickname: 'User2' }),
      ];
      mockZKClient.getMembers.mockResolvedValueOnce(testMembers);

      await roomService.joinRoom('general');

      expect(mockZKClient.getMembers).toHaveBeenCalledWith('general');
    });

    it('should update memberService with room members', async () => {
      const testMembers = [
        createTestMember({ userId: 'user-1', nickname: 'User1' }),
        createTestMember({ userId: 'user-2', nickname: 'User2' }),
      ];
      mockZKClient.getMembers.mockResolvedValueOnce(testMembers);

      await roomService.joinRoom('general');

      const members = memberService.getMembers();
      expect(members).toHaveLength(2);
    });

    it('should join room with different roomId', async () => {
      await roomService.joinRoom('dev-team');

      expect(mockZKClient.createMemberNode).toHaveBeenCalledWith(
        'dev-team',
        expect.objectContaining({
          userId: mockUserId,
        })
      );

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom?.roomId).toBe('dev-team');
    });
  });

  describe('M2.5.2 leaveRoom() - Leave current chat room', () => {
    it('should leave room successfully when in a room', async () => {
      await roomService.joinRoom('general');
      mockZKClient.deleteMemberNode.mockResolvedValueOnce(undefined);

      await roomService.leaveRoom();

      expect(mockZKClient.deleteMemberNode).toHaveBeenCalledWith('general', mockUserId);
    });

    it('should publish room_left event when leaving', async () => {
      await roomService.joinRoom('general');
      const eventHandler = jest.fn();
      eventBus.subscribe('room_left', eventHandler);

      await roomService.leaveRoom();

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith({ roomId: 'general' });
    });

    it('should clear current room after leaving', async () => {
      await roomService.joinRoom('general');
      await roomService.leaveRoom();

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom).toBeNull();
    });

    it('should throw error when not in a room', async () => {
      await expect(roomService.leaveRoom()).rejects.toThrow('Not in any room');
    });

    it('should throw error when ZK deleteMemberNode fails', async () => {
      await roomService.joinRoom('general');
      mockZKClient.deleteMemberNode.mockRejectedValueOnce(new Error('ZK Error'));

      await expect(roomService.leaveRoom()).rejects.toThrow('ZK Error');
    });

    it('should not throw when deleteMemberNode fails with node not exists', async () => {
      await roomService.joinRoom('general');
      mockZKClient.deleteMemberNode.mockRejectedValueOnce(
        new Error('Node not exists')
      );

      // Should not throw - node might already be deleted
      await expect(roomService.leaveRoom()).resolves.not.toThrow();
    });
  });

  describe('M2.5.3 switchRoom() - Switch to a different chat room', () => {
    it('should switch room successfully', async () => {
      await roomService.joinRoom('room1');

      await roomService.switchRoom('room2');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom?.roomId).toBe('room2');
    });

    it('should leave current room before joining new one', async () => {
      await roomService.joinRoom('room1');
      const deleteSpy = jest.spyOn(mockZKClient, 'deleteMemberNode');
      deleteSpy.mockResolvedValueOnce(undefined);

      await roomService.switchRoom('room2');

      expect(deleteSpy).toHaveBeenCalledWith('room1', mockUserId);
    });

    it('should join new room after leaving', async () => {
      await roomService.joinRoom('room1');
      jest.spyOn(mockZKClient, 'deleteMemberNode').mockResolvedValueOnce(undefined);

      await roomService.switchRoom('room2');

      expect(mockZKClient.createMemberNode).toHaveBeenLastCalledWith(
        'room2',
        expect.objectContaining({
          userId: mockUserId,
        })
      );
    });

    it('should publish room_left then room_joined events', async () => {
      await roomService.joinRoom('room1');
      const roomLeftHandler = jest.fn();
      const roomJoinedHandler = jest.fn();
      eventBus.subscribe('room_left', roomLeftHandler);
      eventBus.subscribe('room_joined', roomJoinedHandler);

      await roomService.switchRoom('room2');

      expect(roomLeftHandler).toHaveBeenCalledWith({ roomId: 'room1' });
      expect(roomJoinedHandler).toHaveBeenCalledWith({ roomId: 'room2' });
    });

    it('should switch room even when not currently in a room', async () => {
      await roomService.switchRoom('new-room');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom?.roomId).toBe('new-room');
    });

    it('should throw error when switchRoom fails during join', async () => {
      await roomService.joinRoom('room1');
      jest.spyOn(mockZKClient, 'deleteMemberNode').mockResolvedValueOnce(undefined);
      mockZKClient.createMemberNode.mockRejectedValueOnce(new Error('Join failed'));

      await expect(roomService.switchRoom('room2')).rejects.toThrow('Join failed');
    });
  });

  describe('getCurrentRoom() - Get current room info', () => {
    it('should return null when not in any room', () => {
      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom).toBeNull();
    });

    it('should return room info when in a room', async () => {
      await roomService.joinRoom('test-room');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom).toBeDefined();
      expect(currentRoom?.roomId).toBe('test-room');
    });

    it('should return Room type with roomId and members', async () => {
      const testMembers = [
        createTestMember({ userId: 'user-1', nickname: 'User1' }),
      ];
      mockZKClient.getMembers.mockResolvedValueOnce(testMembers);

      await roomService.joinRoom('general');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom).toBeDefined();
      expect(currentRoom).toHaveProperty('roomId');
      expect(currentRoom).toHaveProperty('members');
      expect(currentRoom).toHaveProperty('createdAt');
    });

    it('should return null after leaving room', async () => {
      await roomService.joinRoom('test-room');
      await roomService.leaveRoom();

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom).toBeNull();
    });

    it('should track members in current room', async () => {
      const testMembers = [
        createTestMember({ userId: 'user-1', nickname: 'User1' }),
        createTestMember({ userId: 'user-2', nickname: 'User2' }),
      ];
      mockZKClient.getMembers.mockResolvedValueOnce(testMembers);

      await roomService.joinRoom('general');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom?.members).toHaveLength(2);
    });
  });

  describe('listRooms() - Get all available rooms', () => {
    it('should return list of rooms from ZK', async () => {
      const rooms = await roomService.listRooms();
      expect(rooms).toEqual(['room1', 'room2']);
    });

    it('should call ZKClient listRooms', async () => {
      await roomService.listRooms();
      expect(mockZKClient.listRooms).toHaveBeenCalled();
    });

    it('should return empty array when no rooms exist', async () => {
      mockZKClient.listRooms.mockResolvedValueOnce([]);

      const rooms = await roomService.listRooms();
      expect(rooms).toEqual([]);
    });

    it('should throw error when ZK listRooms fails', async () => {
      mockZKClient.listRooms.mockRejectedValueOnce(new Error('ZK Error'));

      await expect(roomService.listRooms()).rejects.toThrow('ZK Error');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle joining room with special characters', async () => {
      await roomService.joinRoom('room-123_test');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom?.roomId).toBe('room-123_test');
    });

    it('should handle multiple rapid join/leave operations', async () => {
      jest.spyOn(mockZKClient, 'deleteMemberNode').mockResolvedValue(undefined);

      await roomService.joinRoom('room1');
      await roomService.leaveRoom();
      await roomService.joinRoom('room2');
      await roomService.leaveRoom();
      await roomService.joinRoom('room3');

      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom?.roomId).toBe('room3');
    });

    it('should handle switchRoom with same roomId', async () => {
      await roomService.joinRoom('room1');

      await roomService.switchRoom('room1');

      // Should remain in same room
      const currentRoom = roomService.getCurrentRoom();
      expect(currentRoom?.roomId).toBe('room1');
    });

    it('should not delete member node twice when switchRoom to same room', async () => {
      await roomService.joinRoom('room1');
      const deleteSpy = jest.spyOn(mockZKClient, 'deleteMemberNode');
      deleteSpy.mockResolvedValue(undefined);

      await roomService.switchRoom('room1');

      // Should not call delete when switching to same room
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should handle leaveRoom when ZK is disconnected', async () => {
      await roomService.joinRoom('general');
      mockZKClient.deleteMemberNode.mockRejectedValueOnce(
        new Error('Not connected to ZooKeeper')
      );

      await expect(roomService.leaveRoom()).rejects.toThrow('Not connected');
    });

    it('should handle concurrent room operations', async () => {
      await roomService.joinRoom('room1');

      // Both operations should work correctly
      const promise1 = roomService.leaveRoom();
      const promise2 = roomService.switchRoom('room2');

      await expect(Promise.all([promise1, promise2])).resolves.not.toThrow();
    });
  });

  describe('Event publishing', () => {
    it('should publish room_joined with correct roomId', async () => {
      const handler = jest.fn();
      eventBus.subscribe('room_joined', handler);

      await roomService.joinRoom('my-room');

      expect(handler).toHaveBeenCalledWith({ roomId: 'my-room' });
    });

    it('should publish room_left with correct roomId', async () => {
      await roomService.joinRoom('my-room');
      const handler = jest.fn();
      eventBus.subscribe('room_left', handler);

      await roomService.leaveRoom();

      expect(handler).toHaveBeenCalledWith({ roomId: 'my-room' });
    });

    it('should publish events in correct order for switchRoom', async () => {
      await roomService.joinRoom('room1');
      const events: string[] = [];

      eventBus.subscribe('room_left', () => events.push('room_left'));
      eventBus.subscribe('room_joined', () => events.push('room_joined'));

      await roomService.switchRoom('room2');

      expect(events).toEqual(['room_left', 'room_joined']);
    });
  });
});
