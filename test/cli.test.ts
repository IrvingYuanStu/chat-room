import * as yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

describe('M1.4 CLI Options and Parsing', () => {
  describe('M1.4.1 CLI Options Definition', () => {
    it('should export parseArgs function', async () => {
      const { parseArgs } = await import('../src/cli');
      expect(parseArgs).toBeDefined();
      expect(typeof parseArgs).toBe('function');
    });

    it('should return CLIOptions with all required properties', async () => {
      const { parseArgs } = await import('../src/cli');
      // Mock process.argv to avoid actual CLI parsing
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--zk-addresses=127.0.0.1:2181', '--port=9001']);

      process.argv = originalArgv;

      expect(result).toHaveProperty('zk-addresses');
      expect(result).toHaveProperty('port');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('nickname');
      expect(result).toHaveProperty('data-dir');
      expect(result).toHaveProperty('log-dir');
      expect(result).toHaveProperty('log-level');
      expect(result).toHaveProperty('help');
    });
  });

  describe('M1.4.2 yargs Parsing', () => {
    it('should parse --zk-addresses option correctly', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--zk-addresses=192.168.1.100:2181']);

      process.argv = originalArgv;

      expect(result['zk-addresses']).toBe('192.168.1.100:2181');
    });

    it('should parse multiple --zk-addresses separated by comma', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--zk-addresses=192.168.1.100:2181,192.168.1.101:2182']);

      process.argv = originalArgv;

      expect(result['zk-addresses']).toBe('192.168.1.100:2181,192.168.1.101:2182');
    });

    it('should parse --port option correctly', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--port=9002']);

      process.argv = originalArgv;

      expect(result.port).toBe(9002);
    });

    it('should parse --config option correctly', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--config=/custom/path/config.json']);

      process.argv = originalArgv;

      expect(result.config).toBe('/custom/path/config.json');
    });

    it('should parse --nickname option correctly', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--nickname=TestUser']);

      process.argv = originalArgv;

      expect(result.nickname).toBe('TestUser');
    });

    it('should parse --data-dir option correctly', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--data-dir=/custom/data']);

      process.argv = originalArgv;

      expect(result['data-dir']).toBe('/custom/data');
    });

    it('should parse --log-dir option correctly', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--log-dir=/custom/logs']);

      process.argv = originalArgv;

      expect(result['log-dir']).toBe('/custom/logs');
    });

    it('should parse --log-level option correctly', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--log-level=debug']);

      process.argv = originalArgv;

      expect(result['log-level']).toBe('debug');
    });

    it('should use default values when options not provided', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs([]);

      process.argv = originalArgv;

      expect(result['zk-addresses']).toBe('127.0.0.1:2181');
      expect(result.port).toBe(9001);
      expect(result.config).toBe('~/.chat-room/config.json');
      expect(result['data-dir']).toBe('/tmp/chat-room');
      expect(result['log-dir']).toBe('/tmp/chat-room/logs');
      expect(result['log-level']).toBe('info');
    });

    it('should validate log-level choices', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      // Valid log levels should not throw
      expect(() => parseArgs(['--log-level=debug'])).not.toThrow();
      expect(() => parseArgs(['--log-level=info'])).not.toThrow();
      expect(() => parseArgs(['--log-level=warn'])).not.toThrow();
      expect(() => parseArgs(['--log-level=error'])).not.toThrow();

      process.argv = originalArgv;
    });

    it('should validate port is a number', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--port=9005']);

      process.argv = originalArgv;

      expect(typeof result.port).toBe('number');
      expect(result.port).toBe(9005);
    });

    it('should handle combined short options', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      // yargs supports combining options but we primarily test long form
      const result = parseArgs(['--port=9001', '--nickname=Alice', '--log-level=debug']);

      process.argv = originalArgv;

      expect(result.port).toBe(9001);
      expect(result.nickname).toBe('Alice');
      expect(result['log-level']).toBe('debug');
    });

    it('should handle equals sign syntax', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--zk-addresses=127.0.0.1:2181', '--port=9002']);

      process.argv = originalArgv;

      expect(result['zk-addresses']).toBe('127.0.0.1:2181');
      expect(result.port).toBe(9002);
    });

    it('should handle space syntax', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--zk-addresses', '127.0.0.1:2181', '--port', '9002']);

      process.argv = originalArgv;

      expect(result['zk-addresses']).toBe('127.0.0.1:2181');
      expect(result.port).toBe(9002);
    });
  });

  describe('M1.4.3 CLI Help Information', () => {
    it('should include help option', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--help']);

      process.argv = originalArgv;

      expect(result.help).toBe(true);
    });

    it('should set help to false when not provided', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs([]);

      process.argv = originalArgv;

      expect(result.help).toBe(false);
    });
  });

  describe('CLI Options Type Validation', () => {
    it('should return zkAddresses as string type', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--zk-addresses=127.0.0.1:2181']);

      process.argv = originalArgv;

      expect(typeof result['zk-addresses']).toBe('string');
    });

    it('should return port as number type', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const result = parseArgs(['--port=9001']);

      process.argv = originalArgv;

      expect(typeof result.port).toBe('number');
    });

    it('should return log-level within valid choices', async () => {
      const { parseArgs } = await import('../src/cli');
      const originalArgv = process.argv;
      process.argv = ['node', 'chat-room'];

      const validLevels = ['debug', 'info', 'warn', 'error'];

      for (const level of validLevels) {
        const result = parseArgs([`--log-level=${level}`]);
        expect(validLevels).toContain(result['log-level']);
      }

      process.argv = originalArgv;
    });
  });
});
