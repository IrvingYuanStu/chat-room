import * as fs from 'fs';
import * as path from 'path';

describe('M1.5 ConfigService', () => {
  const testConfigDir = path.join('/tmp', 'chat-room-test-config', 'subdir');
  const testConfigPath = path.join(testConfigDir, 'config.json');

  beforeAll(() => {
    // Clean up test directory before tests
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('M1.5.1 ConfigService class structure and load()', () => {
    it('should export ConfigService class', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      expect(ConfigService).toBeDefined();
      expect(typeof ConfigService).toBe('function');
    });

    it('should create ConfigService instance', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(service).toBeDefined();
    });

    it('should have load method', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(typeof service.load).toBe('function');
    });

    it('should return default config when file does not exist', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });

      const config = await service.load();

      expect(config.zkAddresses).toEqual(['127.0.0.1:2181']);
      expect(config.currentRoomId).toBe('');
      expect(config.nickname).toBeDefined();
      expect(config.recentRooms).toEqual([]);
      expect(config.port).toBe(9001);
      expect(config.dataDir).toBe('/tmp/chat-room');
      expect(config.logDir).toBe('/tmp/chat-room/logs');
      expect(config.logLevel).toBe('info');
    });

    it('should load config from existing file', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      // Create a test config file
      const testConfig = {
        zkAddresses: ['192.168.1.100:2181', '192.168.1.101:2182'],
        currentRoomId: 'test-room',
        nickname: 'TestUser',
        recentRooms: ['room1', 'room2'],
        port: 9002,
        dataDir: '/custom/data',
        logDir: '/custom/logs',
        logLevel: 'debug'
      };

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const service = new ConfigService({ configPath: testConfigPath });
      const config = await service.load();

      expect(config.zkAddresses).toEqual(['192.168.1.100:2181', '192.168.1.101:2182']);
      expect(config.currentRoomId).toBe('test-room');
      expect(config.nickname).toBe('TestUser');
      expect(config.recentRooms).toEqual(['room1', 'room2']);
      expect(config.port).toBe(9002);
      expect(config.dataDir).toBe('/custom/data');
      expect(config.logDir).toBe('/custom/logs');
      expect(config.logLevel).toBe('debug');
    });

    it('should use default values for missing fields in config file', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      // Create a minimal config file
      const minimalConfig = {
        nickname: 'MinimalUser'
      };

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(minimalConfig, null, 2));

      const service = new ConfigService({ configPath: testConfigPath });
      const config = await service.load();

      expect(config.nickname).toBe('MinimalUser');
      expect(config.zkAddresses).toEqual(['127.0.0.1:2181']); // default
      expect(config.port).toBe(9001); // default
    });
  });

  describe('M1.5.2 save() method', () => {
    it('should have save method', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(typeof service.save).toBe('function');
    });

    it('should save config to file', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });

      const config = {
        zkAddresses: ['10.0.0.1:2181'],
        currentRoomId: 'saved-room',
        nickname: 'SavedUser',
        recentRooms: ['room1'],
        port: 9005,
        dataDir: '/saved/data',
        logDir: '/saved/logs',
        logLevel: 'warn' as const
      };

      await service.save(config);

      expect(fs.existsSync(testConfigPath)).toBe(true);

      const savedContent = fs.readFileSync(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.zkAddresses).toEqual(['10.0.0.1:2181']);
      expect(savedConfig.currentRoomId).toBe('saved-room');
      expect(savedConfig.nickname).toBe('SavedUser');
      expect(savedConfig.port).toBe(9005);
    });

    it('should save partial config', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      // First save a full config
      const fullConfig = {
        zkAddresses: ['127.0.0.1:2181'],
        currentRoomId: 'room1',
        nickname: 'User1',
        recentRooms: [],
        port: 9001,
        dataDir: '/tmp/chat-room',
        logDir: '/tmp/chat-room/logs',
        logLevel: 'info' as const
      };

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(fullConfig));

      // Now save partial config
      const service = new ConfigService({ configPath: testConfigPath });
      await service.save({ nickname: 'UpdatedUser', currentRoomId: 'room2' });

      const savedContent = fs.readFileSync(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.nickname).toBe('UpdatedUser');
      expect(savedConfig.currentRoomId).toBe('room2');
      expect(savedConfig.zkAddresses).toEqual(['127.0.0.1:2181']); // preserved
    });

    it('should create parent directories if they do not exist', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const nestedPath = path.join(testConfigDir, 'nested', 'deep', 'config.json');
      const service = new ConfigService({ configPath: nestedPath });

      await service.save({ nickname: 'NestedUser' });

      expect(fs.existsSync(nestedPath)).toBe(true);
    });
  });

  describe('M1.5.3 get/set methods', () => {
    it('should have get method', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(typeof service.get).toBe('function');
    });

    it('should have set method', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(typeof service.set).toBe('function');
    });

    it('should get individual config value', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      const testConfig = {
        zkAddresses: ['192.168.1.50:2181'],
        currentRoomId: 'get-test-room',
        nickname: 'GetUser',
        recentRooms: ['roomA', 'roomB'],
        port: 8888,
        dataDir: '/get/data',
        logDir: '/get/logs',
        logLevel: 'error' as const
      };

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig));

      const service = new ConfigService({ configPath: testConfigPath });
      await service.load();

      expect(service.get('zkAddresses')).toEqual(['192.168.1.50:2181']);
      expect(service.get('currentRoomId')).toBe('get-test-room');
      expect(service.get('nickname')).toBe('GetUser');
      expect(service.get('port')).toBe(8888);
      expect(service.get('logLevel')).toBe('error');
    });

    it('should set individual config value', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      const initialConfig = {
        zkAddresses: ['127.0.0.1:2181'],
        currentRoomId: 'initial-room',
        nickname: 'InitialUser',
        recentRooms: [],
        port: 9001,
        dataDir: '/tmp/chat-room',
        logDir: '/tmp/chat-room/logs',
        logLevel: 'info' as const
      };

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(initialConfig));

      const service = new ConfigService({ configPath: testConfigPath });
      await service.load();

      await service.set('nickname', 'UpdatedNickname');
      await service.set('currentRoomId', 'new-room');
      await service.set('port', 9999);

      const savedContent = fs.readFileSync(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.nickname).toBe('UpdatedNickname');
      expect(savedConfig.currentRoomId).toBe('new-room');
      expect(savedConfig.port).toBe(9999);
      expect(savedConfig.zkAddresses).toEqual(['127.0.0.1:2181']); // unchanged
    });

    it('should return correct types for get method', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      const testConfig = {
        zkAddresses: ['127.0.0.1:2181'],
        currentRoomId: 'type-test',
        nickname: 'TypeUser',
        recentRooms: ['r1'],
        port: 9001,
        dataDir: '/data',
        logDir: '/logs',
        logLevel: 'debug' as const
      };

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig));

      const service = new ConfigService({ configPath: testConfigPath });
      await service.load();

      expect(typeof service.get('nickname')).toBe('string');
      expect(typeof service.get('port')).toBe('number');
      expect(Array.isArray(service.get('zkAddresses'))).toBe(true);
      expect(Array.isArray(service.get('recentRooms'))).toBe(true);
    });

    it('should persist changes after set', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      const testConfig = {
        zkAddresses: ['127.0.0.1:2181'],
        currentRoomId: 'persist-test',
        nickname: 'PersistUser',
        recentRooms: [],
        port: 9001,
        dataDir: '/tmp/chat-room',
        logDir: '/tmp/chat-room/logs',
        logLevel: 'info' as const
      };

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig));

      const service = new ConfigService({ configPath: testConfigPath });
      await service.load();

      await service.set('nickname', 'PersistedNick');

      // Create new instance and load - should have updated value
      const service2 = new ConfigService({ configPath: testConfigPath });
      await service2.load();

      expect(service2.get('nickname')).toBe('PersistedNick');
    });
  });

  describe('M1.5.4 promptConfig() method', () => {
    it('should have promptConfig method', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(typeof service.promptConfig).toBe('function');
    });

    it('should return config object from promptConfig', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });

      // promptConfig is async and typically uses stdin
      // For testing, we verify the method exists and returns a promise
      const result = service.promptConfig();

      expect(result).toBeInstanceOf(Promise);
    });

    it('promptConfig should accept zkAddresses parameter', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });

      // This tests that the method signature accepts a string parameter
      // The actual implementation would use this to set zkAddresses
      const mockZkAddresses = '192.168.1.100:2181,192.168.1.101:2182';
      const result = service.promptConfig(mockZkAddresses);

      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('getConfigPath() method', () => {
    it('should have getConfigPath method', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(typeof service.getConfigPath).toBe('function');
    });

    it('should return the config path', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      expect(service.getConfigPath()).toBe(testConfigPath);
    });
  });

  describe('Default config values', () => {
    it('should have correct default zkAddresses', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      const config = await service.load();

      expect(config.zkAddresses).toEqual(['127.0.0.1:2181']);
    });

    it('should have correct default port', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      const config = await service.load();

      expect(config.port).toBe(9001);
    });

    it('should have correct default logLevel', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');
      const service = new ConfigService({ configPath: testConfigPath });
      const config = await service.load();

      expect(config.logLevel).toBe('info');
    });

    it('should generate default nickname with User prefix', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      // Delete config file to ensure we get default values
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }

      const service = new ConfigService({ configPath: testConfigPath });
      const config = await service.load();

      expect(config.nickname).toMatch(/^User\d+$/);
    });
  });

  describe('Config validation', () => {
    it('should handle empty config file gracefully', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, '{}');

      const service = new ConfigService({ configPath: testConfigPath });
      const config = await service.load();

      expect(config.zkAddresses).toEqual(['127.0.0.1:2181']); // defaults applied
      expect(config.port).toBe(9001);
    });

    it('should handle malformed JSON gracefully', async () => {
      const { ConfigService } = await import('../../src/services/ConfigService');

      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigPath, 'not valid json {');

      const service = new ConfigService({ configPath: testConfigPath });

      // Should not throw, should return defaults
      const config = await service.load();

      expect(config.zkAddresses).toEqual(['127.0.0.1:2181']);
    });
  });
});
