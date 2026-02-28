import { EncryptionService } from './EncryptionService';
import { SessionService } from './SessionService';

/**
 * RoomService - Handles room-related business logic
 * Coordinates between encryption, sessions, and room operations
 */
export class RoomService {
  private encryptionService: EncryptionService;
  private roomId: string;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.encryptionService = new EncryptionService();
  }

  async initializeFromUrl(hash: string): Promise<boolean> {
    try {
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const keyString = hashParams.get('k');

      if (keyString) {
        await this.encryptionService.importKey(decodeURIComponent(keyString));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize from URL:', error);
      return false;
    }
  }

  async restoreSession(): Promise<{
    displayName: string;
    avatar: string;
    participantId: string;
    encryptionKey: CryptoKey;
  } | null> {
    const session = SessionService.loadSession(this.roomId);
    if (!session) return null;

    try {
      const key = await this.encryptionService.importKey(session.encryptionKey);
      return {
        displayName: session.displayName,
        avatar: session.avatar,
        participantId: session.participantId,
        encryptionKey: key,
      };
    } catch (error) {
      console.error('Failed to restore session:', error);
      SessionService.clearSession(this.roomId);
      return null;
    }
  }

  async saveSession(data: {
    displayName: string;
    avatar: string;
    participantId: string;
  }): Promise<void> {
    const exportedKey = await this.encryptionService.exportKey();
    SessionService.saveSession({
      roomId: this.roomId,
      displayName: data.displayName,
      avatar: data.avatar,
      participantId: data.participantId,
      encryptionKey: exportedKey,
    });
  }

  clearSession(): void {
    SessionService.clearSession(this.roomId);
  }

  getEncryptionService(): EncryptionService {
    return this.encryptionService;
  }

  async generateInviteLink(baseUrl: string): Promise<string> {
    const exportedKey = await this.encryptionService.exportKey();
    const keyFragment = `#k=${encodeURIComponent(exportedKey)}`;
    return `${baseUrl}/join/${this.roomId}${keyFragment}`;
  }
}
