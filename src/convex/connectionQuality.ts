import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Phase 1: Connection quality monitoring
export const updateConnectionQuality = mutation({
  args: {
    participantId: v.id("callParticipants"),
    quality: v.union(
      v.literal("excellent"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("poor")
    ),
    metrics: v.optional(v.object({
      rtt: v.optional(v.number()),
      packetLoss: v.optional(v.number()),
      jitter: v.optional(v.number()),
      bandwidth: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.participantId, {
      connectionQuality: args.quality,
      lastQualityUpdate: Date.now(),
    });
  },
});

// Track reconnection attempts
export const trackReconnection = mutation({
  args: {
    participantId: v.id("callParticipants"),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return;
    
    await ctx.db.patch(args.participantId, {
      reconnectAttempts: (participant.reconnectAttempts || 0) + 1,
      lastReconnectAt: Date.now(),
    });
  },
});
