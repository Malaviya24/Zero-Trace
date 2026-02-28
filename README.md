# Chattrix

**Secure, anonymous chat rooms with end-to-end encryption and real-time voice calls.**

Chattrix lets anyone create or join encrypted chat rooms without signing up. Messages are encrypted client-side, identities are anonymous, and rooms can be shared via link or QR code. Built-in WebRTC calling brings voice communication directly into the chat.

[![Live Demo](https://img.shields.io/badge/Live-Demo-7c3aed?style=for-the-badge)](https://chattrix.replit.app)
[![Built with React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Convex Backend](https://img.shields.io/badge/Convex-Serverless-f97316?style=flat-square)](https://convex.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## Features

### Chat
- **End-to-end encryption** — Messages are encrypted in the browser before leaving the device using AES-GCM with Web Crypto API
- **Anonymous identities** — No registration, no email, no phone number. Random display names and avatars are generated for each session
- **Ephemeral messages** — Set messages to auto-delete after a chosen duration
- **Real-time sync** — Messages appear instantly for all participants via Convex's reactive subscriptions
- **Typing indicators** — WhatsApp-style animated typing bubbles show when someone is composing a message
- **Room sharing** — Share rooms via link or scannable QR code
- **Password protection** — Rooms can optionally require a password (hashed with PBKDF2, 100K iterations)
- **Admin controls** — Room creators can kick participants

### Calling
- **WebRTC voice calls** — Peer-to-peer audio calls directly in the browser
- **Group calls** — Mesh topology supporting multiple participants
- **Perfect negotiation** — Proper glare handling to prevent connection deadlocks
- **ICE restart** — Automatic recovery from network changes
- **Call notifications** — In-chat banner when someone starts a call

### Design
- **Modern UI** — Purple/violet brand with glassmorphism, gradients, and Framer Motion animations
- **Dark mode** — Full dark mode support
- **Mobile-first** — Responsive design with safe-area support for gesture-bar devices
- **Loading animations** — Branded splash screen and skeleton loaders throughout
- **Professional 404** — Animated error page for invalid routes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS v4, Framer Motion |
| UI Components | Radix UI, shadcn/ui |
| Backend | Convex (serverless, real-time) |
| Routing | React Router v7 |
| State | Zustand |
| Calling | WebRTC (native browser APIs) |
| Encryption | Web Crypto API (AES-GCM) |
| Production Server | Hono |

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A free [Convex](https://convex.dev) account

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/chattrix.git
cd chattrix

# Install dependencies
pnpm install

# Set up Convex backend
npx convex login
npx convex init        # Create a new project
npx convex deploy      # Deploy backend functions

# Create environment file
echo "VITE_CONVEX_URL=https://your-project.convex.cloud" > .env

# Start development server
pnpm dev
```

The app will be running at `http://localhost:5000`.

---

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   ├── chat/            # Chat components (MessageInput, TypingBubble, etc.)
│   ├── call/            # Call components (CallNotification, etc.)
│   └── LoadingScreen.tsx # Branded loading animations
├── convex/              # Convex backend
│   ├── schema.ts        # Database schema
│   ├── rooms.ts         # Room CRUD, join/leave, typing
│   ├── messages.ts      # Message send/read/edit
│   ├── calls.ts         # Call lifecycle management
│   └── signaling.ts     # WebRTC signaling relay
├── hooks/               # Custom React hooks
├── lib/
│   ├── crypto.ts        # Encryption utilities
│   ├── config.ts        # WebRTC/ICE configuration
│   └── utils.ts         # General utilities
├── pages/               # Route pages
│   ├── Home.tsx         # Landing page
│   ├── RoomPage.tsx     # Chat room wrapper
│   ├── GroupCallPage.tsx # WebRTC call interface
│   └── NotFound.tsx     # 404 page
├── services/            # Session management
├── store/               # Zustand stores (call state)
└── types/               # TypeScript definitions
```

---

## How It Works

### Encryption Flow

1. When a room is created, a random AES-GCM encryption key is generated in the browser
2. The key is shared via the room invite link (in the URL fragment, never sent to the server)
3. Every message is encrypted client-side before being sent to Convex
4. Recipients decrypt messages locally using the shared key
5. The server never has access to plaintext messages

### Calling Architecture

1. A participant starts a call, which creates a call record in Convex
2. Other participants join and exchange WebRTC signaling (offers, answers, ICE candidates) through Convex mutations
3. Once signaling completes, audio streams flow directly peer-to-peer
4. The "perfect negotiation" pattern handles simultaneous connection attempts without deadlocks

---

## Deployment

### Production Build

```bash
pnpm build        # Outputs to dist/
node server.js    # Start production server on port 5000
```

### Hosting Options

The included `server.js` is a production-ready Hono server with security headers (CSP, HSTS, X-Frame-Options, etc.) and SPA routing.

You can also deploy to:
- **Vercel** — Static deployment with SPA rewrites
- **Netlify** — Static deployment with redirect rules
- **Docker** — Containerized with the included server
- **Any VPS** — Behind Nginx with pm2 process management

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for step-by-step instructions for each method.

---

## Security

| Measure | Implementation |
|---|---|
| Message encryption | AES-GCM via Web Crypto API, keys never leave the client |
| Password hashing | PBKDF2 with 100K iterations + unique salt per room |
| Random generation | `crypto.getRandomValues()` for all IDs, names, avatars |
| Input sanitization | HTML entity stripping on display names, length caps |
| Authorization | Ownership checks on signal processing, call management |
| Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| API safety | Room queries strip sensitive fields (password hashes, encryption keys) |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `npx convex deploy` | Deploy Convex backend functions |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with React, Convex, and WebRTC
</p>
