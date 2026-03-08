import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { computeReadPatch } from "../lib/message-conflict-utils";
import { requireRoomParticipantSession, verifyRoomParticipantSession } from "./sessionAuth";

const HEART_VARIANTS = new Set(["❤", "❤️"]);
const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "🙏"]);

function normalizeReactionEmoji(value: string) {
  const emoji = value.trim();
  if (HEART_VARIANTS.has(emoji)) return "❤️";
  return emoji;
}

function handleConvexError(scope: string, e: unknown): never {
  console.error(`[${scope}]`, e);
  if (e instanceof Error && e.message) {
    throw new Error(e.message);
  }
  throw new Error("Unexpected server error.");
}

async function requireActiveRoom(ctx: any, roomId: string) {
  const room = await ctx.db
    .query("rooms")
    .withIndex("by_room_id", (q: any) => q.eq("roomId", roomId))
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();
  if (!room || room.expiresAt < Date.now()) {
    throw new Error("Room not found or expired");
  }
  return room;
}

export const sendMessage = mutation({
  args: {
    roomId: v.string(),
    content: v.string(),
    encryptionKeyId: v.string(),
    selfDestruct: v.optional(v.boolean()),
    participantId: v.id("participants"),
    participantToken: v.string(),
    messageType: v.optional(v.union(v.literal("text"), v.literal("image"), v.literal("file"), v.literal("audio"))),
    storageId: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const participant = await requireRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      const body = args.content?.trim() ?? "";
      if (!body && !args.storageId) {
        throw new Error("Message content cannot be empty.");
      }
      if (body.length > 2000) {
        throw new Error("Message is too long (max 2000 characters).");
      }
      if (!args.encryptionKeyId.trim()) {
        throw new Error("Missing encryption key reference.");
      }

      const room = await requireActiveRoom(ctx, args.roomId);

      const now = Date.now();
      const expiresAt = Math.min(room.expiresAt, now + 2 * 60 * 60 * 1000);
      const selfDestructAt = args.selfDestruct ? now + 10 * 60 * 1000 : undefined;

      let resolvedReplyTo: Id<"messages"> | undefined;
      let resolvedReplyToPreview:
        | {
            senderName: string;
            content: string;
            type: "text" | "image" | "file" | "audio" | "system";
          }
        | undefined;

      const rawReplyTo = args.replyTo?.trim();
      if (rawReplyTo) {
        const normalizedReplyTo = ctx.db.normalizeId("messages", rawReplyTo);
        if (normalizedReplyTo) {
          const parent = await ctx.db.get(normalizedReplyTo);
          if (
            parent &&
            parent.roomId === args.roomId &&
            parent.expiresAt > now &&
            (!parent.selfDestructAt || parent.selfDestructAt > now)
          ) {
            resolvedReplyTo = parent._id;
            resolvedReplyToPreview = {
              senderName: parent.senderName,
              content: parent.content,
              type:
                parent.messageType === "join" || parent.messageType === "leave"
                  ? "system"
                  : parent.messageType,
            };
          }
        }
      }

      const messageId = await ctx.db.insert("messages", {
        roomId: args.roomId,
        senderId: undefined,
        senderParticipantId: participant._id,
        senderName: participant.displayName,
        senderAvatar: participant.avatar,
        content: body,
        messageType: args.messageType || "text",
        storageId: args.storageId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        isRead: false,
        selfDestructAt,
        expiresAt,
        encryptionKeyId: args.encryptionKeyId,
        replyTo: resolvedReplyTo,
        replyToPreview: resolvedReplyToPreview,
      });

      await ctx.db.patch(participant._id, { lastSeen: now });

      return messageId;
    } catch (e) {
      handleConvexError("messages.sendMessage", e);
    }
  },
});

export const generateUploadUrl = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await requireActiveRoom(ctx, args.roomId);
      await requireRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });
      return await ctx.storage.generateUploadUrl();
    } catch (e) {
      handleConvexError("messages.generateUploadUrl", e);
    }
  },
});

export const getRoomMessages = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const participant = await verifyRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });
      if (!participant) return [];

      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!room || room.expiresAt < Date.now()) return [];

      const limit = Math.max(1, Math.min(args.limit ?? 50, 500));
      const allMessages = await ctx.db
        .query("messages")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .order("asc")
        .collect();

      const now = Date.now();
      const visible = allMessages.filter(
        (message) => message.expiresAt > now && (!message.selfDestructAt || message.selfDestructAt > now)
      );
      const windowMessages = visible.slice(Math.max(0, visible.length - limit));

      const visibleById = new Map<string, (typeof windowMessages)[number]>(
        windowMessages.map((message) => [String(message._id), message])
      );
      const replyParentMap = new Map<string, (typeof windowMessages)[number]>();
      const replyParentIds = Array.from(
        new Set(windowMessages.map((message) => message.replyTo).filter(Boolean))
      ) as Id<"messages">[];

      for (const parentId of replyParentIds) {
        const fromWindow = visibleById.get(String(parentId));
        const parent = fromWindow ?? (await ctx.db.get(parentId));
        if (
          parent &&
          parent.roomId === args.roomId &&
          parent.expiresAt > now &&
          (!parent.selfDestructAt || parent.selfDestructAt > now)
        ) {
          replyParentMap.set(String(parentId), parent);
        }
      }

      const enhancedMessages = await Promise.all(
        windowMessages.map(async (message) => {
          const parent = message.replyTo ? replyParentMap.get(String(message.replyTo)) : undefined;
          const storedReplyPreview = message.replyToPreview;
          const replyToPreview = parent
            ? {
                senderName: parent.senderName,
                content: parent.content,
                type:
                  parent.messageType === "join" || parent.messageType === "leave"
                    ? "system"
                    : parent.messageType,
              }
            : storedReplyPreview;

          if (message.storageId) {
            return {
              ...message,
              fileUrl: await ctx.storage.getUrl(message.storageId),
              replyToPreview,
            };
          }
          return {
            ...message,
            replyToPreview,
          };
        })
      );

      return enhancedMessages;
    } catch (e) {
      handleConvexError("messages.getRoomMessages", e);
    }
  },
});

export const markMessageRead = mutation({
  args: {
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const message = await ctx.db.get(args.messageId);
      if (!message) return;

      const participant = await verifyRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });
      if (!participant) return;

      const now = Date.now();
      const patch = computeReadPatch(message, now);
      if (!patch) return;
      await ctx.db.patch(args.messageId, patch);
    } catch (e) {
      handleConvexError("messages.markMessageRead", e);
    }
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
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

      const participant = await requireRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      if (message.senderParticipantId && message.senderParticipantId !== participant._id) {
        throw new Error("You can only edit your own messages");
      }

      if (!message.senderParticipantId && message.senderName !== participant.displayName) {
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

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    participantToken: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const now = Date.now();
      const emoji = normalizeReactionEmoji(args.emoji);
      if (!emoji || emoji.length > 8 || !ALLOWED_REACTIONS.has(emoji)) {
        return { messageId: args.messageId, reactions: [], ignored: true as const };
      }

      const message = await ctx.db.get(args.messageId);
      if (!message) {
        return { messageId: args.messageId, reactions: [], ignored: true as const };
      }
      if (message.expiresAt <= now || (message.selfDestructAt && message.selfDestructAt <= now)) {
        return { messageId: args.messageId, reactions: [], ignored: true as const };
      }

      const participant = await requireRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      const existing = message.reactions ?? [];
      const reactionIndex = existing.findIndex(
        (reaction) => reaction.participantId === args.participantId && reaction.emoji === emoji
      );

      const withoutMine = existing.filter((reaction) => reaction.participantId !== args.participantId);
      const reactions =
        reactionIndex >= 0
          ? existing.filter((_, index) => index !== reactionIndex)
          : [
              ...withoutMine,
              {
                emoji,
                participantId: args.participantId,
                displayName: participant.displayName,
                createdAt: Date.now(),
              },
            ];

      try {
        await ctx.db.patch(args.messageId, { reactions });
      } catch (patchError) {
        const errorMessage = patchError instanceof Error ? patchError.message.toLowerCase() : "";
        if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
          return { messageId: args.messageId, reactions: [], ignored: true as const };
        }
        throw patchError;
      }

      return { messageId: args.messageId, reactions, ignored: false as const };
    } catch (e) {
      handleConvexError("messages.toggleReaction", e);
    }
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const message = await ctx.db.get(args.messageId);
      if (!message) return;

      const participant = await requireRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      if (message.senderParticipantId && message.senderParticipantId === participant._id) {
        await ctx.db.delete(args.messageId);
        return;
      }

      if (!message.senderParticipantId && message.senderName === participant.displayName) {
        await ctx.db.delete(args.messageId);
      }
    } catch (e) {
      handleConvexError("messages.deleteMessage", e);
    }
  },
});

export const clearRoomMessages = mutation({
  args: {
    roomId: v.string(),
    callerParticipantId: v.id("participants"),
    callerParticipantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
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

      if (!room || room.expiresAt < Date.now() || room.isActive !== true) {
        return;
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
