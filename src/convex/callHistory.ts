import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Phase 2: Call history and logs
export const logCallEvent = mutation({
  args: {
    callId: v.id("calls"),
    eventType: v.union(
      v.literal("created"),
      v.literal("joined"),
      v.literal("left"),
      v.literal("ended"),
      v.literal("reconnected"),
      v.literal("quality_degraded")
    ),
    participantId: v.optional(v.id("callParticipants")),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const now = Date.now();
    
    // Log to messages table as system message for room visibility
    const call = await ctx.db.get(args.callId);
    if (call?.roomId) {
      let message = "";
      switch (args.eventType) {
        case "created":
          message = "📞 Call started";
          break;
        case "joined":
          message = "👋 Participant joined the call";
          break;
        case "left":
          message = "👋 Participant left the call";
          break;
        case "ended":
          message = "📞 Call ended";
          break;
        case "reconnected":
          message = "🔄 Participant reconnected";
          break;
        case "quality_degraded":
          message = "⚠️ Connection quality degraded";
          break;
      }
      
      await ctx.db.insert("messages", {
        roomId: call.roomId,
        senderName: "System",
        senderAvatar: "📊",
        content: message,
        messageType: "system",
        isRead: false,
        expiresAt: now + 24 * 60 * 60 * 1000,
        encryptionKeyId: "system",
      });
    }
  },
});

// Get call history for a room
export const getCallHistory = query({
  args: { roomId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(args.limit || 20);
    
    return calls;
  },
});

// Get call statistics
export const getCallStats = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call) return null;
    
    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
      .collect();
    
    const duration = call.endedAt && call.startedAt 
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
