/**
 * CLI Module - Command Line Interface options and parsing
 * M1.4: Define CLI options, implement yargs parsing, and generate help information
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CLIOptions } from './services/types';

/**
 * Parse command line arguments using yargs
 * @param args - Command line arguments (defaults to process.argv if not provided)
 * @returns Parsed CLI options
 */
export function parseArgs(args?: string[]): CLIOptions {
  const argv = yargs(args || hideBin(process.argv))
    .option('zk-addresses', {
      type: 'string',
      default: '127.0.0.1:2181',
      describe: 'ZooKeeper server addresses, separated by commas',
      alias: 'z',
    })
    .option('port', {
      type: 'number',
      default: 9001,
      describe: 'P2P listening port',
      alias: 'p',
    })
    .option('config', {
      type: 'string',
      default: '~/.chat-room/config.json',
      describe: 'Configuration file path',
      alias: 'c',
    })
    .option('nickname', {
      type: 'string',
      default: generateDefaultNickname(),
      describe: 'Client nickname',
      alias: 'n',
    })
    .option('data-dir', {
      type: 'string',
      default: '/tmp/chat-room',
      describe: 'Data storage directory',
      alias: 'd',
    })
    .option('log-dir', {
      type: 'string',
      default: '/tmp/chat-room/logs',
      describe: 'Log output directory',
      alias: 'l',
    })
    .option('log-level', {
      type: 'string',
      default: 'info',
      describe: 'Log level: debug, info, warn, error',
      choices: ['debug', 'info', 'warn', 'error'],
      alias: 'v',
    })
    .option('help', {
      type: 'boolean',
      default: false,
      describe: 'Show help information',
      alias: 'h',
    })
    .strict(true)
    .exitProcess(false)
    .parse();

  return argv as CLIOptions;
}

/**
 * Generate a default nickname with random suffix
 * @returns Generated nickname in format "User{xxx}"
 */
function generateDefaultNickname(): string {
  const randomNum = Math.floor(100 + Math.random() * 900); // 100-999
  return `User${randomNum}`;
}

/**
 * Get help text for the CLI
 * @returns Formatted help string
 */
export function getHelpText(): string {
  return `
chat-room [options]

Options:
  --zk-addresses <addresses>  ZooKeeper server addresses, separated by commas (default: 127.0.0.1:2181)
  --port <port>               P2P listening port (default: 9001)
  --config <path>             Configuration file path (default: ~/.chat-room/config.json)
  --nickname <name>           Client nickname (default: User{xxx})
  --data-dir <path>           Data storage directory (default: /tmp/chat-room)
  --log-dir <path>            Log output directory (default: /tmp/chat-room/logs)
  --log-level <level>         Log level: debug/info/warn/error (default: info)
  --help                      Show help information

Examples:
  chat-room --zk-addresses "192.168.1.100:2181" --port 9001 --nickname "Alice"
  chat-room --log-dir ~/chat-room-logs --log-level debug
  chat-room --help
`;
}

// Export default for direct execution
export default parseArgs;
