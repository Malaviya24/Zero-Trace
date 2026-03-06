import { describe, expect, it } from "vitest";
import {
  filterOtherParticipants,
  mergeCachedMessages,
  resolveRemoteCallName,
  shouldResetCallOverlay,
} from "./call-chat-utils";

describe("mergeCachedMessages", () => {
  it("retains cached history when incoming query is empty", () => {
    const previous = [
      { _id: "m1", _creationTime: 1 },
      { _id: "m2", _creationTime: 2 },
    ];
    const merged = mergeCachedMessages(previous, []);
    expect(merged).toEqual(previous);
  });

  it("keeps prior messages when late joiners introduce new events", () => {
    const previous = [
      { _id: "m1", _creationTime: 1 },
      { _id: "m2", _creationTime: 2 },
    ];
    const incoming = [
      { _id: "m2", _creationTime: 2 },
      { _id: "m3", _creationTime: 3 },
    ];
    const merged = mergeCachedMessages(previous, incoming);
    expect(merged.map((message) => message._id)).toEqual(["m1", "m2", "m3"]);
  });
});

describe("resolveRemoteCallName", () => {
  it("maps remote participant instead of local user", () => {
    const name = resolveRemoteCallName(
      [
        { _id: "p1", displayName: "Alice" },
        { _id: "p2", displayName: "Bob" },
      ],
      "Alice",
      "Fallback",
      true
    );
    expect(name).toBe("Bob");
  });
});

describe("shouldResetCallOverlay", () => {
  it("resets stale connected overlay when no active call remains", () => {
    expect(shouldResetCallOverlay("connected", false)).toBe(true);
    expect(shouldResetCallOverlay("connected", true)).toBe(false);
    expect(shouldResetCallOverlay("idle", false)).toBe(false);
  });
});

describe("filterOtherParticipants", () => {
  it("filters out local participant by id", () => {
    const result = filterOtherParticipants(
      [
        { _id: "me", displayName: "Me" },
        { _id: "other", displayName: "Other" },
      ],
      "me",
      "Me"
    );
    expect(result.map((participant) => participant._id)).toEqual(["other"]);
  });
});
