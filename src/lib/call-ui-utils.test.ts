import { describe, expect, it } from "vitest";
import {
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
