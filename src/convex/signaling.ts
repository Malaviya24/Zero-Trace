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
    if (!call) {
      throw new Error("Call not found");
    }

    // Validate participants exist
    const fromParticipant = await ctx.db.get(args.fromParticipantId);
    const toParticipant = await ctx.db.get(args.toParticipantId);
    
    if (!fromParticipant || !toParticipant) {
      throw new Error("Invalid participant");
    }
    if (fromParticipant.leftAt || toParticipant.leftAt) {
      throw new Error("Inactive participant");
    }

    // Validate participants belong to this call
    if (fromParticipant.callId !== args.callId || toParticipant.callId !== args.callId) {
      throw new Error("Participant not in call");
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
    const signal = await ctx.db.get(args.signalId);
    if (!signal) {
      return;
    }
    const user = await requireAuthenticatedUser(ctx);
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }
    if (participant.callId !== signal.callId) {
      throw new Error("Participant not in signal call");
    }
    if (participant.leftAt) {
      throw new Error("Inactive participant cannot process signal");
    }
    if (signal.toParticipantId !== participant._id) {
      throw new Error("Not allowed to process this signal");
    }
    if (participant.userId !== user._id) {
      throw new Error("Not allowed to process this signal");
    }

    await ctx.db.patch(args.signalId, {
      processed: true,
    });
  },
});
