import { createContext, useContext, useReducer, ReactNode, createElement } from "react";

// Types
export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: "audioinput" | "videoinput" | "audiooutput";
}

export interface CallState {
  callId: string | null;
  status: "idle" | "ringing" | "connecting" | "connected" | "disconnected" | "error" | "reconnecting";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isBackgroundBlurred: boolean;
  devices: {
    audioInputs: MediaDevice[];
    videoInputs: MediaDevice[];
    audioOutputs: MediaDevice[];
  };
  selectedDevices: {
    audioInput: string;
    videoInput: string;
    audioOutput: string;
  };
  callDuration: number;
  error: string | null;
  displayName: string;
  // Phase 1: Connection quality
  connectionQuality: "excellent" | "good" | "fair" | "poor" | null;
  connectionMetrics: {
    rtt: number;
    packetLoss: number;
    jitter: number;
    bandwidth: number;
  } | null;
  // Phase 2: Reconnection
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

type CallAction =
  | { type: "SET_CALL_ID"; payload: string }
  | { type: "SET_STATUS"; payload: CallState["status"] }
  | { type: "SET_LOCAL_STREAM"; payload: MediaStream | null }
  | { type: "SET_REMOTE_STREAM"; payload: MediaStream | null }
  | { type: "SET_PEER_CONNECTION"; payload: RTCPeerConnection | null }
  | { type: "TOGGLE_AUDIO" }
  | { type: "TOGGLE_VIDEO" }
  | { type: "SET_SCREEN_SHARING"; payload: boolean }
  | { type: "SET_BACKGROUND_BLUR"; payload: boolean }
  | { type: "SET_DEVICES"; payload: CallState["devices"] }
  | { type: "SET_SELECTED_DEVICE"; payload: { type: keyof CallState["selectedDevices"]; deviceId: string } }
  | { type: "SET_CALL_DURATION"; payload: number }
  | { type: "INCREMENT_CALL_DURATION" }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_DISPLAY_NAME"; payload: string }
  | { type: "SET_CONNECTION_QUALITY"; payload: CallState["connectionQuality"] }
  | { type: "SET_CONNECTION_METRICS"; payload: CallState["connectionMetrics"] }
  | { type: "INCREMENT_RECONNECT_ATTEMPTS" }
  | { type: "RESET_RECONNECT_ATTEMPTS" }
  | { type: "RESET" };

const initialState: CallState = {
  callId: null,
  status: "idle",
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  isBackgroundBlurred: false,
  devices: {
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  },
  selectedDevices: {
    audioInput: "",
    videoInput: "",
    audioOutput: "",
  },
  callDuration: 0,
  error: null,
  displayName: "",
  connectionQuality: null,
  connectionMetrics: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
};

function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "SET_CALL_ID":
      return { ...state, callId: action.payload };
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_LOCAL_STREAM":
      return { ...state, localStream: action.payload };
    case "SET_REMOTE_STREAM":
      return { ...state, remoteStream: action.payload };
    case "SET_PEER_CONNECTION":
      return { ...state, peerConnection: action.payload };
    case "TOGGLE_AUDIO":
      return { ...state, isAudioEnabled: !state.isAudioEnabled };
    case "TOGGLE_VIDEO":
      return { ...state, isVideoEnabled: !state.isVideoEnabled };
    case "SET_SCREEN_SHARING":
      return { ...state, isScreenSharing: action.payload };
    case "SET_BACKGROUND_BLUR":
      return { ...state, isBackgroundBlurred: action.payload };
    case "SET_DEVICES":
      return { ...state, devices: action.payload };
    case "SET_SELECTED_DEVICE":
      return {
        ...state,
        selectedDevices: {
          ...state.selectedDevices,
          [action.payload.type]: action.payload.deviceId,
        },
      };
    case "SET_CALL_DURATION":
      return { ...state, callDuration: action.payload };
    case "INCREMENT_CALL_DURATION":
      return { ...state, callDuration: state.callDuration + 1 };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_DISPLAY_NAME":
      return { ...state, displayName: action.payload };
    case "SET_CONNECTION_QUALITY":
      return { ...state, connectionQuality: action.payload };
    case "SET_CONNECTION_METRICS":
      return { ...state, connectionMetrics: action.payload };
    case "INCREMENT_RECONNECT_ATTEMPTS":
      return { ...state, reconnectAttempts: state.reconnectAttempts + 1 };
    case "RESET_RECONNECT_ATTEMPTS":
      return { ...state, reconnectAttempts: 0 };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface CallContextType {
  state: CallState;
  actions: {
    setCallId: (callId: string) => void;
    setStatus: (status: CallState["status"]) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setRemoteStream: (stream: MediaStream | null) => void;
    setPeerConnection: (pc: RTCPeerConnection | null) => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
    setScreenSharing: (sharing: boolean) => void;
    setBackgroundBlur: (blur: boolean) => void;
    setDevices: (devices: CallState["devices"]) => void;
    setSelectedDevice: (type: keyof CallState["selectedDevices"], deviceId: string) => void;
    setCallDuration: (duration: number) => void;
    incrementCallDuration: () => void;
    setError: (error: string | null) => void;
    setDisplayName: (name: string) => void;
    setConnectionQuality: (quality: CallState["connectionQuality"]) => void;
    setConnectionMetrics: (metrics: CallState["connectionMetrics"]) => void;
    incrementReconnectAttempts: () => void;
    resetReconnectAttempts: () => void;
    reset: () => void;
    initDevices: () => Promise<void>;
    startLocalMedia: () => Promise<void>;
    stopLocalMedia: () => void;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;
    attemptReconnection: () => Promise<void>;
  };
}

const CallContext = createContext<CallContextType | null>(null);

import { useMemo } from "react";

export function CallProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(callReducer, initialState);

  const actions = useMemo(() => ({
    setCallId: (callId: string) => dispatch({ type: "SET_CALL_ID", payload: callId }),
    setStatus: (status: CallState["status"]) => dispatch({ type: "SET_STATUS", payload: status }),
    setLocalStream: (stream: MediaStream | null) => dispatch({ type: "SET_LOCAL_STREAM", payload: stream }),
    setRemoteStream: (stream: MediaStream | null) => dispatch({ type: "SET_REMOTE_STREAM", payload: stream }),
    setPeerConnection: (pc: RTCPeerConnection | null) => dispatch({ type: "SET_PEER_CONNECTION", payload: pc }),
    toggleAudio: () => dispatch({ type: "TOGGLE_AUDIO" }),
    toggleVideo: () => dispatch({ type: "TOGGLE_VIDEO" }),
    setScreenSharing: (sharing: boolean) => dispatch({ type: "SET_SCREEN_SHARING", payload: sharing }),
    setBackgroundBlur: (blur: boolean) => dispatch({ type: "SET_BACKGROUND_BLUR", payload: blur }),
    setDevices: (devices: CallState["devices"]) => dispatch({ type: "SET_DEVICES", payload: devices }),
    setSelectedDevice: (type: keyof CallState["selectedDevices"], deviceId: string) =>
      dispatch({ type: "SET_SELECTED_DEVICE", payload: { type, deviceId } }),
    setCallDuration: (duration: number) => dispatch({ type: "SET_CALL_DURATION", payload: duration }),
    incrementCallDuration: () => dispatch({ type: "INCREMENT_CALL_DURATION" }),
    setError: (error: string | null) => dispatch({ type: "SET_ERROR", payload: error }),
    setDisplayName: (name: string) => dispatch({ type: "SET_DISPLAY_NAME", payload: name }),
    setConnectionQuality: (quality: CallState["connectionQuality"]) => 
      dispatch({ type: "SET_CONNECTION_QUALITY", payload: quality }),
    setConnectionMetrics: (metrics: CallState["connectionMetrics"]) => 
      dispatch({ type: "SET_CONNECTION_METRICS", payload: metrics }),
    incrementReconnectAttempts: () => dispatch({ type: "INCREMENT_RECONNECT_ATTEMPTS" }),
    resetReconnectAttempts: () => dispatch({ type: "RESET_RECONNECT_ATTEMPTS" }),
    reset: () => dispatch({ type: "RESET" }),

    initDevices: async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === "audioinput").map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as "audioinput",
        }));
        const videoInputs = devices.filter(d => d.kind === "videoinput").map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as "videoinput",
        }));
        const audioOutputs = devices.filter(d => d.kind === "audiooutput").map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as "audiooutput",
        }));

        dispatch({
          type: "SET_DEVICES",
          payload: { audioInputs, videoInputs, audioOutputs },
        });

        // Set default devices
        if (audioInputs.length > 0 && !state.selectedDevices.audioInput) {
          dispatch({
            type: "SET_SELECTED_DEVICE",
            payload: { type: "audioInput", deviceId: audioInputs[0].deviceId },
          });
        }
        if (videoInputs.length > 0 && !state.selectedDevices.videoInput) {
          dispatch({
            type: "SET_SELECTED_DEVICE",
            payload: { type: "videoInput", deviceId: videoInputs[0].deviceId },
          });
        }
        if (audioOutputs.length > 0 && !state.selectedDevices.audioOutput) {
          dispatch({
            type: "SET_SELECTED_DEVICE",
            payload: { type: "audioOutput", deviceId: audioOutputs[0].deviceId },
          });
        }
      } catch (error) {
        console.error("Failed to enumerate devices:", error);
        dispatch({ type: "SET_ERROR", payload: "Failed to access media devices" });
      }
    },

    startLocalMedia: async () => {
      // Prevent starting if already have an active stream
      if (state.localStream && state.localStream.active) {
        console.log("✅ Local stream already active, skipping");
        return;
      }
      
      // Clean up any existing inactive streams
      if (state.localStream) {
        console.log("🧹 Cleaning up inactive local stream");
        state.localStream.getTracks().forEach(track => track.stop());
      }
      
      try {
        const constraints: MediaStreamConstraints = {
          audio: state.selectedDevices.audioInput
            ? { 
                deviceId: { exact: state.selectedDevices.audioInput },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
          video: false, // Audio-only for voice calls (WhatsApp/Telegram style)
        };

        console.log("🎤 Requesting user media (audio only):", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("✅ Got local audio stream with tracks:", stream.getTracks().map(t => `${t.kind}: ${t.enabled}, readyState: ${t.readyState}`));
        
        // Verify tracks are live
        const allTracksLive = stream.getTracks().every(t => t.readyState === "live");
        if (!allTracksLive) {
          console.error("❌ Some tracks are not live:", stream.getTracks().map(t => `${t.kind}: ${t.readyState}`));
        }
        
        dispatch({ type: "SET_LOCAL_STREAM", payload: stream });
      } catch (error) {
        console.error("❌ Failed to get user media:", error);
        dispatch({ type: "SET_ERROR", payload: `Failed to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    },

    stopLocalMedia: () => {
      if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        dispatch({ type: "SET_LOCAL_STREAM", payload: null });
      }
    },

    startScreenShare: async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "monitor",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });
        
        // Replace video track in peer connection if exists
        if (state.peerConnection) {
          const videoTrack = stream.getVideoTracks()[0];
          const sender = state.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === "video"
          );
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
          
          // Also replace audio track if screen sharing includes audio
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            const audioSender = state.peerConnection.getSenders().find(s => 
              s.track && s.track.kind === "audio"
            );
            if (audioSender) {
              await audioSender.replaceTrack(audioTrack);
            }
          }
        }

        dispatch({ type: "SET_SCREEN_SHARING", payload: true });
        
        // Stop screen sharing when user stops it
        stream.getVideoTracks()[0].onended = () => {
          actions.stopScreenShare();
        };
      } catch (error) {
        console.error("Failed to start screen share:", error);
        dispatch({ type: "SET_ERROR", payload: "Failed to start screen sharing" });
      }
    },

    stopScreenShare: async () => {
      try {
        // Restart camera if we were screen sharing
        if (state.isScreenSharing && state.peerConnection) {
          const constraints: MediaStreamConstraints = {
            video: state.selectedDevices.videoInput
              ? { deviceId: { exact: state.selectedDevices.videoInput } }
              : true,
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          const videoTrack = stream.getVideoTracks()[0];
          const sender = state.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === "video"
          );
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
        
        dispatch({ type: "SET_SCREEN_SHARING", payload: false });
      } catch (error) {
        console.error("Failed to stop screen share:", error);
      }
    },

    // Phase 2: Reconnection logic
    attemptReconnection: async () => {
      if (state.reconnectAttempts >= state.maxReconnectAttempts) {
        dispatch({ type: "SET_ERROR", payload: "Maximum reconnection attempts reached" });
        dispatch({ type: "SET_STATUS", payload: "error" });
        return;
      }

      dispatch({ type: "SET_STATUS", payload: "reconnecting" });
      dispatch({ type: "INCREMENT_RECONNECT_ATTEMPTS" });

      try {
        // Attempt to restart local media
        await actions.startLocalMedia();
        
        // Reset peer connection
        if (state.peerConnection) {
          state.peerConnection.close();
        }
        
        dispatch({ type: "SET_STATUS", payload: "connecting" });
        dispatch({ type: "RESET_RECONNECT_ATTEMPTS" });
      } catch (error) {
        console.error("Reconnection failed:", error);
        dispatch({ type: "SET_ERROR", payload: "Reconnection failed" });
        
        // Retry after delay
        setTimeout(() => {
          if (state.reconnectAttempts < state.maxReconnectAttempts) {
            actions.attemptReconnection();
          }
        }, 2000 * (state.reconnectAttempts + 1)); // Exponential backoff
      }
    },
  }), [state.localStream, state.peerConnection, state.selectedDevices, state.isScreenSharing, state.reconnectAttempts, state.maxReconnectAttempts]);

  return (
    createElement(
      CallContext.Provider,
      { value: { state, actions } },
      children
    )
  );
}

export function useCallStore() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallStore must be used within CallProvider");
  }
  return context;
}