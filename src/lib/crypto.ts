// Client-side encryption utilities using Web Crypto API

export class ChatCrypto {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Generate a new AES-GCM key
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // Export key to base64 string
  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  // Import key from base64 string
  static async importKey(keyString: string): Promise<CryptoKey> {
    const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // Encrypt message
  static async encrypt(message: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = this.encoder.encode(message);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt message
  static async decrypt(encryptedMessage: string, key: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data
    );

    return this.decoder.decode(decrypted);
  }

  // Generate room ID using cryptographically secure random
  static generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(8));
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    return result;
  }

  private static secureRandom(max: number): number {
    const arr = crypto.getRandomValues(new Uint32Array(1));
    return arr[0] % max;
  }

  // Generate anonymous display name
  static generateAnonymousName(): string {
    const adjectives = ['Swift', 'Bright', 'Clever', 'Quick', 'Silent', 'Mystic', 'Cosmic', 'Digital'];
    const nouns = ['Fox', 'Wolf', 'Eagle', 'Shark', 'Tiger', 'Dragon', 'Phoenix', 'Ninja'];

    const adj = adjectives[this.secureRandom(adjectives.length)];
    const noun = nouns[this.secureRandom(nouns.length)];
    const num = this.secureRandom(999) + 1;

    return `${adj}${noun}${num}`;
  }

  // Generate random emoji avatar
  static generateAvatar(): string {
    const emojis = ['🦊', '🐺', '🦅', '🦈', '🐅', '🐉', '🔥', '⚡', '🌟', '🎭', '🎪', '🎨', '🎯', '🎲', '🎸', '🎺'];
    return emojis[this.secureRandom(emojis.length)];
  }

  // Hash password for room protection using PBKDF2
  static async hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const saltBytes = salt
      ? Uint8Array.from(atob(salt), c => c.charCodeAt(0))
      : crypto.getRandomValues(new Uint8Array(16));
    const saltString = typeof salt === 'string' ? salt : btoa(String.fromCharCode(...saltBytes));

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      this.encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );

    const hashString = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
    return { hash: hashString, salt: saltString };
  }

  // Verify password
  static async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const { hash: newHash } = await this.hashPassword(password, salt);
    if (newHash.length !== hash.length) return false;
    let mismatch = 0;
    for (let i = 0; i < newHash.length; i++) {
      mismatch |= newHash.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return mismatch === 0;
  }
}
