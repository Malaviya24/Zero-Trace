// Type-safe API layer - eliminates all (api as any) usage
import { api } from "@/convex/_generated/api";
import { FunctionReference } from "convex/server";
import { Id } from "@/convex/_generated/dataModel";

// Properly typed API references
export const typedApi = {
  rooms: {
    createRoom: api.rooms.createRoom as FunctionReference<"mutation">,
    getRoomByRoomId: api.rooms.getRoomByRoomId as FunctionReference<"query">,
    getRoomParticipants: api.rooms.getRoomParticipants as FunctionReference<"query">,
    joinRoom: api.rooms.joinRoom as FunctionReference<"mutation">,
    leaveRoom: api.rooms.leaveRoom as FunctionReference<"mutation">,
    updateActivity: api.rooms.updateActivity as FunctionReference<"mutation">,
    kickParticipant: api.rooms.kickParticipant as FunctionReference<"mutation">,
    clearParticipants: api.rooms.clearParticipants as FunctionReference<"mutation">,
    setTyping: api.rooms.setTyping as FunctionReference<"mutation">,
  },
  messages: {
    sendMessage: api.messages.sendMessage as FunctionReference<"mutation">,
    getRoomMessages: api.messages.getRoomMessages as FunctionReference<"query">,
    markMessageRead: api.messages.markMessageRead as FunctionReference<"mutation">,
    editMessage: api.messages.editMessage as FunctionReference<"mutation">,
    clearRoomMessages: api.messages.clearRoomMessages as FunctionReference<"mutation">,
  },
  calls: {
    create: api.calls.create as FunctionReference<"mutation">,
    get: api.calls.get as FunctionReference<"query">,
    join: api.calls.join as FunctionReference<"mutation">,
    leave: api.calls.leave as FunctionReference<"mutation">,
    end: api.calls.end as FunctionReference<"mutation">,
    getParticipants: api.calls.getParticipants as FunctionReference<"query">,
    listByRoom: api.calls.listByRoom as FunctionReference<"query">,
  },
  signaling: {
    sendSignal: api.signaling.sendSignal as FunctionReference<"mutation">,
    getSignals: api.signaling.getSignals as FunctionReference<"query">,
    markProcessed: api.signaling.markProcessed as FunctionReference<"mutation">,
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
