import type { Id } from "./_generated/dataModel";

type AnyCtx = {
  db: any;
  storage: {
    delete: (storageId: Id<"_storage">) => Promise<void>;
  };
};

export async function getRoomByRoomId(ctx: { db: any }, roomId: string) {
  return await ctx.db
    .query("rooms")
    .withIndex("by_room_id", (q: any) => q.eq("roomId", roomId))
    .first();
}

export function isRoomExpiredOrInactive(room: { isActive: boolean; expiresAt: number }, now = Date.now()) {
  return !room.isActive || room.expiresAt <= now;
}

async function safeDeleteRow(ctx: { db: any }, table: string, rawId: string) {
  const normalizedId = ctx.db.normalizeId(table, rawId);
  if (!normalizedId) return false;
  try {
    await ctx.db.delete(normalizedId);
    return true;
  } catch {
    return false;
  }
}

async function safeDeleteStorage(ctx: AnyCtx, storageId: string) {
  try {
    await ctx.storage.delete(storageId as Id<"_storage">);
  } catch {
    // Storage item may already be missing. Ignore to keep purge idempotent.
  }
}

export async function hardDeleteRoomData(ctx: AnyCtx, roomId: string) {
  const deletion = {
    signaling: 0,
    callParticipants: 0,
    calls: 0,
    participants: 0,
    messages: 0,
    storageObjects: 0,
    encryptionKeys: 0,
    joinAttempts: 0,
    linkPreviewCache: 0,
    room: 0,
  };

  const calls = await ctx.db
    .query("calls")
    .withIndex("by_room_id", (q: any) => q.eq("roomId", roomId))
    .collect();

  for (const call of calls) {
    const signals = await ctx.db
      .query("signaling")
      .withIndex("by_call_id", (q: any) => q.eq("callId", call._id))
      .collect();
    for (const signal of signals) {
      if (await safeDeleteRow(ctx, "signaling", String(signal._id))) {
        deletion.signaling += 1;
      }
    }

    const callParticipants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q: any) => q.eq("callId", call._id))
      .collect();
    for (const callParticipant of callParticipants) {
      if (await safeDeleteRow(ctx, "callParticipants", String(callParticipant._id))) {
        deletion.callParticipants += 1;
      }
    }
  }

  for (const call of calls) {
    if (await safeDeleteRow(ctx, "calls", String(call._id))) {
      deletion.calls += 1;
    }
  }

  const participants = await ctx.db
    .query("participants")
    .withIndex("by_room_id", (q: any) => q.eq("roomId", roomId))
    .collect();
  for (const participant of participants) {
    if (await safeDeleteRow(ctx, "participants", String(participant._id))) {
      deletion.participants += 1;
    }
  }

  const messages = await ctx.db
    .query("messages")
    .withIndex("by_room_id", (q: any) => q.eq("roomId", roomId))
    .collect();
  for (const message of messages) {
    if (message.storageId) {
      await safeDeleteStorage(ctx, String(message.storageId));
      deletion.storageObjects += 1;
    }
    if (await safeDeleteRow(ctx, "messages", String(message._id))) {
      deletion.messages += 1;
    }
  }

  const encryptionKeys = await ctx.db
    .query("encryptionKeys")
    .withIndex("by_room_id", (q: any) => q.eq("roomId", roomId))
    .collect();
  for (const key of encryptionKeys) {
    if (await safeDeleteRow(ctx, "encryptionKeys", String(key._id))) {
      deletion.encryptionKeys += 1;
    }
  }

  const joinAttemptsFailed = await ctx.db
    .query("joinAttempts")
    .withIndex("by_room_and_failed_and_created_at", (q: any) => q.eq("roomId", roomId).eq("failed", true))
    .collect();
  const joinAttemptsSuccess = await ctx.db
    .query("joinAttempts")
    .withIndex("by_room_and_failed_and_created_at", (q: any) => q.eq("roomId", roomId).eq("failed", false))
    .collect();
  const seenAttemptIds = new Set<string>();
  for (const attempt of [...joinAttemptsFailed, ...joinAttemptsSuccess]) {
    const attemptId = String(attempt._id);
    if (seenAttemptIds.has(attemptId)) continue;
    seenAttemptIds.add(attemptId);
    if (await safeDeleteRow(ctx, "joinAttempts", attemptId)) {
      deletion.joinAttempts += 1;
    }
  }

  const linkPreviewCache = await ctx.db
    .query("linkPreviewCache")
    .withIndex("by_room_and_url", (q: any) => q.eq("roomId", roomId))
    .collect();
  for (const preview of linkPreviewCache) {
    if (await safeDeleteRow(ctx, "linkPreviewCache", String(preview._id))) {
      deletion.linkPreviewCache += 1;
    }
  }

  const room = await getRoomByRoomId(ctx, roomId);
  if (room && (await safeDeleteRow(ctx, "rooms", String(room._id)))) {
    deletion.room = 1;
  }

  return deletion;
}
