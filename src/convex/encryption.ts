import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRoomParticipantSession } from "./sessionAuth";
import { getRoomByRoomId, hardDeleteRoomData, isRoomExpiredOrInactive } from "./roomLifecycle";

async function getActiveRoom(
  ctx: any,
  roomId: string,
  options: {
    purgeIfExpired?: boolean;
  } = {}
) {
  const room = await getRoomByRoomId(ctx, roomId);
  if (!room) {
    throw new Error("Room not found or expired");
  }
  if (isRoomExpiredOrInactive(room)) {
    if (options.purgeIfExpired) {
      await hardDeleteRoomData(ctx, roomId);
    }
    throw new Error("Room not found or expired");
  }
  return room;
}

async function requireAdminMembership(ctx: any, roomId: string, participantId: any, participantToken: string) {
  await getActiveRoom(ctx, roomId, { purgeIfExpired: true });
  const participant = await requireRoomParticipantSession(ctx, {
    roomId,
    participantId,
    participantToken,
  });
  if (participant.role !== "admin") {
    throw new Error("Only room admin can rotate keys");
  }
  return participant;
}

export const generateRoomKey = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    encryptedKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.encryptedKey.trim()) {
      throw new Error("Encrypted key is required.");
    }
    if (args.encryptedKey.length > 10000) {
      throw new Error("Encrypted key payload too large.");
    }

    await requireAdminMembership(ctx, args.roomId, args.participantId, args.participantToken);

    const now = Date.now();
    const keyId = `key_${now}_${Math.random().toString(36).slice(2, 11)}`;
    const expiresAt = now + 2 * 60 * 60 * 1000;

    const existingKeys = await ctx.db
      .query("encryptionKeys")
      .withIndex("by_room_id", (q: any) => q.eq("roomId", args.roomId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    for (const key of existingKeys) {
      await ctx.db.patch(key._id, { isActive: false });
    }

    const keyDocId = await ctx.db.insert("encryptionKeys", {
      roomId: args.roomId,
      keyId,
      encryptedKey: args.encryptedKey,
      createdAt: now,
      isActive: true,
      expiresAt,
    });

    return { keyId, keyDocId };
  },
});

export const getActiveRoomKey = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    await getActiveRoom(ctx, args.roomId);
    await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    return await ctx.db
      .query("encryptionKeys")
      .withIndex("by_room_id", (q: any) => q.eq("roomId", args.roomId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();
  },
});

export const rotateRoomKey = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    newEncryptedKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.newEncryptedKey.trim()) {
      throw new Error("Encrypted key is required.");
    }
    if (args.newEncryptedKey.length > 10000) {
      throw new Error("Encrypted key payload too large.");
    }

    await requireAdminMembership(ctx, args.roomId, args.participantId, args.participantToken);

    const now = Date.now();
    const keyId = `key_${now}_${Math.random().toString(36).slice(2, 11)}`;
    const expiresAt = now + 2 * 60 * 60 * 1000;

    const existingKeys = await ctx.db
      .query("encryptionKeys")
      .withIndex("by_room_id", (q: any) => q.eq("roomId", args.roomId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    for (const key of existingKeys) {
      await ctx.db.patch(key._id, { isActive: false });
    }

    const keyDocId = await ctx.db.insert("encryptionKeys", {
      roomId: args.roomId,
      keyId,
      encryptedKey: args.newEncryptedKey,
      createdAt: now,
      isActive: true,
      expiresAt,
    });

    return { keyId, keyDocId };
  },
});
