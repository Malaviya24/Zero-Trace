import { describe, expect, it } from "vitest";
import { resolveWebRtcConfig } from "./config";

describe("resolveWebRtcConfig", () => {
  it("does not hard-block production calls when TURN is missing by default", () => {
    const result = resolveWebRtcConfig(
      {
        PROD: true,
        VITE_STUN_URLS: "stun:stun.l.google.com:19302",
      },
      "kpgu.in"
    );

    expect(result.requireDedicatedTurn).toBe(true);
    expect(result.hasConfiguredTurn).toBe(false);
    expect(result.canStartCalls).toBe(true);
    expect(result.missingTurnReason).toContain("TURN");
    expect(result.iceServers.every((entry) => String(entry.urls).startsWith("stun:"))).toBe(true);
  });

  it("enforces preflight blocking when explicitly enabled", () => {
    const result = resolveWebRtcConfig(
      {
        PROD: true,
        VITE_STUN_URLS: "stun:stun.l.google.com:19302",
        VITE_ENFORCE_CALL_PREFLIGHT: "true",
      },
      "kpgu.in"
    );

    expect(result.canStartCalls).toBe(false);
    expect(result.missingTurnReason).toContain("TURN");
  });

  it("allows local/dev calls with fallback relay when TURN credentials are absent", () => {
    const result = resolveWebRtcConfig(
      {
        PROD: false,
        VITE_STUN_URLS: "stun:stun.l.google.com:19302",
      },
      "localhost"
    );

    expect(result.requireDedicatedTurn).toBe(false);
    expect(result.canStartCalls).toBe(true);
    expect(
      result.iceServers.some((entry) =>
        Array.isArray(entry.urls)
          ? entry.urls.some((url) => url.includes("openrelay") || url.includes("expressturn"))
          : entry.urls.includes("openrelay") || entry.urls.includes("expressturn")
      )
    ).toBe(true);
  });

  it("prioritizes dedicated TURN when provided", () => {
    const result = resolveWebRtcConfig(
      {
        PROD: true,
        VITE_STUN_URLS: "stun:stun.l.google.com:19302",
        VITE_SFU_URL: "wss://sfu.example.com",
        VITE_TURN_URLS: "turn:turn.example.com:3478,turns:turn.example.com:5349?transport=tcp",
        VITE_TURN_USERNAME: "user",
        VITE_TURN_CREDENTIAL: "pass",
      },
      "kpgu.in"
    );

    expect(result.hasConfiguredTurn).toBe(true);
    expect(result.canStartCalls).toBe(true);
    const first = result.iceServers[0];
    expect(first.username).toBe("user");
    expect(first.credential).toBe("pass");
    expect(Array.isArray(first.urls)).toBe(true);
  });
});
