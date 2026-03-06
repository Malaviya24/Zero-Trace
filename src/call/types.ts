export type CallStatus =
  | "idle"
  | "outgoing"
  | "incoming"
  | "ringing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "error";

export type ConnectionQuality = "excellent" | "good" | "weak" | "reconnecting";

export interface CallStatsSnapshot {
  rttMs: number;
  jitterMs: number;
  packetLoss: number;
  bitrateKbps: number;
}

export interface CallAnalyticsPayload {
  callId: string;
  durationSec: number;
  reconnectCount: number;
  averagePacketLoss: number;
  averageRttMs: number;
  averageBitrateKbps: number;
  qualityTimeline: ConnectionQuality[];
}

export interface SignalingMessage<T = unknown> {
  type:
    | "call:start"
    | "call:accept"
    | "call:reject"
    | "call:end"
    | "webrtc:offer"
    | "webrtc:answer"
    | "webrtc:ice"
    | "webrtc:restart";
  callId: string;
  from: string;
  to?: string;
  payload?: T;
  ts: number;
}
