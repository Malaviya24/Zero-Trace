import { create } from "zustand";
import { Id } from "@/convex/_generated/dataModel";
import { CONFIG } from "@/lib/config";

interface PeerConnection {
  pc: RTCPeerConnection;
  remoteStream: MediaStream | null;
  iceQueue: RTCIceCandidate[];
  hasRemoteDescription: boolean;
}

interface GroupCallState {
  callId: string | null;
  displayName: string | null;
  myParticipantId: Id<"callParticipants"> | null;
  localStream: MediaStream | null;
  peerConnections: Map<string, PeerConnection>;
  isAudioEnabled: boolean;
  callDuration: number;
  status: "idle" | "connecting" | "connected" | "disconnected" | "error";
  error: string | null;
}

interface GroupCallActions {
  setCallId: (callId: string) => void;
  setDisplayName: (name: string) => void;
  setMyParticipantId: (id: Id<"callParticipants">) => void;
  startLocalMedia: () => Promise<void>;
  stopLocalMedia: () => void;
  toggleAudio: () => void;
  createPeerConnection: (participantId: string) => RTCPeerConnection;
  addTracksToPC: (participantId: string) => void;
  getPeerConnection: (participantId: string) => PeerConnection | undefined;
  removePeerConnection: (participantId: string) => void;
  setRemoteStream: (participantId: string, stream: MediaStream) => void;
  removeRemoteStream: (participantId: string) => void;
  queueIceCandidate: (participantId: string, candidate: RTCIceCandidate) => void;
  flushIceCandidates: (participantId: string) => Promise<void>;
  markRemoteDescriptionSet: (participantId: string) => void;
  setStatus: (status: GroupCallState["status"]) => void;
  setError: (error: string | null) => void;
  incrementCallDuration: () => void;
  reset: () => void;
}

const initialState: GroupCallState = {
  callId: null,
  displayName: null,
  myParticipantId: null,
  localStream: null,
  peerConnections: new Map(),
  isAudioEnabled: true,
  callDuration: 0,
  status: "idle",
  error: null,
};

export const useGroupCallStore = create<GroupCallState & { actions: GroupCallActions }>((set, get) => ({
  ...initialState,

  actions: {
    setCallId: (callId: string) => set({ callId }),
    setDisplayName: (name: string) => set({ displayName: name }),
    setMyParticipantId: (id: Id<"callParticipants">) => set({ myParticipantId: id }),

    startLocalMedia: async () => {
      const state = get();
      if (state.localStream && state.localStream.active) {
        return;
      }

      if (state.localStream) {
        state.localStream.getTracks().forEach(t => t.stop());
      }

      try {
        console.log("[Call] Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: CONFIG.media.audio,
          video: false,
        });
        console.log("[Call] Microphone access granted, tracks:", stream.getAudioTracks().length);
        set({ localStream: stream, isAudioEnabled: true });
      } catch (error) {
        console.error("[Call] Microphone access failed:", error);
        set({ error: "Could not access microphone. Please allow microphone permission." });
      }
    },

    stopLocalMedia: () => {
      const state = get();
      if (state.localStream) {
        state.localStream.getTracks().forEach(t => t.stop());
        set({ localStream: null });
      }
    },

    toggleAudio: () => {
      const state = get();
      const newState = !state.isAudioEnabled;
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach(t => {
          t.enabled = newState;
        });
      }
      set({ isAudioEnabled: newState });
    },

    createPeerConnection: (participantId: string): RTCPeerConnection => {
      const state = get();

      console.log(`[Call] Creating peer connection for: ${participantId}`);

      const pc = new RTCPeerConnection({
        iceServers: CONFIG.webrtc.iceServers,
        iceCandidatePoolSize: CONFIG.webrtc.iceCandidatePoolSize,
        bundlePolicy: CONFIG.webrtc.bundlePolicy,
        rtcpMuxPolicy: CONFIG.webrtc.rtcpMuxPolicy,
      });

      const peerConnection: PeerConnection = {
        pc,
        remoteStream: null,
        iceQueue: [],
        hasRemoteDescription: false,
      };

      const newMap = new Map(state.peerConnections);
      newMap.set(participantId, peerConnection);
      set({ peerConnections: newMap });

      return pc;
    },

    addTracksToPC: (participantId: string) => {
      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (!peerConn || !state.localStream) {
        console.warn(`[Call] Cannot add tracks: no ${!peerConn ? 'peer connection' : 'local stream'} for ${participantId}`);
        return;
      }
      const senders = peerConn.pc.getSenders();
      const hasAudio = senders.some(s => s.track?.kind === "audio");
      if (!hasAudio) {
        state.localStream.getTracks().forEach((track: MediaStreamTrack) => {
          console.log(`[Call] Adding ${track.kind} track to peer ${participantId}`);
          peerConn.pc.addTrack(track, state.localStream!);
        });
      }
    },

    getPeerConnection: (participantId) => get().peerConnections.get(participantId),

    removePeerConnection: (participantId) => {
      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (peerConn) {
        console.log(`[Call] Removing peer connection: ${participantId}`);
        try { peerConn.pc.close(); } catch {}
        const newMap = new Map(state.peerConnections);
        newMap.delete(participantId);
        set({ peerConnections: newMap });
      }
      get().actions.removeRemoteStream(participantId);
    },

    setRemoteStream: (participantId, stream) => {
      console.log(`[Call] Remote stream received from: ${participantId}, tracks:`, stream.getTracks().map(t => `${t.kind}:${t.readyState}`));

      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (peerConn) {
        const newMap = new Map(state.peerConnections);
        newMap.set(participantId, { ...peerConn, remoteStream: stream });
        set({ peerConnections: newMap });
      }
    },

    removeRemoteStream: (participantId) => {
      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (peerConn) {
        const newMap = new Map(state.peerConnections);
        newMap.set(participantId, { ...peerConn, remoteStream: null });
        set({ peerConnections: newMap });
      }
    },

    queueIceCandidate: (participantId, candidate) => {
      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (peerConn) {
        peerConn.iceQueue.push(candidate);
        const newMap = new Map(state.peerConnections);
        newMap.set(participantId, peerConn);
        set({ peerConnections: newMap });
      }
    },

    flushIceCandidates: async (participantId) => {
      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (peerConn && peerConn.hasRemoteDescription && peerConn.iceQueue.length > 0) {
        console.log(`[Call] Flushing ${peerConn.iceQueue.length} queued ICE candidates for: ${participantId}`);
        for (const candidate of peerConn.iceQueue) {
          try {
            await peerConn.pc.addIceCandidate(candidate);
          } catch (error) {
            console.warn("[Call] Failed to add queued ICE candidate:", error);
          }
        }
        peerConn.iceQueue = [];
        const newMap = new Map(state.peerConnections);
        newMap.set(participantId, peerConn);
        set({ peerConnections: newMap });
      }
    },

    markRemoteDescriptionSet: (participantId) => {
      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (peerConn) {
        peerConn.hasRemoteDescription = true;
        const newMap = new Map(state.peerConnections);
        newMap.set(participantId, peerConn);
        set({ peerConnections: newMap });
        get().actions.flushIceCandidates(participantId);
      }
    },

    setStatus: (status) => set({ status }),
    setError: (error) => set({ error }),
    incrementCallDuration: () => set(s => ({ callDuration: s.callDuration + 1 })),

    reset: () => {
      const state = get();
      state.peerConnections.forEach((peerConn) => {
        try { peerConn.pc.close(); } catch {}
      });
      get().actions.stopLocalMedia();
      set({ ...initialState, peerConnections: new Map() });
    },
  },
}));
