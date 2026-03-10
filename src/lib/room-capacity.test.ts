import { describe, expect, it } from "vitest";
import { isRoomFullError, mapJoinRoomErrorMessage } from "./room-capacity";

describe("room capacity helpers", () => {
  it("detects room full server errors", () => {
    expect(isRoomFullError(new Error("Room is full"))).toBe(true);
    expect(isRoomFullError(new Error("ROOM IS FULL"))).toBe(true);
    expect(isRoomFullError(new Error("Unauthorized"))).toBe(false);
  });

  it("maps room full errors to deterministic copy", () => {
    expect(mapJoinRoomErrorMessage(new Error("Room is full"))).toBe(
      "Room is full. Try later or ask admin to increase limit."
    );
  });
});
