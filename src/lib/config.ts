function parseList(value: string | undefined) {
  if (!value || typeof value !== "string") return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

const env = import.meta.env as {
  VITE_STUN_URLS?: string;
  VITE_TURN_URLS?: string;
  VITE_TURN_USERNAME?: string;
  VITE_TURN_CREDENTIAL?: string;
};

const stunUrls = parseList(env.VITE_STUN_URLS);
const turnUrls = parseList(env.VITE_TURN_URLS);
const turnUser = env.VITE_TURN_USERNAME as string | undefined;
const turnCred = env.VITE_TURN_CREDENTIAL as string | undefined;

const defaultStun = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
];

const iceServers: RTCIceServer[] = [];

for (const u of (stunUrls.length ? stunUrls : defaultStun)) {
  iceServers.push({ urls: u });
}

if (turnUrls.length && turnUser && turnCred) {
  iceServers.push({ urls: turnUrls, username: turnUser, credential: turnCred });
} else {
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

export const CONFIG = {
  webrtc: {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle" as RTCBundlePolicy,
    rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
  },
  media: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
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
