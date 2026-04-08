/**
 * Application Entry Point
 * M1.9.1: Parse arguments → Load config → Connect ZK → Start P2P → Render UI
 */

import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import { parseArgs } from './cli';
import { initLogger, getLogger } from './utils/logger';
import { ConfigService } from './services/ConfigService';
import { ZKClient } from './network/ZKClient';
import { App } from './ui/App';
import { Config } from './services/types';

// Generate a unique user ID for this instance
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Parse ZooKeeper addresses from CLI string to array
function parseZkAddresses(input: string): string[] {
  return input.split(',').map(s => s.trim()).filter(Boolean);
}

// Global references for cleanup
let zkClient: ZKClient | null = null;
let loggerInitialized = false;

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  // Step 1: Parse CLI arguments
  const cliOptions = parseArgs();

  // Show help and exit if --help was passed
  if (cliOptions.help) {
    console.log(`
chat-room [options]

Options:
  --zk-addresses <addresses>  ZooKeeper server addresses (default: 127.0.0.1:2181)
  --port <port>               P2P listening port (default: 9001)
  --config <path>             Configuration file path (default: ~/.chat-room/config.json)
  --nickname <name>           Client nickname (default: User{xxx})
  --data-dir <path>            Data storage directory (default: /tmp/chat-room)
  --log-dir <path>             Log output directory (default: /tmp/chat-room/logs)
  --log-level <level>          Log level: debug/info/warn/error (default: info)
  --help                       Show help information
    `);
    process.exit(0);
  }

  // Step 2: Initialize logger
  try {
    initLogger({
      logDir: cliOptions['log-dir'],
      logLevel: cliOptions['log-level'],
      module: 'App'
    });
    loggerInitialized = true;
    const logger = getLogger();
    logger.info('Application starting...');
    logger.info(`Log level: ${cliOptions['log-level']}`);
    logger.info(`Log directory: ${cliOptions['log-dir']}`);
  } catch (error) {
    console.error('Failed to initialize logger:', error);
    process.exit(1);
  }

  const logger = getLogger();

  // Step 3: Load configuration
  let config: Config;
  try {
    const configService = new ConfigService({
      configPath: cliOptions.config
    });

    // Load existing config or use defaults
    config = await configService.load();

    // Override with CLI options (CLI takes precedence)
    config = {
      ...config,
      zkAddresses: parseZkAddresses(cliOptions['zk-addresses']),
      nickname: cliOptions.nickname || config.nickname,
      port: cliOptions.port || config.port,
      dataDir: cliOptions['data-dir'] || config.dataDir,
      logDir: cliOptions['log-dir'] || config.logDir,
      logLevel: cliOptions['log-level'] || config.logLevel
    };

    // Save updated config
    await configService.save(config);

    logger.info(`Configuration loaded: ${configService.getConfigPath()}`);
    logger.info(`ZooKeeper addresses: ${config.zkAddresses.join(', ')}`);
    logger.info(`Nickname: ${config.nickname}`);
    logger.info(`Port: ${config.port}`);
  } catch (error) {
    logger.error('Failed to load configuration:', error);
    process.exit(1);
  }

  // Generate user ID for this instance
  const userId = generateUserId();
  logger.info(`User ID: ${userId}`);

  // Step 4: Connect to ZooKeeper
  try {
    zkClient = new ZKClient({ logLevel: config.logLevel });
    logger.info(`Connecting to ZooKeeper: ${config.zkAddresses.join(', ')}`);

    await zkClient.connect(config.zkAddresses);
    logger.info('ZooKeeper connected successfully');

    // Ensure root node exists
    await zkClient.ensureRootNode();
    logger.info('ZooKeeper root node verified');
  } catch (error) {
    logger.error('Failed to connect to ZooKeeper:', error);
    logger.info('Application will continue but may not function properly without ZooKeeper');
    // Continue anyway - some features may work
  }

  // Step 5: Render UI
  logger.info('Rendering application UI...');

  // Set up cleanup handlers
  const cleanup = async (): Promise<void> => {
    logger.info('Cleaning up...');

    // Disconnect from ZooKeeper
    if (zkClient) {
      try {
        await zkClient.disconnect();
        logger.info('ZooKeeper disconnected');
      } catch (error) {
        logger.error('Error disconnecting from ZooKeeper:', error);
      }
    }

    // Close logger
    if (loggerInitialized) {
      const log = getLogger();
      log.close();
    }
  };

  // Handle interrupt signals
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await cleanup();
    process.exit(0);
  });

  // Render the App component
  try {
    const { waitUntilExit } = render(
      <App
        initialConfig={config}
        zkClient={zkClient ?? undefined}
      />
    );

    // Wait for the app to exit
    await waitUntilExit();

    // Cleanup after app exits
    await cleanup();
  } catch (error) {
    logger.error('Error rendering application:', error);
    await cleanup();
    process.exit(1);
  }

  logger.info('Application exited normally');
}

// Export for testing
export { main, parseZkAddresses, generateUserId };

// Run main if this is the entry point
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
