import { ChatCrypto } from '@/lib/crypto';

/**
 * EncryptionService - Manages encryption keys and operations
 * Provides a clean interface for all encryption-related functionality
 */
export class EncryptionService {
  private key: CryptoKey | null = null;

  async generateKey(): Promise<CryptoKey> {
    this.key = await ChatCrypto.generateKey();
    return this.key;
  }

  async importKey(keyString: string): Promise<CryptoKey> {
    this.key = await ChatCrypto.importKey(keyString);
    return this.key;
  }

  async exportKey(): Promise<string> {
    if (!this.key) {
      throw new Error('No encryption key available to export');
    }
    return await ChatCrypto.exportKey(this.key);
  }

  async encrypt(content: string): Promise<string> {
    if (!this.key) {
      throw new Error('No encryption key available');
    }
    return await ChatCrypto.encrypt(content, this.key);
  }

  async decrypt(encryptedContent: string): Promise<string> {
    if (!this.key) {
      throw new Error('No encryption key available');
    }
    return await ChatCrypto.decrypt(encryptedContent, this.key);
  }

  getKey(): CryptoKey | null {
    return this.key;
  }

  setKey(key: CryptoKey): void {
    this.key = key;
  }

  hasKey(): boolean {
    return this.key !== null;
  }

  static generateAnonymousIdentity(): { displayName: string; avatar: string } {
    return {
      displayName: ChatCrypto.generateAnonymousName(),
      avatar: ChatCrypto.generateAvatar(),
    };
  }

  static async hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    return await ChatCrypto.hashPassword(password, salt);
  }
}
