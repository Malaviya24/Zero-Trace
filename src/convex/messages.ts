import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Add: centralized error handler utility
function handleConvexError(scope: string, e: unknown): never {
  console.error(`[${scope}]`, e);
  if (e instanceof Error && e.message) {
    // Re-throw sanitized error message
    throw new Error(e.message);
  }
  throw new Error("Unexpected server error.");
}

// Send a message
export const sendMessage = mutation({
  args: {
    roomId: v.string(),
    content: v.string(),
    encryptionKeyId: v.string(),
    selfDestruct: v.optional(v.boolean()),
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    try {
      // Validate content
      const body = args.content?.trim() ?? "";
      if (!body) {
        throw new Error("Message content cannot be empty.");
      }
      if (body.length > 2000) {
        throw new Error("Message is too long (max 2000 characters).");
      }
      if (!args.encryptionKeyId.trim()) {
        throw new Error("Missing encryption key reference.");
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

      const user = await getCurrentUser(ctx);

      // Resolve participant from provided participantId
      const participant = await ctx.db.get(args.participantId);
      if (!participant || participant.roomId !== args.roomId || !participant.isActive) {
        throw new Error("You must join the room first");
      }

      const now = Date.now();
      const expiresAt = now + 2 * 60 * 60 * 1000; // 2 hours TTL
      const selfDestructAt = args.selfDestruct ? now + 10 * 60 * 1000 : undefined; // 10 minutes

      const messageId = await ctx.db.insert("messages", {
        roomId: args.roomId,
        senderId: user?._id,
        senderName: participant.displayName,
        senderAvatar: participant.avatar,
        content: body,
        messageType: "text",
        isRead: false,
        selfDestructAt,
        expiresAt,
        encryptionKeyId: args.encryptionKeyId,
      });

      // Update participant activity
      await ctx.db.patch(participant._id, { lastSeen: now });

      return messageId;
    } catch (e) {
      handleConvexError("messages.sendMessage", e);
    }
  },
});

// Get messages for a room
export const getRoomMessages = query({
  args: { 
    roomId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const limit = Math.max(1, Math.min(args.limit ?? 50, 200));

      // Validate room exists and not expired
      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!room || room.expiresAt < Date.now()) {
        return [];
      }

      // Change to ascending order like WhatsApp
      return await ctx.db
        .query("messages")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .order("asc")
        .take(limit);
    } catch (e) {
      handleConvexError("messages.getRoomMessages", e);
    }
  },
});

// Mark message as read
export const markMessageRead = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    try {
      const message = await ctx.db.get(args.messageId);
      if (!message) return;

      // Ensure caller is a participant of the message's room
      const user = await getCurrentUser(ctx);
      const participant = await ctx.db
        .query("participants")
        .withIndex("by_room_and_user", (q) =>
          q.eq("roomId", message.roomId).eq("userId", user?._id)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!participant) return;

      const now = Date.now();
      await ctx.db.patch(args.messageId, {
        isRead: true,
        readAt: now,
      });

      // If message has self-destruct enabled and not previously read, set the timer
      if (message.selfDestructAt && !message.readAt) {
        const selfDestructAt = now + 10 * 60 * 1000; // 10 minutes from read
        await ctx.db.patch(args.messageId, { selfDestructAt });
      }
    } catch (e) {
      handleConvexError("messages.markMessageRead", e);
    }
  },
});

// Edit a message
export const editMessage = mutation({
  args: { 
    messageId: v.id("messages"),
    content: v.string(),
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    try {
      const body = args.content?.trim() ?? "";
      if (!body) {
        throw new Error("Message content cannot be empty.");
      }
      if (body.length > 2000) {
        throw new Error("Message is too long (max 2000 characters).");
      }

      const message = await ctx.db.get(args.messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      if (message.messageType !== "text") {
        throw new Error("Only text messages can be edited");
      }

      const user = await getCurrentUser(ctx);
      const participant = await ctx.db.get(args.participantId);

      if (!participant || participant.roomId !== message.roomId || !participant.isActive) {
        throw new Error("You must be in the room to edit messages");
      }

      // Only sender can edit their own messages
      if (message.senderId && user?._id && message.senderId !== user._id) {
        throw new Error("You can only edit your own messages");
      }

      // For anonymous users, check if participant name matches
      if (!message.senderId && message.senderName !== participant.displayName) {
        throw new Error("You can only edit your own messages");
      }

      await ctx.db.patch(args.messageId, {
        content: body,
        editedAt: Date.now(),
      });

      return args.messageId;
    } catch (e) {
      handleConvexError("messages.editMessage", e);
    }
  },
});

// Delete a message (panic mode)
export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);
      const message = await ctx.db.get(args.messageId);
      
      if (!message) return;
      
      // Only sender can delete their own messages
      if (message.senderId === user?._id) {
        await ctx.db.delete(args.messageId);
      }
    } catch (e) {
      handleConvexError("messages.deleteMessage", e);
    }
  },
});

// Clear all messages in a room (panic mode) — ADMIN ONLY
export const clearRoomMessages = mutation({
  args: { roomId: v.string(), callerParticipantId: v.id("participants") },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);

      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .first();

      if (!room || room.expiresAt < Date.now() || room.isActive !== true) {
        return;
      }

      // Permit if:
      // - signed-in creator, or
      // - caller participant exists in room and has role "admin"
      let isAdmin = false;
      if (user?._id && room.creatorId && user._id === room.creatorId) {
        isAdmin = true;
      } else {
        const caller = await ctx.db.get(args.callerParticipantId);
        isAdmin = !!(caller && caller.roomId === args.roomId && caller.role === "admin" && caller.isActive);
      }

      if (!isAdmin) {
        throw new Error("Only the admin can perform this action");
      }

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
    } catch (e) {
      handleConvexError("messages.clearRoomMessages", e);
    }
  },
});