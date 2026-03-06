# Calling UI Redesign QA

## Scope

- New unified call UI applied to direct call page, group call page, and incoming/active modal overlays.
- Functional coverage includes initiation, receive/accept, hold, transfer, and end call.

## Device Matrix

- Phone: 360x800 and 390x844
- Tablet: 768x1024
- Desktop: 1366x768 and 1920x1080

## Responsive Checks

- Control dock remains visible and accessible at all viewport sizes.
- Top status pills do not overlap with browser safe areas.
- Primary action buttons remain reachable with one thumb on phone.
- Local preview card remains anchored bottom-right without clipping.
- Participant count and connection quality labels remain readable.

## Functional Checks

- Start call from room and verify new call screen appears.
- Receive incoming call and verify redesigned incoming modal appears.
- Accept incoming call and verify active call layout appears.
- Toggle mic and verify audio mute/unmute behavior persists.
- Toggle speaker and verify output-device switching remains functional.
- Toggle hold and verify local audio tracks are disabled while held.
- Trigger transfer and verify share sheet or clipboard link works.
- End call and verify return navigation to room/home remains intact.

## Group Call Checks

- Join group call with two or more users and verify participant count updates.
- Verify remote participant display names render correctly.
- Verify hold and transfer actions remain operational in group flow.
- End group call as participant and verify leave flow remains stable.

## Regression Checks

- Chat room incoming call banner still opens call route.
- Existing call signaling flow (offer/answer/ice) remains stable.
- Reconnect state still renders call stats and controls.
