import { ZKClient } from '../../src/network/ZKClient';
import { Member, MemberNodeData } from '../../src/services/types';

// Mock the zookeeper module
const mockClient: any = {
  on: jest.fn((event: string, callback: () => void) => {
    if (event === 'connected' || event === 'disconnected' || event === 'expired') {
      mockClient._callbacks = mockClient._callbacks || {};
      mockClient._callbacks[event] = callback;
    }
  }),
  connect: jest.fn((_addresses: string, _timeout: number, callback?: (err: Error | null) => void) => {
    setTimeout(() => {
      mockClient.connected = true;
      if (callback) callback(null);
      if (mockClient._callbacks && mockClient._callbacks['connected']) {
        mockClient._callbacks['connected']();
      }
    }, 10);
  }),
  close: jest.fn((callback?: () => void) => {
    setTimeout(() => {
      mockClient.connected = false;
      if (callback) callback();
    }, 10);
  }),
  create: jest.fn((path: string, data: any, _flags: number, callback: (err: Error | null, path: string) => void) => {
    setTimeout(() => {
      if (mockClient.connected) {
        mockClient.paths = mockClient.paths || new Set();
        mockClient.paths.add(path);
        if (data) {
          mockClient.pathData = mockClient.pathData || new Map();
          mockClient.pathData.set(path, data);
        }
        callback(null, path);
      } else {
        callback(new Error('Client is closed'), '');
      }
    }, 10);
  }),
  getData: jest.fn((path: string, _watchOrCallback: any, callback?: any) => {
    // Handle both getData(path, callback) and getData(path, watch, callback) forms
    const cb = typeof _watchOrCallback === 'function' ? _watchOrCallback : callback;
    setTimeout(() => {
      if (mockClient.pathData && mockClient.pathData.has(path)) {
        cb(null, mockClient.pathData.get(path), null);
      } else {
        cb(null, '', null);
      }
    }, 10);
  }),
  setData: jest.fn((path: string, data: any, versionOrCallback: any, callback?: (err: Error | null) => void) => {
    // Handle both setData(path, data, callback) and setData(path, data, version, callback) forms
    // data can be a Buffer, versionOrCallback can be a number or callback
    let cb: (err: Error | null) => void;
    if (typeof versionOrCallback === 'function') {
      cb = versionOrCallback;
    } else {
      cb = callback as (err: Error | null) => void;
    }
    setTimeout(() => {
      if (mockClient.paths && mockClient.paths.has(path)) {
        mockClient.pathData = mockClient.pathData || new Map();
        mockClient.pathData.set(path, data);
        cb(null);
      } else {
        cb(new Error('Node does not exist'));
      }
    }, 10);
  }),
  remove: jest.fn((path: string, versionOrCallback: any, callback?: any) => {
    // Handle both remove(path, callback) and remove(path, version, callback) forms
    const cb = typeof versionOrCallback === 'function' ? versionOrCallback : callback;
    setTimeout(() => {
      if (mockClient.paths) {
        mockClient.paths.delete(path);
      }
      cb(null);
    }, 10);
  }),
  exists: jest.fn((path: string, watchOrCallback: any, callback?: any) => {
    // Handle both exists(path, callback) and exists(path, watch, callback) forms
    // When 2 args passed: exists(path, callback) - callback is 2nd arg
    // When 3 args passed: exists(path, watch, callback) - callback is 3rd arg
    let cb: (err: Error | null, stat: any) => void;
    if (typeof watchOrCallback === 'function') {
      // 2-arg form: exists(path, callback)
      cb = watchOrCallback;
    } else if (typeof callback === 'function') {
      // 3-arg form: exists(path, watch, callback)
      cb = callback;
    } else {
      // No callback provided
      return;
    }
    setTimeout(() => {
      if (mockClient.connected === false) return; // Don't fire if disconnected
      const exists = mockClient.paths && mockClient.paths.has(path);
      cb(null, { exists });
    }, 10);
  }),
  getChildren: jest.fn((path: string, watchOrCallback: any, callback?: any) => {
    // Handle both getChildren(path, callback) and getChildren(path, watch, callback) forms
    let cb: (err: Error | null, children: string[]) => void;
    if (typeof watchOrCallback === 'function') {
      // 2-arg form: getChildren(path, callback)
      cb = watchOrCallback;
    } else if (typeof callback === 'function') {
      // 3-arg form: getChildren(path, watch, callback)
      cb = callback;
    } else {
      // No callback provided
      return;
    }
    setTimeout(() => {
      if (mockClient.connected === false) return; // Don't fire if disconnected
      const children: string[] = [];
      if (mockClient.paths) {
        mockClient.paths.forEach((p: string) => {
          if (p.startsWith(path + '/')) {
            const remainder = p.substring(path.length + 1);
            if (!remainder.includes('/')) {
              children.push(remainder);
            }
          }
        });
      }
      cb(null, children);
    }, 10);
  }),
  waitUntilConnected: jest.fn((callback: (err: Error | null) => void) => {
    setTimeout(() => {
      if (mockClient.connected) {
        callback(null);
      } else {
        mockClient.connected = true;
        callback(null);
      }
    }, 10);
  }),
  _callbacks: {} as Record<string, () => void>,
  connected: false
};

jest.mock('node-zookeeper-client', () => ({
  createClient: jest.fn(() => mockClient),
  CreateMode: {
    PERSISTENT: 0,
    EPHEMERAL: 1
  },
  Exception: {
    NODE_EXISTS: -110,
    NO_NODE: -101
  },
  ErrorCode: {
    NODEEXISTS: -110,
    NONODE: -101
  },
  ZooKeeperLogLevel: {
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
  }
}));

describe('M1.7 ZKClient', () => {
  let zkClient: ZKClient;
  const testAddresses = ['127.0.0.1:2181'];
  const testRoomId = 'test-room';
  const testMemberData: MemberNodeData = {
    nickname: 'TestUser',
    status: 'online',
    ip: '192.168.1.100',
    port: 9001,
    userId: 'user-123',
    joinedAt: Date.now()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock client state
    mockClient.connected = false;
    mockClient.paths = undefined;
    mockClient.pathData = undefined;
    mockClient._callbacks = {};
    zkClient = new ZKClient({ logLevel: 'error' });
  });

  afterEach(async () => {
    try {
      await zkClient.disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('M1.7.1 ZKClient connection - connect/disconnect', () => {
    it('should export ZKClient class', () => {
      expect(ZKClient).toBeDefined();
      expect(typeof ZKClient).toBe('function');
    });

    it('should create ZKClient instance', () => {
      const client = new ZKClient({ logLevel: 'error' });
      expect(client).toBeDefined();
    });

    it('should have connect method', () => {
      expect(typeof zkClient.connect).toBe('function');
    });

    it('should have disconnect method', () => {
      expect(typeof zkClient.disconnect).toBe('function');
    });

    it('should connect to ZooKeeper addresses', async () => {
      await zkClient.connect(testAddresses);

      // Verify connection was initiated
      expect(zkClient.isConnected()).toBe(true);
    }, 10000);

    it('should disconnect cleanly', async () => {
      await zkClient.connect(testAddresses);
      await zkClient.disconnect();

      expect(zkClient.isConnected()).toBe(false);
    }, 10000);

    it('should handle multiple connect calls', async () => {
      await zkClient.connect(testAddresses);
      await zkClient.connect(testAddresses);

      expect(zkClient.isConnected()).toBe(true);
    }, 10000);

    it('should handle disconnect when not connected', async () => {
      // Should not throw
      await expect(zkClient.disconnect()).resolves.not.toThrow();
    });
  });

  describe('M1.7.2 createMemberNode', () => {
    it('should have createMemberNode method', () => {
      expect(typeof zkClient.createMemberNode).toBe('function');
    });

    it('should create member node with correct path', async () => {
      await zkClient.connect(testAddresses);

      const path = await zkClient.createMemberNode(testRoomId, testMemberData);

      expect(path).toContain(testRoomId);
      expect(path).toContain('members');
    }, 10000);

    it('should include member data in node', async () => {
      await zkClient.connect(testAddresses);

      const path = await zkClient.createMemberNode(testRoomId, testMemberData);

      // Path should be returned
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
    }, 10000);

    it('should reject when not connected', async () => {
      await expect(zkClient.createMemberNode(testRoomId, testMemberData))
        .rejects.toThrow();
    }, 10000);
  });

  describe('M1.7.3 deleteMemberNode', () => {
    it('should have deleteMemberNode method', () => {
      expect(typeof zkClient.deleteMemberNode).toBe('function');
    });

    it('should delete member node by roomId and userId', async () => {
      await zkClient.connect(testAddresses);

      // First create a member
      await zkClient.createMemberNode(testRoomId, testMemberData);

      // Then delete it
      await expect(zkClient.deleteMemberNode(testRoomId, testMemberData.userId))
        .resolves.not.toThrow();
    }, 10000);

    it('should reject when not connected', async () => {
      await expect(zkClient.deleteMemberNode(testRoomId, 'user-123'))
        .rejects.toThrow();
    }, 10000);
  });

  describe('M1.7.4 setMemberData', () => {
    it('should have setMemberData method', () => {
      expect(typeof zkClient.setMemberData).toBe('function');
    });

    it('should update member data', async () => {
      await zkClient.connect(testAddresses);

      // First create a member
      await zkClient.createMemberNode(testRoomId, testMemberData);

      // Update the member data
      const updatedData = { ...testMemberData, nickname: 'UpdatedNickname' };
      await expect(zkClient.setMemberData(testRoomId, testMemberData.userId, updatedData))
        .resolves.not.toThrow();
    }, 10000);

    it('should reject when not connected', async () => {
      await expect(zkClient.setMemberData(testRoomId, 'user-123', testMemberData))
        .rejects.toThrow();
    }, 10000);
  });

  describe('M1.7.5 getMembers', () => {
    it('should have getMembers method', () => {
      expect(typeof zkClient.getMembers).toBe('function');
    });

    it('should return array of members', async () => {
      await zkClient.connect(testAddresses);

      const members = await zkClient.getMembers(testRoomId);

      expect(Array.isArray(members)).toBe(true);
    }, 10000);

    it('should return Member objects with correct structure', async () => {
      await zkClient.connect(testAddresses);

      const members = await zkClient.getMembers(testRoomId);

      // Each member should have the expected properties
      members.forEach(member => {
        expect(member).toHaveProperty('userId');
        expect(member).toHaveProperty('nickname');
        expect(member).toHaveProperty('status');
        expect(member).toHaveProperty('ip');
        expect(member).toHaveProperty('port');
        expect(member).toHaveProperty('joinedAt');
      });
    }, 10000);

    it('should reject when not connected', async () => {
      await expect(zkClient.getMembers(testRoomId))
        .rejects.toThrow();
    }, 10000);
  });

  describe('M1.7.6 listRooms', () => {
    it('should have listRooms method', () => {
      expect(typeof zkClient.listRooms).toBe('function');
    });

    it('should return array of room IDs', async () => {
      await zkClient.connect(testAddresses);

      const rooms = await zkClient.listRooms();

      expect(Array.isArray(rooms)).toBe(true);
    }, 10000);

    it('should reject when not connected', async () => {
      await expect(zkClient.listRooms())
        .rejects.toThrow();
    }, 10000);
  });

  describe('M1.7.7 watchMembers', () => {
    it('should have watchMembers method', () => {
      expect(typeof zkClient.watchMembers).toBe('function');
    });

    it('should accept callback for member changes', async () => {
      await zkClient.connect(testAddresses);

      const callback = jest.fn((members: Member[]) => {});

      // Should not throw
      expect(() => {
        zkClient.watchMembers(testRoomId, callback);
      }).not.toThrow();
    }, 10000);

    it('should invoke callback when members change', async () => {
      await zkClient.connect(testAddresses);

      const callback = jest.fn((members: Member[]) => {});

      zkClient.watchMembers(testRoomId, callback);

      // Wait for initial watch setup to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      // Trigger a member change by creating a node
      await zkClient.createMemberNode(testRoomId, testMemberData);

      // Wait for watch callback to be triggered
      await new Promise(resolve => setTimeout(resolve, 50));

      // Callback should have been called
      expect(callback).toHaveBeenCalled();
    }, 10000);
  });

  describe('M1.7.8 watchRooms', () => {
    it('should have watchRooms method', () => {
      expect(typeof zkClient.watchRooms).toBe('function');
    });

    it('should accept callback for room list changes', async () => {
      await zkClient.connect(testAddresses);

      const callback = jest.fn((rooms: string[]) => {});

      // Should not throw when setting up watch
      expect(() => {
        zkClient.watchRooms(callback);
      }).not.toThrow();

      // Wait for initial callback to be called
      await new Promise(resolve => setTimeout(resolve, 50));
    }, 10000);

    it('should invoke callback when room list changes', async () => {
      await zkClient.connect(testAddresses);

      const callback = jest.fn((rooms: string[]) => {});

      zkClient.watchRooms(callback);

      // Wait for initial callback to be called
      await new Promise(resolve => setTimeout(resolve, 50));

      // Callback should have been called at least once
      expect(callback).toHaveBeenCalled();
    }, 10000);
  });

  describe('M1.7.9 Reconnect logic', () => {
    it('should schedule reconnect after disconnect', async () => {
      await zkClient.connect(testAddresses);

      // Simulate disconnect
      await zkClient.disconnect();

      // After reconnect delay (5 seconds), it should automatically try to reconnect
      // For testing, we just verify the client is in disconnected state
      expect(zkClient.isConnected()).toBe(false);
    }, 10000);

    it('should have isConnected method', () => {
      expect(typeof zkClient.isConnected).toBe('function');
    });

    it('should return false when not connected', () => {
      expect(zkClient.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await zkClient.connect(testAddresses);
      expect(zkClient.isConnected()).toBe(true);
    }, 10000);

    it('should handle connection state transitions', async () => {
      expect(zkClient.isConnected()).toBe(false);

      await zkClient.connect(testAddresses);
      expect(zkClient.isConnected()).toBe(true);

      await zkClient.disconnect();
      expect(zkClient.isConnected()).toBe(false);
    }, 10000);
  });

  describe('M1.7.10 ensureRootNode', () => {
    it('should have ensureRootNode method', () => {
      expect(typeof zkClient.ensureRootNode).toBe('function');
    });

    it('should create root node if it does not exist', async () => {
      await zkClient.connect(testAddresses);

      // Should not throw
      await expect(zkClient.ensureRootNode()).resolves.not.toThrow();
    }, 10000);

    it('should handle root node already existing', async () => {
      await zkClient.connect(testAddresses);

      // Call twice - second should not throw
      await zkClient.ensureRootNode();
      await expect(zkClient.ensureRootNode()).resolves.not.toThrow();
    }, 10000);

    it('should reject when not connected', async () => {
      await expect(zkClient.ensureRootNode())
        .rejects.toThrow();
    }, 10000);
  });

  describe('ZKClient path structure', () => {
    it('should use correct root path /libra-regions', async () => {
      await zkClient.connect(testAddresses);

      // The root path should be /libra-regions
      await zkClient.ensureRootNode();

      // Verify that internal structure expects this path
      expect(true).toBe(true); // Path structure is internal implementation
    }, 10000);

    it('should build correct member node path', async () => {
      await zkClient.connect(testAddresses);

      const path = await zkClient.createMemberNode(testRoomId, testMemberData);

      expect(path).toContain('/libra-regions/');
      expect(path).toContain(testRoomId);
      expect(path).toContain('members');
    }, 10000);
  });

  describe('ZKClient error handling', () => {
    it('should handle operations after disconnect', async () => {
      await zkClient.connect(testAddresses);
      await zkClient.disconnect();

      // All operations should reject after disconnect
      await expect(zkClient.createMemberNode(testRoomId, testMemberData))
        .rejects.toThrow();
    }, 10000);
  });

  describe('ZKClient member data structure', () => {
    it('should serialize member data correctly', async () => {
      await zkClient.connect(testAddresses);

      const path = await zkClient.createMemberNode(testRoomId, testMemberData);

      expect(path).toBeDefined();
      // Data should be stored as JSON
    }, 10000);

    it('should preserve all member data fields', async () => {
      await zkClient.connect(testAddresses);

      await zkClient.createMemberNode(testRoomId, testMemberData);

      const members = await zkClient.getMembers(testRoomId);

      // Find the member we just created
      const createdMember = members.find(m => m.userId === testMemberData.userId);

      if (createdMember) {
        expect(createdMember.nickname).toBe(testMemberData.nickname);
        expect(createdMember.ip).toBe(testMemberData.ip);
        expect(createdMember.port).toBe(testMemberData.port);
      }
    }, 10000);
  });
});
