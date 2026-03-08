import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Auth is intentionally disabled for anonymous room sessions.
// Keep lightweight stubs so existing call sites do not fail at runtime.
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (_ctx, args) => {
    return { ok: true, name: args.name.trim() };
  },
});

export const currentUser = query({
  args: {},
  handler: async () => null,
});

export const getCurrentUser = async () => null;

export const list = query({
  args: {},
  handler: async () => [],
});
