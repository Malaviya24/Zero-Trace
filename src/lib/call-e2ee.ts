import { ChatCrypto } from "@/lib/crypto";

type EncryptedSignalEnvelope = {
  v: 1;
  e2ee: true;
  payload: string;
};

function isEncryptedSignalEnvelope(value: unknown): value is EncryptedSignalEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const envelope = value as Partial<EncryptedSignalEnvelope>;
  return envelope.v === 1 && envelope.e2ee === true && typeof envelope.payload === "string";
}

export async function encryptCallSignalPayload(
  payload: unknown,
  key: CryptoKey | null,
  e2eeEnabled: boolean
): Promise<string> {
  const rawPayload = JSON.stringify(payload);
  if (!e2eeEnabled) return rawPayload;
  if (!key) {
    throw new Error("Missing call encryption key");
  }
  const ciphertext = await ChatCrypto.encrypt(rawPayload, key);
  return JSON.stringify({
    v: 1,
    e2ee: true,
    payload: ciphertext,
  } satisfies EncryptedSignalEnvelope);
}

export async function decryptCallSignalPayload(
  data: string,
  key: CryptoKey | null,
  e2eeEnabled: boolean
): Promise<string> {
  if (!e2eeEnabled) return data;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error("Invalid encrypted signaling payload");
  }

  if (isEncryptedSignalEnvelope(parsed)) {
    if (!key) {
      throw new Error("Missing call encryption key");
    }
    return ChatCrypto.decrypt(parsed.payload, key);
  }

  // Backward compatibility for existing clients still emitting plaintext signaling.
  return data;
}

export function resolveStoredCallKeyString(roomId?: string | null): string | null {
  try {
    const direct = sessionStorage.getItem("call_e2ee_key");
    if (direct) {
      const directRoomId = sessionStorage.getItem("call_e2ee_room_id");
      if (!roomId || !directRoomId || directRoomId === roomId) {
        return direct;
      }
    }
  } catch {
    // ignore
  }

  if (!roomId) return null;

  try {
    const rawSession = localStorage.getItem(`room_session_${roomId}`);
    if (!rawSession) return null;
    const parsed = JSON.parse(rawSession);
    return typeof parsed?.encryptionKey === "string" ? parsed.encryptionKey : null;
  } catch {
    return null;
  }
}
