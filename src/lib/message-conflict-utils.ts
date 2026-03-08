export interface ReadPatchInput {
  isRead: boolean;
  readAt?: number;
  selfDestructAt?: number;
}

export interface ReadPatch {
  isRead: true;
  readAt: number;
  selfDestructAt?: number;
}

const SELF_DESTRUCT_AFTER_READ_MS = 10 * 60 * 1000;

export function computeReadPatch(message: ReadPatchInput, now: number): ReadPatch | null {
  if (message.isRead) {
    return null;
  }

  const patch: ReadPatch = {
    isRead: true,
    readAt: now,
  };

  if (typeof message.selfDestructAt === "number" && !message.readAt) {
    patch.selfDestructAt = now + SELF_DESTRUCT_AFTER_READ_MS;
  }

  return patch;
}

export function shouldSendReadMark(
  messageId: string,
  messageIsRead: boolean,
  senderName: string,
  displayName: string,
  alreadyMarked: Set<string>
): boolean {
  if (messageIsRead) return false;
  if (senderName === displayName) return false;
  if (alreadyMarked.has(messageId)) return false;
  return true;
}

