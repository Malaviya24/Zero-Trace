import { describe, expect, it } from "vitest";
import { computeReadPatch, shouldSendReadMark } from "./message-conflict-utils";

describe("computeReadPatch", () => {
  it("returns null for already-read messages", () => {
    const now = Date.now();
    expect(
      computeReadPatch({ isRead: true, readAt: now - 1000 }, now)
    ).toBeNull();
  });

  it("returns a single read patch for unread messages", () => {
    const now = Date.now();
    expect(
      computeReadPatch({ isRead: false }, now)
    ).toEqual({
      isRead: true,
      readAt: now,
    });
  });

  it("recalculates self-destruct timer when first read is recorded", () => {
    const now = Date.now();
    expect(
      computeReadPatch(
        { isRead: false, selfDestructAt: now + 60_000, readAt: undefined },
        now
      )
    ).toEqual({
      isRead: true,
      readAt: now,
      selfDestructAt: now + 10 * 60 * 1000,
    });
  });
});

describe("shouldSendReadMark", () => {
  it("allows unread messages from other users once", () => {
    const sent = new Set<string>();
    expect(shouldSendReadMark("m1", false, "Alice", "Bob", sent)).toBe(true);
  });

  it("blocks already-read, self, and already-sent marks", () => {
    const sent = new Set<string>(["m3"]);
    expect(shouldSendReadMark("m1", true, "Alice", "Bob", sent)).toBe(false);
    expect(shouldSendReadMark("m2", false, "Bob", "Bob", sent)).toBe(false);
    expect(shouldSendReadMark("m3", false, "Alice", "Bob", sent)).toBe(false);
  });
});
