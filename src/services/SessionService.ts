/**
 * SessionService - Handles room session persistence and restoration
 * Encapsulates all localStorage operations for room sessions
 */
export class SessionService {
  private static readonly SESSION_PREFIX = 'room_session_';
  private static readonly SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours

  static getSessionKey(roomId: string): string {
    return `${this.SESSION_PREFIX}${roomId}`;
  }

  static saveSession(data: {
    roomId: string;
    displayName: string;
    avatar: string;
    participantId: string;
    encryptionKey: string;
  }): void {
    try {
      const sessionData = {
        ...data,
        expiresAt: Date.now() + this.SESSION_DURATION,
      };
      localStorage.setItem(
        this.getSessionKey(data.roomId),
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  static loadSession(roomId: string): {
    displayName: string;
    avatar: string;
    participantId: string;
    encryptionKey: string;
    expiresAt: number;
  } | null {
    try {
      const sessionKey = this.getSessionKey(roomId);
      const savedSession = localStorage.getItem(sessionKey);

      if (!savedSession) return null;

      const session = JSON.parse(savedSession);

      // Check if session is expired
      if (session.expiresAt && session.expiresAt <= Date.now()) {
        this.clearSession(roomId);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to load session:', error);
      this.clearSession(roomId);
      return null;
    }
  }

  static clearSession(roomId: string): void {
    try {
      localStorage.removeItem(this.getSessionKey(roomId));
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  static isSessionValid(roomId: string): boolean {
    const session = this.loadSession(roomId);
    return session !== null;
  }
}
