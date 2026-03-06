# Bug Fixes and Logic Corrections Report

**Project:** zero-trace-chat  
**Date:** March 6, 2026  
**Scope:** Full codebase review — call/WebRTC, Convex backend, React state, and utilities.

---

## Purpose

This document describes **existing behavior** in the codebase — i.e. fixes that are already implemented in the referenced files. It is **not** a changelog of new changes. Use it as a reference for how call/Convex/UI logic is intended to work and what issues have been addressed.

---

## Summary

| Category         | Items documented |
|------------------|------------------|
| Convex / calls   | 2                |
| Call UI / state  | 1                |
| WebRTC           | 1                |
| Utilities        | 1                |

The behaviors below are present in the current code. Existing tests pass.

---

## 1. Convex: Duplicate call participants on rejoin (`src/convex/calls.ts`)

**Issue (addressed):** When a user who was already in a call tried to “rejoin” (e.g. refresh or reconnect), the code could have inserted a **new** `callParticipants` row, creating duplicates.

**Current behavior:** If the user is already a participant and has not left (`participant && !participant.leftAt`), the handler returns immediately with the existing `participantId` and the same `offer` / `isFirst` / `offererId` shape. No new row is inserted.

**Location:** `calls.join` mutation, “Check if user is already a participant”.

---

## 2. Convex: Incorrect ordering in `listByRoom` (`src/convex/calls.ts`)

**Issue (addressed):** Using `.order("desc")` on the `by_room_id` index, which only has `roomId`. For a single room all documents share the same `roomId`, so the order was effectively undefined and “newest first” was not guaranteed.

**Current behavior:** The handler `.collect()`s all calls for the room, sorts in memory by `_creationTime` descending, then `.slice(0, 10)` so the 10 most recent calls are returned.

---

## 3. Convex: Ordering in `getCallHistory` (`src/convex/callHistory.ts`)

**Issue (addressed):** Same as above: `by_room_id` plus `.order("desc").take(limit)` does not guarantee newest-first.

**Current behavior:** The handler `.collect()`s all calls for the room, sorts by `_creationTime` descending, then `.slice(0, limit)`. Limit is enforced with `Math.max(1, args.limit ?? 20)`.

---

## 4. Call state: Reject incoming call (`src/call/CallProvider.tsx`)

**Issue (addressed):** Rejecting an incoming call could have left stale `callId`, streams, or other call state for the next incoming call or UI.

**Current behavior:** `rejectIncomingCall` stops the ringtone and dispatches a single `RESET` action (same as `endCall`) so the whole call state is cleared after rejecting.

---

## 5. WebRTC: Return type for `setOutputDevice` (`src/call/WebRTCManager.ts`)

**Issue (addressed):** Callers (e.g. `CallProvider`) need a boolean to know if the output device was applied.

**Current behavior:** `setOutputDevice` has an explicit return type `Promise<boolean>` so the contract is clear and TypeScript enforces it.

---

## 6. Call UI utils: Quality "weak" / "poor" (`src/lib/call-ui-utils.ts`)

**Issue (addressed):** The call layer uses `ConnectionQuality` values like `"weak"` (from `WebRTCManager.deriveQuality`); the UI needed consistent styling for all quality levels.

**Current behavior:** `getQualityToneClass` has an explicit branch for `"weak"` and `"poor"` (both use `"text-rose-300"`) so behavior matches the call types.

---

## Files covered

| File | Behavior documented |
|------|---------------------|
| `src/convex/calls.ts` | Rejoin early-return to avoid duplicate participants; `listByRoom` in-memory sort by `_creationTime` |
| `src/convex/callHistory.ts` | `getCallHistory` in-memory sort and limit handling |
| `src/call/CallProvider.tsx` | `rejectIncomingCall` dispatches `RESET` |
| `src/call/WebRTCManager.ts` | `setOutputDevice` return type `Promise<boolean>` |
| `src/lib/call-ui-utils.ts` | `getQualityToneClass` handles `"weak"` and `"poor"` |

---

## Verification

- `npm run test`: all tests pass (e.g. `call-ui-utils.test.ts`, `call-chat-utils.test.ts`).
- Convex types and usage in these areas are consistent; no schema changes required.

---

## Recommendations (not implemented)

- **CallPanel / useCallStore vs CallProvider:** There are two call flows (group call store vs 1:1 CallProvider). Consider unifying or clearly separating them to avoid confusion.
- **Convex indexes:** If “calls by room, newest first” is needed in more places, consider an index that includes a time field (e.g. `by_room_id_creation`) so ordering can be done in the query instead of in memory.
- **Deprecation:** `createOffer({ offerToReceiveAudio: true })` is deprecated; consider moving to transceiver-based API when updating WebRTC code.

---

*End of report.*
