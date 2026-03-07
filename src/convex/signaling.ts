import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

async function requireAuthenticatedUser(ctx: unknown) {
  const user = await getCurrentUser(ctx as never);
  if (!user?._id) {
    throw new Error("Unauthorized");
  }
  return user;
}

// PERMANENT: Proper validation and error handling
export const sendSignal = mutation({
  args: {
    callId: v.id("calls"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    data: v.string(),
    fromParticipantId: v.id("callParticipants"),
    toParticipantId: v.id("callParticipants"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    // Validate call exists
    const call = await ctx.db.get(args.callId);
    if (!call || call.status === "ended") {
      // Late ICE/offer after call end should be a no-op.
      return { ignored: true as const };
    }

    // Validate participants exist
    const fromParticipant = await ctx.db.get(args.fromParticipantId);
    const toParticipant = await ctx.db.get(args.toParticipantId);
    
    if (!fromParticipant || !toParticipant) {
      return { ignored: true as const };
    }
    if (fromParticipant.leftAt || toParticipant.leftAt) {
      return { ignored: true as const };
    }

    // Validate participants belong to this call
    if (fromParticipant.callId !== args.callId || toParticipant.callId !== args.callId) {
      return { ignored: true as const };
    }
    if (fromParticipant.userId !== user._id) {
      throw new Error("Not allowed to send this signal");
    }

    await ctx.db.insert("signaling", {
      callId: args.callId,
      type: args.type,
      data: args.data,
      fromParticipantId: args.fromParticipantId,
      toParticipantId: args.toParticipantId,
      processed: false,
      expiresAt: Date.now() + 60000, // Use constant from config
    });
    return { ignored: false as const };
  },
});

export const getSignals = query({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const now = Date.now();
    
    // Validate participant exists and belongs to call
    const participant = await ctx.db.get(args.participantId);
    if (
      !participant ||
      participant.callId !== args.callId ||
      participant.leftAt ||
      participant.userId !== user._id
    ) {
      return [];
    }
    
    const signals = await ctx.db
      .query("signaling")
      .withIndex("by_call_and_to_and_processed", (q) => 
        q.eq("callId", args.callId)
         .eq("toParticipantId", args.participantId)
         .eq("processed", false)
      )
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();

    return signals;
  },
});

export const markProcessed = mutation({
  args: {
    signalId: v.id("signaling"),
    participantId: v.id("callParticipants"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const signal = await ctx.db.get(args.signalId);
    if (!signal) {
      return { ignored: true as const };
    }

    const call = await ctx.db.get(signal.callId);
    if (!call || call.status === "ended") {
      return { ignored: true as const };
    }

    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      return { ignored: true as const };
    }
    if (participant.callId !== signal.callId) {
      return { ignored: true as const };
    }
    if (participant.leftAt) {
      return { ignored: true as const };
    }
    if (signal.toParticipantId !== participant._id) {
      return { ignored: true as const };
    }
    if (participant.userId !== user._id) {
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
