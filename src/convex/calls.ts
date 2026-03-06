import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

const generateLeaveToken = () => {
  const first =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const second =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${first}${second}`;
};

async function requireAuthenticatedUser(ctx: unknown) {
  const user = await getCurrentUser(ctx as never);
  if (!user?._id) {
    throw new Error("Unauthorized");
  }
  return user;
}

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
      const user = await requireAuthenticatedUser(ctx);
      const now = Date.now();
      const expiresAt = now + 4 * 60 * 60 * 1000; // 4 hours TTL

      // Create the call - relaxed constraints for anonymous users
      const callId = await ctx.db.insert("calls", {
        roomId: args.roomId,
        createdBy: user._id,
        status: "ringing",
        e2ee: args.e2ee ?? true,
        maxParticipants: args.maxParticipants || 10,
        sfuEnabled: args.sfuEnabled ?? false,
        expiresAt,
      });

      // Add creator as first participant
      await ctx.db.insert("callParticipants", {
        callId,
        userId: user._id,
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
      const user = await requireAuthenticatedUser(ctx);
      const call = await ctx.db.get(args.callId);
      
      if (!call || call.expiresAt < Date.now()) {
        throw new Error("Call not found or expired");
      }

      if (call.status === "ended") {
        throw new Error("Call has already ended");
      }

      const now = Date.now();
      const requestedDisplayName = (args.displayName || user?.name || "Anonymous").trim();
      const allParticipants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();
      const activeParticipants = allParticipants.filter((participant) => !participant.leftAt);
      const maxParticipants = call.maxParticipants ?? 10;

      const buildUniqueDisplayName = (baseName: string, excludeParticipantId?: string) => {
        const used = new Set(
          activeParticipants
            .filter((p) => !excludeParticipantId || p._id !== excludeParticipantId)
            .map((p) => p.displayName.toLowerCase())
        );
        if (!used.has(baseName.toLowerCase())) return baseName;
        let suffix = 2;
        let candidate = `${baseName} (${suffix})`;
        while (used.has(candidate.toLowerCase())) {
          suffix += 1;
          candidate = `${baseName} (${suffix})`;
        }
        return candidate;
      };

      // Check if user is already a participant (rejoin: return existing, do not duplicate)
      const participant = allParticipants.find(
        (candidate) => candidate.userId === user._id && !candidate.leftAt
      );

      if (participant && !participant.leftAt) {
        const leaveToken = generateLeaveToken();
        const uniqueDisplayName = buildUniqueDisplayName(
          requestedDisplayName,
          participant._id
        );
        await ctx.db.patch(participant._id, {
          displayName: uniqueDisplayName,
          joinedAt: now,
          leaveToken,
        });
        const sorted = [...activeParticipants].sort(
          (a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0) || String(a._id).localeCompare(String(b._id))
        );
        const isFirst = sorted.length > 0 && sorted[0]._id === participant._id;
        return {
          participantId: participant._id,
          offer: call.offer,
          isFirst,
          offererId: !isFirst && sorted.length > 0 ? sorted[0]._id : undefined,
          leaveToken,
        };
      }

      if (activeParticipants.length >= maxParticipants) {
        throw new Error("Call is full");
      }

      const priorParticipant = allParticipants
        .filter((candidate) => candidate.userId === user._id)
        .sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0))[0];

      const uniqueDisplayName = buildUniqueDisplayName(requestedDisplayName, priorParticipant?._id);
      const leaveToken = generateLeaveToken();
      let participantId;
      if (priorParticipant) {
        await ctx.db.patch(priorParticipant._id, {
          displayName: uniqueDisplayName,
          joinedAt: now,
          leftAt: undefined,
          expiresAt: call.expiresAt,
          leaveToken,
        });
        participantId = priorParticipant._id;
      } else {
        participantId = await ctx.db.insert("callParticipants", {
          callId: args.callId,
          userId: user._id,
          displayName: uniqueDisplayName,
          role: "member",
          joinedAt: now,
          expiresAt: call.expiresAt,
          leaveToken,
        });
      }

      // Update call status to active when second person joins
      const participantsAfterJoin = [...activeParticipants, {
        _id: participantId,
        joinedAt: now,
      }];

      if (participantsAfterJoin.length >= 2 && (call.status === "idle" || call.status === "ringing")) {
        await ctx.db.patch(args.callId, {
          status: "active",
          startedAt: now,
        });
      }

      // Deterministic leader election
      const sorted = participantsAfterJoin.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || String(a._id).localeCompare(String(b._id)));
      const isFirst = sorted.length > 0 && sorted[0]._id === participantId;

      return { 
        participantId, 
        offer: call.offer,
        isFirst,
        offererId: !isFirst && sorted.length > 0 ? sorted[0]._id : undefined,
        leaveToken,
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
    
    // Verify user is an active participant
    const participant = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!participant || participant.leftAt) {
      throw new Error("You must be a participant to update the offer");
    }

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
    leaveToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const user = await requireAuthenticatedUser(ctx);
      const now = Date.now();

      const participants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();

      let participant = participants.find(
        (candidate) => candidate.userId === user._id && !candidate.leftAt
      );

      if (!participant && args.participantId && args.leaveToken) {
        const fallback = await ctx.db.get(args.participantId);
        if (
          fallback &&
          fallback.callId === args.callId &&
          fallback.userId === user._id &&
          fallback.leftAt === undefined &&
          fallback.leaveToken === args.leaveToken
        ) {
          participant = fallback;
        }
      }

      if (participant && !participant.leftAt) {
        await ctx.db.patch(participant._id, {
          leftAt: now,
          leaveToken: undefined,
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

export const rejectInvite = mutation({
  args: {
    callId: v.id("calls"),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireAuthenticatedUser(ctx);
    const call = await ctx.db.get(args.callId);
    if (!call || call.status === "ended" || call.expiresAt < now) {
      return { ok: false };
    }

    const participant = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!participant) {
      await ctx.db.insert("callParticipants", {
        callId: args.callId,
        userId: user._id,
        displayName: args.displayName || user?.name || "Anonymous",
        role: "member",
        joinedAt: now,
        leftAt: now,
        expiresAt: call.expiresAt,
      });
    } else if (!participant.leftAt) {
      await ctx.db.patch(participant._id, { leftAt: now });
    }

    if (call.roomId) {
      await ctx.db.insert("messages", {
        roomId: call.roomId,
        senderName: "System",
        senderAvatar: "📴",
        content: `${args.displayName || user?.name || "Someone"} declined the call.`,
        messageType: "system",
        isRead: false,
        expiresAt: call.expiresAt,
        encryptionKeyId: "system",
      });
    }

    const allParticipants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
      .collect();
    const activeCount = allParticipants.filter((p) => p.leftAt === undefined).length;
    if (activeCount <= 1 && call.status === "ringing") {
      await ctx.db.patch(args.callId, {
        status: "missed",
        endedAt: now,
      });
    }

    return { ok: true };
  },
});

// Get call details
export const get = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    try {
      const user = await requireAuthenticatedUser(ctx);
      const call = await ctx.db.get(args.callId);
      if (!call || call.expiresAt < Date.now()) {
        return null;
      }
      const participants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();
      const canAccessCall = participants.some(
        (participant) => participant.userId === user._id
      );
      if (canAccessCall) {
        return call;
      }

      if (call.roomId) {
        const roomMembership = await ctx.db
          .query("participants")
          .withIndex("by_room_and_user", (q) =>
            q.eq("roomId", call.roomId!).eq("userId", user._id)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
        if (roomMembership) {
          return call;
        }
      }

      return null;
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
      const user = await requireAuthenticatedUser(ctx);
      // Fetch participants for the call, then filter in JS to avoid comparing to undefined in Convex
      const participants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();
      const canAccess = participants.some(
        (participant) => participant.userId === user._id && !participant.leftAt
      );
      if (!canAccess) {
        return [];
      }

      // Only active participants (no leftAt set)
      return participants.filter((p) => p.leftAt === undefined);
    } catch (e) {
      console.error("calls.getParticipants error:", e);
      return [];
    }
  },
});

// List active calls by room (excludes ended calls, newest first)
export const listByRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    try {
      const user = await requireAuthenticatedUser(ctx);
      const roomParticipant = await ctx.db
        .query("participants")
        .withIndex("by_room_and_user", (q) =>
          q.eq("roomId", args.roomId).eq("userId", user._id)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!roomParticipant) {
        return [];
      }

      const allCalls = await ctx.db
        .query("calls")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();
      const calls = allCalls
        .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
        .slice(0, 10);
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
