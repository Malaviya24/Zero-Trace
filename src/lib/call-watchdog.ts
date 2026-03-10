export type AudioWatchdogAction = "none" | "ice-restart" | "hard-reset" | "open-circuit";

export function getAudioWatchdogAction(input: {
  isConnected: boolean;
  hasRemoteAudio: boolean;
  firstSeenAt: number;
  now: number;
  audioRecoveryStep: number;
  lastAudioRecoveryAt: number;
}) {
  const {
    isConnected,
    hasRemoteAudio,
    firstSeenAt,
    now,
    audioRecoveryStep,
    lastAudioRecoveryAt,
  } = input;

  if (!isConnected || hasRemoteAudio) {
    return "none" as AudioWatchdogAction;
  }

  const connectedFor = now - firstSeenAt;
  if (connectedFor < 8000) {
    return "none" as AudioWatchdogAction;
  }

  if (audioRecoveryStep === 0) {
    return "ice-restart" as AudioWatchdogAction;
  }

  if (audioRecoveryStep === 1 && now - lastAudioRecoveryAt >= 6000) {
    return "hard-reset" as AudioWatchdogAction;
  }

  if (audioRecoveryStep >= 2 && now - lastAudioRecoveryAt >= 9000) {
    return "open-circuit" as AudioWatchdogAction;
  }

  return "none" as AudioWatchdogAction;
}
