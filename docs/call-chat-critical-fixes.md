# Critical Call/Chat Fixes

## Root Cause Analysis

### 1) Post-call UI anomaly (lingering call overlay)
- Symptom: after ending/losing a call, a fullscreen call overlay remained visible in room view.
- Root cause: room-level call overlay state was driven by call context status, but there was no forced reset when the backend no longer reported an active room call.
- Fix: added a guard in room view to auto-reset call overlay state when no active call exists while UI status is still connecting/connected/reconnecting/ringing.

### 2) Participant name mislabeling (local name shown as remote)
- Symptom: users sometimes saw their own name in the remote call tile/header.
- Root cause: remote name fallback logic could reuse local display identity when participant resolution was temporarily incomplete.
- Fix: centralized remote-name resolution to always prefer a non-local participant first, then safe fallback text.

### 3) Chat persistence failure on call end
- Symptom: chat appeared to disappear on call termination/room return.
- Root cause: chat rendering depended only on live query payload; temporary empty responses caused visible history drops.
- Fix: introduced room-scoped message cache merging and session-backed restoration to retain already-seen messages through call transitions and room re-entry.

### 4) Chat history loss when new users join
- Symptom: existing users appeared to lose prior messages when late join events arrived.
- Root cause: bounded message window + live query-only rendering made history appear truncated or reset under update bursts.
- Fix: increased fetch window in room/call chat usage and merged incoming payloads into deduplicated chronological cache so late-join updates append instead of replacing visible history.

## Code Changes

- Chat overlay reset and remote-name mapping hardened in room view:
  - `src/components/ChatRoom.tsx`
- Stable participant filtering in group call view:
  - `src/pages/GroupCallPage.tsx`
- Call sidebar chat now uses durable room identity and valid room participant identity:
  - `src/components/call/CallChat.tsx`
- Shared deterministic logic extracted:
  - `src/lib/call-chat-utils.ts`

## Suggested Commit Messages

1. `fix(call-ui): auto-reset stale room call overlay when active call ends`
2. `fix(call-name): resolve remote participant name without local-name fallback collisions`
3. `fix(chat-persistence): merge and persist room message cache across call transitions`
4. `fix(call-chat): use room session participant identity and durable room lookup`
5. `test(call-chat): add unit coverage for overlay reset, remote naming, and history merge`

## QA Checklist

- [ ] Start call from room A, end call locally, verify room UI returns without lingering call overlay.
- [ ] End call from remote side, verify local room overlay closes automatically.
- [ ] Join 1:1 call as two users, verify each side sees the other participant name in call UI.
- [ ] Send messages, start/end call, return to room, verify previous messages remain visible.
- [ ] Re-enter same room from same browser session, verify cached history appears immediately and syncs with server.
- [ ] With active room history, add late joiner, verify existing users keep prior messages.
- [ ] Verify late joiner sees prior room conversation (within server retention limits).
- [ ] Verify call sidebar chat sends successfully (no participant authorization errors).
