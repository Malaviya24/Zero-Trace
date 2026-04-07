/**
 * SessionService - Handles room session persistence and restoration
 * Encapsulates all localStorage operations for room sessions
 */
const ROOM_ID_PATTERN = /^[A-Z0-9]{8}$/i;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MAX_AVATAR_LENGTH = 16;
const MAX_TOKEN_LENGTH = 512;
const MAX_EXPORTED_KEY_LENGTH = 4096;

type StoredRoomSession = {
  roomId: string;
  displayName: string;
  avatar: string;
  participantId: string;
  participantToken: string;
  encryptionKey: string;
  expiresAt: number;
};

export class SessionService {
  private static readonly SESSION_PREFIX = "room_session_";
  private static readonly SESSION_DURATION = 2 * 60 * 60 * 1000;

  static getSessionKey(roomId: string): string {
    return `${this.SESSION_PREFIX}${roomId}`;
  }

  private static isValidRoomId(roomId: string): boolean {
    return ROOM_ID_PATTERN.test(roomId.trim());
  }

  private static normalizeSession(session: unknown, roomId: string): StoredRoomSession | null {
    if (!session || typeof session !== "object") return null;
    const candidate = session as Partial<StoredRoomSession>;
    if (!this.isValidRoomId(roomId)) return null;
    if (typeof candidate.displayName !== "string" || !candidate.displayName.trim() || candidate.displayName.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      return null;
    }
    if (typeof candidate.avatar !== "string" || !candidate.avatar.trim() || candidate.avatar.length > MAX_AVATAR_LENGTH) {
      return null;
    }
    if (typeof candidate.participantId !== "string" || !candidate.participantId.trim() || candidate.participantId.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    if (typeof candidate.participantToken !== "string" || !candidate.participantToken.trim() || candidate.participantToken.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    if (typeof candidate.encryptionKey !== "string" || !candidate.encryptionKey.trim() || candidate.encryptionKey.length > MAX_EXPORTED_KEY_LENGTH) {
      return null;
    }
    if (typeof candidate.expiresAt !== "number" || !Number.isFinite(candidate.expiresAt)) {
      return null;
    }
    if (candidate.expiresAt <= Date.now()) {
      return null;
    }

    return {
      roomId: roomId.toUpperCase(),
      displayName: candidate.displayName.trim(),
      avatar: candidate.avatar.trim(),
      participantId: candidate.participantId.trim(),
      participantToken: candidate.participantToken.trim(),
      encryptionKey: candidate.encryptionKey.trim(),
      expiresAt: candidate.expiresAt,
    };
  }

  static saveSession(data: {
    roomId: string;
    displayName: string;
    avatar: string;
    participantId: string;
    participantToken: string;
    encryptionKey: string;
  }): void {
    try {
      const roomId = data.roomId.trim().toUpperCase();
      if (!this.isValidRoomId(roomId)) {
        throw new Error("Invalid room id");
      }

      const sessionData: StoredRoomSession = {
        roomId,
        displayName: data.displayName.trim(),
        avatar: data.avatar.trim(),
        participantId: data.participantId.trim(),
        participantToken: data.participantToken.trim(),
        encryptionKey: data.encryptionKey.trim(),
        expiresAt: Date.now() + this.SESSION_DURATION,
      };

      const normalized = this.normalizeSession(sessionData, roomId);
      if (!normalized) {
        throw new Error("Invalid session payload");
      }

      localStorage.setItem(this.getSessionKey(roomId), JSON.stringify(normalized));
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  }

  static loadSession(roomId: string): {
    displayName: string;
    avatar: string;
    participantId: string;
    participantToken: string;
    encryptionKey: string;
    expiresAt: number;
  } | null {
    try {
      const normalizedRoomId = roomId.trim().toUpperCase();
      if (!this.isValidRoomId(normalizedRoomId)) return null;

      const savedSession = localStorage.getItem(this.getSessionKey(normalizedRoomId));
      if (!savedSession) return null;

      const parsed = JSON.parse(savedSession);
      const session = this.normalizeSession(parsed, normalizedRoomId);
      if (!session) {
        this.clearSession(normalizedRoomId);
        return null;
      }

      return {
        displayName: session.displayName,
        avatar: session.avatar,
        participantId: session.participantId,
        participantToken: session.participantToken,
        encryptionKey: session.encryptionKey,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      console.error("Failed to load session:", error);
      this.clearSession(roomId);
      return null;
    }
  }

  static clearSession(roomId: string): void {
    try {
      const normalizedRoomId = roomId.trim().toUpperCase();
      if (!normalizedRoomId) return;
      localStorage.removeItem(this.getSessionKey(normalizedRoomId));
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  }

  static isSessionValid(roomId: string): boolean {
    return this.loadSession(roomId) !== null;
  }
}
