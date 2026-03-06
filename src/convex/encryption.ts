import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./users";

type Ctx = MutationCtx | QueryCtx;

async function requireAuthenticatedUser(ctx: Ctx) {
  const user = await getCurrentUser(ctx as never);
  if (!user?._id) {
    throw new Error("Unauthorized");
  }
  return user;
}

async function getActiveRoom(ctx: Ctx, roomId: string) {
  const room = await ctx.db
    .query("rooms")
    .withIndex("by_room_id", (q) => q.eq("roomId", roomId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();
  if (!room || room.expiresAt < Date.now()) {
    throw new Error("Room not found or expired");
  }
  return room;
}

async function getActiveMembership(ctx: Ctx, roomId: string, userId: Id<"users">) {
  return await ctx.db
    .query("participants")
    .withIndex("by_room_and_user", (q) =>
      q.eq("roomId", roomId).eq("userId", userId)
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();
}

// Generate new encryption key for room
export const generateRoomKey = mutation({
  args: {
    roomId: v.string(),
    encryptedKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const user = await requireAuthenticatedUser(ctx);
      // Validate input
      if (!args.encryptedKey.trim()) {
        throw new Error("Encrypted key is required.");
      }
      if (args.encryptedKey.length > 10000) {
        throw new Error("Encrypted key payload too large.");
      }

      const room = await getActiveRoom(ctx, args.roomId);
      const membership = await getActiveMembership(ctx, args.roomId, user._id);
      const isAdmin = (room.creatorId && room.creatorId === user._id) || membership?.role === "admin";
      if (!isAdmin) {
        throw new Error("Only room admin can rotate keys");
      }

      const now = Date.now();
      const keyId = `key_${now}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = now + 2 * 60 * 60 * 1000; // 2 hours TTL

      // Deactivate previous keys
      const existingKeys = await ctx.db
        .query("encryptionKeys")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const key of existingKeys) {
        await ctx.db.patch(key._id, { isActive: false });
      }

      // Create new key
      const keyDocId = await ctx.db.insert("encryptionKeys", {
        roomId: args.roomId,
        keyId,
        encryptedKey: args.encryptedKey,
        createdAt: now,
        isActive: true,
        expiresAt,
      });

      return { keyId, keyDocId };
    } catch (e) {
      console.error("encryption.generateRoomKey error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Get active encryption key for room
export const getActiveRoomKey = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    try {
      const user = await requireAuthenticatedUser(ctx);
      await getActiveRoom(ctx, args.roomId);
      const membership = await getActiveMembership(ctx, args.roomId, user._id);
      if (!membership) {
        throw new Error("Unauthorized");
      }

      return await ctx.db
        .query("encryptionKeys")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
    } catch (e) {
      console.error("encryption.getActiveRoomKey error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Rotate encryption key
export const rotateRoomKey = mutation({
  args: {
    roomId: v.string(),
    newEncryptedKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const user = await requireAuthenticatedUser(ctx);
      // Validate input
      if (!args.newEncryptedKey.trim()) {
        throw new Error("Encrypted key is required.");
      }
      if (args.newEncryptedKey.length > 10000) {
        throw new Error("Encrypted key payload too large.");
      }

      const room = await getActiveRoom(ctx, args.roomId);
      const membership = await getActiveMembership(ctx, args.roomId, user._id);
      const isAdmin = (room.creatorId && room.creatorId === user._id) || membership?.role === "admin";
      if (!isAdmin) {
        throw new Error("Only room admin can rotate keys");
      }

      const now = Date.now();
      const keyId = `key_${now}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = now + 2 * 60 * 60 * 1000;

      // Deactivate previous keys
      const existingKeys = await ctx.db
        .query("encryptionKeys")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const key of existingKeys) {
        await ctx.db.patch(key._id, { isActive: false });
      }

      // Create new key
      const keyDocId = await ctx.db.insert("encryptionKeys", {
        roomId: args.roomId,
        keyId,
        encryptedKey: args.newEncryptedKey,
        createdAt: now,
        isActive: true,
        expiresAt,
      });

      return { keyId, keyDocId };
    } catch (e) {
      console.error("encryption.rotateRoomKey error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});
