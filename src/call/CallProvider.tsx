import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { WebRTCManager } from "./WebRTCManager";
import { RingtoneController } from "./ringtone";
import { CallAnalyticsPayload, CallStatsSnapshot, CallStatus, ConnectionQuality } from "./types";

type CallState = {
  status: CallStatus;
  callId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  speakerOn: boolean;
  onHold: boolean;
  selectedOutputDeviceId: string;
  stats: CallStatsSnapshot;
  quality: ConnectionQuality;
  reconnectCount: number;
  callDurationSec: number;
  incomingFrom: string | null;
  qualityTimeline: ConnectionQuality[];
};

type Action =
  | { type: "STATUS"; payload: CallStatus }
  | { type: "CALL_ID"; payload: string | null }
  | { type: "LOCAL_STREAM"; payload: MediaStream | null }
  | { type: "REMOTE_STREAM"; payload: MediaStream | null }
  | { type: "MUTED"; payload: boolean }
  | { type: "SPEAKER"; payload: boolean }
  | { type: "OUTPUT"; payload: string }
  | { type: "STATS"; payload: CallStatsSnapshot }
  | { type: "QUALITY"; payload: ConnectionQuality }
  | { type: "RECONNECT_INC" }
  | { type: "DURATION_INC" }
  | { type: "DURATION_RESET" }
  | { type: "INCOMING"; payload: string | null }
  | { type: "HOLD"; payload: boolean }
  | { type: "RESET" };

const initial: CallState = {
  status: "idle",
  callId: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  speakerOn: true,
  selectedOutputDeviceId: "",
  stats: { rttMs: 0, jitterMs: 0, packetLoss: 0, bitrateKbps: 0 },
  quality: "excellent",
  reconnectCount: 0,
  callDurationSec: 0,
  incomingFrom: null,
  qualityTimeline: [],
  onHold: false,
};

function reducer(state: CallState, action: Action): CallState {
  switch (action.type) {
    case "STATUS":
      return { ...state, status: action.payload };
    case "CALL_ID":
      return { ...state, callId: action.payload };
    case "LOCAL_STREAM":
      return { ...state, localStream: action.payload };
    case "REMOTE_STREAM":
      return { ...state, remoteStream: action.payload };
    case "MUTED":
      return { ...state, muted: action.payload };
    case "SPEAKER":
      return { ...state, speakerOn: action.payload };
    case "OUTPUT":
      return { ...state, selectedOutputDeviceId: action.payload };
    case "STATS":
      return { ...state, stats: action.payload };
    case "QUALITY":
      return { ...state, quality: action.payload, qualityTimeline: [...state.qualityTimeline, action.payload] };
    case "RECONNECT_INC":
      return { ...state, reconnectCount: state.reconnectCount + 1 };
    case "DURATION_INC":
      return { ...state, callDurationSec: state.callDurationSec + 1 };
    case "DURATION_RESET":
      return { ...state, callDurationSec: 0 };
    case "INCOMING":
      return { ...state, incomingFrom: action.payload };
    case "HOLD":
      return { ...state, onHold: action.payload };
    case "RESET":
      return initial;
    default:
      return state;
  }
}

type CallContextValue = {
  state: CallState;
  startOutgoingCall: (callId: string, audioInputId?: string) => Promise<void>;
  receiveIncomingCall: (callId: string, from: string) => Promise<void>;
  acceptIncomingCall: (audioInputId?: string) => Promise<void>;
  rejectIncomingCall: () => void;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  setHold: (hold: boolean) => void;
  setOutputDevice: (deviceId: string) => Promise<void>;
  bindRemoteAudioElement: (el: HTMLAudioElement | null) => void;
  trackAnalytics: (endpoint: string) => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneRef = useRef(new RingtoneController());
  const managerRef = useRef<WebRTCManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new WebRTCManager({
      onRemoteStream: (stream) => {
        dispatch({ type: "REMOTE_STREAM", payload: stream });
        if (audioElRef.current) audioElRef.current.srcObject = stream;
      },
      onConnectionState: (connection) => {
        if (connection === "connected") dispatch({ type: "STATUS", payload: "connected" });
        if (connection === "connecting") dispatch({ type: "STATUS", payload: "connecting" });
        if (connection === "disconnected" || connection === "failed") dispatch({ type: "STATUS", payload: "reconnecting" });
      },
      onStats: (stats, quality) => {
        dispatch({ type: "STATS", payload: stats });
        dispatch({ type: "QUALITY", payload: quality === "weak" ? "weak" : quality });
      },
      onReconnectAttempt: () => dispatch({ type: "RECONNECT_INC" }),
    });
  }

  const manager = managerRef.current;

  useEffect(() => {
    const unlock = () => ringtoneRef.current.unlock();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    if (state.status !== "connected") return;
    const t = window.setInterval(() => dispatch({ type: "DURATION_INC" }), 1000);
    return () => window.clearInterval(t);
  }, [state.status]);

  const startOutgoingCall = useCallback(async (callId: string, audioInputId?: string) => {
    dispatch({ type: "CALL_ID", payload: callId });
    dispatch({ type: "STATUS", payload: "outgoing" });
    await ringtoneRef.current.playOutgoing();
    const stream = await manager.ensureLocalStream(audioInputId);
    dispatch({ type: "LOCAL_STREAM", payload: stream });
    await manager.createConnection();
    await manager.attachLocalTracks();
    manager.startStatsMonitor();
    dispatch({ type: "STATUS", payload: "ringing" });
  }, [manager]);

  const receiveIncomingCall = useCallback(async (callId: string, from: string) => {
    dispatch({ type: "CALL_ID", payload: callId });
    dispatch({ type: "INCOMING", payload: from });
    dispatch({ type: "STATUS", payload: "incoming" });
    await ringtoneRef.current.playIncoming();
  }, []);

  const acceptIncomingCall = useCallback(async (audioInputId?: string) => {
    ringtoneRef.current.stopAll();
    dispatch({ type: "STATUS", payload: "connecting" });
    const stream = await manager.ensureLocalStream(audioInputId);
    dispatch({ type: "LOCAL_STREAM", payload: stream });
    await manager.createConnection();
    await manager.attachLocalTracks();
    manager.startStatsMonitor();
  }, [manager]);

  const rejectIncomingCall = useCallback(() => {
    ringtoneRef.current.stopAll();
    dispatch({ type: "RESET" });
  }, []);

  const endCall = useCallback(async () => {
    ringtoneRef.current.stopAll();
    manager.cleanup();
    if (audioElRef.current) audioElRef.current.srcObject = null;
    dispatch({ type: "RESET" });
  }, [manager]);

  const toggleMute = useCallback(() => {
    const next = !state.muted;
    dispatch({ type: "MUTED", payload: next });
    manager.toggleMute(next || state.onHold);
  }, [manager, state.muted, state.onHold]);

  const setHold = useCallback((hold: boolean) => {
    dispatch({ type: "HOLD", payload: hold });
    manager.toggleMute(state.muted || hold);
  }, [manager, state.muted]);

  const setOutputDevice = useCallback(async (deviceId: string) => {
    if (!audioElRef.current) return;
    const ok = await manager.setOutputDevice(audioElRef.current, deviceId);
    if (ok) dispatch({ type: "OUTPUT", payload: deviceId });
  }, [manager]);

  const outputDevicesRef = useRef<{ deviceId: string }[]>([]);

  const toggleSpeaker = useCallback(async () => {
    const el = audioElRef.current;
    if (!el || typeof (el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId !== "function") {
      dispatch({ type: "SPEAKER", payload: !state.speakerOn });
      return;
    }
    if (outputDevicesRef.current.length === 0) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        outputDevicesRef.current = devices
          .filter((d) => d.kind === "audiooutput")
          .map((d) => ({ deviceId: d.deviceId }));
      } catch {
        dispatch({ type: "SPEAKER", payload: !state.speakerOn });
        return;
      }
    }
    const list = outputDevicesRef.current;
    if (list.length === 0) {
      dispatch({ type: "SPEAKER", payload: !state.speakerOn });
      return;
    }
    const currentId = state.selectedOutputDeviceId || list[0]?.deviceId;
    const idx = list.findIndex((d) => d.deviceId === currentId);
    const nextIdx = (idx + 1) % list.length;
    const nextId = list[nextIdx]?.deviceId ?? list[0]?.deviceId;
    const ok = await manager.setOutputDevice(el, nextId);
    if (ok) {
      dispatch({ type: "OUTPUT", payload: nextId });
      dispatch({ type: "SPEAKER", payload: true });
    } else {
      dispatch({ type: "SPEAKER", payload: !state.speakerOn });
    }
  }, [manager, state.speakerOn, state.selectedOutputDeviceId]);

  const bindRemoteAudioElement = useCallback((el: HTMLAudioElement | null) => {
    audioElRef.current = el;
    if (el && state.remoteStream) el.srcObject = state.remoteStream;
  }, [state.remoteStream]);

  const trackAnalytics = useCallback(async (endpoint: string) => {
    if (!state.callId) return;
    const avgRtt = state.stats.rttMs;
    const avgLoss = state.stats.packetLoss;
    const avgBitrate = state.stats.bitrateKbps;
    const payload: CallAnalyticsPayload = {
      callId: state.callId,
      durationSec: state.callDurationSec,
      reconnectCount: state.reconnectCount,
      averagePacketLoss: avgLoss,
      averageRttMs: avgRtt,
      averageBitrateKbps: avgBitrate,
      qualityTimeline: state.qualityTimeline,
    };
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  }, [state.callDurationSec, state.callId, state.qualityTimeline, state.reconnectCount, state.stats.bitrateKbps, state.stats.packetLoss, state.stats.rttMs]);

  useEffect(() => {
    return () => {
      ringtoneRef.current.stopAll();
      manager.cleanup();
    };
  }, [manager]);

  const value = useMemo<CallContextValue>(() => ({
    state,
    startOutgoingCall,
    receiveIncomingCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    setHold,
    setOutputDevice,
    bindRemoteAudioElement,
    trackAnalytics,
  }), [state, startOutgoingCall, receiveIncomingCall, acceptIncomingCall, rejectIncomingCall, endCall, toggleMute, toggleSpeaker, setHold, setOutputDevice, bindRemoteAudioElement, trackAnalytics]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
