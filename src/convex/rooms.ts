import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { generateParticipantToken, requireRoomParticipantSession, sanitizeDisplayName, verifyRoomParticipantSession } from "./sessionAuth";
import { getRoomByRoomId as getRoomDocByRoomId, hardDeleteRoomData, isRoomExpiredOrInactive } from "./roomLifecycle";

async function cleanupExpiredData(ctx: { db: any; storage: any }, now: number) {
  const expiredRooms = await ctx.db
    .query("rooms")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();

  let hardDeletedRooms = 0;
  let hardDeletedStorageObjects = 0;

  for (const room of expiredRooms) {
    const deleted = await hardDeleteRoomData(ctx, room.roomId);
    if (deleted.room > 0) {
      hardDeletedRooms += 1;
      hardDeletedStorageObjects += deleted.storageObjects;
    }
  }

  const expiredSignals = await ctx.db
    .query("signaling")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();
  for (const signal of expiredSignals) {
    try {
      await ctx.db.delete(signal._id);
    } catch {
      // Ignore already-deleted rows.
    }
  }

  const expiredCallParticipants = await ctx.db
    .query("callParticipants")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();
  for (const participant of expiredCallParticipants) {
    try {
      await ctx.db.delete(participant._id);
    } catch {
      // Ignore already-deleted rows.
    }
  }

  const expiredCalls = await ctx.db
    .query("calls")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();
  for (const call of expiredCalls) {
    try {
      await ctx.db.delete(call._id);
    } catch {
      // Ignore already-deleted rows.
    }
  }

  const expiredKeys = await ctx.db
    .query("encryptionKeys")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();
  for (const key of expiredKeys) {
    try {
      await ctx.db.delete(key._id);
    } catch {
      // Ignore already-deleted rows.
    }
  }

  const expiredParticipants = await ctx.db
    .query("participants")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();

  for (const participant of expiredParticipants) {
    try {
      await ctx.db.delete(participant._id);
    } catch {
      // Ignore already-deleted rows.
    }
  }

  const expiredMessages = await ctx.db
    .query("messages")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();

  const selfDestructMessages = await ctx.db
    .query("messages")
    .withIndex("by_self_destruct", (q: any) => q.lt("selfDestructAt", now))
    .collect();

  const messageIdsToDelete = new Set<string>();
  for (const message of expiredMessages) {
    messageIdsToDelete.add(String(message._id));
  }
  for (const message of selfDestructMessages) {
    messageIdsToDelete.add(String(message._id));
  }

  for (const messageId of messageIdsToDelete) {
    const normalizedId = ctx.db.normalizeId("messages", messageId);
    if (normalizedId) {
      const message = await ctx.db.get(normalizedId);
      if (message?.storageId) {
        try {
          await ctx.storage.delete(message.storageId);
          hardDeletedStorageObjects += 1;
        } catch {
          // Ignore missing storage objects.
        }
      }
      try {
        await ctx.db.delete(normalizedId);
      } catch {
        // Ignore already-deleted rows.
      }
    }
  }

  const expiredAttempts = await ctx.db
    .query("joinAttempts")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();

  for (const attempt of expiredAttempts) {
    try {
      await ctx.db.delete(attempt._id);
    } catch {
      // Ignore already-deleted rows.
    }
  }

  const expiredLinkPreviews = await ctx.db
    .query("linkPreviewCache")
    .withIndex("by_expires_at", (q: any) => q.lt("expiresAt", now))
    .collect();

  for (const preview of expiredLinkPreviews) {
    try {
      await ctx.db.delete(preview._id);
    } catch {
      // Ignore already-deleted rows.
    }
  }

  return {
    expiredRooms: expiredRooms.length,
    hardDeletedRooms,
    hardDeletedStorageObjects,
    expiredSignals: expiredSignals.length,
    expiredCallParticipants: expiredCallParticipants.length,
    expiredCalls: expiredCalls.length,
    expiredKeys: expiredKeys.length,
    expiredMessages: expiredMessages.length,
    expiredParticipants: expiredParticipants.length,
    selfDestructMessages: selfDestructMessages.length,
    expiredAttempts: expiredAttempts.length,
    expiredLinkPreviews: expiredLinkPreviews.length,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(20);
  },
});

export const createRoom = mutation({
  args: {
    roomId: v.string(),
    name: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    settings: v.optional(
      v.object({
        selfDestruct: v.boolean(),
        screenshotProtection: v.optional(v.boolean()),
        linkPreviewsEnabled: v.optional(v.boolean()),
        keyRotationInterval: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const providedRoomId = (args.roomId || "").toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(providedRoomId)) {
      throw new Error("Invalid room code format. Must be 8 characters: A-Z, 0-9.");
    }

    if (args.name && args.name.length > 50) {
      throw new Error("Room name must be 50 characters or fewer.");
    }

    const maxParticipants = args.maxParticipants ?? 10;
    if (maxParticipants < 2 || maxParticipants > 50) {
      throw new Error("Max participants must be between 2 and 50.");
    }

    if (args.settings) {
      if (args.settings.keyRotationInterval <= 0 || !Number.isFinite(args.settings.keyRotationInterval)) {
        throw new Error("Key rotation interval must be a positive number.");
      }
    }

    if (args.passwordHash) {
      if (args.passwordHash.length < 20 || args.passwordHash.length > 100) {
        throw new Error("Invalid password verifier format.");
      }
      if (!args.passwordSalt || args.passwordSalt.length < 10 || args.passwordSalt.length > 100) {
        throw new Error("Invalid password salt format.");
      }
    }

    const now = Date.now();
    const expiresAt = now + 2 * 60 * 60 * 1000;

    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < 8; i += 1) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let finalRoomId = providedRoomId;
    for (let i = 0; i < 5; i += 1) {
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", finalRoomId))
        .first();
      if (!existing) break;
      finalRoomId = generateCode();
    }

    await ctx.db.insert("rooms", {
      roomId: finalRoomId,
      name: args.name,
      passwordVerifier: args.passwordHash,
      passwordSalt: args.passwordSalt,
      creatorId: undefined,
      isActive: true,
      maxParticipants,
      expiresAt,
      settings: {
        selfDestruct: args.settings?.selfDestruct ?? false,
        screenshotProtection: args.settings?.screenshotProtection ?? false,
        linkPreviewsEnabled: args.settings?.linkPreviewsEnabled ?? true,
        keyRotationInterval: args.settings?.keyRotationInterval ?? 50,
      },
    });

    return { roomId: finalRoomId };
  },
});

export const getRoomByRoomId = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoomDocByRoomId(ctx, args.roomId);

    if (!room) return null;
    if (isRoomExpiredOrInactive(room)) return null;

    return {
      _id: room._id,
      _creationTime: room._creationTime,
      roomId: room.roomId,
      name: room.name,
      isActive: room.isActive,
      maxParticipants: room.maxParticipants,
      expiresAt: room.expiresAt,
      settings: room.settings,
      creatorId: room.creatorId,
      hasPassword: !!room.passwordVerifier,
      passwordSalt: room.passwordSalt,
    };
  },
});

export const getJoinCapacity = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoomDocByRoomId(ctx, args.roomId);
    if (!room || isRoomExpiredOrInactive(room)) {
      return {
        exists: false,
        maxParticipants: 0,
        activeCount: 0,
        isFull: false,
      };
    }

    const activeParticipants = await ctx.db
      .query("participants")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const maxParticipants = room.maxParticipants || 10;
    const activeCount = activeParticipants.length;
    return {
      exists: true,
      maxParticipants,
      activeCount,
      isFull: activeCount >= maxParticipants,
    };
  },
});

export const purgeIfExpired = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoomDocByRoomId(ctx, args.roomId);
    if (!room) return { purged: false };
    if (!isRoomExpiredOrInactive(room)) return { purged: false };
    const deleted = await hardDeleteRoomData(ctx, args.roomId);
    return { purged: deleted.room > 0 };
  },
});

export const joinRoom = mutation({
  args: {
    roomId: v.string(),
    displayName: v.string(),
    avatar: v.string(),
    passwordHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sanitizedName = sanitizeDisplayName(args.displayName);
    if (!sanitizedName || sanitizedName.length > 30) {
      throw new Error("Display name must be 1-30 characters.");
    }

    const sanitizedAvatar = args.avatar.trim();
    if (!sanitizedAvatar || sanitizedAvatar.length > 10) {
      throw new Error("Invalid avatar.");
    }

    const room = await getRoomDocByRoomId(ctx, args.roomId);
    const now = Date.now();

    if (!room) {
      throw new Error("Room not found or expired");
    }

    if (isRoomExpiredOrInactive(room, now)) {
      await hardDeleteRoomData(ctx, args.roomId);
      throw new Error("Room not found or expired");
    }
    const windowMs = 10 * 60 * 1000;
    const threshold = 5;

    if (room.passwordVerifier) {
      if (!args.passwordHash) {
        await ctx.db.insert("joinAttempts", {
          roomId: args.roomId,
          failed: true,
          createdAt: now,
          expiresAt: now + windowMs,
        });
        throw new Error("Password required to join this room");
      }

      const recentFailed = await ctx.db
        .query("joinAttempts")
        .withIndex("by_room_and_failed_and_created_at", (q) =>
          q.eq("roomId", args.roomId).eq("failed", true).gt("createdAt", now - windowMs)
        )
        .collect();

      if (recentFailed.length >= threshold) {
        throw new Error("Too many incorrect password attempts. Try again later.");
      }

      if (args.passwordHash !== room.passwordVerifier) {
        await ctx.db.insert("joinAttempts", {
          roomId: args.roomId,
          failed: true,
          createdAt: now,
          expiresAt: now + windowMs,
        });
        throw new Error("Incorrect password");
      }

      await ctx.db.insert("joinAttempts", {
        roomId: args.roomId,
        failed: false,
        createdAt: now,
        expiresAt: now + windowMs,
      });
    }

    const activeParticipants = await ctx.db
      .query("participants")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (activeParticipants.length >= (room.maxParticipants || 10)) {
      throw new Error("Room is full");
    }

    const anyAdmin = activeParticipants.some((participant) => participant.role === "admin");
    const roleForUser = anyAdmin ? "member" : "admin";
    const participantToken = generateParticipantToken();
    const expiresAt = now + 2 * 60 * 60 * 1000;

    const participantId = await ctx.db.insert("participants", {
      roomId: args.roomId,
      userId: undefined,
      participantToken,
      displayName: sanitizedName,
      avatar: sanitizedAvatar,
      isActive: true,
      lastSeen: now,
      joinedAt: now,
      expiresAt,
      role: roleForUser,
      isTyping: false,
      typingUpdatedAt: now,
    });

    await ctx.db.insert("messages", {
      roomId: args.roomId,
      senderName: "System",
      senderAvatar: "bot",
      content: `${sanitizedName} joined the room`,
      messageType: "join",
      isRead: false,
      expiresAt,
      encryptionKeyId: "system",
    });

    return { participantId, participantToken };
  },
});

export const leaveRoom = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      requireActive: false,
    });

    if (!participant.isActive) {
      return;
    }

    await ctx.db.patch(participant._id, { isActive: false, isTyping: false });

    const now = Date.now();
    const expiresAt = now + 2 * 60 * 60 * 1000;
    await ctx.db.insert("messages", {
      roomId: args.roomId,
      senderName: "System",
      senderAvatar: "bot",
      content: `${participant.displayName} left the room`,
      messageType: "leave",
      isRead: false,
      expiresAt,
      encryptionKeyId: "system",
    });
  },
});

export const getRoomParticipants = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await verifyRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    if (!me) return [];

    return await ctx.db
      .query("participants")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const updateActivity = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    await ctx.db.patch(participant._id, { lastSeen: Date.now() });
  },
});

export const setTyping = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const participant = await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    await ctx.db.patch(participant._id, {
      isTyping: args.isTyping,
      typingUpdatedAt: Date.now(),
    });
  },
});

export const kickParticipant = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    callerParticipantId: v.id("participants"),
    callerParticipantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.callerParticipantId,
      participantToken: args.callerParticipantToken,
    });

    if (caller.role !== "admin") {
      throw new Error("Only the admin can perform this action");
    }

    const target = await ctx.db.get(args.participantId);
    if (!target || target.roomId !== args.roomId || !target.isActive) return;
    if (target.role === "admin") {
      throw new Error("Cannot kick the admin");
    }

    await ctx.db.patch(args.participantId, { isActive: false, isTyping: false });

    const now = Date.now();
    const expiresAt = now + 2 * 60 * 60 * 1000;
    await ctx.db.insert("messages", {
      roomId: args.roomId,
      senderName: "System",
      senderAvatar: "bot",
      content: `${target.displayName} was removed by admin`,
      messageType: "system",
      isRead: false,
      expiresAt,
      encryptionKeyId: "system",
    });
  },
});

export const clearParticipants = mutation({
  args: {
    roomId: v.string(),
    callerParticipantId: v.id("participants"),
    callerParticipantToken: v.string(),
    panic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const caller = await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.callerParticipantId,
      participantToken: args.callerParticipantToken,
    });

    if (caller.role !== "admin") {
      throw new Error("Only the admin can perform this action");
    }

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!room) return { success: true, destroyed: false };

    const allParticipants = await ctx.db
      .query("participants")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .collect();

    if (!args.panic) {
      for (const participant of allParticipants) {
        if (participant.isActive && participant.role !== "admin") {
          await ctx.db.patch(participant._id, { isActive: false, isTyping: false });
        }
      }
      return { success: true, destroyed: false };
    }

    await hardDeleteRoomData(ctx, args.roomId);

    return { success: true, destroyed: true };
  },
});

export const cleanupExpiredInternal = internalMutation({
  args: {},
  handler: async (ctx) => cleanupExpiredData(ctx, Date.now()),
});

export const cleanupExpired = mutation({
  args: {},
  handler: async (ctx) => cleanupExpiredData(ctx, Date.now()),
});
