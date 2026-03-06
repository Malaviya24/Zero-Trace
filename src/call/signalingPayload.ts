type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

export type OfferPayload = RTCSessionDescriptionInit;
export type AnswerPayload = RTCSessionDescriptionInit;
export type IceCandidatePayload = RTCIceCandidateInit;

export type ParsedSignalPayload =
  | { type: "offer"; payload: OfferPayload }
  | { type: "answer"; payload: AnswerPayload }
  | { type: "ice-candidate"; payload: IceCandidatePayload };

function isSessionDescription(value: unknown): value is RTCSessionDescriptionInit {
  if (!isRecord(value)) return false;
  return typeof value.type === "string" && typeof value.sdp === "string";
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  if (!isRecord(value)) return false;
  return "candidate" in value || "sdpMid" in value || "sdpMLineIndex" in value;
}

export function parseSignalPayload(type: "offer", data: string): { type: "offer"; payload: OfferPayload };
export function parseSignalPayload(type: "answer", data: string): { type: "answer"; payload: AnswerPayload };
export function parseSignalPayload(type: "ice-candidate", data: string): { type: "ice-candidate"; payload: IceCandidatePayload };
export function parseSignalPayload(type: "offer" | "answer" | "ice-candidate", data: string): ParsedSignalPayload {
  const parsed: unknown = JSON.parse(data);
  if ((type === "offer" || type === "answer") && isSessionDescription(parsed)) {
    return { type, payload: parsed };
  }
  if (type === "ice-candidate" && isIceCandidate(parsed)) {
    return { type, payload: parsed };
  }
  throw new Error(`Invalid signaling payload for type "${type}"`);
}
