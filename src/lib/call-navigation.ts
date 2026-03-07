const CALL_RETURN_PATH_KEY = "call_return_path";

function extractRoomIdFromPath(path: string): string | null {
  const match = path.match(/^\/(?:join|room)\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function isSafeReturnPath(path: string): boolean {
  if (!path || !path.startsWith("/")) return false;
  if (path.startsWith("/call/")) return false;
  return true;
}

export function captureCallReturnPath(roomId?: string): void {
  if (typeof window === "undefined") return;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (isSafeReturnPath(currentPath)) {
    sessionStorage.setItem(CALL_RETURN_PATH_KEY, currentPath);
    return;
  }

  if (roomId) {
    sessionStorage.setItem(CALL_RETURN_PATH_KEY, `/room/${roomId}`);
  }
}

export function resolveCallReturnPath(roomId?: string): string {
  const storedPath = sessionStorage.getItem(CALL_RETURN_PATH_KEY);
  if (!storedPath || !isSafeReturnPath(storedPath)) {
    return roomId ? `/room/${roomId}` : "/";
  }

  if (!roomId) return storedPath;

  const storedRoomId = extractRoomIdFromPath(storedPath);
  if (storedRoomId && storedRoomId !== roomId) {
    return `/room/${roomId}`;
  }

  return storedPath;
}

export function clearCallReturnPath(): void {
  sessionStorage.removeItem(CALL_RETURN_PATH_KEY);
}
