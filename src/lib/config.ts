function parseList(value: string | undefined) {
  if (!value || typeof value !== "string") return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export type RuntimeEnv = {
  VITE_STUN_URLS?: string;
  VITE_TURN_URLS?: string;
  VITE_TURN_USERNAME?: string;
  VITE_TURN_CREDENTIAL?: string;
  VITE_SFU_URL?: string;
  VITE_ENFORCE_CALL_PREFLIGHT?: string;
  PROD?: boolean;
};

const defaultStun = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
];

function isLocalHostname(hostname: string | undefined) {
  if (!hostname) return false;
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  );
}

export function resolveWebRtcConfig(
  env: RuntimeEnv,
  runtimeHostname?: string
): {
  iceServers: RTCIceServer[];
  hasConfiguredTurn: boolean;
  requireDedicatedTurn: boolean;
  forceRelayTransport: boolean;
  hasSfuEndpoint: boolean;
  requireSfuEndpoint: boolean;
  canStartCalls: boolean;
  missingTurnReason: string | null;
  missingSfuReason: string | null;
  missingCallInfraReason: string | null;
} {
  const stunUrls = parseList(env.VITE_STUN_URLS);
  const turnUrls = parseList(env.VITE_TURN_URLS);
  const turnUser = env.VITE_TURN_USERNAME as string | undefined;
  const turnCred = env.VITE_TURN_CREDENTIAL as string | undefined;
  const hasConfiguredTurn = turnUrls.length > 0 && !!turnUser && !!turnCred;
  const requireDedicatedTurn = !!env.PROD && !isLocalHostname(runtimeHostname);
  const hasSfuEndpoint = !!env.VITE_SFU_URL;
  const requireSfuEndpoint = !!env.PROD && !isLocalHostname(runtimeHostname);
  const enforceCallPreflight =
    env.VITE_ENFORCE_CALL_PREFLIGHT === "1" ||
    env.VITE_ENFORCE_CALL_PREFLIGHT?.toLowerCase() === "true";

  const iceServers: RTCIceServer[] = [];

  // TURN first for production stability across NAT/carrier networks.
  if (hasConfiguredTurn) {
    iceServers.push({ urls: turnUrls, username: turnUser, credential: turnCred });
  } else if (!requireDedicatedTurn) {
    // Dev/local fallback to keep local testing possible without dedicated relay.
    iceServers.push({
      urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"],
      username: "openrelayproject",
      credential: "openrelayproject",
    });
    iceServers.push({
      urls: "turn:relay1.expressturn.com:443",
      username: "efB2YXSCWI3OEEKI3L",
      credential: "JA7nOSJP8OJSRllf",
    });
  }

  for (const u of (stunUrls.length ? stunUrls : defaultStun)) {
    iceServers.push({ urls: u });
  }

  const missingTurnReason =
    requireDedicatedTurn && !hasConfiguredTurn
      ? "TURN relay credentials are missing for this production deployment. Cross-network call reliability may be degraded."
      : null;
  const missingSfuReason =
    requireSfuEndpoint && !hasSfuEndpoint
      ? "SFU endpoint (VITE_SFU_URL) is missing. Call setup may fail until it is configured."
      : null;

  return {
    iceServers,
    hasConfiguredTurn,
    requireDedicatedTurn,
    forceRelayTransport: requireDedicatedTurn,
    hasSfuEndpoint,
    requireSfuEndpoint,
    // Preflight is advisory by default to avoid false production hard-blocks.
    canStartCalls:
      !enforceCallPreflight ||
      ((!requireDedicatedTurn || hasConfiguredTurn) &&
        (!requireSfuEndpoint || hasSfuEndpoint)),
    missingTurnReason,
    missingSfuReason,
    missingCallInfraReason: missingTurnReason || missingSfuReason,
  };
}

const env = import.meta.env as RuntimeEnv;
const runtimeHostname = typeof window !== "undefined" ? window.location.hostname : undefined;
const webrtcConfig = resolveWebRtcConfig(env, runtimeHostname);

export const CONFIG = {
  webrtc: {
    iceServers: webrtcConfig.iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle" as RTCBundlePolicy,
    rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
    iceTransportPolicy: (webrtcConfig.forceRelayTransport ? "relay" : "all") as RTCIceTransportPolicy,
  },
  callPreflight: {
    hasConfiguredTurn: webrtcConfig.hasConfiguredTurn,
    requireDedicatedTurn: webrtcConfig.requireDedicatedTurn,
    hasSfuEndpoint: webrtcConfig.hasSfuEndpoint,
    requireSfuEndpoint: webrtcConfig.requireSfuEndpoint,
    canStartCalls: webrtcConfig.canStartCalls,
    missingTurnReason: webrtcConfig.missingTurnReason,
    missingSfuReason: webrtcConfig.missingSfuReason,
    missingCallInfraReason: webrtcConfig.missingCallInfraReason,
  },
  media: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: "user",
    },
  },
  timing: {
    signalTTL: 60_000,
    roomExpiry: 2 * 60 * 60 * 1000,
    messageExpiry: 10 * 60 * 1000,
    activityHeartbeat: 30_000,
    iceRestartDelay: 1_000,
    reconnectBackoff: {
      initial: 1_000,
      max: 30_000,
      multiplier: 2,
    },
  },
  limits: {
    messagesPerQuery: 100,
    participantsPerRoom: 50,
    maxCallParticipants: 10,
    maxReconnectAttempts: 5,
  },
  rateLimits: {
    messagesSend: { rate: 10, period: 60_000 },
    callCreate: { rate: 5, period: 60_000 },
    roomCreate: { rate: 3, period: 60_000 },
  },
} as const;
