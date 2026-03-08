import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

export function generateParticipantToken() {
  const randomA = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const randomB = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${randomA}.${randomB}`;
}

export function sanitizeDisplayName(value: string) {
  return value.replace(/[<>&"'`]/g, "").trim();
}

export async function verifyRoomParticipantSession(
  ctx: Ctx,
  args: {
    roomId: string;
    participantId: Id<"participants">;
    participantToken: string;
    requireActive?: boolean;
  }
) {
  const participant = await ctx.db.get(args.participantId);
  if (!participant) return null;
  if (participant.roomId !== args.roomId) return null;
  if (!args.participantToken || participant.participantToken !== args.participantToken) return null;
  if (participant.expiresAt <= Date.now()) return null;
  if (args.requireActive !== false && !participant.isActive) return null;
  return participant;
}

export async function requireRoomParticipantSession(
  ctx: Ctx,
  args: {
    roomId: string;
    participantId: Id<"participants">;
    participantToken: string;
    requireActive?: boolean;
  }
) {
  const participant = await verifyRoomParticipantSession(ctx, args);
  if (!participant) {
    throw new Error("Unauthorized");
  }
  return participant;
}

export async function verifyCallParticipantSession(
  ctx: Ctx,
  args: {
    callId: Id<"calls">;
    participantId: Id<"callParticipants">;
    participantToken: string;
    requireActive?: boolean;
  }
) {
  const participant = await ctx.db.get(args.participantId);
  if (!participant) return null;
  if (participant.callId !== args.callId) return null;
  if (!args.participantToken || participant.participantToken !== args.participantToken) return null;
  if (participant.expiresAt <= Date.now()) return null;
  if (args.requireActive !== false && !!participant.leftAt) return null;
  return participant;
}

export async function requireCallParticipantSession(
  ctx: Ctx,
  args: {
    callId: Id<"calls">;
    participantId: Id<"callParticipants">;
    participantToken: string;
    requireActive?: boolean;
  }
) {
  const participant = await verifyCallParticipantSession(ctx, args);
  if (!participant) {
    throw new Error("Unauthorized");
  }
  return participant;
}
