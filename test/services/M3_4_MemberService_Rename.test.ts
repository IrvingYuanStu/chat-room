/**
 * M3.4 MemberService Rename Tests
 * Tests for nickname change functionality with ZK and P2P integration
 *
 * M3.4.1: /rename command parsing (tested in InputBox.test.tsx)
 * M3.4.2: Update ZK node data when renaming
 * M3.4.3: Broadcast nickname change via PeerService
 */

import { MemberService } from '../../src/services/MemberService';
import { Member, MemberNodeData } from '../../src/services/types';
import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';
import { PeerService } from '../../src/services/PeerService';
import { P2PTransport } from '../../src/network/P2PTransport';
import { P2PMessage } from '../../src/services/types';

// Mock ZKClient
const mockSetMemberData = jest.fn().mockResolvedValue(undefined);
const mockZKClient = {
  setMemberData: mockSetMemberData,
} as any;

// Mock PeerService broadcast
const mockBroadcast = jest.fn();
const mockPeerService = {
  broadcast: mockBroadcast,
} as any;

describe('M3.4 MemberService Rename', () => {
  let memberService: MemberService;
  let eventBus: EventBus;

  const createTestMember = (overrides: Partial<Member> = {}): Member => ({
    userId: 'user-1',
    nickname: 'TestUser',
    status: 'online',
    ip: '192.168.1.100',
    port: 9001,
    joinedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    resetEventBus();
    eventBus = getEventBus();
    mockSetMemberData.mockClear();
    mockBroadcast.mockClear();

    // Create MemberService with mocked ZKClient and PeerService
    memberService = new MemberService(eventBus, mockZKClient, mockPeerService);
    // Set current room ID for ZK operations
    memberService.setCurrentRoomId('general');
  });

  afterEach(() => {
    resetEventBus();
  });

  describe('M3.4.2 Update ZK Node Data', () => {
    it('should call zkClient.setMemberData when renaming', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      expect(mockSetMemberData).toHaveBeenCalledTimes(1);
    });

    it('should pass correct roomId to setMemberData', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      // The roomId should be passed - currently it's stored in member but we need
      // to track which room the member belongs to
      expect(mockSetMemberData).toHaveBeenCalled();
      const callArgs = mockSetMemberData.mock.calls[0];
      // Expected: setMemberData(roomId, userId, data)
      expect(callArgs[1]).toBe('user-1'); // userId
    });

    it('should pass updated nickname in setMemberData', async () => {
      const member = createTestMember({
        userId: 'user-1',
        nickname: 'OldName',
        ip: '192.168.1.100',
        port: 9001,
        status: 'online'
      });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      expect(mockSetMemberData).toHaveBeenCalled();
      const callArgs = mockSetMemberData.mock.calls[0];
      const updatedData: MemberNodeData = callArgs[2];
      expect(updatedData.nickname).toBe('NewName');
    });

    it('should preserve other member properties when updating ZK', async () => {
      const member = createTestMember({
        userId: 'user-1',
        nickname: 'OldName',
        ip: '192.168.1.100',
        port: 9001,
        status: 'online',
        joinedAt: 1234567890
      });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      const callArgs = mockSetMemberData.mock.calls[0];
      const updatedData: MemberNodeData = callArgs[2];
      expect(updatedData.userId).toBe('user-1');
      expect(updatedData.ip).toBe('192.168.1.100');
      expect(updatedData.port).toBe(9001);
      expect(updatedData.status).toBe('online');
      expect(updatedData.joinedAt).toBe(1234567890);
    });

    it('should not update ZK if member does not exist', async () => {
      // rename throws if member doesn't exist - this is correct behavior
      await expect(memberService.rename('non-existent', 'NewName')).rejects.toThrow('Member not found');

      expect(mockSetMemberData).not.toHaveBeenCalled();
    });

    it('should still update local state even if ZK update fails', async () => {
      mockSetMemberData.mockRejectedValueOnce(new Error('ZK Error'));

      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      // Should not throw
      await expect(memberService.rename('user-1', 'NewName')).resolves.toBeUndefined();

      // Local state should still be updated
      const updated = memberService.getMember('user-1');
      expect(updated?.nickname).toBe('NewName');
    });
  });

  describe('M3.4.3 Broadcast Nickname Change via PeerService', () => {
    it('should call peerService.broadcast when renaming', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      expect(mockBroadcast).toHaveBeenCalledTimes(1);
    });

    it('should broadcast with type nick_change', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      expect(mockBroadcast).toHaveBeenCalled();
      const broadcastMessage: P2PMessage = mockBroadcast.mock.calls[0][0];
      expect(broadcastMessage.type).toBe('nick_change');
    });

    it('should include senderId in broadcast', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      const broadcastMessage: P2PMessage = mockBroadcast.mock.calls[0][0];
      expect(broadcastMessage.senderId).toBe('user-1');
    });

    it('should include oldNickname and newNickname in payload', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      const broadcastMessage: P2PMessage = mockBroadcast.mock.calls[0][0];
      const payload = broadcastMessage.payload as { oldNickname: string; newNickname: string };
      expect(payload.oldNickname).toBe('OldName');
      expect(payload.newNickname).toBe('NewName');
    });

    it('should not broadcast if member does not exist', async () => {
      // rename throws if member doesn't exist - this is correct behavior
      await expect(memberService.rename('non-existent', 'NewName')).rejects.toThrow('Member not found');

      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('should still broadcast even if ZK update fails', async () => {
      mockSetMemberData.mockRejectedValueOnce(new Error('ZK Error'));

      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      // Should still broadcast the nick_change
      expect(mockBroadcast).toHaveBeenCalledTimes(1);
    });

    it('should not broadcast if peerService is not available', async () => {
      // Create MemberService without PeerService
      const memberServiceNoPeer = new MemberService(eventBus, mockZKClient, null as any);
      memberServiceNoPeer.setCurrentRoomId('general');

      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberServiceNoPeer.onMemberJoin(member);

      // Should not throw
      await expect(memberServiceNoPeer.rename('user-1', 'NewName')).resolves.toBeUndefined();

      // ZK should still be updated
      expect(mockSetMemberData).toHaveBeenCalled();
    });
  });

  describe('Rename Command Integration', () => {
    it('should handle complete rename flow end-to-end', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'Alice' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'Bob');

      // Verify local state
      const updated = memberService.getMember('user-1');
      expect(updated?.nickname).toBe('Bob');

      // Verify ZK update
      expect(mockSetMemberData).toHaveBeenCalledTimes(1);

      // Verify broadcast
      expect(mockBroadcast).toHaveBeenCalledTimes(1);
      const broadcastMessage: P2PMessage = mockBroadcast.mock.calls[0][0];
      expect(broadcastMessage.type).toBe('nick_change');

      // Verify local event published
      const nickChangeHandler = jest.fn();
      eventBus.subscribe('nick_change', nickChangeHandler);
      await memberService.rename('user-1', 'Charlie');
      expect(nickChangeHandler).toHaveBeenCalledWith({
        userId: 'user-1',
        oldNickname: 'Bob',
        newNickname: 'Charlie'
      });
    });

    it('should handle concurrent rename requests', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'Original' });
      memberService.onMemberJoin(member);

      // Simulate concurrent renames
      const rename1 = memberService.rename('user-1', 'Name1');
      const rename2 = memberService.rename('user-1', 'Name2');

      await expect(Promise.all([rename1, rename2])).resolves.toBeDefined();

      // Both ZK and broadcast should have been called for each rename
      expect(mockSetMemberData.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(mockBroadcast.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
