export type CachedMessage = {
  _id: string;
  _creationTime: number;
  expiresAt?: number;
  selfDestructAt?: number;
};

export type ParticipantLike = {
  _id: string;
  displayName: string;
  avatar?: string;
};

export function mergeCachedMessages<T extends CachedMessage>(previous: T[], incoming?: T[]): T[] {
  const now = Date.now();
  const isVisible = (message: T) => {
    if (typeof message.expiresAt === "number" && message.expiresAt <= now) return false;
    if (typeof message.selfDestructAt === "number" && message.selfDestructAt <= now) return false;
    return true;
  };

  const previousVisible = previous.filter(isVisible);

  if (!incoming) {
    return previousVisible;
  }
  // Resilience: transient empty payloads can happen during auth/socket refresh.
  // Don't wipe UI history on those momentary states.
  if (incoming.length === 0) {
    return previousVisible;
  }

  // Merge incoming with cache by id and keep chronological order.
  const byId = new Map<string, T>();
  previousVisible.forEach((message) => byId.set(String(message._id), message));
  incoming.filter(isVisible).forEach((message) => byId.set(String(message._id), message));
  return Array.from(byId.values())
    .sort((a, b) => a._creationTime - b._creationTime)
    .slice(-600);
}

export function resolveRemoteCallName(
  participants: ParticipantLike[],
  localDisplayName: string,
  fallbackName: string,
  hasActiveCall: boolean
): string {
  const remote = participants.find((participant) => participant.displayName !== localDisplayName)?.displayName;
  if (remote) return remote;
  if (hasActiveCall) return fallbackName;
  return "Waiting for participant...";
}

export function shouldResetCallOverlay(status: string, hasActiveCall: boolean): boolean {
  if (hasActiveCall) return false;
  return status === "connecting" || status === "connected" || status === "reconnecting" || status === "ringing";
}

export function filterOtherParticipants<T extends ParticipantLike>(
  participants: T[] | undefined,
  myParticipantId: string | null,
  myDisplayName: string | null
): T[] {
  if (!participants) return [];
  return participants.filter((participant) => {
    if (myParticipantId) return participant._id !== myParticipantId;
    if (myDisplayName) return participant.displayName !== myDisplayName;
    return true;
  });
}

/** Normalize display name by stripping "(2)", "(3)" suffix for deduplication */
function getBaseDisplayName(displayName: string): string {
  const match = displayName.match(/^(.+?)\s*\(\d+\)\s*$/);
  return match ? match[1].trim() : displayName.trim();
}

export type CallParticipantLike = ParticipantLike & { userId?: string };

/**
 * Deduplicate call participants so one row per person:
 * - by userId when present (logged-in)
 * - by base displayName for anonymous (avoids "4 participants" when same person has 2 tabs)
 */
export function getUniqueCallParticipants<T extends CallParticipantLike>(
  participants: T[] | undefined
): T[] {
  if (!participants?.length) return [];
  const seen = new Map<string, T>();
  for (const p of participants) {
    const key = p.userId ? `user:${p.userId}` : `name:${getBaseDisplayName(p.displayName).toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return Array.from(seen.values());
}

/** Display name for UI: show base name only (no " (2)" suffix) when we deduped */
export function getDisplayNameForCall(name: string): string {
  return getBaseDisplayName(name);
}
