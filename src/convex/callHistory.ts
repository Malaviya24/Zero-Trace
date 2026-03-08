import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCallParticipantSession, verifyRoomParticipantSession } from "./sessionAuth";

export const logCallEvent = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
    eventType: v.union(
      v.literal("created"),
      v.literal("joined"),
      v.literal("left"),
      v.literal("ended"),
      v.literal("reconnected"),
      v.literal("quality_degraded")
    ),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const call = await ctx.db.get(args.callId);
    if (!call || call.expiresAt < now) return;

    const participant = await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      requireActive: false,
    });

    if (!call.roomId) return;

    let message = "";
    switch (args.eventType) {
      case "created":
        message = "Call started";
        break;
      case "joined":
        message = `${participant.displayName} joined the call`;
        break;
      case "left":
        message = `${participant.displayName} left the call`;
        break;
      case "ended":
        message = "Call ended";
        break;
      case "reconnected":
        message = `${participant.displayName} reconnected`;
        break;
      case "quality_degraded":
        message = `${participant.displayName} has poor connection quality`;
        break;
    }

    await ctx.db.insert("messages", {
      roomId: call.roomId,
      senderName: "System",
      senderAvatar: "call",
      content: message,
      messageType: "system",
      isRead: false,
      expiresAt: now + 24 * 60 * 60 * 1000,
      encryptionKeyId: "system",
    });
  },
});

export const getCallHistory = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const member = await verifyRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });
    if (!member) return [];

    const allCalls = await ctx.db
      .query("calls")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .collect();

    const limit = Math.max(1, args.limit ?? 20);
    return allCalls
      .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
      .slice(0, limit);
  },
});

export const getCallStats = query({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call) return null;

    await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      requireActive: false,
    });

    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
      .collect();

    const duration =
      call.endedAt && call.startedAt
        ? call.endedAt - call.startedAt
        : call.startedAt
        ? Date.now() - call.startedAt
        : 0;

    return {
      callId: args.callId,
      status: call.status,
      participantCount: participants.length,
      duration,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
    };
  },
});
