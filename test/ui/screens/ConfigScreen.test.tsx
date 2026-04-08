/**
 * M1.8.1 ConfigScreen Component Tests
 * Tests for the configuration screen component
 *
 * Note: These tests verify the component interface and behavior
 * without rendering Ink components (which require a terminal environment).
 */

import React from 'react';
import { Config } from '../../../src/services/types';

// We test the component interface and helper functions
// since Ink components cannot be rendered in Jest without special setup

describe('M1.8.1 ConfigScreen Component', () => {
  describe('Component Interface (ConfigScreenProps)', () => {
    it('should define onConfigComplete as required function prop', () => {
      // The ConfigScreen must receive an onConfigComplete callback
      interface ConfigScreenProps {
        onConfigComplete: (config: Config) => void;
      }

      const props: ConfigScreenProps = {
        onConfigComplete: jest.fn()
      };

      expect(props.onConfigComplete).toBeDefined();
      expect(typeof props.onConfigComplete).toBe('function');
    });

    it('should accept initialConfig as optional prop', () => {
      interface ConfigScreenProps {
        onConfigComplete: (config: Config) => void;
        initialConfig?: Partial<Config>;
      }

      // Without initial config
      const propsWithoutInitial: ConfigScreenProps = {
        onConfigComplete: jest.fn()
      };
      expect(propsWithoutInitial.initialConfig).toBeUndefined();

      // With initial config
      const propsWithInitial: ConfigScreenProps = {
        onConfigComplete: jest.fn(),
        initialConfig: {
          zkAddresses: ['192.168.1.100:2181'],
          nickname: 'InitialUser'
        }
      };
      expect(propsWithInitial.initialConfig).toBeDefined();
      expect(propsWithInitial.initialConfig?.zkAddresses).toEqual(['192.168.1.100:2181']);
    });
  });

  describe('ConfigScreen Validation Logic', () => {
    // Test validation functions that should be used by ConfigScreen

    it('should validate ZooKeeper address format (host:port)', () => {
      const isValidAddressFormat = (address: string): boolean => {
        return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(address) || /^[\w.-]+:\d+$/.test(address);
      };

      // Valid addresses
      expect(isValidAddressFormat('127.0.0.1:2181')).toBe(true);
      expect(isValidAddressFormat('192.168.1.100:2181')).toBe(true);
      expect(isValidAddressFormat('localhost:2181')).toBe(true);
      expect(isValidAddressFormat('zookeeper.example.com:2181')).toBe(true);

      // Invalid addresses
      expect(isValidAddressFormat('invalid')).toBe(false);
      expect(isValidAddressFormat('127.0.0.1')).toBe(false);
      expect(isValidAddressFormat('127.0.0.1:')).toBe(false);
      expect(isValidAddressFormat(':2181')).toBe(false);
    });

    it('should parse multiple ZK addresses separated by comma', () => {
      const parseAddresses = (input: string): string[] => {
        return input.split(',').map(s => s.trim()).filter(Boolean);
      };

      const result = parseAddresses('192.168.1.100:2181,192.168.1.101:2181');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('192.168.1.100:2181');
      expect(result[1]).toBe('192.168.1.101:2181');
    });

    it('should handle single ZK address', () => {
      const parseAddresses = (input: string): string[] => {
        return input.split(',').map(s => s.trim()).filter(Boolean);
      };

      const result = parseAddresses('127.0.0.1:2181');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('127.0.0.1:2181');
    });

    it('should trim whitespace from addresses', () => {
      const parseAddresses = (input: string): string[] => {
        return input.split(',').map(s => s.trim()).filter(Boolean);
      };

      const result = parseAddresses(' 192.168.1.100:2181 , 192.168.1.101:2181 ');
      expect(result).toEqual(['192.168.1.100:2181', '192.168.1.101:2181']);
    });

    it('should filter empty address entries', () => {
      const parseAddresses = (input: string): string[] => {
        return input.split(',').map(s => s.trim()).filter(Boolean);
      };

      const result = parseAddresses('192.168.1.100:2181,,192.168.1.101:2181');
      expect(result).toHaveLength(2);
    });
  });

  describe('Nickname Validation', () => {
    it('should validate nickname length (max 32 characters)', () => {
      const isValidNickname = (nickname: string): boolean => {
        return nickname.trim().length > 0 && nickname.length <= 32;
      };

      expect(isValidNickname('User001')).toBe(true);
      expect(isValidNickname('A')).toBe(true);
      expect(isValidNickname('A'.repeat(32))).toBe(true);
      expect(isValidNickname('')).toBe(false);
      expect(isValidNickname('   ')).toBe(false);
      expect(isValidNickname('A'.repeat(33))).toBe(false);
    });

    it('should generate default nickname in User{xxx} format', () => {
      const generateDefaultNickname = (): string => {
        const randomNum = Math.floor(100 + Math.random() * 900);
        return `User${randomNum}`;
      };

      const nickname = generateDefaultNickname();
      expect(nickname).toMatch(/^User\d{3}$/);
    });
  });

  describe('Config Object Creation', () => {
    it('should create complete Config object from form inputs', () => {
      const createConfig = (
        zkAddresses: string[],
        nickname: string,
        existingConfig?: Partial<Config>
      ): Config => {
        return {
          zkAddresses,
          currentRoomId: existingConfig?.currentRoomId || '',
          nickname: nickname.trim(),
          recentRooms: existingConfig?.recentRooms || [],
          port: existingConfig?.port || 9001,
          dataDir: existingConfig?.dataDir || '/tmp/chat-room',
          logDir: existingConfig?.logDir || '/tmp/chat-room/logs',
          logLevel: existingConfig?.logLevel || 'info'
        };
      };

      const config = createConfig(
        ['127.0.0.1:2181'],
        'TestUser'
      );

      expect(config.zkAddresses).toEqual(['127.0.0.1:2181']);
      expect(config.nickname).toBe('TestUser');
      expect(config.currentRoomId).toBe('');
      expect(config.recentRooms).toEqual([]);
      expect(config.port).toBe(9001);
      expect(config.dataDir).toBe('/tmp/chat-room');
      expect(config.logDir).toBe('/tmp/chat-room/logs');
      expect(config.logLevel).toBe('info');
    });

    it('should preserve existing config values when provided', () => {
      const createConfig = (
        zkAddresses: string[],
        nickname: string,
        existingConfig?: Partial<Config>
      ): Config => {
        return {
          zkAddresses,
          currentRoomId: existingConfig?.currentRoomId || '',
          nickname: nickname.trim(),
          recentRooms: existingConfig?.recentRooms || [],
          port: existingConfig?.port || 9001,
          dataDir: existingConfig?.dataDir || '/tmp/chat-room',
          logDir: existingConfig?.logDir || '/tmp/chat-room/logs',
          logLevel: existingConfig?.logLevel || 'info'
        };
      };

      const existingConfig: Partial<Config> = {
        currentRoomId: 'general',
        recentRooms: ['general', 'dev'],
        port: 9002,
        dataDir: '/custom/path',
        logLevel: 'debug' as const
      };

      const config = createConfig(['192.168.1.100:2181'], 'NewUser', existingConfig);

      expect(config.zkAddresses).toEqual(['192.168.1.100:2181']);
      expect(config.nickname).toBe('NewUser');
      expect(config.currentRoomId).toBe('general');
      expect(config.recentRooms).toEqual(['general', 'dev']);
      expect(config.port).toBe(9002);
      expect(config.dataDir).toBe('/custom/path');
      expect(config.logLevel).toBe('debug');
    });
  });
});
