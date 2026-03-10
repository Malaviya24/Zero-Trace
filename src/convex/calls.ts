import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCallParticipantSession, requireRoomParticipantSession, verifyRoomParticipantSession } from "./sessionAuth";
import { getRoomByRoomId, hardDeleteRoomData, isRoomExpiredOrInactive } from "./roomLifecycle";

const generateLeaveToken = () => {
  const first = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const second = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${first}${second}`;
};

const DEFAULT_CALL_MAX_PARTICIPANTS = 10;
const LIVEKIT_SESSION_TTL_MS = 30 * 60 * 1000;
const textEncoder = new TextEncoder();

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string) {
  const bytes =
    typeof input === "string"
      ? textEncoder.encode(input)
      : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createHS256Jwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(signingInput));
  const encodedSignature = base64UrlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
}

function resolveLiveKitConfig() {
  const wsUrl = process.env.LIVEKIT_WS_URL || process.env.SFU_URL || process.env.VITE_SFU_URL;
  const apiKey = process.env.LIVEKIT_API_KEY || process.env.SFU_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET || process.env.SFU_API_SECRET;
  return { wsUrl, apiKey, apiSecret };
}

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

    const room = await getRoomByRoomId(ctx, args.roomId);
    if (!room) {
      throw new Error("Room not found or expired");
    }
    if (isRoomExpiredOrInactive(room)) {
      await hardDeleteRoomData(ctx, args.roomId);
      throw new Error("Room not found or expired");
    }

    const now = Date.now();
    const expiresAt = Math.min(room.expiresAt, now + 4 * 60 * 60 * 1000);
    const sfuEnabled = args.sfuEnabled ?? true;
    const e2eeEnabled = args.e2ee ?? !sfuEnabled;

    const callId = await ctx.db.insert("calls", {
      roomId: args.roomId,
      createdBy: undefined,
      createdByParticipantId: roomParticipant._id,
      status: "ringing",
      e2ee: e2eeEnabled,
      maxParticipants: args.maxParticipants || DEFAULT_CALL_MAX_PARTICIPANTS,
      sfuEnabled,
      mediaProvider: sfuEnabled ? "livekit" : "mesh",
      mediaRegion: process.env.LIVEKIT_REGION,
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
      participantState: "joining",
      connectionState: "connecting",
      isMuted: false,
      isVideoOn: false,
      lastStateUpdate: now,
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
    const maxParticipants = call.maxParticipants ?? DEFAULT_CALL_MAX_PARTICIPANTS;

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
        participantState: "joining",
        connectionState: "connecting",
        lastStateUpdate: now,
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
        participantState: "joining",
        connectionState: "connecting",
        isMuted: false,
        isVideoOn: false,
        lastStateUpdate: now,
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
        participantState: "joining",
        connectionState: "connecting",
        isMuted: false,
        isVideoOn: false,
        lastStateUpdate: now,
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
      status: "ending",
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
          leaveToken: undefined,
          participantState: "left",
          connectionState: "disconnected",
          lastStateUpdate: now,
        });
      }
    }

    await ctx.db.patch(args.callId, {
      status: "ended",
      endedAt: now,
    });
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
        participantState: "left",
        connectionState: "disconnected",
        lastStateUpdate: now,
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
        status: "ending",
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
            participantState: "left",
            connectionState: "disconnected",
            lastStateUpdate: now,
          });
        }
      }

      await ctx.db.patch(args.callId, {
        status: "ended",
        endedAt: now,
      });

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
        status: "ending",
        endedAt: now,
      });
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
        participantState: "left",
        connectionState: "disconnected",
        isMuted: false,
        isVideoOn: false,
        lastStateUpdate: now,
      });
    } else if (!participant.leftAt) {
      await ctx.db.patch(participant._id, {
        leftAt: now,
        participantState: "left",
        connectionState: "disconnected",
        lastStateUpdate: now,
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

export const createSession = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    const call = await ctx.db.get(args.callId);
    if (!call || call.expiresAt <= Date.now() || !call.roomId || call.status === "ended") {
      throw new Error("Call unavailable");
    }
    if (!call.sfuEnabled || call.mediaProvider === "mesh") {
      return {
        provider: "mesh" as const,
        endpoint: null,
        token: null,
        expiresAt: Date.now() + 60_000,
        participantRole: participant.role,
        roomName: null,
      };
    }

    const { wsUrl, apiKey, apiSecret } = resolveLiveKitConfig();
    if (!wsUrl || !apiKey || !apiSecret) {
      throw new Error("SFU is not configured. Missing LIVEKIT_WS_URL/API_KEY/API_SECRET.");
    }

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const expMs = Math.min(call.expiresAt, nowMs + LIVEKIT_SESSION_TTL_MS);
    const expSec = Math.floor(expMs / 1000);
    const roomName = `room-${call.roomId}`;
    const identity = String(participant._id);

    const payload = {
      iss: apiKey,
      sub: identity,
      iat: nowSec,
      nbf: nowSec - 5,
      exp: expSec,
      name: participant.displayName,
      metadata: JSON.stringify({
        callId: String(call._id),
        roomId: call.roomId,
        role: participant.role,
      }),
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    };

    const token = await createHS256Jwt(payload, apiSecret);

    await ctx.db.patch(participant._id, {
      participantState: "joining",
      connectionState: "connecting",
      lastStateUpdate: nowMs,
    });

    if (call.status === "ringing" || call.status === "idle") {
      await ctx.db.patch(call._id, {
        status: "active",
        startedAt: call.startedAt ?? nowMs,
      });
    }

    return {
      provider: "livekit" as const,
      endpoint: wsUrl,
      token,
      expiresAt: expMs,
      participantRole: participant.role,
      roomName,
    };
  },
});

export const updateParticipantState = mutation({
  args: {
    callId: v.id("calls"),
    participantId: v.id("callParticipants"),
    participantToken: v.string(),
    participantState: v.optional(
      v.union(
        v.literal("joining"),
        v.literal("connected"),
        v.literal("muted"),
        v.literal("videoOn"),
        v.literal("left")
      )
    ),
    isMuted: v.optional(v.boolean()),
    isVideoOn: v.optional(v.boolean()),
    connectionState: v.optional(v.union(v.literal("connecting"), v.literal("connected"), v.literal("disconnected"))),
  },
  handler: async (ctx, args) => {
    const participant = await requireCallParticipantSession(ctx, {
      callId: args.callId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      requireActive: false,
    });

    const patch: Record<string, unknown> = {
      lastStateUpdate: Date.now(),
    };
    if (args.participantState !== undefined) patch.participantState = args.participantState;
    if (args.isMuted !== undefined) patch.isMuted = args.isMuted;
    if (args.isVideoOn !== undefined) patch.isVideoOn = args.isVideoOn;
    if (args.connectionState !== undefined) patch.connectionState = args.connectionState;
    if (args.participantState === "left") {
      patch.leftAt = participant.leftAt ?? Date.now();
      patch.leaveToken = undefined;
    }

    await ctx.db.patch(participant._id, patch);
    return { ok: true as const };
  },
});

export const getLiveState = query({
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
        requireActive: false,
      });

      const call = await ctx.db.get(args.callId);
      if (!call) return null;

      const participants = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_id", (q) => q.eq("callId", args.callId))
        .collect();

      return {
        call: {
          _id: call._id,
          roomId: call.roomId,
          status: call.status,
          startedAt: call.startedAt,
          endedAt: call.endedAt,
          mediaProvider: call.mediaProvider ?? (call.sfuEnabled ? "livekit" : "mesh"),
          sfuEnabled: call.sfuEnabled ?? false,
        },
        participants: participants
          .filter((participant) => !participant.leftAt)
          .map((participant) => ({
            _id: participant._id,
            displayName: participant.displayName,
            role: participant.role,
            participantState: participant.participantState ?? "connecting",
            isMuted: participant.isMuted ?? false,
            isVideoOn: participant.isVideoOn ?? false,
            connectionState: participant.connectionState ?? "connecting",
            lastStateUpdate: participant.lastStateUpdate,
          })),
      };
    } catch {
      return null;
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
