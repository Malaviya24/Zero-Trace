import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { useGroupCallStore } from "@/store/useGroupCallStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Lock, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { typedApi } from "@/lib/api-types";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { WhatsAppCallControls } from "@/components/call/WhatsAppCallControls";
import { ParticipantList } from "@/components/call/ParticipantList";
import { CallChat } from "@/components/call/CallChat";
import { formatDuration } from "@/lib/utils";
import { LoadingScreen } from "@/components/LoadingScreen";
import { parseSignalPayload } from "@/call/signalingPayload";
import { filterOtherParticipants, getUniqueCallParticipants, getDisplayNameForCall } from "@/lib/call-chat-utils";
import { applyHoldToStream, buildTransferUrl } from "@/lib/call-ui-utils";
import { useAudioOutputDevice } from "@/hooks/useAudioOutputDevice";
import { clearCallReturnPath, resolveCallReturnPath } from "@/lib/call-navigation";
import { ChatCrypto } from "@/lib/crypto";
import { ScreenShield } from "@/components/security/ScreenShield";
import {
  decryptCallSignalPayload,
  encryptCallSignalPayload,
  resolveStoredCallKeyString,
} from "@/lib/call-e2ee";

type JoinCallResult = {
  participantId: Id<"callParticipants">;
  participantToken?: string;
  offer?: string;
  isFirst: boolean;
  offererId?: Id<"callParticipants">;
  leaveToken?: string;
};

function readRoomSession(roomId: string | null | undefined): { participantId: string; participantToken: string } | null {
  if (!roomId) return null;
  try {
    const raw = localStorage.getItem(`room_session_${roomId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.participantId !== "string" ||
      !parsed.participantId ||
      typeof parsed?.participantToken !== "string" ||
      !parsed.participantToken
    ) {
      return null;
    }
    return {
      participantId: parsed.participantId,
      participantToken: parsed.participantToken,
    };
  } catch {
    return null;
  }
}

type SinkableAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

function hasLiveVideoTrack(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((track) => track.readyState === "live");
}

function MediaVideoTile({
  stream,
  mirrored = false,
  className = "",
}: {
  stream: MediaStream;
  mirrored?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={mirrored}
      className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""} ${className}`}
    />
  );
}

function RemoteAudioPlayer({
  stream,
  sinkId,
  enabled,
}: {
  stream: MediaStream;
  sinkId?: string;
  enabled: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;

    audio.srcObject = stream;
    audio.volume = 1.0;

    const tryPlay = () => {
      audio.play().catch(() => {});
    };

    tryPlay();

    const handleClick = () => tryPlay();
    document.addEventListener("click", handleClick);
    document.addEventListener("touchstart", handleClick);

    const handleTrackAdded = () => {
      audio.srcObject = stream;
      tryPlay();
    };
    stream.addEventListener("addtrack", handleTrackAdded);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("touchstart", handleClick);
      stream.removeEventListener("addtrack", handleTrackAdded);
      audio.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const audio = audioRef.current as SinkableAudio | null;
    if (!sinkId || !audio || typeof audio.setSinkId !== "function") return;
    audio.setSinkId(sinkId).catch(() => {});
  }, [sinkId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !enabled;
  }, [enabled]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}

function GroupCallPageContent() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const roomIdHint = sessionStorage.getItem("call_room_id");
  const roomSession = useMemo(() => readRoomSession(roomIdHint), [roomIdHint]);
  
  const isNew = callId === "new";
  const validCallId = !isNew && callId ? (callId as Id<"calls">) : null;

  const state = useGroupCallStore((s) => s);
  const actions = useGroupCallStore((s) => s.actions);
  const hasJoinedRef = useRef(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isPeopleSheetOpen, setIsPeopleSheetOpen] = useState(false);
  const [isChatSheetOpen, setIsChatSheetOpen] = useState(false);
  const [isAudioSheetOpen, setIsAudioSheetOpen] = useState(false);
  const [callE2EEKey, setCallE2EEKey] = useState<CryptoKey | null>(null);
  const [isCallE2EEReady, setIsCallE2EEReady] = useState(false);
  const [callE2EEError, setCallE2EEError] = useState<string | null>(null);
  const [callParticipantToken, setCallParticipantToken] = useState<string | null>(null);
  const { isBluetooth: isOutputBluetooth } = useAudioOutputDevice(selectedOutputId || null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const peerSetupRef = useRef<Set<string>>(new Set());
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedRef = useRef(false);
  const endingCallRef = useRef(false);
  const leaveTokenRef = useRef<string | null>(null);
  const offerRetryCountsRef = useRef<Map<string, number>>(new Map());
  const offerRetryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const peerFirstSeenAtRef = useRef<Map<string, number>>(new Map());
  const videoPreferenceFromQuery = useMemo(() => {
    const rawValue = new URLSearchParams(location.search).get("video");
    if (rawValue === null) return null;
    return rawValue === "true" || rawValue === "1";
  }, [location.search]);
  const shouldStartWithVideo = videoPreferenceFromQuery ?? sessionStorage.getItem("call_video_mode") === "1";
  const supportsSinkSelection = useMemo(() => {
    if (typeof HTMLMediaElement === "undefined") return false;
    return typeof (HTMLMediaElement.prototype as SinkableAudio).setSinkId === "function";
  }, []);

  const call = useQuery(
    typedApi.calls.get,
    validCallId && roomSession
      ? {
          callId: validCallId,
          roomParticipantId: roomSession.participantId as Id<"participants">,
          roomParticipantToken: roomSession.participantToken,
        }
      : "skip"
  );
  const participantsQuery = useQuery(
    typedApi.calls.getParticipants,
    state.myParticipantId && validCallId && callParticipantToken
      ? {
          callId: validCallId,
          participantId: state.myParticipantId,
          participantToken: callParticipantToken,
        }
      : "skip"
  );
  const participants = participantsQuery as Doc<"callParticipants">[] | undefined;
  const activeParticipants = useMemo(
    () => (participants || []).filter((participant: Doc<"callParticipants">) => !participant.leftAt),
    [participants]
  );

  const uniqueParticipants = useMemo(
    () => getUniqueCallParticipants(activeParticipants as Array<{ _id: string; displayName: string; userId?: string }>),
    [activeParticipants]
  );

  const myParticipant = useMemo(() => {
    if (!activeParticipants.length) return undefined;
    if (state.myParticipantId) {
      const byId = activeParticipants.find((p: Doc<"callParticipants">) => p._id === state.myParticipantId);
      if (byId) return byId;
    }
    if (!state.displayName) return undefined;
    const byName = activeParticipants.filter(
      (p: Doc<"callParticipants">) => p.displayName === state.displayName && !p.leftAt
    );
    return byName.length === 1 ? byName[0] : undefined;
  }, [activeParticipants, state.myParticipantId, state.displayName]);

  const signalsQuery = useQuery(
    typedApi.signaling.getSignals,
    state.myParticipantId && validCallId && callParticipantToken
      ? {
          callId: validCallId,
          participantId: state.myParticipantId,
          participantToken: callParticipantToken,
        }
      : "skip"
  );
  const signals = signalsQuery as Doc<"signaling">[] | undefined;

  const createCallMutation = useMutation(typedApi.calls.create);
  const leaveCallMutation = useMutation(typedApi.calls.leave);
  const joinCallMutation = useMutation(typedApi.calls.join);
  const sendSignalMutation = useMutation(typedApi.signaling.sendSignal);
  const markProcessedMutation = useMutation(typedApi.signaling.markProcessed);

  // Handle "new" call creation
  useEffect(() => {
    if (!isNew) return;
    
    const createNewCall = async () => {
      try {
        const storedDisplayName = sessionStorage.getItem("call_display_name");
        const storedRoomId = sessionStorage.getItem("call_room_id");
        const storedRoomSession = readRoomSession(storedRoomId);
        const storedCallKey = resolveStoredCallKeyString(storedRoomId);
        if (!storedCallKey || !storedRoomSession) {
          toast.error("Missing room key. Rejoin room before starting encrypted call.");
          navigate(resolveCallReturnPath(storedRoomId ?? undefined), { replace: true });
          return;
        }
        sessionStorage.setItem("call_e2ee_key", storedCallKey);
        if (storedRoomId) {
          sessionStorage.setItem("call_e2ee_room_id", storedRoomId);
        }
        
        const newCallId = await createCallMutation({
          roomId: storedRoomId || "",
          roomParticipantId: storedRoomSession.participantId as Id<"participants">,
          roomParticipantToken: storedRoomSession.participantToken,
          displayName: storedDisplayName || "Anonymous",
          e2ee: true,
          sfuEnabled: false,
        });
        
        // Navigate to the new call URL
        navigate(`/call/${newCallId}`, { replace: true });
      } catch (error) {
        console.error("Failed to create new call:", error);
        toast.error("Failed to start call");
        navigate("/");
      }
    };
    
    createNewCall();
  }, [isNew, createCallMutation, navigate]);

  const sendSignalRef = useRef(sendSignalMutation);
  sendSignalRef.current = sendSignalMutation;
  const markProcessedRef = useRef(markProcessedMutation);
  markProcessedRef.current = markProcessedMutation;

  const markSignalProcessedSafe = useCallback(
    async (
      signalId: Id<"signaling">,
      participantId: Id<"callParticipants">,
      options?: { localOnly?: boolean }
    ) => {
      if (options?.localOnly) {
        processedSignalsRef.current.add(signalId);
        return;
      }
      if (!callParticipantToken) {
        processedSignalsRef.current.add(signalId);
        return;
      }
      try {
        await markProcessedRef.current({ signalId, participantId, participantToken: callParticipantToken });
        processedSignalsRef.current.add(signalId);
      } catch {
        // After leave/end, stop remote writes and avoid retry loops for stale signals.
        if (endingCallRef.current || hasNavigatedRef.current) {
          processedSignalsRef.current.add(signalId);
        }
      }
    },
    [callParticipantToken]
  );
  const getReturnPath = useCallback(() => {
    const sessionRoomId = sessionStorage.getItem("call_room_id");
    const callRoomId = call?.roomId;
    const resolvedRoomId = sessionRoomId || callRoomId || null;
    if (resolvedRoomId) {
      sessionStorage.setItem("call_room_id", resolvedRoomId);
    }
    return resolveCallReturnPath(resolvedRoomId ?? undefined);
  }, [call?.roomId]);
  const resolveDisplayName = useCallback(() => {
    const savedName = sessionStorage.getItem("call_display_name");
    if (savedName?.trim()) return savedName.trim();
    const roomId = call?.roomId;
    if (roomId) {
      try {
        const rawSession = localStorage.getItem(`room_session_${roomId}`);
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (typeof parsed?.displayName === "string" && parsed.displayName.trim()) {
            return parsed.displayName.trim();
          }
        }
      } catch (error) {
        console.warn("[Call] Failed to read room session display name:", error);
      }
    }
    return "Anonymous";
  }, [call?.roomId]);

  useEffect(() => {
    if (videoPreferenceFromQuery === null) return;
    sessionStorage.setItem("call_video_mode", videoPreferenceFromQuery ? "1" : "0");
  }, [videoPreferenceFromQuery]);

  const isCallEncryptionRequired = call?.e2ee !== false;

  useEffect(() => {
    if (!isCallEncryptionRequired) {
      setCallE2EEKey(null);
      setCallE2EEError(null);
      setIsCallE2EEReady(true);
      return;
    }

    let cancelled = false;
    const loadCallKey = async () => {
      setIsCallE2EEReady(false);
      setCallE2EEError(null);
      const roomIdForKey = call?.roomId || sessionStorage.getItem("call_room_id");
      const keyString = resolveStoredCallKeyString(roomIdForKey);
      if (!keyString) {
        if (!cancelled) {
          setCallE2EEKey(null);
          setCallE2EEError("Missing room encryption key for this call.");
          setIsCallE2EEReady(true);
        }
        return;
      }
      try {
        const key = await ChatCrypto.importKey(keyString);
        if (cancelled) return;
        sessionStorage.setItem("call_e2ee_key", keyString);
        if (call?.roomId) {
          sessionStorage.setItem("call_e2ee_room_id", call.roomId);
        }
        setCallE2EEKey(key);
        setCallE2EEError(null);
      } catch {
        if (!cancelled) {
          setCallE2EEKey(null);
          setCallE2EEError("Invalid room encryption key for this call.");
        }
      } finally {
        if (!cancelled) {
          setIsCallE2EEReady(true);
        }
      }
    };

    void loadCallKey();

    return () => {
      cancelled = true;
    };
  }, [call?.roomId, isCallEncryptionRequired]);

  const encodeSignalPayload = useCallback(
    async (payload: unknown) =>
      encryptCallSignalPayload(payload, callE2EEKey, isCallEncryptionRequired),
    [callE2EEKey, isCallEncryptionRequired]
  );

  const decodeSignalPayload = useCallback(
    async (data: string) =>
      decryptCallSignalPayload(data, callE2EEKey, isCallEncryptionRequired),
    [callE2EEKey, isCallEncryptionRequired]
  );

  useEffect(() => {
    if (!validCallId || !call || hasJoinedRef.current) return;
    if (!roomSession) return;
    if (isCallEncryptionRequired && !isCallE2EEReady) return;
    if (isCallEncryptionRequired && !callE2EEKey) {
      return;
    }

    hasJoinedRef.current = true;

    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    const displayName = resolveDisplayName();
    sessionStorage.setItem("call_display_name", displayName);
    actions.setDisplayName(displayName);

    joinCallMutation({
      callId: validCallId,
      roomParticipantId: roomSession.participantId as Id<"participants">,
      roomParticipantToken: roomSession.participantToken,
      displayName,
    }).then((result: JoinCallResult) => {
      const participantId = result.participantId;
      leaveTokenRef.current = typeof result.leaveToken === "string" ? result.leaveToken : null;
      setCallParticipantToken(
        typeof result.participantToken === "string" && result.participantToken
          ? result.participantToken
          : roomSession.participantToken
      );
      console.log("[Call] Joined as:", displayName, "pid:", participantId);
      actions.setMyParticipantId(participantId);
    }).catch(err => {
      console.error("[Call] Failed to join:", err);
      toast.error("Failed to join call");
      leaveTokenRef.current = null;
        setCallParticipantToken(null);
        hasJoinedRef.current = false;
      });
  }, [
    validCallId,
    call,
    actions,
    joinCallMutation,
    resolveDisplayName,
    isCallEncryptionRequired,
    isCallE2EEReady,
    callE2EEKey,
    callE2EEError,
    roomSession,
  ]);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      if (cancelled) return;
      const outputs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 8)}` }));
      setAudioOutputs(outputs);
      setSelectedOutputId((prev) => (outputs.length > 0 && !prev ? outputs[0].deviceId : prev));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (audioOutputs.length === 1 && !selectedOutputId) {
      setSelectedOutputId(audioOutputs[0].deviceId);
    }
  }, [audioOutputs, selectedOutputId]);

  useEffect(() => {
    if (validCallId) {
      actions.setCallId(validCallId);
      void actions.startLocalMedia({ withVideo: shouldStartWithVideo });
    }

    return () => {
      cleanupTimerRef.current = setTimeout(() => {
        console.log("[Call] Cleaning up (deferred)");
        useGroupCallStore.getState().actions.reset();
        peerSetupRef.current.clear();
        processedSignalsRef.current.clear();
        leaveTokenRef.current = null;
        setCallParticipantToken(null);
        offerRetryCountsRef.current.clear();
        offerRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
        offerRetryTimersRef.current.clear();
        peerFirstSeenAtRef.current.clear();
        sessionStorage.removeItem("call_display_name");
        sessionStorage.removeItem("call_e2ee_key");
        sessionStorage.removeItem("call_e2ee_room_id");
      }, 100);
    };
  }, [validCallId, actions, shouldStartWithVideo]);

  useEffect(() => {
    let intervalId: number | undefined;
    const hasConnectedPeer = state.status === "connected" || Array.from(state.peerConnections.values()).some(
      (pc) => pc.pc.connectionState === "connected" || !!pc.remoteStream
    );
    if (hasConnectedPeer) {
      intervalId = window.setInterval(() => actions.incrementCallDuration(), 1000);
    }
    return () => { if (intervalId !== undefined) window.clearInterval(intervalId); };
  }, [state.peerConnections, state.status, actions]);

  useEffect(() => {
    if (call?.status !== "ended" || hasNavigatedRef.current) return;
    endingCallRef.current = true;
    const targetPath = getReturnPath();
    const timeoutId = window.setTimeout(() => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      offerRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
      offerRetryTimersRef.current.clear();
      offerRetryCountsRef.current.clear();
      peerFirstSeenAtRef.current.clear();
      actions.reset();
      sessionStorage.removeItem("call_e2ee_key");
      sessionStorage.removeItem("call_e2ee_room_id");
      clearCallReturnPath();
      navigate(targetPath);
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [call?.status, getReturnPath, actions, navigate]);

  const clearOfferRetryTimer = useCallback((participantId: string) => {
    const existingTimer = offerRetryTimersRef.current.get(participantId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      offerRetryTimersRef.current.delete(participantId);
    }
  }, []);

  const isOfferInitiator = useCallback((myId: string, peerId: string) => {
    return String(myId) < String(peerId);
  }, []);

  const setupPeerConnectionRef = useRef<(participantId: string) => RTCPeerConnection | null>(() => null);

  const tryCreateAndSendOffer = useCallback(
    async (
      participantId: string,
      reason: string,
      options?: {
        iceRestart?: boolean;
      }
    ) => {
      if (endingCallRef.current || hasNavigatedRef.current || call?.status === "ended") return false;
      if (!validCallId || !callParticipantToken) return false;

      const myId = useGroupCallStore.getState().myParticipantId;
      if (!myId) return false;

      let peerConn = useGroupCallStore.getState().actions.getPeerConnection(participantId);
      if (!peerConn) {
        const created = setupPeerConnectionRef.current(participantId);
        if (!created) return false;
        peerConn = useGroupCallStore.getState().actions.getPeerConnection(participantId);
      }
      if (!peerConn) return false;

      const pc = peerConn.pc;
      if (pc.signalingState !== "stable") {
        console.log(`[Call] Offer skipped for ${participantId} (${reason}), signalingState: ${pc.signalingState}`);
        return false;
      }

      try {
        const offer = options?.iceRestart
          ? await pc.createOffer({ iceRestart: true })
          : await pc.createOffer();
        await pc.setLocalDescription(offer);

        const encryptedData = await encodeSignalPayload(pc.localDescription);
        await sendSignalRef.current({
          callId: validCallId,
          type: "offer",
          data: encryptedData,
          fromParticipantId: myId,
          fromParticipantToken: callParticipantToken,
          toParticipantId: participantId as Id<"callParticipants">,
        });

        offerRetryCountsRef.current.delete(participantId);
        clearOfferRetryTimer(participantId);
        return true;
      } catch (error) {
        console.error(`[Call] Offer flow failed for ${participantId} (${reason}):`, error);
        actions.removePeerConnection(participantId);
        peerSetupRef.current.delete(participantId);
        return false;
      }
    },
    [actions, call?.status, callParticipantToken, clearOfferRetryTimer, encodeSignalPayload, validCallId]
  );

  const scheduleOfferRetry = useCallback(
    (participantId: string, reason: string) => {
      if (endingCallRef.current || hasNavigatedRef.current || call?.status === "ended") return;
      if (offerRetryTimersRef.current.has(participantId)) return;

      const currentCount = offerRetryCountsRef.current.get(participantId) ?? 0;
      if (currentCount >= 4) return;

      const delayMs = Math.min(4000, 500 * 2 ** currentCount);
      const nextCount = currentCount + 1;
      offerRetryCountsRef.current.set(participantId, nextCount);

      const timer = setTimeout(() => {
        offerRetryTimersRef.current.delete(participantId);
        void tryCreateAndSendOffer(participantId, `retry-${nextCount}:${reason}`);
      }, delayMs);
      offerRetryTimersRef.current.set(participantId, timer);
    },
    [call?.status, tryCreateAndSendOffer]
  );

  const handleIceRestart = useCallback(
    async (pc: RTCPeerConnection, participantId: string) => {
      if (pc.signalingState !== "stable") return;
      const sent = await tryCreateAndSendOffer(participantId, "ice-restart", { iceRestart: true });
      if (!sent) {
        scheduleOfferRetry(participantId, "ice-restart");
      }
    },
    [scheduleOfferRetry, tryCreateAndSendOffer]
  );

  const setupPeerConnection = useCallback((participantId: string): RTCPeerConnection | null => {
    if (endingCallRef.current || call?.status === "ended") {
      return null;
    }
    console.log(`[Call] Setting up peer for: ${participantId}`);

    const pc = useGroupCallStore.getState().actions.createPeerConnection(participantId);

    pc.onicecandidate = async (event) => {
      if (endingCallRef.current || call?.status === "ended") return;
      const myId = useGroupCallStore.getState().myParticipantId;
      if (event.candidate && myId && validCallId && callParticipantToken) {
        try {
          const encryptedData = await encodeSignalPayload(event.candidate);
          await sendSignalRef.current({
            callId: validCallId,
            type: "ice-candidate",
            data: encryptedData,
            fromParticipantId: myId,
            fromParticipantToken: callParticipantToken,
            toParticipantId: participantId as Id<"callParticipants">,
          });
        } catch (error) {
          console.warn("[Call] Failed to send ICE:", error);
        }
      }
    };

    pc.ontrack = (event) => {
      console.log("[Call] *** RECEIVED REMOTE TRACK ***", participantId,
        "kind:", event.track.kind,
        "readyState:", event.track.readyState,
        "streams:", event.streams.length
      );

      let remoteStream = event.streams[0];
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStream.addTrack(event.track);
        console.log("[Call] Created new MediaStream for trackless event");
      }

      useGroupCallStore.getState().actions.setRemoteStream(participantId, remoteStream);
      useGroupCallStore.getState().actions.setStatus("connected");
    };

    pc.onconnectionstatechange = () => {
      const connState = pc.connectionState;
      console.log(`[Call] Connection state ${participantId}: ${connState}`);
      if (connState === "connected") {
        useGroupCallStore.getState().actions.setStatus("connected");
      } else if (connState === "failed") {
        console.log("[Call] Connection failed, attempting ICE restart");
        handleIceRestart(pc, participantId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Call] ICE state ${participantId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed") {
        handleIceRestart(pc, participantId);
      }
    };

    pc.onnegotiationneeded = async () => {
      if (!useGroupCallStore.getState().myParticipantId || !validCallId || !callParticipantToken) return;
      if (pc.signalingState !== "stable") {
        console.log(`[Call] onnegotiationneeded skipped, state: ${pc.signalingState}`);
        return;
      }
      const peerConn = useGroupCallStore.getState().actions.getPeerConnection(participantId);
      if (!peerConn?.hasRemoteDescription) {
        console.log(`[Call] onnegotiationneeded skipped, no remote desc yet for ${participantId}`);
        return;
      }
      try {
        const sent = await tryCreateAndSendOffer(participantId, "renegotiation");
        if (!sent) {
          scheduleOfferRetry(participantId, "renegotiation");
        }
      } catch (error) {
        console.error("[Call] Renegotiation failed:", error);
      }
    };

    if (useGroupCallStore.getState().localStream) {
      useGroupCallStore.getState().actions.addTracksToPC(participantId);
    }

    return pc;
  }, [
    call?.status,
    callParticipantToken,
    encodeSignalPayload,
    handleIceRestart,
    scheduleOfferRetry,
    tryCreateAndSendOffer,
    validCallId,
  ]);
  setupPeerConnectionRef.current = setupPeerConnection;

  useEffect(() => {
    if (!state.localStream) return;
    state.peerConnections.forEach((_, participantId) => {
      actions.addTracksToPC(participantId);
    });
  }, [state.localStream, state.peerConnections, actions]);

  useEffect(() => {
    if (!participants || !myParticipant || !state.myParticipantId || !callParticipantToken) {
      return;
    }

    const otherParticipants = participants.filter(
      (p: Doc<"callParticipants">) => p._id !== state.myParticipantId
    );

    otherParticipants.forEach((participant: Doc<"callParticipants">) => {
      const pid = participant._id;
      if (!peerFirstSeenAtRef.current.has(pid)) {
        peerFirstSeenAtRef.current.set(pid, Date.now());
      }
      let createdNow = false;

      if (!peerSetupRef.current.has(pid) && !state.peerConnections.has(pid)) {
        createdNow = true;
        peerSetupRef.current.add(pid);
        console.log(`[Call] New participant: ${participant.displayName} (${pid})`);

        const pc = setupPeerConnection(pid);
        if (!pc) {
          peerSetupRef.current.delete(pid);
          return;
        }
      }

      if (createdNow && isOfferInitiator(String(state.myParticipantId), String(pid))) {
        actions.setStatus("connecting");
        void tryCreateAndSendOffer(pid, "participant-joined").then((sent) => {
          if (!sent) {
            scheduleOfferRetry(pid, "participant-joined");
          }
        });
      } else {
        console.log(`[Call] Waiting for offer from ${participant.displayName}`);
      }
    });

    const currentPids = new Set(otherParticipants.map((p: Doc<"callParticipants">) => p._id as string));
    state.peerConnections.forEach((_, pid) => {
      if (!currentPids.has(pid)) {
        console.log(`[Call] Participant left: ${pid}`);
        actions.removePeerConnection(pid);
        peerSetupRef.current.delete(pid);
        offerRetryCountsRef.current.delete(pid);
        clearOfferRetryTimer(pid);
        peerFirstSeenAtRef.current.delete(pid);
      }
    });
  }, [
    participants,
    myParticipant,
    state.myParticipantId,
    state.peerConnections,
    callParticipantToken,
    setupPeerConnection,
    actions,
    clearOfferRetryTimer,
    isOfferInitiator,
    scheduleOfferRetry,
    tryCreateAndSendOffer,
  ]);

  useEffect(() => {
    if (
      !participants ||
      !state.myParticipantId ||
      !callParticipantToken ||
      endingCallRef.current ||
      hasNavigatedRef.current ||
      call?.status === "ended"
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      for (const participant of participants) {
        if (participant._id === state.myParticipantId) continue;
        if (!isOfferInitiator(String(state.myParticipantId), String(participant._id))) continue;

        const peerConn = useGroupCallStore.getState().actions.getPeerConnection(participant._id);
        const isConnected =
          !!peerConn?.remoteStream ||
          peerConn?.pc.connectionState === "connected" ||
          peerConn?.pc.iceConnectionState === "connected";
        if (isConnected) {
          offerRetryCountsRef.current.delete(participant._id);
          clearOfferRetryTimer(participant._id);
          continue;
        }

        const firstSeen = peerFirstSeenAtRef.current.get(participant._id) ?? Date.now();
        peerFirstSeenAtRef.current.set(participant._id, firstSeen);
        if (Date.now() - firstSeen < 6000) continue;

        void tryCreateAndSendOffer(participant._id, "watchdog").then((sent) => {
          if (!sent) {
            scheduleOfferRetry(participant._id, "watchdog");
          }
        });
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [
    call?.status,
    participants,
    state.myParticipantId,
    callParticipantToken,
    clearOfferRetryTimer,
    isOfferInitiator,
    scheduleOfferRetry,
    tryCreateAndSendOffer,
  ]);

  useEffect(() => {
    if (
      endingCallRef.current ||
      hasNavigatedRef.current ||
      call?.status === "ended" ||
      !signals ||
      signals.length === 0 ||
      !state.myParticipantId ||
      !callParticipantToken ||
      isProcessingRef.current
    ) {
      return;
    }

    const unprocessed = signals.filter((s: Doc<"signaling">) => !processedSignalsRef.current.has(s._id));
    if (unprocessed.length === 0) return;

    const myParticipantId = state.myParticipantId;
    if (!myParticipantId) return;

    isProcessingRef.current = true;

    const processAll = async () => {
      console.log(`[Call] Processing ${unprocessed.length} signal(s)`);

      for (const signal of unprocessed) {
        if (endingCallRef.current || hasNavigatedRef.current || call?.status === "ended") {
          await markSignalProcessedSafe(signal._id, myParticipantId, { localOnly: true });
          continue;
        }
        const fromPid = signal.fromParticipantId;

        console.log(`[Call] Signal: ${signal.type} from ${fromPid}`);

        let peerConn = useGroupCallStore.getState().actions.getPeerConnection(fromPid);

        if (!peerConn) {
          if (!peerSetupRef.current.has(fromPid)) {
            peerSetupRef.current.add(fromPid);
            setupPeerConnection(fromPid);
            peerConn = useGroupCallStore.getState().actions.getPeerConnection(fromPid);
          }
        }

        if (!peerConn) {
          console.error("[Call] No peer connection for:", fromPid);
          continue;
        }

        const pc = peerConn.pc;

        try {
          const rawSignalPayload = await decodeSignalPayload(signal.data);
          if (signal.type === "offer") {
            const parsed = parseSignalPayload("offer", rawSignalPayload);
            const myId = useGroupCallStore.getState().myParticipantId!;
            const iAmPolite = myId < fromPid;
            const offerCollision = pc.signalingState !== "stable";

            console.log(`[Call] Offer from ${fromPid}, signalingState: ${pc.signalingState}, polite: ${iAmPolite}, collision: ${offerCollision}`);

            if (!iAmPolite && offerCollision) {
              console.log("[Call] Impolite peer ignoring colliding offer");
              await markSignalProcessedSafe(signal._id, myParticipantId);
              continue;
            }

            if (iAmPolite && offerCollision) {
              console.log("[Call] Polite peer rolling back for incoming offer");
              await pc.setLocalDescription({ type: "rollback" });
            }

            await pc.setRemoteDescription(new RTCSessionDescription(parsed.payload));
            useGroupCallStore.getState().actions.markRemoteDescriptionSet(fromPid);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (myId) {
              const encryptedData = await encodeSignalPayload(pc.localDescription);
              await sendSignalRef.current({
                callId: validCallId,
                type: "answer",
                data: encryptedData,
                fromParticipantId: myId,
                fromParticipantToken: callParticipantToken,
                toParticipantId: fromPid as Id<"callParticipants">,
              });
              console.log(`[Call] Answer sent to ${fromPid}`);
            }

          } else if (signal.type === "answer") {
            const parsed = parseSignalPayload("answer", rawSignalPayload);
            console.log(`[Call] Answer from ${fromPid}, signalingState: ${pc.signalingState}`);

            if (pc.signalingState !== "have-local-offer") {
              console.warn(`[Call] Skipping answer in state: ${pc.signalingState}`);
              await markSignalProcessedSafe(signal._id, myParticipantId);
              continue;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(parsed.payload));
            useGroupCallStore.getState().actions.markRemoteDescriptionSet(fromPid);
            console.log(`[Call] Answer applied from ${fromPid}`);

          } else if (signal.type === "ice-candidate") {
            const parsed = parseSignalPayload("ice-candidate", rawSignalPayload);
            const candidate = new RTCIceCandidate(parsed.payload);
            const currentPeerConn = useGroupCallStore.getState().actions.getPeerConnection(fromPid);

            if (currentPeerConn?.hasRemoteDescription && pc.remoteDescription) {
              await pc.addIceCandidate(candidate);
              console.log(`[Call] ICE candidate added from ${fromPid}`);
            } else {
              useGroupCallStore.getState().actions.queueIceCandidate(fromPid, candidate);
              console.log(`[Call] ICE candidate queued for ${fromPid}`);
            }
          }

          await markSignalProcessedSafe(signal._id, myParticipantId);
        } catch (error) {
          console.error(`[Call] Failed to process ${signal.type}:`, error);
          if (signal.type === "offer" || signal.type === "answer") {
            actions.removePeerConnection(fromPid);
            peerSetupRef.current.delete(fromPid);
            if (isOfferInitiator(String(myParticipantId), String(fromPid))) {
              scheduleOfferRetry(String(fromPid), `process-${signal.type}`);
            }
          }
          await markSignalProcessedSafe(signal._id, myParticipantId, {
            localOnly: endingCallRef.current || hasNavigatedRef.current || call?.status === "ended",
          });
        }
      }
    };

    processAll().finally(() => {
      isProcessingRef.current = false;
    });
  }, [
    call?.status,
    signals,
    state.myParticipantId,
    participants,
    validCallId,
    setupPeerConnection,
    markSignalProcessedSafe,
    actions,
    decodeSignalPayload,
    callParticipantToken,
    isOfferInitiator,
    scheduleOfferRetry,
  ]);

  const handleEndCall = async () => {
    endingCallRef.current = true;
    if (validCallId && state.myParticipantId && callParticipantToken) {
      try {
        await leaveCallMutation({
          callId: validCallId,
          participantId: state.myParticipantId,
          participantToken: callParticipantToken,
          leaveToken: leaveTokenRef.current || undefined,
        });
      } catch (error) {
        console.error("[Call] Backend leave failed:", error);
      }
    }

    offerRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
    offerRetryTimersRef.current.clear();
    offerRetryCountsRef.current.clear();
    peerFirstSeenAtRef.current.clear();
    setIsPeopleSheetOpen(false);
    setIsChatSheetOpen(false);
    setIsAudioSheetOpen(false);
    actions.reset();
    hasNavigatedRef.current = true;
    sessionStorage.removeItem("call_e2ee_key");
    sessionStorage.removeItem("call_e2ee_room_id");
    const targetPath = getReturnPath();
    clearCallReturnPath();
    navigate(targetPath);
  };

  const handleToggleAudio = () => {
    actions.toggleAudio();
  };

  const handleToggleVideo = async () => {
    await actions.toggleVideo();
  };

  const handleToggleHold = () => {
    setIsOnHold((prev) => {
      const next = !prev;
      applyHoldToStream(state.localStream, next, state.isAudioEnabled);
      toast.success(next ? "Call on hold" : "Call resumed");
      return next;
    });
  };

  const handleTransferCall = async () => {
    try {
      const transferUrl = buildTransferUrl(window.location.origin, validCallId);
      if (navigator.share) {
        await navigator.share({ title: "Join group call", url: transferUrl });
      } else {
        await navigator.clipboard.writeText(transferUrl);
      }
      toast.success("Transfer link ready to share");
    } catch (error) {
      console.error("Transfer call failed:", error);
      toast.error("Unable to prepare transfer link");
    }
  };

  const handleToggleSpeaker = useCallback(() => {
    if (!isSpeakerEnabled) {
      setIsSpeakerEnabled(true);
      if (supportsSinkSelection && audioOutputs.length > 0 && !selectedOutputId) {
        setSelectedOutputId(audioOutputs[0].deviceId);
      }
      return;
    }
    setIsSpeakerEnabled(false);
  }, [audioOutputs, isSpeakerEnabled, selectedOutputId, supportsSinkSelection]);

  const handleSelectAudioOutput = useCallback(
    (deviceId: string) => {
      setSelectedOutputId(deviceId);
      setIsSpeakerEnabled(true);
    },
    []
  );

  const handleCycleAudioOutput = useCallback(() => {
    if (!supportsSinkSelection || audioOutputs.length < 2) return;
    const currentIndex = audioOutputs.findIndex((device) => device.deviceId === selectedOutputId);
    const nextIndex = (currentIndex + 1) % audioOutputs.length;
    const nextOutput = audioOutputs[nextIndex];
    if (!nextOutput) return;
    setSelectedOutputId(nextOutput.deviceId);
    setIsSpeakerEnabled(true);
    toast.success(`Audio output: ${nextOutput.label}`);
  }, [audioOutputs, selectedOutputId, supportsSinkSelection]);

  if (!callId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <Card className="w-96 shadow-lg border-destructive/20">
          <CardContent className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Invalid Call</h2>
            <p className="text-muted-foreground mb-6 text-sm">No call ID provided.</p>
            <Button onClick={() => navigate(getReturnPath())} className="w-full" size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isNew) {
    return (
      <LoadingScreen
        variant="page"
        message="Starting group call..."
        submessage="Creating secure room"
      />
    );
  }

  if (!roomSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <Card className="w-96 shadow-lg border-destructive/20">
          <CardContent className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Session Required</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Your room session expired. Rejoin the room before joining the call.
            </p>
            <Button onClick={() => navigate(getReturnPath())} className="w-full" size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Room
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (call === undefined) {
    return (
      <LoadingScreen
        variant="page"
        message="Connecting to call..."
        submessage="Setting up your secure connection"
      />
    );
  }

  if (call === null || call?.status === "ended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <Card className="w-96 shadow-lg border-destructive/20">
          <CardContent className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
            <p className="text-muted-foreground mb-6 text-sm">This call has ended or doesn't exist.</p>
            <Button onClick={() => navigate(getReturnPath())} className="w-full" size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCallEncryptionRequired && !isCallE2EEReady) {
    return (
      <LoadingScreen
        variant="page"
        message="Preparing encrypted call..."
        submessage="Loading end-to-end encryption keys"
      />
    );
  }

  if (isCallEncryptionRequired && callE2EEError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <Card className="w-96 shadow-lg border-destructive/20">
          <CardContent className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Encrypted Call Setup Failed</h2>
            <p className="text-muted-foreground mb-6 text-sm">{callE2EEError}</p>
            <Button
              onClick={() => navigate(getReturnPath())}
              className="w-full"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Room
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resolvedMyParticipantId = myParticipant?._id || state.myParticipantId || null;
  const otherParticipants = filterOtherParticipants(
    uniqueParticipants as Array<{ _id: string; displayName: string }> | undefined,
    resolvedMyParticipantId,
    state.displayName
  ) as Doc<"callParticipants">[];
  const totalParticipants = uniqueParticipants.length;

  const isConnected = state.status === "connected" || Array.from(state.peerConnections.values()).some(
    (pc) => pc.pc.connectionState === "connected"
  );
  const isWaiting = !isConnected && otherParticipants.length === 0;

  const remoteStreams = Array.from(state.peerConnections.entries())
    .filter(([, pc]) => pc.remoteStream)
    .map(([pid, pc]) => ({ pid, stream: pc.remoteStream! }));
  const remoteStreamParticipantIds = new Set(remoteStreams.map(({ pid }) => pid));
  const hasLocalVideo = hasLiveVideoTrack(state.localStream);
  const meDisplayName = getDisplayNameForCall(state.displayName || "You");
  const callStatusLabel = isOnHold
    ? "On hold"
    : isConnected
    ? "Connected"
    : isWaiting
    ? "Ringing..."
    : "Connecting...";
  const headerTitle = otherParticipants.length > 0
    ? otherParticipants.map((participant: Doc<"callParticipants">) => getDisplayNameForCall(participant.displayName)).join(", ")
    : "Waiting for participants";
  const callQuality = isOnHold ? "fair" : isConnected ? "good" : "fair";
  const isVideoCallExperience = state.isVideoEnabled || hasLocalVideo || shouldStartWithVideo;
  const participantPanelData = (participants || []).map((participant: Doc<"callParticipants">) => {
    const isLocal = participant._id === resolvedMyParticipantId;
    const peerConnection = state.peerConnections.get(participant._id);
    const remoteStream = peerConnection?.remoteStream ?? null;
    const connectionStatus = isLocal
      ? "connected"
      : remoteStream ||
          peerConnection?.pc.connectionState === "connected" ||
          peerConnection?.pc.iceConnectionState === "connected"
        ? "connected"
        : peerConnection?.pc.connectionState === "connecting" || peerConnection?.pc.connectionState === "new"
          ? "connecting"
          : "disconnected";

    return {
      _id: participant._id,
      displayName: getDisplayNameForCall(participant.displayName),
      isLocal,
      isAudioEnabled: isLocal ? state.isAudioEnabled : connectionStatus === "connected",
      isVideoEnabled: isLocal ? state.isVideoEnabled : hasLiveVideoTrack(remoteStream),
      connectionStatus,
    } as const;
  });

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b141a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,211,102,0.15),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(11,20,26,0.96),rgba(7,27,33,0.9)_35%,rgba(11,20,26,0.98))]" />

      {remoteStreams.map(({ pid, stream }) => (
        <RemoteAudioPlayer
          key={pid}
          stream={stream}
          enabled={isSpeakerEnabled}
          sinkId={supportsSinkSelection && isSpeakerEnabled ? selectedOutputId || undefined : undefined}
        />
      ))}

      <div className="relative z-10 flex h-full flex-col">
        <header className="px-3 pt-3 sm:px-6 sm:pt-5">
          <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full text-white hover:bg-white/15"
                onClick={() => void handleEndCall()}
                aria-label="Leave call"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold sm:text-base">{headerTitle}</p>
                <p className="text-xs text-white/70">{callStatusLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-200 sm:inline-flex">
                <Lock className="h-3 w-3" />
                Encrypted
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/85">
                <Users className="h-3.5 w-3.5" />
                {totalParticipants}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3">
            <div className="relative flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-black/25 p-3 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-4">
              {otherParticipants.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-white/30 bg-white/10 text-3xl font-semibold text-white shadow-2xl">
                    {meDisplayName.charAt(0).toUpperCase()}
                    <motion.span
                      className="absolute inset-0 rounded-full border-2 border-emerald-300/40"
                      animate={{ scale: [1, 1.18, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                  </div>
                  <h2 className="mb-1 text-xl font-semibold">Calling room members</h2>
                  <p className="text-sm text-white/70">
                    Keep this screen open while others join.
                  </p>
                </div>
              ) : (
                <div className={`grid h-full gap-3 ${otherParticipants.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                  {otherParticipants.map((participant: Doc<"callParticipants">) => {
                    const peerConnection = state.peerConnections.get(participant._id);
                    const remoteStream = peerConnection?.remoteStream ?? null;
                    const hasRemoteAudio = remoteStreamParticipantIds.has(participant._id);
                    const hasRemoteVideo = hasLiveVideoTrack(remoteStream);
                    const connectionState = peerConnection?.pc.connectionState;
                    const isParticipantConnected = hasRemoteAudio || connectionState === "connected";
                    const participantStatus = isParticipantConnected
                      ? "Connected"
                      : connectionState === "connecting"
                      ? "Connecting..."
                      : isVideoCallExperience
                      ? "Waiting for video"
                      : "Waiting for audio";

                    return (
                      <div
                        key={participant._id}
                        className={`relative h-full min-h-[180px] overflow-hidden rounded-2xl border px-4 py-6 text-center transition-colors ${
                          isParticipantConnected
                            ? "border-emerald-300/35 bg-emerald-500/10"
                            : "border-white/15 bg-white/5"
                        }`}
                      >
                        {hasRemoteVideo && remoteStream ? (
                          <MediaVideoTile stream={remoteStream} />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center">
                            <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold">
                              {getDisplayNameForCall(participant.displayName).charAt(0).toUpperCase()}
                            </div>
                            <p className="max-w-full truncate text-base font-semibold">
                              {getDisplayNameForCall(participant.displayName)}
                            </p>
                            <p className="mt-1 text-xs text-white/70">{participantStatus}</p>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white/85 backdrop-blur">
                          {getDisplayNameForCall(participant.displayName)}
                        </div>
                        <div className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-1 text-[11px] text-white/70 backdrop-blur">
                          {hasRemoteVideo ? "Video" : participantStatus}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pointer-events-none absolute bottom-3 right-3 flex h-24 w-36 flex-col justify-end overflow-hidden rounded-xl border border-white/20 bg-black/45 p-2 text-left shadow-xl backdrop-blur sm:h-28 sm:w-44">
                {hasLocalVideo && state.localStream ? (
                  <div className="absolute inset-0">
                    <MediaVideoTile stream={state.localStream} mirrored />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/65" />
                  </div>
                ) : null}
                <span className="text-[10px] uppercase tracking-wide text-white/60">You</span>
                <span className="truncate text-sm font-semibold">{meDisplayName}</span>
                <span className="text-xs text-white/70">{state.isVideoEnabled ? "Camera on" : state.isAudioEnabled ? "Mic on" : "Muted"}</span>
              </div>
            </div>
          </div>
        </main>

        <div className="relative z-20">
          {state.error && (
            <div className="mx-auto mb-1 w-full max-w-3xl px-4 text-center text-sm text-rose-300">
              {state.error}
            </div>
          )}
          <WhatsAppCallControls
            isAudioEnabled={state.isAudioEnabled}
            isSpeakerEnabled={isSpeakerEnabled}
            isVideoEnabled={state.isVideoEnabled}
            isOnHold={isOnHold}
            participantsCount={totalParticipants}
            callDurationLabel={formatDuration(state.callDuration)}
            connectionQuality={callQuality}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={() => {
              void handleToggleVideo();
            }}
            onToggleSpeaker={handleToggleSpeaker}
            isBluetooth={isOutputBluetooth}
            onToggleHold={handleToggleHold}
            onTransferCall={handleTransferCall}
            onToggleParticipants={() => setIsPeopleSheetOpen(true)}
            onToggleChat={() => setIsChatSheetOpen(true)}
            onOpenSettings={() => setIsAudioSheetOpen(true)}
            onEndCall={handleEndCall}
          />
        </div>

        <Sheet open={isPeopleSheetOpen} onOpenChange={setIsPeopleSheetOpen}>
          <SheetContent side="bottom" className="h-[78vh] rounded-t-3xl border-white/10 bg-[#0b141a] text-white">
            <SheetHeader>
              <SheetTitle>People in call</SheetTitle>
              <SheetDescription className="text-white/70">
                Live participants and connection status.
              </SheetDescription>
            </SheetHeader>
            <div className="h-[calc(100%-5.5rem)] overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <ParticipantList participants={participantPanelData} className="h-full border-0 bg-transparent" />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={isChatSheetOpen} onOpenChange={setIsChatSheetOpen}>
          <SheetContent side="bottom" className="h-[78vh] rounded-t-3xl border-white/10 bg-[#0b141a] text-white">
            <SheetHeader>
              <SheetTitle>Call chat</SheetTitle>
              <SheetDescription className="text-white/70">
                Chat in this room while staying on call.
              </SheetDescription>
            </SheetHeader>
            <div className="h-[calc(100%-5.5rem)] overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <CallChat roomId={call?.roomId} displayName={state.displayName || meDisplayName} className="h-full border-0 bg-transparent" />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={isAudioSheetOpen} onOpenChange={setIsAudioSheetOpen}>
          <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl border-white/10 bg-[#0b141a] text-white">
            <SheetHeader>
              <SheetTitle>Audio routing</SheetTitle>
              <SheetDescription className="text-white/70">
                Toggle speaker and choose playback device.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-5">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Speaker</p>
                  <p className="text-xs text-white/70">
                    {isSpeakerEnabled ? "Enabled" : "Muted"} {supportsSinkSelection ? "• device switching supported" : "• browser output switching unavailable"}
                  </p>
                </div>
                <Button
                  variant={isSpeakerEnabled ? "default" : "outline"}
                  onClick={handleToggleSpeaker}
                  className={isSpeakerEnabled ? "bg-emerald-500 text-black hover:bg-emerald-400" : "border-white/20 text-white hover:bg-white/10"}
                >
                  {isSpeakerEnabled ? "On" : "Off"}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Output devices</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCycleAudioOutput}
                    disabled={!supportsSinkSelection || audioOutputs.length < 2}
                    className="text-white/80 hover:bg-white/10"
                  >
                    Next device
                  </Button>
                </div>
                <div className="space-y-2">
                  {audioOutputs.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                      No audio output devices detected yet.
                    </p>
                  ) : (
                    audioOutputs.map((output) => (
                      <Button
                        key={output.deviceId}
                        variant={selectedOutputId === output.deviceId ? "default" : "outline"}
                        className={
                          selectedOutputId === output.deviceId
                            ? "w-full justify-start bg-emerald-500/90 text-black hover:bg-emerald-400"
                            : "w-full justify-start border-white/15 text-white hover:bg-white/10"
                        }
                        onClick={() => handleSelectAudioOutput(output.deviceId)}
                        disabled={!supportsSinkSelection}
                      >
                        {output.label}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export default function GroupCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const watermark = callId ? `Call • ${callId}` : "Call • Protected";
  return (
    <ScreenShield watermarkText={watermark} className="h-screen w-screen">
      <GroupCallPageContent />
    </ScreenShield>
  );
}
