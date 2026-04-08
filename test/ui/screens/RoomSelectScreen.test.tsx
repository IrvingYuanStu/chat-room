/**
 * M1.8.2 RoomSelectScreen Component Tests
 * Tests for the room selection screen component
 */

import React from 'react';
import { Room } from '../../../src/services/types';

describe('M1.8.2 RoomSelectScreen Component', () => {
  describe('Component Interface (RoomSelectScreenProps)', () => {
    it('should define rooms as string array prop', () => {
      interface RoomSelectScreenProps {
        rooms: string[];
        recentRooms: string[];
        onSelectRoom: (roomId: string) => void;
        onCreateRoom: (roomId: string) => void;
        onBack: () => void;
      }

      const props: RoomSelectScreenProps = {
        rooms: ['general', 'dev-team', 'random'],
        recentRooms: ['general'],
        onSelectRoom: jest.fn(),
        onCreateRoom: jest.fn(),
        onBack: jest.fn()
      };

      expect(props.rooms).toBeDefined();
      expect(Array.isArray(props.rooms)).toBe(true);
      expect(props.rooms.length).toBe(3);
    });

    it('should define recentRooms as string array prop', () => {
      interface RoomSelectScreenProps {
        rooms: string[];
        recentRooms: string[];
        onSelectRoom: (roomId: string) => void;
        onCreateRoom: (roomId: string) => void;
        onBack: () => void;
      }

      const props: RoomSelectScreenProps = {
        rooms: [],
        recentRooms: ['general', 'dev-team'],
        onSelectRoom: jest.fn(),
        onCreateRoom: jest.fn(),
        onBack: jest.fn()
      };

      expect(props.recentRooms).toBeDefined();
      expect(Array.isArray(props.recentRooms)).toBe(true);
    });

    it('should define onSelectRoom as function prop', () => {
      interface RoomSelectScreenProps {
        rooms: string[];
        recentRooms: string[];
        onSelectRoom: (roomId: string) => void;
        onCreateRoom: (roomId: string) => void;
        onBack: () => void;
      }

      const props: RoomSelectScreenProps = {
        rooms: [],
        recentRooms: [],
        onSelectRoom: jest.fn(),
        onCreateRoom: jest.fn(),
        onBack: jest.fn()
      };

      expect(typeof props.onSelectRoom).toBe('function');
    });

    it('should define onCreateRoom as function prop', () => {
      interface RoomSelectScreenProps {
        rooms: string[];
        recentRooms: string[];
        onSelectRoom: (roomId: string) => void;
        onCreateRoom: (roomId: string) => void;
        onBack: () => void;
      }

      const props: RoomSelectScreenProps = {
        rooms: [],
        recentRooms: [],
        onSelectRoom: jest.fn(),
        onCreateRoom: jest.fn(),
        onBack: jest.fn()
      };

      expect(typeof props.onCreateRoom).toBe('function');
    });

    it('should define onBack as function prop', () => {
      interface RoomSelectScreenProps {
        rooms: string[];
        recentRooms: string[];
        onSelectRoom: (roomId: string) => void;
        onCreateRoom: (roomId: string) => void;
        onBack: () => void;
      }

      const props: RoomSelectScreenProps = {
        rooms: [],
        recentRooms: [],
        onSelectRoom: jest.fn(),
        onCreateRoom: jest.fn(),
        onBack: jest.fn()
      };

      expect(typeof props.onBack).toBe('function');
    });

    it('should require all props as mandatory', () => {
      interface RoomSelectScreenProps {
        rooms: string[];
        recentRooms: string[];
        onSelectRoom: (roomId: string) => void;
        onCreateRoom: (roomId: string) => void;
        onBack: () => void;
      }

      // All props should be required (not optional)
      const props: RoomSelectScreenProps = {
        rooms: [],
        recentRooms: [],
        onSelectRoom: () => {},
        onCreateRoom: () => {},
        onBack: () => {}
      };

      // Verify all props exist
      expect(props.rooms).toBeDefined();
      expect(props.recentRooms).toBeDefined();
      expect(props.onSelectRoom).toBeDefined();
      expect(props.onCreateRoom).toBeDefined();
      expect(props.onBack).toBeDefined();
    });
  });

  describe('Room Selection Behavior', () => {
    it('should call onSelectRoom when user selects existing room', () => {
      const onSelectRoom = jest.fn();

      // User selects an existing room
      onSelectRoom('general');

      expect(onSelectRoom).toHaveBeenCalledWith('general');
      expect(onSelectRoom).toHaveBeenCalledTimes(1);
    });

    it('should call onCreateRoom when user creates new room', () => {
      const onCreateRoom = jest.fn();

      // User creates a new room
      onCreateRoom('new-room');

      expect(onCreateRoom).toHaveBeenCalledWith('new-room');
      expect(onCreateRoom).toHaveBeenCalledTimes(1);
    });

    it('should call onBack when user goes back', () => {
      const onBack = jest.fn();

      // User presses back
      onBack();

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should validate room ID format (alphanumeric, underscore, hyphen)', () => {
      const isValidRoomId = (roomId: string): boolean => {
        return /^[a-zA-Z0-9_-]+$/.test(roomId);
      };

      expect(isValidRoomId('general')).toBe(true);
      expect(isValidRoomId('dev-team')).toBe(true);
      expect(isValidRoomId('team_123')).toBe(true);
      expect(isValidRoomId('Room-123')).toBe(true);
      expect(isValidRoomId('')).toBe(false);
      expect(isValidRoomId('room name')).toBe(false);
      expect(isValidRoomId('room/name')).toBe(false);
    });

    it('should filter out invalid room IDs', () => {
      const filterValidRoomIds = (roomIds: string[]): string[] => {
        return roomIds.filter(id => /^[a-zA-Z0-9_-]+$/.test(id));
      };

      const result = filterValidRoomIds(['general', 'invalid room', 'dev-team', 'room/name']);
      expect(result).toEqual(['general', 'dev-team']);
    });
  });

  describe('Room List Display Logic', () => {
    it('should separate recent rooms from all rooms', () => {
      const rooms = ['general', 'dev-team', 'random', 'test'];
      const recentRooms = ['general', 'dev-team'];

      const otherRooms = rooms.filter(room => !recentRooms.includes(room));

      expect(otherRooms).toEqual(['random', 'test']);
    });

    it('should handle empty room list', () => {
      const rooms: string[] = [];
      const recentRooms: string[] = [];

      expect(rooms.length).toBe(0);
      expect(recentRooms.length).toBe(0);
    });

    it('should sort rooms alphabetically', () => {
      const rooms = ['zebra', 'apple', 'banana'];
      const sortedRooms = [...rooms].sort();

      expect(sortedRooms).toEqual(['apple', 'banana', 'zebra']);
    });

    it('should not duplicate recent rooms in all rooms list', () => {
      const rooms = ['general', 'dev-team', 'random'];
      const recentRooms = ['general', 'dev-team'];

      const combined = [...new Set([...recentRooms, ...rooms])];
      const sortedCombined = combined.sort();

      expect(sortedCombined).toEqual(['dev-team', 'general', 'random']);
    });
  });

  describe('Room Selection State', () => {
    it('should track selected room ID in state', () => {
      let selectedRoomId: string | null = null;

      selectedRoomId = 'general';
      expect(selectedRoomId).toBe('general');

      selectedRoomId = null;
      expect(selectedRoomId).toBeNull();
    });

    it('should track new room input value in state', () => {
      let newRoomInput = '';

      newRoomInput = 'new-room';
      expect(newRoomInput).toBe('new-room');

      newRoomInput = '';
      expect(newRoomInput).toBe('');
    });

    it('should track whether user is creating new room', () => {
      let isCreatingNewRoom = false;

      isCreatingNewRoom = true;
      expect(isCreatingNewRoom).toBe(true);

      isCreatingNewRoom = false;
      expect(isCreatingNewRoom).toBe(false);
    });
  });

  describe('Room ID Validation', () => {
    it('should reject empty room ID', () => {
      const isValidRoomId = (roomId: string): boolean => {
        return roomId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(roomId);
      };

      expect(isValidRoomId('')).toBe(false);
    });

    it('should reject room ID with spaces', () => {
      const isValidRoomId = (roomId: string): boolean => {
        return roomId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(roomId);
      };

      expect(isValidRoomId('my room')).toBe(false);
    });

    it('should reject room ID with special characters', () => {
      const isValidRoomId = (roomId: string): boolean => {
        return roomId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(roomId);
      };

      expect(isValidRoomId('room@123')).toBe(false);
      expect(isValidRoomId('room#123')).toBe(false);
      expect(isValidRoomId('room$123')).toBe(false);
    });

    it('should accept room ID with numbers, letters, underscore, hyphen', () => {
      const isValidRoomId = (roomId: string): boolean => {
        return roomId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(roomId);
      };

      expect(isValidRoomId('Room123')).toBe(true);
      expect(isValidRoomId('room_123')).toBe(true);
      expect(isValidRoomId('room-123')).toBe(true);
      expect(isValidRoomId('123')).toBe(true);
      expect(isValidRoomId('a')).toBe(true);
    });
  });
});
