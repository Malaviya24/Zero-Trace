import { describe, expect, it } from "vitest";
import { getAudioWatchdogAction } from "./call-watchdog";

describe("getAudioWatchdogAction", () => {
  const now = 100_000;

  it("does nothing while still in initial grace period", () => {
    expect(
      getAudioWatchdogAction({
        isConnected: true,
        hasRemoteAudio: false,
        firstSeenAt: now - 5000,
        now,
        audioRecoveryStep: 0,
        lastAudioRecoveryAt: 0,
      })
    ).toBe("none");
  });

  it("requests ICE restart first", () => {
    expect(
      getAudioWatchdogAction({
        isConnected: true,
        hasRemoteAudio: false,
        firstSeenAt: now - 9000,
        now,
        audioRecoveryStep: 0,
        lastAudioRecoveryAt: 0,
      })
    ).toBe("ice-restart");
  });

  it("requests hard reset after ICE restart cooldown", () => {
    expect(
      getAudioWatchdogAction({
        isConnected: true,
        hasRemoteAudio: false,
        firstSeenAt: now - 20_000,
        now,
        audioRecoveryStep: 1,
        lastAudioRecoveryAt: now - 7000,
      })
    ).toBe("hard-reset");
  });

  it("opens circuit after bounded retries", () => {
    expect(
      getAudioWatchdogAction({
        isConnected: true,
        hasRemoteAudio: false,
        firstSeenAt: now - 30_000,
        now,
        audioRecoveryStep: 2,
        lastAudioRecoveryAt: now - 10_000,
      })
    ).toBe("open-circuit");
  });
});
