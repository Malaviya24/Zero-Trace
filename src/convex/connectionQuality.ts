import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireCallParticipantSession } from "./sessionAuth";

export const updateConnectionQuality = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
    quality: v.union(v.literal("excellent"), v.literal("good"), v.literal("fair"), v.literal("poor")),
    metrics: v.optional(
      v.object({
        rtt: v.optional(v.number()),
        packetLoss: v.optional(v.number()),
        jitter: v.optional(v.number()),
        bandwidth: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    await ctx.db.patch(args.participantId, {
      connectionQuality: args.quality,
      qualityMetrics: args.metrics,
      lastQualityUpdate: Date.now(),
    });
  },
});

export const trackReconnection = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    await ctx.db.patch(args.participantId, {
      reconnectAttempts: (participant.reconnectAttempts || 0) + 1,
      lastReconnectAt: Date.now(),
    });
  },
});
