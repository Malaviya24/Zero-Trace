import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getCurrentUser } from "./users";

async function requireAuthenticatedUser(ctx: unknown) {
  const user = await getCurrentUser(ctx as never);
  if (!user?._id) {
    throw new Error("Unauthorized");
  }
  return user;
}

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
    const user = await requireAuthenticatedUser(ctx);
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.participantId, {
      connectionQuality: args.quality,
      qualityMetrics: args.metrics,
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
    const user = await requireAuthenticatedUser(ctx);
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.userId !== user._id) {
      throw new Error("Unauthorized");
    }
    
    await ctx.db.patch(args.participantId, {
      reconnectAttempts: (participant.reconnectAttempts || 0) + 1,
      lastReconnectAt: Date.now(),
    });
  },
});
