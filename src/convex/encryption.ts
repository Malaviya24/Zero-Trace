import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Generate new encryption key for room
export const generateRoomKey = mutation({
  args: {
    roomId: v.string(),
    encryptedKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Validate input
      if (!args.encryptedKey.trim()) {
        throw new Error("Encrypted key is required.");
      }
      if (args.encryptedKey.length > 10000) {
        throw new Error("Encrypted key payload too large.");
      }

      // Validate room exists and is active / not expired
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!room || room.expiresAt < Date.now()) {
        throw new Error("Room not found or expired");
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
      // Validate input
      if (!args.newEncryptedKey.trim()) {
        throw new Error("Encrypted key is required.");
      }
      if (args.newEncryptedKey.length > 10000) {
        throw new Error("Encrypted key payload too large.");
      }

      // Validate room exists and is active / not expired
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!room || room.expiresAt < Date.now()) {
        throw new Error("Room not found or expired");
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