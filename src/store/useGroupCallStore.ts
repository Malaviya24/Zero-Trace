import { create } from "zustand";
import { Id } from "@/convex/_generated/dataModel";
import { CONFIG } from "@/lib/config";

interface PeerConnection {
  pc: RTCPeerConnection;
  remoteStream: MediaStream | null;
  iceQueue: RTCIceCandidate[];
  hasRemoteDescription: boolean;
}

function getTransceiverByKind(
  pc: RTCPeerConnection,
  kind: "audio" | "video"
): RTCRtpTransceiver | undefined {
  return pc.getTransceivers().find((transceiver) => {
    const senderKind = transceiver.sender.track?.kind;
    const receiverKind = transceiver.receiver.track.kind;
    return senderKind === kind || receiverKind === kind;
  });
}

function setTransceiverDirection(
  transceiver: RTCRtpTransceiver,
  direction: RTCRtpTransceiverDirection
) {
  try {
    transceiver.direction = direction;
  } catch {
    // no-op
  }
}

interface GroupCallState {
  callId: string | null;
  displayName: string | null;
  myParticipantId: Id<"callParticipants"> | null;
  localStream: MediaStream | null;
  peerConnections: Map<string, PeerConnection>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  callDuration: number;
  status: "idle" | "connecting" | "connected" | "disconnected" | "error";
  error: string | null;
}

interface GroupCallActions {
  setCallId: (callId: string) => void;
  setDisplayName: (name: string) => void;
  setMyParticipantId: (id: Id<"callParticipants">) => void;
  startLocalMedia: (options?: { withVideo?: boolean }) => Promise<void>;
  stopLocalMedia: () => void;
  toggleAudio: () => void;
  toggleVideo: () => Promise<void>;
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
  isVideoEnabled: false,
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

    startLocalMedia: async (options) => {
      const state = get();
      const shouldEnableVideo = !!options?.withVideo;
      if (state.localStream && state.localStream.active) {
        const currentHasVideo = state.localStream.getVideoTracks().some((track) => track.readyState === "live");
        if (currentHasVideo === shouldEnableVideo) {
          set({ isVideoEnabled: currentHasVideo });
          return;
        }

        state.localStream.getTracks().forEach((track) => track.stop());
        set({ localStream: null });
      }

      if (state.localStream) {
        state.localStream.getTracks().forEach((t) => t.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: CONFIG.media.audio,
          video: shouldEnableVideo ? CONFIG.media.video : false,
        });
        set({
          localStream: stream,
          isAudioEnabled: true,
          isVideoEnabled: stream.getVideoTracks().some((track) => track.readyState === "live"),
          error: null,
        });
      } catch (error) {
        console.error("[Call] Local media access failed:", error);
        if (shouldEnableVideo) {
          try {
            // Fall back to audio-only before entering listen-only mode.
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: CONFIG.media.audio,
              video: false,
            });
            set({
              localStream: audioOnlyStream,
              isAudioEnabled: true,
              isVideoEnabled: false,
              error: "Camera unavailable. Joined with microphone only.",
            });
            return;
          } catch (audioError) {
            console.error("[Call] Audio fallback access failed:", audioError);
          }
        }

        // Keep call join possible without media permissions (listen-only).
        set({
          localStream: null,
          isAudioEnabled: false,
          isVideoEnabled: false,
          error: "Media unavailable. Joined in listen-only mode.",
        });
      }
    },

    stopLocalMedia: () => {
      const state = get();
      if (state.localStream) {
        state.localStream.getTracks().forEach(t => t.stop());
        set({ localStream: null, isVideoEnabled: false });
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

    toggleVideo: async () => {
      const state = get();
      const localStream = state.localStream;
      if (!localStream) return;

      const existingVideoTracks = localStream.getVideoTracks();
      const hasLiveVideoTrack = existingVideoTracks.some((track) => track.readyState === "live");

      if (hasLiveVideoTrack) {
        const peerConnections = Array.from(state.peerConnections.values());
        for (const peerConnection of peerConnections) {
          const transceiver = getTransceiverByKind(peerConnection.pc, "video");
          if (transceiver) {
            try {
              await transceiver.sender.replaceTrack(null);
              setTransceiverDirection(transceiver, "recvonly");
            } catch (error) {
              console.warn("[Call] Failed to remove video sender:", error);
            }
          } else {
            const sender = peerConnection.pc
              .getSenders()
              .find((candidate) => candidate.track?.kind === "video");
            if (sender) {
              try {
                peerConnection.pc.removeTrack(sender);
              } catch (error) {
                console.warn("[Call] Failed to remove video sender:", error);
              }
            }
          }
        }

        existingVideoTracks.forEach((track) => {
          try {
            localStream.removeTrack(track);
          } catch {
            // no-op
          }
          track.stop();
        });
        set({ localStream, isVideoEnabled: false });
        return;
      }

      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: CONFIG.media.video,
        });
        const newVideoTrack = cameraStream.getVideoTracks()[0];
        if (!newVideoTrack) {
          set({ error: "No camera track available." });
          return;
        }

        localStream.addTrack(newVideoTrack);
        const peerConnections = Array.from(get().peerConnections.values());
        for (const peerConnection of peerConnections) {
          try {
            const transceiver = getTransceiverByKind(peerConnection.pc, "video");
            if (transceiver) {
              await transceiver.sender.replaceTrack(newVideoTrack);
              setTransceiverDirection(transceiver, "sendrecv");
            } else {
              peerConnection.pc.addTrack(newVideoTrack, localStream);
            }
          } catch (error) {
            console.warn("[Call] Failed to add video track to peer:", error);
          }
        }
        set({ localStream, isVideoEnabled: true, error: null });
      } catch (error) {
        console.error("[Call] Camera access failed:", error);
        set({ error: "Could not access camera. Please allow camera permission." });
      }
    },

    createPeerConnection: (participantId: string): RTCPeerConnection => {
      const state = get();

      console.log(`[Call] Creating peer connection for: ${participantId}`);

      const pc = new RTCPeerConnection({
        iceServers: CONFIG.webrtc.iceServers,
        iceCandidatePoolSize: CONFIG.webrtc.iceCandidatePoolSize,
        bundlePolicy: CONFIG.webrtc.bundlePolicy,
        rtcpMuxPolicy: CONFIG.webrtc.rtcpMuxPolicy,
        iceTransportPolicy: CONFIG.webrtc.iceTransportPolicy,
      });

      // Keep offer SDP valid even when local media isn't ready yet.
      try {
        pc.addTransceiver("audio", { direction: "recvonly" });
      } catch (error) {
        console.warn("[Call] Failed to add audio transceiver:", error);
      }
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
      } catch (error) {
        console.warn("[Call] Failed to add video transceiver:", error);
      }

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

      for (const track of state.localStream.getTracks()) {
        const kind = track.kind as "audio" | "video";
        const transceiver = getTransceiverByKind(peerConn.pc, kind);

        if (transceiver) {
          const currentTrackId = transceiver.sender.track?.id;
          if (currentTrackId === track.id) continue;
          console.log(`[Call] Replacing ${kind} track for peer ${participantId}`);
          void transceiver.sender.replaceTrack(track).catch((error) => {
            console.warn(`[Call] Failed to replace ${kind} track:`, error);
          });
          setTransceiverDirection(transceiver, "sendrecv");
          continue;
        }

        const hasKindSender = peerConn.pc.getSenders().some((sender) => sender.track?.kind === kind);
        if (hasKindSender) continue;
        console.log(`[Call] Adding ${kind} track to peer ${participantId}`);
        peerConn.pc.addTrack(track, state.localStream);
      }
    },

    getPeerConnection: (participantId) => get().peerConnections.get(participantId),

    removePeerConnection: (participantId) => {
      const state = get();
      const peerConn = state.peerConnections.get(participantId);
      if (peerConn) {
        console.log(`[Call] Removing peer connection: ${participantId}`);
        try {
          peerConn.pc.close();
        } catch (error) {
          console.warn("[Call] Failed to close peer connection:", error);
        }
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
        try {
          peerConn.pc.close();
        } catch (error) {
          console.warn("[Call] Failed to close peer connection during reset:", error);
        }
      });
      get().actions.stopLocalMedia();
      set({ ...initialState, peerConnections: new Map() });
    },
  },
}));
