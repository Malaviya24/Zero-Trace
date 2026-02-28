import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Create a new chat room
export const createRoom = mutation({
  args: {
    roomId: v.string(),
    name: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    settings: v.optional(v.object({
      selfDestruct: v.boolean(),
      screenshotProtection: v.boolean(),
      keyRotationInterval: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    try {
      // Server-side validation
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
          throw new Error("Invalid password hash format.");
        }
        if (!args.passwordSalt || args.passwordSalt.length < 10 || args.passwordSalt.length > 100) {
          throw new Error("Invalid password salt format.");
        }
      }

      const user = await getCurrentUser(ctx);
      const now = Date.now();
      const expiresAt = now + (2 * 60 * 60 * 1000); // 2 hours TTL

      const generateCode = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        if (typeof crypto !== "undefined" && crypto.getRandomValues) {
          const bytes = new Uint8Array(8);
          crypto.getRandomValues(bytes);
          for (let i = 0; i < 8; i++) {
            result += chars.charAt(bytes[i] % chars.length);
          }
        } else {
          for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        }
        return result;
      };

      let finalRoomId = providedRoomId;
      for (let i = 0; i < 5; i++) {
        const existing = await ctx.db
          .query("rooms")
          .withIndex("by_room_id", (q) => q.eq("roomId", finalRoomId))
          .first();
        if (!existing) break;
        finalRoomId = generateCode();
      }

      try {
        await ctx.db.insert("rooms", {
          roomId: finalRoomId,
          name: args.name,
          passwordHash: args.passwordHash,
          passwordSalt: args.passwordSalt,
          creatorId: user?._id,
          isActive: true,
          maxParticipants,
          expiresAt,
          settings: args.settings || {
            selfDestruct: false,
            screenshotProtection: true,
            keyRotationInterval: 50,
          },
        });
      } catch (e) {
        throw new Error("Failed to create room. Please try again.");
      }

      return { roomId: finalRoomId };
    } catch (e) {
      console.error("rooms.createRoom error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Get room by roomId - strips sensitive fields before returning to client
export const getRoomByRoomId = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    try {
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!room) return null;

      if (room.expiresAt < Date.now()) {
        return null;
      }

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
        hasPassword: !!room.passwordHash,
        passwordSalt: room.passwordSalt,
      };
    } catch (e) {
      console.error("rooms.getRoomByRoomId error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Join a room
export const joinRoom = mutation({
  args: {
    roomId: v.string(),
    displayName: v.string(),
    avatar: v.string(),
    passwordHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const sanitizedName = args.displayName.replace(/[<>&"'`]/g, '').trim();
      if (!sanitizedName || sanitizedName.length > 30) {
        throw new Error("Display name must be 1-30 characters.");
      }
      const sanitizedAvatar = args.avatar.trim();
      if (!sanitizedAvatar || sanitizedAvatar.length > 10) {
        throw new Error("Invalid avatar.");
      }

      const user = await getCurrentUser(ctx);
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!room) {
        throw new Error("Room not found or expired");
      }
      if (room.expiresAt < Date.now()) {
        throw new Error("Room not found or expired");
      }

      const anyAdmin = await ctx.db
        .query("participants")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .first()
        .then(async (firstRow) => {
          if (!firstRow) return false;
          // Collect a small batch to check quickly
          const batch = await ctx.db
            .query("participants")
            .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
            .collect();
          return batch.some((p) => p.role === "admin");
        });

      // Decide role for this joiner:
      // - admin if signed-in creator
      // - else, if room has no creatorId and no admin exists yet, first joiner becomes admin
      const roleForUser =
        user?._id && room!.creatorId && user._id === room!.creatorId
          ? "admin"
          : !room!.creatorId && !anyAdmin
          ? "admin"
          : "member";

      const now = Date.now();
      const windowMs = 10 * 60 * 1000;
      const threshold = 5;

      if (room.passwordHash) {
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

        if (args.passwordHash !== room.passwordHash) {
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

      const currentParticipants = await ctx.db
        .query("participants")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      if (currentParticipants.length >= (room.maxParticipants || 10)) {
        throw new Error("Room is full");
      }

      // Only try to find existing participant if we have a signed-in user
      let existingParticipant = null as null | any;
      if (user?._id) {
        existingParticipant = await ctx.db
          .query("participants")
          .withIndex("by_room_and_user", (q) =>
            q.eq("roomId", args.roomId).eq("userId", user._id)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
      }

      if (existingParticipant) {
        await ctx.db.patch(existingParticipant._id, {
          displayName: sanitizedName,
          avatar: sanitizedAvatar,
          lastSeen: Date.now(),
          role: roleForUser,
        });
        return existingParticipant._id;
      }

      const joinedAt = Date.now();
      const expiresAt = joinedAt + 2 * 60 * 60 * 1000;

      const participantId = await ctx.db.insert("participants", {
        roomId: args.roomId,
        userId: user?._id,
        displayName: sanitizedName,
        avatar: sanitizedAvatar,
        isActive: true,
        lastSeen: joinedAt,
        joinedAt,
        expiresAt,
        role: roleForUser,
        isTyping: false,
        typingUpdatedAt: joinedAt,
      });

      await ctx.db.insert("messages", {
        roomId: args.roomId,
        senderName: "System",
        senderAvatar: "🤖",
        content: `${sanitizedName} joined the room`,
        messageType: "join",
        isRead: false,
        expiresAt,
        encryptionKeyId: "system",
      });

      return participantId;
    } catch (e) {
      console.error("rooms.joinRoom error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Leave a room
export const leaveRoom = mutation({
  args: { roomId: v.string(), participantId: v.optional(v.id("participants")) },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);

      // Resolve participant:
      // - If signed in, find by room+user
      // - Else, fall back to provided participantId
      let participant: any | null = null;

      if (user?._id) {
        participant = await ctx.db
          .query("participants")
          .withIndex("by_room_and_user", (q) =>
            q.eq("roomId", args.roomId).eq("userId", user._id)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
      } else if (args.participantId) {
        const maybe = await ctx.db.get(args.participantId);
        if (maybe && maybe.roomId === args.roomId && maybe.isActive === true) {
          participant = maybe;
        }
      }

      if (participant) {
        await ctx.db.patch(participant._id, { isActive: false, isTyping: false });

        const now = Date.now();
        const expiresAt = now + 2 * 60 * 60 * 1000;

        await ctx.db.insert("messages", {
          roomId: args.roomId,
          senderName: "System",
          senderAvatar: "🤖",
          content: `${participant.displayName} left the room`,
          messageType: "leave",
          isRead: false,
          expiresAt,
          encryptionKeyId: "system",
        });
      }
    } catch (e) {
      console.error("rooms.leaveRoom error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Get room participants
export const getRoomParticipants = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    try {
      return await ctx.db
        .query("participants")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    } catch (e) {
      console.error("rooms.getRoomParticipants error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Update participant activity
export const updateActivity = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);

      // Skip for anonymous to avoid updating someone else
      if (!user?._id) return;

      const participant = await ctx.db
        .query("participants")
        .withIndex("by_room_and_user", (q) => 
          q.eq("roomId", args.roomId).eq("userId", user._id)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (participant) {
        await ctx.db.patch(participant._id, { lastSeen: Date.now() });
      }
    } catch (e) {
      console.error("rooms.updateActivity error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Set typing status (debounced from client)
export const setTyping = mutation({
  args: { roomId: v.string(), isTyping: v.boolean() },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);

      // Skip for anonymous to avoid toggling another anonymous participant
      if (!user?._id) return;

      const participant = await ctx.db
        .query("participants")
        .withIndex("by_room_and_user", (q) => q.eq("roomId", args.roomId).eq("userId", user._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!participant) return;
      await ctx.db.patch(participant._id, {
        isTyping: args.isTyping,
        typingUpdatedAt: Date.now(),
      });
    } catch (e) {
      console.error("rooms.setTyping error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Add: Kick a specific participant (admin only). Verify admin via callerParticipantId.
export const kickParticipant = mutation({
  args: { roomId: v.string(), participantId: v.id("participants"), callerParticipantId: v.id("participants") },
  handler: async (ctx, args) => {
    try {
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .first();
      if (!room) throw new Error("Room not found");

      const caller = await ctx.db.get(args.callerParticipantId);
      if (!caller || caller.roomId !== args.roomId || caller.isActive !== true || caller.role !== "admin") {
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
        senderAvatar: "🤖",
        content: `${target.displayName} was removed by admin`,
        messageType: "system",
        isRead: false,
        expiresAt,
        encryptionKeyId: "system",
      });
    } catch (e) {
      console.error("rooms.kickParticipant error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Add: Clear all members (admin only, keep admin). Verify admin via callerParticipantId.
export const clearParticipants = mutation({
  args: { roomId: v.string(), callerParticipantId: v.id("participants") },
  handler: async (ctx, args) => {
    try {
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .first();

      if (!room) return; // Room already gone

      const user = await getCurrentUser(ctx);
      const caller = await ctx.db.get(args.callerParticipantId);
      
      // Permit if:
      // - signed-in creator, or
      // - caller participant exists in room and has role "admin"
      let isAdmin = false;
      if (user?._id && room.creatorId && user._id === room.creatorId) {
        isAdmin = true;
      } else if (caller && caller.roomId === args.roomId && caller.role === "admin" && caller.isActive) {
        isAdmin = true;
      }

      if (!isAdmin) {
        throw new Error("Only the admin can perform this action");
      }

      // Nuclear Panic Fix: Delete every single trace of the room immediately
      
      // 1. Delete ALL Messages for this roomId
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }

      // 2. Delete ALL Participants for this roomId
      const allParticipants = await ctx.db
        .query("participants")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();
      for (const p of allParticipants) {
        await ctx.db.delete(p._id);
      }

      // 3. Delete ALL Calls, Call Participants, and Signaling for this roomId
      const callsInRoom = await ctx.db
        .query("calls")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();
      
      for (const call of callsInRoom) {
        const callParts = await ctx.db
          .query("callParticipants")
          .withIndex("by_call_id", (q) => q.eq("callId", call._id))
          .collect();
        for (const cp of callParts) await ctx.db.delete(cp._id);

        const signals = await ctx.db
          .query("signaling")
          .withIndex("by_call_id", (q) => q.eq("callId", call._id))
          .collect();
        for (const s of signals) await ctx.db.delete(s._id);

        await ctx.db.delete(call._id);
      }

      // 4. Delete ALL Encryption Keys for this roomId
      const keys = await ctx.db
        .query("encryptionKeys")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();
      for (const k of keys) {
        await ctx.db.delete(k._id);
      }

      // 5. Delete ALL Join Attempts for this roomId
      const attempts = await ctx.db
        .query("joinAttempts")
        .withIndex("by_expires_at") // Use expiresAt index since roomId index might be limited
        .collect();
      for (const att of attempts) {
        if (att.roomId === args.roomId) {
          await ctx.db.delete(att._id);
        }
      }

      // 6. Finally, delete ALL room documents with this roomId
      const rooms = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();
      for (const r of rooms) {
        await ctx.db.delete(r._id);
      }

      return { success: true };
    } catch (e) {
      console.error("rooms.clearParticipants error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});

// Cleanup expired rooms and data
export const cleanupExpired = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      const now = Date.now();

      const expiredRooms = await ctx.db
        .query("rooms")
        .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
        .collect();

      for (const room of expiredRooms) {
        await ctx.db.patch(room._id, { isActive: false });
      }

      const expiredMessages = await ctx.db
        .query("messages")
        .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
        .collect();

      for (const message of expiredMessages) {
        await ctx.db.delete(message._id);
      }

      const expiredParticipants = await ctx.db
        .query("participants")
        .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
        .collect();

      for (const participant of expiredParticipants) {
        await ctx.db.delete(participant._id);
      }

      const selfDestructMessages = await ctx.db
        .query("messages")
        .withIndex("by_self_destruct", (q) => q.lt("selfDestructAt", now))
        .collect();

      for (const message of selfDestructMessages) {
        await ctx.db.delete(message._id);
      }

      const expiredAttempts = await ctx.db
        .query("joinAttempts")
        .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
        .collect();

      for (const attempt of expiredAttempts) {
        await ctx.db.delete(attempt._id);
      }
    } catch (e) {
      console.error("rooms.cleanupExpired error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Unexpected server error.");
    }
  },
});