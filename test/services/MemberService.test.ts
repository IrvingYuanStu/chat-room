import { MemberService } from '../../src/services/MemberService';
import { Member } from '../../src/services/types';
import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';

describe('M2.4 MemberService', () => {
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
    // Reset event bus singleton before each test
    resetEventBus();
    eventBus = getEventBus();
    // Create MemberService with the default event bus
    memberService = new MemberService(eventBus);
  });

  afterEach(() => {
    // Clean up
    resetEventBus();
  });

  describe('M2.4.1 MemberService class structure', () => {
    it('should export MemberService class', () => {
      expect(MemberService).toBeDefined();
      expect(typeof MemberService).toBe('function');
    });

    it('should create MemberService instance', () => {
      const service = new MemberService(eventBus);
      expect(service).toBeDefined();
    });

    it('should have getMembers method', () => {
      expect(typeof memberService.getMembers).toBe('function');
    });

    it('should have getMember method', () => {
      expect(typeof memberService.getMember).toBe('function');
    });

    it('should have isOnline method', () => {
      expect(typeof memberService.isOnline).toBe('function');
    });

    it('should have onMemberJoin method', () => {
      expect(typeof memberService.onMemberJoin).toBe('function');
    });

    it('should have onMemberLeave method', () => {
      expect(typeof memberService.onMemberLeave).toBe('function');
    });

    it('should have updateMembers method', () => {
      expect(typeof memberService.updateMembers).toBe('function');
    });

    it('should have broadcastStatus method', () => {
      expect(typeof memberService.broadcastStatus).toBe('function');
    });

    it('should have rename method', () => {
      expect(typeof memberService.rename).toBe('function');
    });

    it('should have forceOffline method', () => {
      expect(typeof memberService.forceOffline).toBe('function');
    });
  });

  describe('M2.4.1 getMembers() - Get all members', () => {
    it('should return empty array when no members', () => {
      const members = memberService.getMembers();
      expect(members).toEqual([]);
      expect(Array.isArray(members)).toBe(true);
    });

    it('should return all members after they join', () => {
      const member1 = createTestMember({ userId: 'user-1', nickname: 'User1' });
      const member2 = createTestMember({ userId: 'user-2', nickname: 'User2' });

      memberService.onMemberJoin(member1);
      memberService.onMemberJoin(member2);

      const members = memberService.getMembers();
      expect(members).toHaveLength(2);
      expect(members).toContainEqual(member1);
      expect(members).toContainEqual(member2);
    });

    it('should not mutate original member data when returning members', () => {
      const originalMember = createTestMember({ userId: 'user-1', nickname: 'Original' });
      memberService.onMemberJoin(originalMember);

      const members = memberService.getMembers();
      members[0].nickname = 'Modified';

      const member = memberService.getMember('user-1');
      expect(member?.nickname).toBe('Original');
    });
  });

  describe('M2.4.1 getMember() - Get specific member', () => {
    it('should return undefined for non-existent member', () => {
      const member = memberService.getMember('non-existent');
      expect(member).toBeUndefined();
    });

    it('should return member by userId', () => {
      const member = createTestMember({ userId: 'user-123', nickname: 'TestMember' });
      memberService.onMemberJoin(member);

      const found = memberService.getMember('user-123');
      expect(found).toBeDefined();
      expect(found?.userId).toBe('user-123');
      expect(found?.nickname).toBe('TestMember');
    });

    it('should return the correct member with all properties', () => {
      const member = createTestMember({
        userId: 'user-abc',
        nickname: 'FullMember',
        status: 'online',
        ip: '10.0.0.1',
        port: 8080,
        joinedAt: 1234567890,
      });
      memberService.onMemberJoin(member);

      const found = memberService.getMember('user-abc');
      expect(found).toEqual(member);
    });
  });

  describe('M2.4.4 isOnline() - Check member online status', () => {
    it('should return false for non-existent member', () => {
      const result = memberService.isOnline('non-existent-user');
      expect(result).toBe(false);
    });

    it('should return true for online member', () => {
      const member = createTestMember({ userId: 'user-1', status: 'online' });
      memberService.onMemberJoin(member);

      expect(memberService.isOnline('user-1')).toBe(true);
    });

    it('should return false for offline member', () => {
      const member = createTestMember({ userId: 'user-1', status: 'offline' });
      memberService.onMemberJoin(member);

      expect(memberService.isOnline('user-1')).toBe(false);
    });

    it('should return false for member that left', () => {
      const member = createTestMember({ userId: 'user-1' });
      memberService.onMemberJoin(member);
      memberService.onMemberLeave('user-1');

      expect(memberService.isOnline('user-1')).toBe(false);
    });

    it('should correctly track online status after multiple joins and leaves', () => {
      const member1 = createTestMember({ userId: 'user-1' });
      const member2 = createTestMember({ userId: 'user-2' });

      memberService.onMemberJoin(member1);
      memberService.onMemberJoin(member2);

      expect(memberService.isOnline('user-1')).toBe(true);
      expect(memberService.isOnline('user-2')).toBe(true);

      memberService.onMemberLeave('user-1');

      expect(memberService.isOnline('user-1')).toBe(false);
      expect(memberService.isOnline('user-2')).toBe(true);

      memberService.onMemberLeave('user-2');

      expect(memberService.isOnline('user-1')).toBe(false);
      expect(memberService.isOnline('user-2')).toBe(false);
    });
  });

  describe('M2.4.2 onMemberJoin() - Handle member join', () => {
    it('should add member to members list', () => {
      const member = createTestMember({ userId: 'new-user' });
      memberService.onMemberJoin(member);

      expect(memberService.getMembers()).toHaveLength(1);
      expect(memberService.getMember('new-user')).toEqual(member);
    });

    it('should publish member_join event', () => {
      const member = createTestMember({ userId: 'joiner' });
      const eventHandler = jest.fn();

      eventBus.subscribe('member_join', eventHandler);

      memberService.onMemberJoin(member);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(member);
    });

    it('should update existing member if they rejoin', () => {
      const member1 = createTestMember({
        userId: 'user-1',
        nickname: 'OldName',
        status: 'offline',
        ip: '192.168.1.1',
      });
      memberService.onMemberJoin(member1);

      const member2 = createTestMember({
        userId: 'user-1',
        nickname: 'NewName',
        status: 'online',
        ip: '192.168.1.2',
      });
      memberService.onMemberJoin(member2);

      // Should only have one member
      expect(memberService.getMembers()).toHaveLength(1);
      // Should have updated data
      const updated = memberService.getMember('user-1');
      expect(updated?.nickname).toBe('NewName');
      expect(updated?.status).toBe('online');
    });

    it('should handle member join with all properties', () => {
      const now = Date.now();
      const member = createTestMember({
        userId: 'full-member',
        nickname: 'FullMember',
        status: 'online',
        ip: '172.16.0.100',
        port: 9001,
        joinedAt: now,
      });

      memberService.onMemberJoin(member);

      const found = memberService.getMember('full-member');
      expect(found).toEqual({
        userId: 'full-member',
        nickname: 'FullMember',
        status: 'online',
        ip: '172.16.0.100',
        port: 9001,
        joinedAt: now,
      });
    });

    it('should publish event after adding member', () => {
      const member = createTestMember({ userId: 'event-test' });
      const eventHandler = jest.fn();

      eventBus.subscribe('member_join', eventHandler);

      // Add member
      memberService.onMemberJoin(member);

      // Verify member is in list
      expect(memberService.getMember('event-test')).toBeDefined();
      // Verify event was published
      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('M2.4.3 onMemberLeave() - Handle member leave', () => {
    it('should remove member from members list', () => {
      const member = createTestMember({ userId: 'leaving-user' });
      memberService.onMemberJoin(member);

      memberService.onMemberLeave('leaving-user');

      expect(memberService.getMember('leaving-user')).toBeUndefined();
      expect(memberService.getMembers()).toHaveLength(0);
    });

    it('should publish member_leave event with userId', () => {
      const member = createTestMember({ userId: 'user-to-leave' });
      memberService.onMemberJoin(member);

      const eventHandler = jest.fn();
      eventBus.subscribe('member_leave', eventHandler);

      memberService.onMemberLeave('user-to-leave');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith({ userId: 'user-to-leave' });
    });

    it('should not throw when removing non-existent member', () => {
      expect(() => {
        memberService.onMemberLeave('non-existent');
      }).not.toThrow();
    });

    it('should not publish event when removing non-existent member', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe('member_leave', eventHandler);

      memberService.onMemberLeave('non-existent');

      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should handle multiple members with selective leave', () => {
      const member1 = createTestMember({ userId: 'user-1' });
      const member2 = createTestMember({ userId: 'user-2' });
      const member3 = createTestMember({ userId: 'user-3' });

      memberService.onMemberJoin(member1);
      memberService.onMemberJoin(member2);
      memberService.onMemberJoin(member3);

      memberService.onMemberLeave('user-2');

      expect(memberService.getMembers()).toHaveLength(2);
      expect(memberService.getMember('user-1')).toBeDefined();
      expect(memberService.getMember('user-2')).toBeUndefined();
      expect(memberService.getMember('user-3')).toBeDefined();
    });

    it('should set member status to offline instead of removing when forceOffline is called', () => {
      const member = createTestMember({ userId: 'user-1', status: 'online' });
      memberService.onMemberJoin(member);

      memberService.forceOffline('user-1');

      const found = memberService.getMember('user-1');
      expect(found).toBeDefined();
      expect(found?.status).toBe('offline');
      expect(memberService.isOnline('user-1')).toBe(false);
    });
  });

  describe('updateMembers() - Sync members from ZK', () => {
    it('should replace all members with new list', () => {
      const member1 = createTestMember({ userId: 'user-1' });
      const member2 = createTestMember({ userId: 'user-2' });

      memberService.onMemberJoin(member1);

      const newMembers = [
        createTestMember({ userId: 'user-3' }),
        createTestMember({ userId: 'user-4' }),
      ];

      memberService.updateMembers(newMembers);

      const members = memberService.getMembers();
      expect(members).toHaveLength(2);
      expect(members).not.toContainEqual(member1);
      expect(members).toContainEqual(newMembers[0]);
      expect(members).toContainEqual(newMembers[1]);
    });

    it('should handle empty member list', () => {
      memberService.updateMembers([]);

      expect(memberService.getMembers()).toHaveLength(0);
    });

    it('should preserve member data when updating', () => {
      const members = [
        createTestMember({
          userId: 'user-x',
          nickname: 'NickX',
          ip: '10.0.0.1',
          port: 9001,
        }),
      ];

      memberService.updateMembers(members);

      const found = memberService.getMember('user-x');
      expect(found?.nickname).toBe('NickX');
      expect(found?.ip).toBe('10.0.0.1');
      expect(found?.port).toBe(9001);
    });
  });

  describe('rename() - Change nickname', () => {
    it('should have rename method', () => {
      expect(typeof memberService.rename).toBe('function');
    });

    it('should throw error when renaming non-existent member', async () => {
      await expect(
        memberService.rename('non-existent', 'NewName')
      ).rejects.toThrow();
    });

    it('should update nickname for existing member', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      const updated = memberService.getMember('user-1');
      expect(updated?.nickname).toBe('NewName');
    });

    it('should publish nick_change event', async () => {
      const member = createTestMember({ userId: 'user-1', nickname: 'OldName' });
      memberService.onMemberJoin(member);

      const eventHandler = jest.fn();
      eventBus.subscribe('nick_change', eventHandler);

      await memberService.rename('user-1', 'NewName');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith({
        userId: 'user-1',
        oldNickname: 'OldName',
        newNickname: 'NewName',
      });
    });

    it('should keep other member properties unchanged', async () => {
      const member = createTestMember({
        userId: 'user-1',
        nickname: 'Original',
        ip: '192.168.1.1',
        port: 9001,
        status: 'online',
      });
      memberService.onMemberJoin(member);

      await memberService.rename('user-1', 'NewName');

      const updated = memberService.getMember('user-1');
      expect(updated?.userId).toBe('user-1');
      expect(updated?.ip).toBe('192.168.1.1');
      expect(updated?.port).toBe(9001);
      expect(updated?.status).toBe('online');
    });
  });

  describe('forceOffline() - Force member offline', () => {
    it('should set member status to offline', () => {
      const member = createTestMember({ userId: 'user-1', status: 'online' });
      memberService.onMemberJoin(member);

      memberService.forceOffline('user-1');

      const found = memberService.getMember('user-1');
      expect(found?.status).toBe('offline');
    });

    it('should not throw for non-existent member', () => {
      expect(() => {
        memberService.forceOffline('non-existent');
      }).not.toThrow();
    });

    it('should make isOnline return false after forceOffline', () => {
      const member = createTestMember({ userId: 'user-1', status: 'online' });
      memberService.onMemberJoin(member);

      expect(memberService.isOnline('user-1')).toBe(true);

      memberService.forceOffline('user-1');

      expect(memberService.isOnline('user-1')).toBe(false);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle many members joining', () => {
      for (let i = 0; i < 50; i++) {
        const member = createTestMember({ userId: `user-${i}`, nickname: `User${i}` });
        memberService.onMemberJoin(member);
      }

      expect(memberService.getMembers()).toHaveLength(50);
    });

    it('should handle concurrent join and leave operations', () => {
      const member1 = createTestMember({ userId: 'user-1' });
      const member2 = createTestMember({ userId: 'user-2' });

      memberService.onMemberJoin(member1);
      memberService.onMemberJoin(member2);
      memberService.onMemberLeave('user-1');
      memberService.onMemberJoin(member1); // user-1 rejoins

      expect(memberService.getMembers()).toHaveLength(2);
      expect(memberService.isOnline('user-1')).toBe(true);
      // user-2 was never modified, so should remain online
      expect(memberService.isOnline('user-2')).toBe(true);
    });

    it('should handle member with empty nickname', () => {
      const member = createTestMember({ userId: 'user-1', nickname: '' });
      memberService.onMemberJoin(member);

      const found = memberService.getMember('user-1');
      expect(found?.nickname).toBe('');
    });

    it('should handle member with special characters in nickname', () => {
      const member = createTestMember({
        userId: 'user-1',
        nickname: '用户-alpha_123',
      });
      memberService.onMemberJoin(member);

      const found = memberService.getMember('user-1');
      expect(found?.nickname).toBe('用户-alpha_123');
    });

    it('should handle rapid status changes', () => {
      const member = createTestMember({ userId: 'user-1', status: 'online' });
      memberService.onMemberJoin(member);

      memberService.forceOffline('user-1');
      expect(memberService.isOnline('user-1')).toBe(false);

      memberService.forceOffline('user-1'); // Should not throw
      expect(memberService.isOnline('user-1')).toBe(false);
    });
  });

  describe('broadcastStatus() - Broadcast own status', () => {
    it('should have broadcastStatus method', () => {
      expect(typeof memberService.broadcastStatus).toBe('function');
    });

    it('should not throw when calling broadcastStatus', () => {
      expect(() => {
        memberService.broadcastStatus();
      }).not.toThrow();
    });
  });

  describe('Member ordering', () => {
    it('should return members in join order', () => {
      const member1 = createTestMember({ userId: 'user-1', nickname: 'First' });
      const member2 = createTestMember({ userId: 'user-2', nickname: 'Second' });
      const member3 = createTestMember({ userId: 'user-3', nickname: 'Third' });

      memberService.onMemberJoin(member1);
      memberService.onMemberJoin(member2);
      memberService.onMemberJoin(member3);

      const members = memberService.getMembers();
      expect(members[0].nickname).toBe('First');
      expect(members[1].nickname).toBe('Second');
      expect(members[2].nickname).toBe('Third');
    });

    it('should return latest joined member first when sorted by joinedAt descending', () => {
      const now = Date.now();
      const member1 = createTestMember({
        userId: 'user-1',
        nickname: 'First',
        joinedAt: now - 2000,
      });
      const member2 = createTestMember({
        userId: 'user-2',
        nickname: 'Second',
        joinedAt: now - 1000,
      });
      const member3 = createTestMember({
        userId: 'user-3',
        nickname: 'Third',
        joinedAt: now,
      });

      memberService.onMemberJoin(member1);
      memberService.onMemberJoin(member2);
      memberService.onMemberJoin(member3);

      const members = memberService.getMembers();
      // Sorted by joinedAt descending (newest first)
      expect(members[0].nickname).toBe('Third');
      expect(members[1].nickname).toBe('Second');
      expect(members[2].nickname).toBe('First');
    });
  });
});
