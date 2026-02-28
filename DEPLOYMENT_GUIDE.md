# Chattrix - Deployment Guide

A complete guide for deploying Chattrix from a downloaded ZIP file on your own server or hosting provider.

---

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** v18 or later — [Download](https://nodejs.org/)
- **pnpm** package manager — Install with `npm install -g pnpm`
- **Git** (optional, for version control)

You will also need a **Convex** account (free tier available):
- Sign up at [https://convex.dev](https://convex.dev)

---

## Step 1: Extract and Install Dependencies

```bash
# Unzip the downloaded file
unzip chattrix.zip -d chattrix
cd chattrix

# Install all dependencies
pnpm install
```

---

## Step 2: Set Up Convex Backend

Chattrix uses [Convex](https://convex.dev) as its real-time serverless backend. You need to create a Convex project and deploy the backend functions.

### 2a. Log in to Convex

```bash
npx convex login
```

This will open a browser window for authentication.

### 2b. Create a new Convex project

```bash
npx convex init
```

When prompted:
- Choose **"Create a new project"**
- Give it a name (e.g., `chattrix`)

This generates a `.env.local` file with your `CONVEX_URL`.

> **Important:** Convex functions live in `src/convex/`. The `convex.json` file already points to this directory.

### 2c. Deploy Convex functions

```bash
npx convex deploy
```

This uploads all your backend functions (schema, queries, mutations) to Convex's cloud.

### 2d. Note your Convex URL

After deployment, you'll have a URL like:
```
https://your-project-name-123.convex.cloud
```

You'll need this for the environment variable in the next step.

---

## Step 3: Environment Variables

Create a `.env` file in the project root:

```env
VITE_CONVEX_URL=https://your-project-name-123.convex.cloud
```

Replace the URL with your actual Convex deployment URL from Step 2.

---

## Step 4: Build the Frontend

```bash
pnpm build
```

This compiles TypeScript and builds the production-ready frontend into the `dist/` folder.

---

## Step 5: Choose a Deployment Method

### Option A: Run with the Built-in Production Server

Chattrix includes a production server (`server.js`) with security headers, static file serving, and SPA routing.

```bash
node server.js
```

The app will be available at `http://localhost:5000`.

To run in the background on a server:
```bash
# Using pm2 (recommended for production)
npm install -g pm2
pm2 start server.js --name chattrix
pm2 save

# Or using nohup
nohup node server.js &
```

---

### Option B: Deploy to Vercel (Recommended for Simplicity)

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Create a `vercel.json` in the project root:
   ```json
   {
     "buildCommand": "pnpm build",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

4. Set the environment variable in Vercel dashboard:
   - Go to your project settings > Environment Variables
   - Add `VITE_CONVEX_URL` with your Convex URL

---

### Option C: Deploy to Netlify

1. Create a `netlify.toml` in the project root:
   ```toml
   [build]
     command = "pnpm build"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. Deploy via Netlify CLI or connect your Git repository in the Netlify dashboard.

3. Add `VITE_CONVEX_URL` in the Netlify dashboard under Site Settings > Environment Variables.

---

### Option D: Deploy to a VPS (DigitalOcean, AWS EC2, etc.)

1. SSH into your server and clone/upload the project files.

2. Install Node.js and pnpm:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   npm install -g pnpm
   ```

3. Install dependencies and build:
   ```bash
   cd chattrix
   pnpm install
   pnpm build
   ```

4. Set up the environment variable:
   ```bash
   export VITE_CONVEX_URL=https://your-project-name-123.convex.cloud
   ```

5. Run with pm2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name chattrix
   pm2 startup
   pm2 save
   ```

6. Set up Nginx as a reverse proxy:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

7. Enable HTTPS with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

### Option E: Deploy with Docker

1. Create a `Dockerfile` in the project root:
   ```dockerfile
   FROM node:20-alpine AS builder
   RUN npm install -g pnpm
   WORKDIR /app
   COPY package.json pnpm-lock.yaml ./
   RUN pnpm install --frozen-lockfile
   COPY . .
   ARG VITE_CONVEX_URL
   ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
   RUN pnpm build

   FROM node:20-alpine
   RUN npm install -g pnpm
   WORKDIR /app
   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/server.js ./
   COPY --from=builder /app/package.json ./
   COPY --from=builder /app/pnpm-lock.yaml ./
   RUN pnpm install --prod --frozen-lockfile
   EXPOSE 5000
   CMD ["node", "server.js"]
   ```

2. Build and run:
   ```bash
   docker build --build-arg VITE_CONVEX_URL=https://your-url.convex.cloud -t chattrix .
   docker run -p 5000:5000 chattrix
   ```

---

## Step 6: Verify Deployment

1. Open the deployed URL in your browser.
2. You should see the Chattrix landing page.
3. Try creating a room, joining with another browser/tab, and sending messages.
4. Test the calling feature by starting a call from within a room.

---

## Project Structure Overview

```
chattrix/
├── src/
│   ├── components/     # UI components (chat, call, UI primitives)
│   ├── convex/         # Convex backend (schema, queries, mutations)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities, crypto, config
│   ├── pages/          # Page components (Home, Room, Call, Auth, 404)
│   ├── services/       # Service classes (session management)
│   ├── store/          # Zustand state stores
│   └── types/          # TypeScript type definitions
├── public/             # Static assets
├── server.js           # Production server (Hono) with security headers
├── convex.json         # Convex configuration
├── vite.config.ts      # Vite build configuration
├── tailwind.config.ts  # Tailwind CSS configuration
└── package.json        # Dependencies and scripts
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `VITE_CONVEX_URL` | Yes | Your Convex deployment URL |

---

## Troubleshooting

### "Convex functions not found" error
Make sure you ran `npx convex deploy` and that `convex.json` points to `src/convex/`.

### Blank page after deployment
- Check that `VITE_CONVEX_URL` is set before running `pnpm build` (Vite embeds env vars at build time).
- Ensure your hosting has SPA routing (all paths serve `index.html`).

### WebRTC calls not connecting
- Calls require HTTPS in production (browsers block microphone access on HTTP).
- STUN/TURN servers must be reachable from the user's network.
- Check browser console for ICE connection errors.

### Build fails with TypeScript errors
```bash
# Skip type checking if needed
npx vite build
```

---

## Security Notes

- The production server (`server.js`) includes security headers: CSP, HSTS, X-Frame-Options, and more.
- Passwords are hashed with PBKDF2 (100K iterations) before storage.
- Messages are encrypted client-side before being sent to Convex.
- No user registration required — all identities are anonymous.
- For production TURN servers, replace the hardcoded credentials in `src/lib/config.ts` with environment variables.

---

## Support

For issues or questions, refer to the project documentation or open an issue in your repository.
