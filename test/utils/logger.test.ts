import * as fs from 'fs';
import * as path from 'path';

describe('M1.3 Logger', () => {
  const testLogDir = '/tmp/chat-room-test-logs';
  const testModule = 'TestModule';

  beforeAll(() => {
    // Clean up test log directory before tests
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('M1.3.1 Logger class structure', () => {
    it('should export Logger class', async () => {
      const { Logger } = await import('../../src/utils/logger');
      expect(Logger).toBeDefined();
      expect(typeof Logger).toBe('function');
    });

    it('should create Logger instance with module name', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const logger = new Logger({
        logDir: testLogDir,
        logLevel: 'info',
        module: testModule,
      });
      expect(logger).toBeDefined();
    });

    it('should have debug method', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const logger = new Logger({
        logDir: testLogDir,
        logLevel: 'debug',
        module: testModule,
      });
      expect(typeof logger.debug).toBe('function');
    });

    it('should have info method', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const logger = new Logger({
        logDir: testLogDir,
        logLevel: 'info',
        module: testModule,
      });
      expect(typeof logger.info).toBe('function');
    });

    it('should have warn method', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const logger = new Logger({
        logDir: testLogDir,
        logLevel: 'info',
        module: testModule,
      });
      expect(typeof logger.warn).toBe('function');
    });

    it('should have error method', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const logger = new Logger({
        logDir: testLogDir,
        logLevel: 'info',
        module: testModule,
      });
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('M1.3.2 Pino configuration', () => {
    it('should create log directory if it does not exist', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'create-dir-test');

      // Ensure directory doesn't exist
      if (fs.existsSync(uniqueLogDir)) {
        fs.rmSync(uniqueLogDir, { recursive: true, force: true });
      }

      new Logger({
        logDir: uniqueLogDir,
        logLevel: 'info',
        module: testModule,
      });

      expect(fs.existsSync(uniqueLogDir)).toBe(true);
    });

    it('should accept valid log levels', async () => {
      const { Logger } = await import('../../src/utils/logger');

      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

      for (const level of levels) {
        const logger = new Logger({
          logDir: testLogDir,
          logLevel: level,
          module: testModule,
        });
        expect(logger).toBeDefined();
      }
    });

    it('should write log files', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'file-write-test');

      if (fs.existsSync(uniqueLogDir)) {
        fs.rmSync(uniqueLogDir, { recursive: true, force: true });
      }

      const logger = new Logger({
        logDir: uniqueLogDir,
        logLevel: 'debug',
        module: testModule,
      });

      logger.info('Test message');

      // Give some time for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fs.readdirSync(uniqueLogDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('M1.3.3 Log format', () => {
    it('should format debug message correctly', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'format-debug-test');

      if (fs.existsSync(uniqueLogDir)) {
        fs.rmSync(uniqueLogDir, { recursive: true, force: true });
      }

      const logger = new Logger({
        logDir: uniqueLogDir,
        logLevel: 'debug',
        module: testModule,
      });

      logger.debug('Debug message content');

      // Wait for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fs.readdirSync(uniqueLogDir);
      const logFile = files.find(f => f.endsWith('.log'));
      expect(logFile).toBeDefined();

      if (logFile) {
        const content = fs.readFileSync(path.join(uniqueLogDir, logFile), 'utf-8');
        // Pino outputs JSON: {"level":20,"time":"...","module":"TestModule","msg":"..."}
        // level 20 = debug
        expect(content).toContain('"level":20');
        expect(content).toContain('"module":"TestModule"');
        expect(content).toContain('Debug message content');
      }
    });

    it('should format info message correctly', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'format-info-test');

      if (fs.existsSync(uniqueLogDir)) {
        fs.rmSync(uniqueLogDir, { recursive: true, force: true });
      }

      const logger = new Logger({
        logDir: uniqueLogDir,
        logLevel: 'info',
        module: testModule,
      });

      logger.info('Info message content');

      // Wait for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fs.readdirSync(uniqueLogDir);
      const logFile = files.find(f => f.endsWith('.log'));
      expect(logFile).toBeDefined();

      if (logFile) {
        const content = fs.readFileSync(path.join(uniqueLogDir, logFile), 'utf-8');
        // level 30 = info
        expect(content).toContain('"level":30');
        expect(content).toContain('"module":"TestModule"');
        expect(content).toContain('Info message content');
      }
    });

    it('should format warn message correctly', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'format-warn-test');

      if (fs.existsSync(uniqueLogDir)) {
        fs.rmSync(uniqueLogDir, { recursive: true, force: true });
      }

      const logger = new Logger({
        logDir: uniqueLogDir,
        logLevel: 'info',
        module: testModule,
      });

      logger.warn('Warning message content');

      // Wait for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fs.readdirSync(uniqueLogDir);
      const logFile = files.find(f => f.endsWith('.log'));
      expect(logFile).toBeDefined();

      if (logFile) {
        const content = fs.readFileSync(path.join(uniqueLogDir, logFile), 'utf-8');
        // level 40 = warn
        expect(content).toContain('"level":40');
        expect(content).toContain('"module":"TestModule"');
        expect(content).toContain('Warning message content');
      }
    });

    it('should format error message correctly', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'format-error-test');

      if (fs.existsSync(uniqueLogDir)) {
        fs.rmSync(uniqueLogDir, { recursive: true, force: true });
      }

      const logger = new Logger({
        logDir: uniqueLogDir,
        logLevel: 'info',
        module: testModule,
      });

      logger.error('Error message content');

      // Wait for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fs.readdirSync(uniqueLogDir);
      const logFile = files.find(f => f.endsWith('.log'));
      expect(logFile).toBeDefined();

      if (logFile) {
        const content = fs.readFileSync(path.join(uniqueLogDir, logFile), 'utf-8');
        // level 50 = error
        expect(content).toContain('"level":50');
        expect(content).toContain('"module":"TestModule"');
        expect(content).toContain('Error message content');
      }
    });

    it('should include timestamp in ISO format', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'timestamp-test');

      if (fs.existsSync(uniqueLogDir)) {
        fs.rmSync(uniqueLogDir, { recursive: true, force: true });
      }

      const logger = new Logger({
        logDir: uniqueLogDir,
        logLevel: 'info',
        module: testModule,
      });

      logger.info('Timestamp test');

      // Wait for async write
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fs.readdirSync(uniqueLogDir);
      const logFile = files.find(f => f.endsWith('.log'));
      expect(logFile).toBeDefined();

      if (logFile) {
        const content = fs.readFileSync(path.join(uniqueLogDir, logFile), 'utf-8');
        // Should contain ISO timestamp: "2026-04-03T..."
        expect(content).toMatch(/"time":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
  });

  describe('M1.3.4 Log directory creation', () => {
    it('should create nested directories', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'nested', 'deep', 'log-dir');

      if (fs.existsSync(path.join(testLogDir, 'nested'))) {
        fs.rmSync(path.join(testLogDir, 'nested'), { recursive: true, force: true });
      }

      new Logger({
        logDir: uniqueLogDir,
        logLevel: 'info',
        module: testModule,
      });

      expect(fs.existsSync(uniqueLogDir)).toBe(true);
    });

    it('should handle existing directories gracefully', async () => {
      const { Logger } = await import('../../src/utils/logger');
      const uniqueLogDir = path.join(testLogDir, 'existing-dir-test');

      // Create directory first
      fs.mkdirSync(uniqueLogDir, { recursive: true });

      // Should not throw when directory exists
      expect(() => {
        new Logger({
          logDir: uniqueLogDir,
          logLevel: 'info',
          module: testModule,
        });
      }).not.toThrow();
    });
  });
});
