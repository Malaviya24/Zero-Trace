import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    // Validate participants belong to this call
    if (fromParticipant.callId !== args.callId || toParticipant.callId !== args.callId) {
      throw new Error("Participant not in call");
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
    const now = Date.now();
    
    // Validate participant exists and belongs to call
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.callId !== args.callId) {
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
  },
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (!signal) {
      return;
    }

    await ctx.db.patch(args.signalId, {
      processed: true,
    });
  },
});