import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Create a new call
export const create = mutation({
  args: {
    roomId: v.optional(v.string()),
    e2ee: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    sfuEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);
      const now = Date.now();
      const expiresAt = now + 4 * 60 * 60 * 1000; // 4 hours TTL

      // Create the call - relaxed constraints for anonymous users
      const callId = await ctx.db.insert("calls", {
        roomId: args.roomId,
        createdBy: user?._id,
        status: "ringing",
        e2ee: args.e2ee ?? true,
        maxParticipants: args.maxParticipants || 10,
        sfuEnabled: args.sfuEnabled ?? false,
        expiresAt,
      });

      // Add creator as first participant
      await ctx.db.insert("callParticipants", {
        callId,
        userId: user?._id,
        displayName: args.displayName || user?.name || "Anonymous",
        role: "admin",
        joinedAt: now,
        expiresAt,
      });

      // Send notification to room if roomId exists
      if (args.roomId) {
        await ctx.db.insert("messages", {
          roomId: args.roomId,
          senderName: "System",
          senderAvatar: "📞",
          content: `📞 ${args.displayName || "Someone"} started a call. Join now!`,
          messageType: "system",
          isRead: false,
          expiresAt,
          encryptionKeyId: "system",
        });
      }

      return callId;
    } catch (e) {
      console.error("calls.create error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Failed to create call");
    }
  },
});

// Join an existing call
export const join = mutation({
  args: {
    callId: v.id("calls"),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);
      const call = await ctx.db.get(args.callId);
      
      if (!call || call.expiresAt < Date.now()) {
        throw new Error("Call not found or expired");
      }

      if (call.status === "ended") {
        throw new Error("Call has already ended");
      }

      const now = Date.now();
      const displayName = args.displayName || user?.name || "Anonymous";

      // Check if user is already a participant
      let participant = null;
      if (user) {
        participant = await ctx.db
          .query("callParticipants")
          .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
          .filter((q) => q.eq(q.field("userId"), user._id))
          .first();
      }

      if (participant && !participant.leftAt) {
        await ctx.db.patch(participant._id, {
          joinedAt: now,
          displayName,
        });
        const currentParticipants = await ctx.db
          .query("callParticipants")
          .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
          .filter((q) => q.eq(q.field("leftAt"), undefined))
          .collect();
        
        // Deterministic leader election: oldest participant is first
        const sorted = currentParticipants.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a._id.localeCompare(b._id));
        const isFirst = sorted.length > 0 && sorted[0]._id === participant._id;

        return {
          participantId: participant._id,
          offer: call.offer,
          isFirst,
          offererId: !isFirst && sorted.length > 0 ? sorted[0]._id : undefined,
        };
      }

      // Add new participant
      const participantId = await ctx.db.insert("callParticipants", {
        callId: args.callId,
        userId: user?._id,
        displayName,
        role: "member",
        joinedAt: now,
        expiresAt: call.expiresAt,
      });

      // Update call status to active when second person joins
      const allParticipants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .filter((q) => q.eq(q.field("leftAt"), undefined))
        .collect();

      if (allParticipants.length >= 2 && (call.status === "idle" || call.status === "ringing")) {
        await ctx.db.patch(args.callId, {
          status: "active",
          startedAt: now,
        });
      }

      // Deterministic leader election
      const sorted = allParticipants.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a._id.localeCompare(b._id));
      const isFirst = sorted.length > 0 && sorted[0]._id === participantId;

      return { 
        participantId, 
        offer: call.offer,
        isFirst,
        offererId: !isFirst && sorted.length > 0 ? sorted[0]._id : undefined,
      };
    } catch (e) {
      console.error("calls.join error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Failed to join call");
    }
  },
});

export const updateOffer = mutation({
  args: {
    callId: v.id("calls"),
    offer: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");
    
    await ctx.db.patch(args.callId, {
      offer: args.offer,
    });
  },
});

// End a call
export const end = mutation({
  args: {
    callId: v.id("calls"),
  },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);
      const call = await ctx.db.get(args.callId);
      
      if (!call || call.status === "ended") {
        return;
      }

      let canEnd = false;
      if (user && call.createdBy === user._id) {
        canEnd = true;
      } else if (user) {
        const participant = await ctx.db
          .query("callParticipants")
          .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
          .filter((q) => q.eq(q.field("userId"), user._id))
          .first();
        if (participant) {
          canEnd = true;
        }
      }

      if (!canEnd) {
        return;
      }

      const now = Date.now();
      await ctx.db.patch(args.callId, {
        status: "ended",
        endedAt: now,
      });

      // Mark all participants as left
      const participants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();

      for (const participant of participants) {
        if (!participant.leftAt) {
          await ctx.db.patch(participant._id, {
            leftAt: now,
          });
        }
      }
    } catch (e) {
      console.error("calls.end error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Failed to end call");
    }
  },
});

// Leave a call (auto-ends call when last participant leaves)
export const leave = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.optional(v.id("callParticipants")),
  },
  handler: async (ctx, args) => {
    try {
      const user = await getCurrentUser(ctx);
      const now = Date.now();

      let participant = null;
      if (user?._id) {
        participant = await ctx.db
          .query("callParticipants")
          .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
          .filter((q) => q.eq(q.field("userId"), user._id))
          .first();
      } else if (args.participantId) {
        const maybe = await ctx.db.get(args.participantId);
        if (maybe && maybe.callId === args.callId) {
          participant = maybe;
        }
      }

      if (participant && !participant.leftAt) {
        await ctx.db.patch(participant._id, {
          leftAt: now,
        });
      }

      const call = await ctx.db.get(args.callId);
      if (!call || call.status === "ended") return;

      const remainingParticipants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();

      const activeCount = remainingParticipants.filter(
        (p) => p.leftAt === undefined
      ).length;

      if (activeCount === 0) {
        await ctx.db.patch(args.callId, {
          status: "ended",
          endedAt: now,
        });
      }
    } catch (e) {
      console.error("calls.leave error:", e);
      if (e instanceof Error) throw e;
      throw new Error("Failed to leave call");
    }
  },
});

// Get call details
export const get = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    try {
      const call = await ctx.db.get(args.callId);
      if (!call || call.expiresAt < Date.now()) {
        return null;
      }
      return call;
    } catch (e) {
      console.error("calls.get error:", e);
      return null;
    }
  },
});

// Get call participants
export const getParticipants = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    try {
      // Fetch participants for the call, then filter in JS to avoid comparing to undefined in Convex
      const participants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();

      // Only active participants (no leftAt set)
      return participants.filter((p) => p.leftAt === undefined);
    } catch (e) {
      console.error("calls.getParticipants error:", e);
      return [];
    }
  },
});

// List active calls by room (excludes ended calls)
export const listByRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    try {
      const calls = await ctx.db
        .query("calls")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .order("desc")
        .take(10);
      const nonEnded = calls.filter((c) => c.status !== "ended");
      const withActiveParticipants = await Promise.all(
        nonEnded.map(async (call) => {
          const participants = await ctx.db
            .query("callParticipants")
            .withIndex("by_call_id", (q) => q.eq("callId", call._id))
            .collect();
          const activeCount = participants.filter((p) => p.leftAt === undefined).length;
          return { call, activeCount };
        })
      );
      return withActiveParticipants
        .filter(({ activeCount }) => activeCount > 0)
        .map(({ call }) => call);
    } catch (e) {
      console.error("calls.listByRoom error:", e);
      return [];
    }
  },
});
