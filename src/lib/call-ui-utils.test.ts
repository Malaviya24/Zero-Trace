import { describe, expect, it } from "vitest";
import {
  applyHoldToStream,
  buildTransferUrl,
  getParticipantLabel,
  getQualityToneClass,
} from "./call-ui-utils";

describe("getQualityToneClass", () => {
  it("maps quality states to stable color classes", () => {
    expect(getQualityToneClass("excellent")).toBe("text-emerald-300");
    expect(getQualityToneClass("good")).toBe("text-cyan-300");
    expect(getQualityToneClass("fair")).toBe("text-amber-300");
    expect(getQualityToneClass("poor")).toBe("text-rose-300");
    expect(getQualityToneClass(null)).toBe("text-rose-300");
  });
});

describe("getParticipantLabel", () => {
  it("returns singular and plural labels correctly", () => {
    expect(getParticipantLabel(1)).toBe("1 participant");
    expect(getParticipantLabel(4)).toBe("4 participants");
  });
});

describe("buildTransferUrl", () => {
  it("builds call transfer urls for active calls", () => {
    expect(buildTransferUrl("https://app.test", "abc123")).toBe("https://app.test/call/abc123");
  });

  it("falls back to origin when call id is missing", () => {
    expect(buildTransferUrl("https://app.test", null)).toBe("https://app.test");
  });
});

describe("applyHoldToStream", () => {
  it("disables audio and video while hold is enabled", () => {
    const audioTrack = { enabled: true };
    const videoTrack = { enabled: true };
    const stream = {
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [videoTrack],
    } as unknown as MediaStream;

    applyHoldToStream(stream, true, true);

    expect(audioTrack.enabled).toBe(false);
    expect(videoTrack.enabled).toBe(false);
  });

  it("restores audio/video when hold is disabled", () => {
    const audioTrack = { enabled: false };
    const videoTrack = { enabled: false };
    const stream = {
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [videoTrack],
    } as unknown as MediaStream;

    applyHoldToStream(stream, false, true);

    expect(audioTrack.enabled).toBe(true);
    expect(videoTrack.enabled).toBe(true);
  });
});
