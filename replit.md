# Chattrix - Secure Anonymous Chat Rooms

## Overview
Chattrix is a secure, anonymous chat application built with React, TypeScript, and Convex. It supports encrypted chat rooms, WebRTC video/audio calls, and ephemeral messaging.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend**: Convex (serverless backend with real-time sync)
- **UI Components**: Radix UI, shadcn/ui, Framer Motion
- **Routing**: React Router v7
- **State Management**: Zustand
- **Build Tool**: Vite 6
- **Package Manager**: pnpm

## Project Structure
```
/
├── src/
│   ├── components/     # React components
│   │   ├── ui/         # shadcn/ui base components
│   │   ├── call/       # Video/audio call components
│   │   └── chat/       # Chat-specific components
│   ├── convex/         # Convex backend functions
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and config
│   ├── pages/          # Page components
│   ├── services/       # Service classes
│   ├── store/          # Zustand stores
│   └── types/          # TypeScript type definitions
├── public/             # Static assets
├── vite.config.ts      # Vite configuration (port 5000, host 0.0.0.0)
├── convex.json         # Convex configuration
└── package.json        # Dependencies and scripts
```

## Environment Variables
- `VITE_CONVEX_URL` - Convex deployment URL (required, stored as env var)

## Development
- Dev server runs on port 5000 via `pnpm dev`
- Convex backend is managed externally via Convex dashboard
- Vite configured with `allowedHosts: true` for Replit proxy compatibility

## Key Features
- End-to-end encrypted chat rooms
- Anonymous identities (no registration required)
- Ephemeral messages (auto-expire)
- WebRTC video/audio calls
- QR code room sharing

## Design System
- **Theme**: Purple/violet (OKLCH 0.55 0.24 285) as primary brand color for both light and dark modes
- **Glassmorphism**: `.glass` utility class for backdrop-blur card effects
- **Gradient text**: `.gradient-text` utility for brand headings
- **Gradient borders**: `.gradient-border` utility for subtle card borders
- **Chat wallpaper**: `.chat-wallpaper` utility for subtle dot pattern chat background
- **Font smoothing**: Antialiased rendering with OpenType features enabled
- **Responsive**: Mobile-first with safe-area padding for gesture-bar devices

## Session Management
- Room sessions stored in localStorage with 2-hour expiry
- Sessions persist across page refreshes (user stays in room)
- Sessions only cleared on explicit "Leave Room" or admin kick
- SessionService handles save/load/clear with encryption key export/import

## Calling System (WebRTC)
- **Architecture**: Mesh topology with per-participant peer connections
- **Store**: `useGroupCallStore` (Zustand) - manages peer connections, local/remote streams
- **Signaling**: Convex-based (signaling table with offer/answer/ice-candidate messages)
- **Audio**: RemoteAudioPlayer React component with `<audio>` elements for each remote stream
- **Autoplay**: AudioContext unlock on user gesture to handle browser autoplay policies
- **ICE**: Multiple Google STUN servers + TURN relay servers for NAT traversal
- **Config**: All WebRTC/ICE config centralized in `src/lib/config.ts`
- **DisplayName passing**: Via sessionStorage between CallButton → GroupCallPage
- **Glare handling**: Lower participant ID wins when simultaneous offers collide
- **Renegotiation**: `onnegotiationneeded` handler + late track addition for race conditions
- **Call notification**: Green banner in ChatRoom when someone starts a call, with Join button

## Recent Changes (Feb 2026)
- Redesigned entire UI to modern purple/violet theme with OKLCH colors
- Landing page: hero section with floating chat mockup, gradient orbs, FAQ accordion
- All pages: glassmorphism cards, gradient backgrounds, Framer Motion animations
- ChatRoom: WhatsApp-inspired full-screen layout with chat wallpaper, message bubbles, auto-scroll
- ChatHeader: Purple header bar with back button, room info, participant sheet drawer, admin dropdown
- MessageInput: Auto-growing textarea, round send button, typing indicators, edit preview
- ParticipantSidebar: Desktop side panel, mobile sheet drawer accessed via header
- Session persistence: Users stay in room on page refresh (no more redirect to home)
- Room creation flow: Creators auto-join without re-entering room ID
- Join flow: Link/QR users only need to enter password (room ID from URL)
- WebRTC calling: Rebuilt with proper signaling, audio playback, autoplay handling, mesh architecture

## Call System Fixes (Feb 2026)
- Auto-end calls: When last participant leaves, backend automatically marks call as "ended"
- listByRoom query filters out ended calls - no more stale "Join Call" banners
- Removed onnegotiationneeded loops: handler now only fires for renegotiation after initial connection
- Track addition separated from PC creation to prevent premature negotiation
- Fixed myParticipant matching to use participantId instead of displayName (prevents self-connection)
- Proper perfect negotiation: polite peer rollback, signalingState guards, RTCSessionDescription wrapping
- Improved RemoteAudioPlayer: retry on gesture, addtrack listener, hidden audio elements
- React StrictMode safe: deferred cleanup with setTimeout to handle double-mounting

## Security Audit (Feb 2026)
- Room query strips sensitive fields (passwordHash, encryptionKey) - returns hasPassword boolean + passwordSalt only
- Password hashing upgraded from single SHA-256 to PBKDF2 (100K iterations) with constant-time comparison
- All random generation (room IDs, identity names, avatars) uses crypto.getRandomValues() instead of Math.random()
- Input sanitization: displayName strips HTML entities, avatar capped at 10 chars
- Anonymous users can no longer end arbitrary calls (authorization fix)
- Signaling markProcessed requires caller ownership check (participantId must match target)
- Removed exposed seed/test mutation from calls.ts
- Production server.js includes security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- createRoom validates passwordHash/passwordSalt format before storing
- Known remaining: TURN credentials hardcoded in config.ts (use env vars for production)
