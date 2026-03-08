export type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | null | undefined;

export function getQualityToneClass(connectionQuality: ConnectionQuality): string {
  if (connectionQuality === "excellent") return "text-emerald-300";
  if (connectionQuality === "good") return "text-cyan-300";
  if (connectionQuality === "fair") return "text-amber-300";
  if (connectionQuality === "poor") return "text-rose-300";
  return "text-rose-300";
}

export function getParticipantLabel(count: number): string {
  return `${count} participant${count === 1 ? "" : "s"}`;
}

export function buildTransferUrl(origin: string, callId: string | null | undefined): string {
  if (!callId) return origin;
  return `${origin}/call/${callId}`;
}

export function applyHoldToStream(
  stream: MediaStream | null,
  shouldHold: boolean,
  isAudioEnabled: boolean
): void {
  if (!stream) return;
  stream.getAudioTracks().forEach((track) => {
    track.enabled = !shouldHold && isAudioEnabled;
  });
  stream.getVideoTracks().forEach((track) => {
    track.enabled = !shouldHold;
  });
}
