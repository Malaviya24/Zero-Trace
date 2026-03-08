import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCallParticipantSession, verifyCallParticipantSession } from "./sessionAuth";

export const sendSignal = mutation({
  args: {
    callId: v.id("calls"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    data: v.string(),
    fromParticipantId: v.id("callParticipants"),
    fromParticipantToken: v.string(),
    toParticipantId: v.id("callParticipants"),
  },
  handler: async (ctx, args) => {
    await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.fromParticipantId,
      participantToken: args.fromParticipantToken,
    });

    const call = await ctx.db.get(args.callId);
    if (!call || call.status === "ended") {
      return { ignored: true as const };
    }

    const [fromParticipant, toParticipant] = await Promise.all([
      ctx.db.get(args.fromParticipantId),
      ctx.db.get(args.toParticipantId),
    ]);

    if (!fromParticipant || !toParticipant) {
      return { ignored: true as const };
    }
    if (fromParticipant.leftAt || toParticipant.leftAt) {
      return { ignored: true as const };
    }
    if (fromParticipant.callId !== args.callId || toParticipant.callId !== args.callId) {
      return { ignored: true as const };
    }

    await ctx.db.insert("signaling", {
      callId: args.callId,
      type: args.type,
      data: args.data,
      fromParticipantId: args.fromParticipantId,
      toParticipantId: args.toParticipantId,
      processed: false,
      expiresAt: Date.now() + 60000,
    });

    return { ignored: false as const };
  },
});

export const getSignals = query({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await verifyCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });
    if (!participant) return [];

    const now = Date.now();
    return await ctx.db
      .query("signaling")
      .withIndex("by_call_and_to_and_processed", (q) =>
        q.eq("callId", args.callId).eq("toParticipantId", args.participantId).eq("processed", false)
      )
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();
  },
});

export const markProcessed = mutation({
  args: {
    signalId: v.id("signaling"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (!signal) {
      return { ignored: true as const };
    }

    const participant = await verifyCallParticipantSession(ctx, {
      callId: signal.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });
    if (!participant) {
      return { ignored: true as const };
    }

    const call = await ctx.db.get(signal.callId);
    if (!call || call.status === "ended") {
      return { ignored: true as const };
    }
    if (signal.toParticipantId !== participant._id) {
      return { ignored: true as const };
    }

    try {
      await ctx.db.patch(args.signalId, {
        processed: true,
      });
    } catch {
      return { ignored: true as const };
    }

    return { ignored: false as const };
  },
});
