export function isRoomFullError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return message.includes("room is full");
}

export function mapJoinRoomErrorMessage(error: unknown) {
  if (isRoomFullError(error)) {
    return "Room is full. Try later or ask admin to increase limit.";
  }
  return error instanceof Error ? error.message : "Failed to join room";
}
