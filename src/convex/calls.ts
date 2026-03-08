import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCallParticipantSession, requireRoomParticipantSession, verifyRoomParticipantSession } from "./sessionAuth";

const generateLeaveToken = () => {
  const first = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const second = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${first}${second}`;
};

async function getCallAndValidate(ctx: any, callId: any) {
  const call = await ctx.db.get(callId);
  if (!call || call.expiresAt < Date.now()) {
    throw new Error("Call not found or expired");
  }
  return call;
}

export const create = mutation({
  args: {
    roomId: v.string(),
    roomParticipantId: v.id("participants"),
    roomParticipantToken: v.string(),
    e2ee: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    sfuEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const roomParticipant = await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.roomParticipantId,
      participantToken: args.roomParticipantToken,
    });

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!room || room.expiresAt < Date.now()) {
      throw new Error("Room not found or expired");
    }

    const now = Date.now();
    const expiresAt = Math.min(room.expiresAt, now + 4 * 60 * 60 * 1000);
    const e2eeEnabled = args.e2ee ?? true;
    const sfuEnabled = e2eeEnabled ? false : (args.sfuEnabled ?? false);

    const callId = await ctx.db.insert("calls", {
      roomId: args.roomId,
      createdBy: undefined,
      createdByParticipantId: roomParticipant._id,
      status: "ringing",
      e2ee: e2eeEnabled,
      maxParticipants: args.maxParticipants || 10,
      sfuEnabled,
      recordingEnabled: false,
      expiresAt,
    });

    await ctx.db.insert("callParticipants", {
      callId,
      userId: undefined,
      roomParticipantId: roomParticipant._id,
      participantToken: args.roomParticipantToken,
      displayName: args.displayName || roomParticipant.displayName || "Anonymous",
      role: "admin",
      joinedAt: now,
      leaveToken: generateLeaveToken(),
      expiresAt,
    });

    await ctx.db.insert("messages", {
      roomId: args.roomId,
      senderName: "System",
      senderAvatar: "phone",
      content: `Call started by ${args.displayName || roomParticipant.displayName || "Someone"}. Join now!`,
      messageType: "system",
      isRead: false,
      expiresAt,
      encryptionKeyId: "system",
    });

    return callId;
  },
});

export const join = mutation({
  args: {
    callId: v.id("calls"),
    roomParticipantId: v.id("participants"),
    roomParticipantToken: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const call = await getCallAndValidate(ctx, args.callId);
    if (call.status === "ended") {
      throw new Error("Call has already ended");
    }
    if (!call.roomId) {
      throw new Error("Call is not linked to a room");
    }

    const roomParticipant = await requireRoomParticipantSession(ctx, {
      roomId: call.roomId,
      participantId: args.roomParticipantId,
      participantToken: args.roomParticipantToken,
    });

    const now = Date.now();
    const requestedDisplayName = (args.displayName || roomParticipant.displayName || "Anonymous").trim();
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

    const existing = allParticipants.find(
      (candidate) => candidate.roomParticipantId === roomParticipant._id && !candidate.leftAt
    );

    if (existing) {
      const leaveToken = generateLeaveToken();
      const uniqueDisplayName = buildUniqueDisplayName(requestedDisplayName, existing._id);
      await ctx.db.patch(existing._id, {
        displayName: uniqueDisplayName,
        joinedAt: now,
        leaveToken,
        participantToken: args.roomParticipantToken,
      });

      const sorted = [...activeParticipants].sort(
        (a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0) || String(a._id).localeCompare(String(b._id))
      );
      const isFirst = sorted.length > 0 && sorted[0]._id === existing._id;

      return {
        participantId: existing._id,
        participantToken: args.roomParticipantToken,
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
      .filter((candidate) => candidate.roomParticipantId === roomParticipant._id)
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
        participantToken: args.roomParticipantToken,
      });
      participantId = priorParticipant._id;
    } else {
      participantId = await ctx.db.insert("callParticipants", {
        callId: args.callId,
        userId: undefined,
        roomParticipantId: roomParticipant._id,
        participantToken: args.roomParticipantToken,
        displayName: uniqueDisplayName,
        role: "member",
        joinedAt: now,
        expiresAt: call.expiresAt,
        leaveToken,
      });
    }

    const participantsAfterJoin = [...activeParticipants, { _id: participantId, joinedAt: now }];

    if (participantsAfterJoin.length >= 2 && (call.status === "idle" || call.status === "ringing")) {
      await ctx.db.patch(args.callId, {
        status: "active",
        startedAt: now,
      });
    }

    const sorted = participantsAfterJoin.sort(
      (a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || String(a._id).localeCompare(String(b._id))
    );
    const isFirst = sorted.length > 0 && sorted[0]._id === participantId;

    return {
      participantId,
      participantToken: args.roomParticipantToken,
      offer: call.offer,
      isFirst,
      offererId: !isFirst && sorted.length > 0 ? sorted[0]._id : undefined,
      leaveToken,
    };
  },
});

export const updateOffer = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
    offer: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    await ctx.db.patch(args.callId, {
      offer: args.offer,
    });
  },
});

export const end = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call || call.status === "ended") {
      return;
    }

    await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      requireActive: false,
    });

    const now = Date.now();
    await ctx.db.patch(args.callId, {
      status: "ended",
      endedAt: now,
    });

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
  },
});

export const leave = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.optional(v.id("callParticipants")),
    participantToken: v.string(),
    leaveToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (!args.participantId) {
      return;
    }

    const participant = await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      requireActive: false,
    });

    if (args.leaveToken && participant.leaveToken && participant.leaveToken !== args.leaveToken) {
      throw new Error("Unauthorized");
    }

    if (!participant.leftAt) {
      await ctx.db.patch(participant._id, {
        leftAt: now,
        leaveToken: undefined,
      });
    }

    const call = await ctx.db.get(args.callId);
    if (!call || call.status === "ended") return;

    const isStarter =
      !!call.createdByParticipantId &&
      !!participant.roomParticipantId &&
      participant.roomParticipantId === call.createdByParticipantId;

    if (isStarter) {
      await ctx.db.patch(args.callId, {
        status: "ended",
        endedAt: now,
      });

      const allParticipants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();

      for (const entry of allParticipants) {
        if (!entry.leftAt || entry.leaveToken) {
          await ctx.db.patch(entry._id, {
            leftAt: entry.leftAt ?? now,
            leaveToken: undefined,
          });
        }
      }

      if (call.roomId) {
        await ctx.db.insert("messages", {
          roomId: call.roomId,
          senderName: "System",
          senderAvatar: "phone-off",
          content: `${participant.displayName} ended the call.`,
          messageType: "system",
          isRead: false,
          expiresAt: call.expiresAt,
          encryptionKeyId: "system",
        });
      }

      return;
    }

    const remainingParticipants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
      .collect();

    const activeCount = remainingParticipants.filter((entry) => entry.leftAt === undefined).length;

    if (activeCount === 0) {
      await ctx.db.patch(args.callId, {
        status: "ended",
        endedAt: now,
      });
    }
  },
});

export const rejectInvite = mutation({
  args: {
    callId: v.id("calls"),
    roomParticipantId: v.id("participants"),
    roomParticipantToken: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const call = await ctx.db.get(args.callId);
    if (!call || call.status === "ended" || call.expiresAt < now || !call.roomId) {
      return { ok: false };
    }

    const roomParticipant = await requireRoomParticipantSession(ctx, {
      roomId: call.roomId,
      participantId: args.roomParticipantId,
      participantToken: args.roomParticipantToken,
    });

    const participant = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_room_participant", (q) =>
        q.eq("callId", args.callId).eq("roomParticipantId", roomParticipant._id)
      )
      .first();

    if (!participant) {
      await ctx.db.insert("callParticipants", {
        callId: args.callId,
        userId: undefined,
        roomParticipantId: roomParticipant._id,
        participantToken: args.roomParticipantToken,
        displayName: args.displayName || roomParticipant.displayName || "Anonymous",
        role: "member",
        joinedAt: now,
        leftAt: now,
        expiresAt: call.expiresAt,
      });
    } else if (!participant.leftAt) {
      await ctx.db.patch(participant._id, {
        leftAt: now,
      });
    }

    await ctx.db.insert("messages", {
      roomId: call.roomId,
      senderName: "System",
      senderAvatar: "phone-off",
      content: `${args.displayName || roomParticipant.displayName || "Someone"} declined the call.`,
      messageType: "system",
      isRead: false,
      expiresAt: call.expiresAt,
      encryptionKeyId: "system",
    });

    const allParticipants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
      .collect();
    const activeCount = allParticipants.filter((entry) => entry.leftAt === undefined).length;
    if (activeCount <= 1 && call.status === "ringing") {
      await ctx.db.patch(args.callId, {
        status: "missed",
        endedAt: now,
      });
    }

    return { ok: true };
  },
});

export const get = query({
  args: {
    callId: v.id("calls"),
    roomParticipantId: v.id("participants"),
    roomParticipantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const call = await ctx.db.get(args.callId);
      if (!call || call.expiresAt < Date.now() || !call.roomId) {
        return null;
      }

      const roomParticipant = await verifyRoomParticipantSession(ctx, {
        roomId: call.roomId,
        participantId: args.roomParticipantId,
        participantToken: args.roomParticipantToken,
      });
      if (!roomParticipant) {
        return null;
      }

      return call;
    } catch {
      return null;
    }
  },
});

export const getParticipants = query({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await requireCallParticipantSession(ctx, {
        callId: args.callId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      const participants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();

      return participants.filter((participant) => participant.leftAt === undefined);
    } catch {
      return [];
    }
  },
});

export const listByRoom = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const member = await verifyRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });
      if (!member) return [];

      const allCalls = await ctx.db
        .query("calls")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();

      const calls = allCalls
        .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
        .slice(0, 10);
      const nonEnded = calls.filter((call) => call.status !== "ended");
      const withActiveParticipants = await Promise.all(
        nonEnded.map(async (call) => {
          const participants = await ctx.db
            .query("callParticipants")
            .withIndex("by_call_id", (q) => q.eq("callId", call._id))
            .collect();
          const activeCount = participants.filter((participant) => participant.leftAt === undefined).length;
          return { call, activeCount };
        })
      );

      return withActiveParticipants
        .filter(({ activeCount }) => activeCount > 0)
        .map(({ call }) => call);
    } catch {
      return [];
    }
  },
});
