import { describe, expect, it } from "vitest";
import { hardDeleteRoomData, isRoomExpiredOrInactive } from "./roomLifecycle";

type Row = {
  _id: string;
  [key: string]: unknown;
};

class InMemoryDb {
  private tables: Record<string, Row[]>;

  constructor(seed: Record<string, Row[]>) {
    this.tables = Object.fromEntries(
      Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
    );
  }

  query(table: string) {
    const rows = this.tables[table] ?? [];
    const constraints: Array<{ op: "eq" | "lt" | "gt"; field: string; value: unknown }> = [];

    const api = {
      withIndex: (_index: string, builder: (q: any) => any) => {
        const q = {
          eq: (field: string, value: unknown) => {
            constraints.push({ op: "eq", field, value });
            return q;
          },
          lt: (field: string, value: unknown) => {
            constraints.push({ op: "lt", field, value });
            return q;
          },
          gt: (field: string, value: unknown) => {
            constraints.push({ op: "gt", field, value });
            return q;
          },
        };
        builder(q);
        return api;
      },
      collect: async () => {
        return rows.filter((row) =>
          constraints.every((rule) => {
            const current = row[rule.field];
            if (rule.op === "eq") return current === rule.value;
            if (rule.op === "lt") return Number(current) < Number(rule.value);
            return Number(current) > Number(rule.value);
          })
        );
      },
      first: async () => {
        const all = await api.collect();
        return all[0] ?? null;
      },
    };

    return api;
  }

  normalizeId(table: string, rawId: string) {
    if (!rawId.startsWith(`${table}:`)) return null;
    const rows = this.tables[table] ?? [];
    return rows.some((row) => row._id === rawId) ? rawId : null;
  }

  async delete(id: string) {
    const table = id.split(":")[0];
    const rows = this.tables[table] ?? [];
    const index = rows.findIndex((row) => row._id === id);
    if (index < 0) {
      throw new Error(`Row not found: ${id}`);
    }
    rows.splice(index, 1);
  }

  async get(id: string) {
    const table = id.split(":")[0];
    const rows = this.tables[table] ?? [];
    return rows.find((row) => row._id === id) ?? null;
  }

  rows(table: string) {
    return this.tables[table] ?? [];
  }
}

function createContext() {
  const roomId = "ROOM1234";
  const db = new InMemoryDb({
    rooms: [{ _id: "rooms:1", roomId, isActive: true, expiresAt: Date.now() + 1_000 }],
    calls: [{ _id: "calls:1", roomId, expiresAt: Date.now() + 1_000 }],
    signaling: [{ _id: "signaling:1", callId: "calls:1", expiresAt: Date.now() + 1_000 }],
    callParticipants: [{ _id: "callParticipants:1", callId: "calls:1", expiresAt: Date.now() + 1_000 }],
    participants: [{ _id: "participants:1", roomId, expiresAt: Date.now() + 1_000 }],
    messages: [
      { _id: "messages:1", roomId, expiresAt: Date.now() + 1_000 },
      { _id: "messages:2", roomId, storageId: "storage:1", expiresAt: Date.now() + 1_000 },
    ],
    encryptionKeys: [{ _id: "encryptionKeys:1", roomId, expiresAt: Date.now() + 1_000 }],
    joinAttempts: [
      { _id: "joinAttempts:1", roomId, failed: true, createdAt: Date.now() - 1000, expiresAt: Date.now() + 1_000 },
      { _id: "joinAttempts:2", roomId, failed: false, createdAt: Date.now() - 500, expiresAt: Date.now() + 1_000 },
    ],
    linkPreviewCache: [{ _id: "linkPreviewCache:1", roomId, url: "https://example.com", expiresAt: Date.now() + 1_000 }],
  });

  const storageObjects = new Set<string>(["storage:1"]);
  const deletedStorage: string[] = [];

  const ctx = {
    db,
    storage: {
      delete: async (storageId: string) => {
        if (!storageObjects.has(storageId)) {
          throw new Error("Storage object missing");
        }
        storageObjects.delete(storageId);
        deletedStorage.push(storageId);
      },
    },
  };

  return { ctx, roomId, deletedStorage };
}

describe("isRoomExpiredOrInactive", () => {
  it("returns true for inactive or expired rooms", () => {
    const now = Date.now();
    expect(isRoomExpiredOrInactive({ isActive: false, expiresAt: now + 1_000 }, now)).toBe(true);
    expect(isRoomExpiredOrInactive({ isActive: true, expiresAt: now - 1 }, now)).toBe(true);
    expect(isRoomExpiredOrInactive({ isActive: true, expiresAt: now + 1_000 }, now)).toBe(false);
  });
});

describe("hardDeleteRoomData", () => {
  it("cascades through all room-scoped tables and deletes storage blobs", async () => {
    const { ctx, roomId, deletedStorage } = createContext();
    const result = await hardDeleteRoomData(ctx as any, roomId);

    expect(result.room).toBe(1);
    expect(result.calls).toBe(1);
    expect(result.signaling).toBe(1);
    expect(result.callParticipants).toBe(1);
    expect(result.participants).toBe(1);
    expect(result.messages).toBe(2);
    expect(result.encryptionKeys).toBe(1);
    expect(result.joinAttempts).toBe(2);
    expect(result.linkPreviewCache).toBe(1);
    expect(result.storageObjects).toBe(1);
    expect(deletedStorage).toEqual(["storage:1"]);
  });

  it("is idempotent when called repeatedly", async () => {
    const { ctx, roomId } = createContext();
    await hardDeleteRoomData(ctx as any, roomId);
    const second = await hardDeleteRoomData(ctx as any, roomId);

    expect(second.room).toBe(0);
    expect(second.calls).toBe(0);
    expect(second.messages).toBe(0);
    expect(second.storageObjects).toBe(0);
  });
});
