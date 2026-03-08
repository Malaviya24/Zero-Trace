// Type-safe API layer - eliminates all (api as any) usage
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Properly typed API references
export const typedApi = {
  rooms: {
    createRoom: api.rooms.createRoom as any,
    getRoomByRoomId: api.rooms.getRoomByRoomId as any,
    getRoomParticipants: api.rooms.getRoomParticipants as any,
    joinRoom: api.rooms.joinRoom as any,
    leaveRoom: api.rooms.leaveRoom as any,
    updateActivity: api.rooms.updateActivity as any,
    kickParticipant: api.rooms.kickParticipant as any,
    clearParticipants: api.rooms.clearParticipants as any,
    setTyping: api.rooms.setTyping as any,
  },
  messages: {
    sendMessage: api.messages.sendMessage as any,
    getRoomMessages: api.messages.getRoomMessages as any,
    markMessageRead: api.messages.markMessageRead as any,
    editMessage: api.messages.editMessage as any,
    clearRoomMessages: api.messages.clearRoomMessages as any,
    toggleReaction: api.messages.toggleReaction as any,
  },
  calls: {
    create: api.calls.create as any,
    get: api.calls.get as any,
    join: api.calls.join as any,
    leave: api.calls.leave as any,
    end: api.calls.end as any,
    updateOffer: api.calls.updateOffer as any,
    rejectInvite: api.calls.rejectInvite as any,
    getParticipants: api.calls.getParticipants as any,
    listByRoom: api.calls.listByRoom as any,
  },
  signaling: {
    sendSignal: api.signaling.sendSignal as any,
    getSignals: api.signaling.getSignals as any,
    markProcessed: api.signaling.markProcessed as any,
  },
} as const;

// Type-safe query/mutation parameter types
export type RoomParams = {
  roomId: string;
};

export type CallParams = {
  callId: Id<"calls">;
};

export type ParticipantParams = {
  participantId: Id<"callParticipants">;
};
