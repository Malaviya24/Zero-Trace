import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useGroupCallStore } from "@/store/useGroupCallStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { typedApi } from "@/lib/api-types";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { CallBackground } from "@/components/call/CallBackground";
import { CallAvatar } from "@/components/call/CallAvatar";
import { WhatsAppCallControls } from "@/components/call/WhatsAppCallControls";
import { formatDuration } from "@/lib/utils";
import { LoadingScreen } from "@/components/LoadingScreen";
import { parseSignalPayload } from "@/call/signalingPayload";
import { filterOtherParticipants, getUniqueCallParticipants, getDisplayNameForCall } from "@/lib/call-chat-utils";
import { applyHoldToStream, buildTransferUrl } from "@/lib/call-ui-utils";
import { useAudioOutputDevice } from "@/hooks/useAudioOutputDevice";

type JoinCallResult = {
  participantId: Id<"callParticipants">;
  offer?: string;
  isFirst: boolean;
  offererId?: Id<"callParticipants">;
  leaveToken?: string;
};

type SinkableAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

function RemoteAudioPlayer({ stream, sinkId }: { stream: MediaStream; sinkId?: string }) {
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

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}

function GroupCallPageContent() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const isNew = callId === "new";
  const validCallId = !isNew && callId ? (callId as Id<"calls">) : null;

  const state = useGroupCallStore((s) => s);
  const actions = useGroupCallStore((s) => s.actions);
  const hasJoinedRef = useRef(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");
  const { isBluetooth: isOutputBluetooth } = useAudioOutputDevice(selectedOutputId || null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const peerSetupRef = useRef<Set<string>>(new Set());
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedRef = useRef(false);
  const leaveTokenRef = useRef<string | null>(null);
  const shouldInitiateOffersRef = useRef(false);

  const call = useQuery(typedApi.calls.get, validCallId ? { callId: validCallId } : "skip");
  const participantsQuery = useQuery(typedApi.calls.getParticipants, validCallId ? { callId: validCallId } : "skip");
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
    if (user?._id) {
      const byUser = activeParticipants.find((p: Doc<"callParticipants">) => p.userId === user._id);
      if (byUser) return byUser;
    }
    if (!state.displayName) return undefined;
    const byName = activeParticipants.filter(
      (p: Doc<"callParticipants">) => p.displayName === state.displayName && !p.leftAt
    );
    return byName.length === 1 ? byName[0] : undefined;
  }, [activeParticipants, state.myParticipantId, state.displayName, user?._id]);

  const signalsQuery = useQuery(
    typedApi.signaling.getSignals,
    state.myParticipantId && validCallId ? {
      callId: validCallId,
      participantId: state.myParticipantId
    } : "skip"
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
        
        const newCallId = await createCallMutation({
          roomId: storedRoomId || undefined,
          displayName: storedDisplayName || user?.name || "Anonymous",
          e2ee: true,
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
  }, [isNew, createCallMutation, user?.name, navigate]);

  const sendSignalRef = useRef(sendSignalMutation);
  sendSignalRef.current = sendSignalMutation;
  const markProcessedRef = useRef(markProcessedMutation);
  markProcessedRef.current = markProcessedMutation;
  const getReturnPath = useCallback(() => {
    const sessionRoomId = sessionStorage.getItem("call_room_id");
    const callRoomId = call?.roomId;
    const resolvedRoomId = sessionRoomId || callRoomId || null;
    if (resolvedRoomId) {
      sessionStorage.setItem("call_room_id", resolvedRoomId);
      return `/room/${resolvedRoomId}`;
    }
    return "/";
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
    return user?.name || "Anonymous";
  }, [call?.roomId, user?.name]);

  useEffect(() => {
    if (validCallId && call && !hasJoinedRef.current) {
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
        displayName,
      }).then((result: JoinCallResult) => {
        const participantId = result.participantId;
        leaveTokenRef.current = typeof result.leaveToken === "string" ? result.leaveToken : null;
        console.log("[Call] Joined as:", displayName, "pid:", participantId);
        shouldInitiateOffersRef.current = !result.isFirst;
        actions.setMyParticipantId(participantId);
      }).catch(err => {
        console.error("[Call] Failed to join:", err);
        toast.error("Failed to join call");
        leaveTokenRef.current = null;
        hasJoinedRef.current = false;
      });
    }
  }, [validCallId, call, actions, joinCallMutation, resolveDisplayName]);

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
      actions.startLocalMedia();
    }

    return () => {
      cleanupTimerRef.current = setTimeout(() => {
        console.log("[Call] Cleaning up (deferred)");
        useGroupCallStore.getState().actions.reset();
        peerSetupRef.current.clear();
        processedSignalsRef.current.clear();
        leaveTokenRef.current = null;
        shouldInitiateOffersRef.current = false;
        sessionStorage.removeItem("call_display_name");
      }, 100);
    };
  }, [validCallId]);

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
    const targetPath = getReturnPath();
    const timeoutId = window.setTimeout(() => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      actions.reset();
      navigate(targetPath);
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [call?.status, getReturnPath, actions, navigate]);

  const setupPeerConnection = useCallback((participantId: string) => {
    console.log(`[Call] Setting up peer for: ${participantId}`);

    const pc = useGroupCallStore.getState().actions.createPeerConnection(participantId);

    pc.onicecandidate = async (event) => {
      const myId = useGroupCallStore.getState().myParticipantId;
      if (event.candidate && myId) {
        try {
          await sendSignalRef.current({
            callId: callId as Id<"calls">,
            type: "ice-candidate",
            data: JSON.stringify(event.candidate),
            fromParticipantId: myId,
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
      const myId = useGroupCallStore.getState().myParticipantId;
      if (!myId || !callId) return;
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
        console.log(`[Call] Renegotiation needed for ${participantId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignalRef.current({
          callId: callId as Id<"calls">,
          type: "offer",
          data: JSON.stringify(pc.localDescription),
          fromParticipantId: myId,
          toParticipantId: participantId as Id<"callParticipants">,
        });
      } catch (err) {
        console.error("[Call] Renegotiation failed:", err);
      }
    };

    useGroupCallStore.getState().actions.addTracksToPC(participantId);

    return pc;
  }, [callId]);

  const handleIceRestart = useCallback(async (pc: RTCPeerConnection, participantId: string) => {
    const myId = useGroupCallStore.getState().myParticipantId;
    if (!myId || !callId) return;
    if (pc.signalingState !== "stable") return;

    try {
      console.log(`[Call] ICE restart for: ${participantId}`);
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);

      await sendSignalRef.current({
        callId: callId as Id<"calls">,
        type: "offer",
        data: JSON.stringify(offer),
        fromParticipantId: myId,
        toParticipantId: participantId as Id<"callParticipants">,
      });
    } catch (error) {
      console.error("[Call] ICE restart failed:", error);
    }
  }, [validCallId]);

  useEffect(() => {
    if (!state.localStream) return;

    state.peerConnections.forEach((peerConn, pid) => {
      const senders = peerConn.pc.getSenders();
      const hasAudioSender = senders.some(s => s.track && s.track.kind === "audio");
      if (!hasAudioSender) {
        console.log(`[Call] Late-adding audio track to peer: ${pid}`);
        state.localStream!.getTracks().forEach(track => {
          peerConn.pc.addTrack(track, state.localStream!);
        });
      }
    });
  }, [state.localStream, state.peerConnections]);

  useEffect(() => {
    if (!participants || !myParticipant || !state.localStream || !state.myParticipantId) {
      return;
    }

    const otherParticipants = participants.filter(
      (p: Doc<"callParticipants">) => p._id !== state.myParticipantId
    );

    otherParticipants.forEach((participant: Doc<"callParticipants">) => {
      const pid = participant._id;

      if (!peerSetupRef.current.has(pid) && !state.peerConnections.has(pid)) {
        peerSetupRef.current.add(pid);
        console.log(`[Call] New participant: ${participant.displayName} (${pid})`);

        const pc = setupPeerConnection(pid);

        const myJoinedAt = myParticipant.joinedAt || 0;
        const otherJoinedAt = participant.joinedAt || 0;
        const fallbackShouldCreateOffer =
          myJoinedAt > otherJoinedAt ||
          (myJoinedAt === otherJoinedAt && String(state.myParticipantId) > String(pid));
        const shouldCreateOffer = shouldInitiateOffersRef.current || fallbackShouldCreateOffer;
        if (shouldCreateOffer) {
          console.log(`[Call] I joined after ${participant.displayName}, creating offer`);
          actions.setStatus("connecting");

          (async () => {
            try {
              if (pc.signalingState !== "stable") {
                console.warn(`[Call] Cannot create offer, state: ${pc.signalingState}`);
                return;
              }
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              const myId = useGroupCallStore.getState().myParticipantId;
              if (myId) {
                await sendSignalRef.current({
                  callId: validCallId,
                  type: "offer",
                  data: JSON.stringify(pc.localDescription),
                  fromParticipantId: myId,
                  toParticipantId: pid as Id<"callParticipants">,
                });
                console.log(`[Call] Offer sent to ${participant.displayName}`);
              }
            } catch (err) {
              console.error("[Call] Failed to create/send offer:", err);
              peerSetupRef.current.delete(pid);
            }
          })();
        } else {
          console.log(`[Call] Waiting for offer from ${participant.displayName}`);
        }
      }
    });

    const currentPids = new Set(otherParticipants.map((p: Doc<"callParticipants">) => p._id as string));
    state.peerConnections.forEach((_, pid) => {
      if (!currentPids.has(pid)) {
        console.log(`[Call] Participant left: ${pid}`);
        actions.removePeerConnection(pid);
        peerSetupRef.current.delete(pid);
      }
    });
  }, [participants, myParticipant, state.localStream, state.myParticipantId, validCallId, setupPeerConnection, actions]);

  useEffect(() => {
    if (!signals || signals.length === 0 || !state.myParticipantId || isProcessingRef.current) {
      return;
    }

    const unprocessed = signals.filter((s: Doc<"signaling">) => !processedSignalsRef.current.has(s._id));
    if (unprocessed.length === 0) return;

    isProcessingRef.current = true;

    const processAll = async () => {
      console.log(`[Call] Processing ${unprocessed.length} signal(s)`);

      for (const signal of unprocessed) {
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
          if (signal.type === "offer") {
            const parsed = parseSignalPayload("offer", signal.data);
            const myId = useGroupCallStore.getState().myParticipantId!;
            const iAmPolite = myId < fromPid;
            const offerCollision = pc.signalingState !== "stable";

            console.log(`[Call] Offer from ${fromPid}, signalingState: ${pc.signalingState}, polite: ${iAmPolite}, collision: ${offerCollision}`);

            if (!iAmPolite && offerCollision) {
              console.log("[Call] Impolite peer ignoring colliding offer");
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
              await sendSignalRef.current({
                callId: validCallId,
                type: "answer",
                data: JSON.stringify(pc.localDescription),
                fromParticipantId: myId,
                toParticipantId: fromPid as Id<"callParticipants">,
              });
              console.log(`[Call] Answer sent to ${fromPid}`);
            }

          } else if (signal.type === "answer") {
            const parsed = parseSignalPayload("answer", signal.data);
            console.log(`[Call] Answer from ${fromPid}, signalingState: ${pc.signalingState}`);

            if (pc.signalingState !== "have-local-offer") {
              console.warn(`[Call] Skipping answer in state: ${pc.signalingState}`);
              continue;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(parsed.payload));
            useGroupCallStore.getState().actions.markRemoteDescriptionSet(fromPid);
            console.log(`[Call] Answer applied from ${fromPid}`);

          } else if (signal.type === "ice-candidate") {
            const parsed = parseSignalPayload("ice-candidate", signal.data);
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

          await markProcessedRef.current({ signalId: signal._id, participantId: state.myParticipantId });
          processedSignalsRef.current.add(signal._id);
        } catch (error) {
          console.error(`[Call] Failed to process ${signal.type}:`, error);
        }
      }
    };

    processAll().finally(() => {
      isProcessingRef.current = false;
    });
  }, [signals, state.myParticipantId, participants, validCallId, setupPeerConnection]);

  const handleEndCall = async () => {
    if (validCallId) {
      try {
        await leaveCallMutation({
          callId: validCallId,
          participantId: state.myParticipantId || undefined,
          leaveToken: leaveTokenRef.current || undefined,
        });
      } catch (error) {
        console.error("[Call] Backend leave failed:", error);
      }
    }

    actions.reset();
    hasNavigatedRef.current = true;
    navigate(getReturnPath());
  };

  const handleToggleAudio = () => {
    actions.toggleAudio();
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

  const resolvedMyParticipantId = myParticipant?._id || state.myParticipantId || null;
  const otherParticipants = filterOtherParticipants(
    uniqueParticipants as Array<{ _id: string; displayName: string }> | undefined,
    resolvedMyParticipantId,
    state.displayName
  ) as Doc<"callParticipants">[];
  const totalParticipants = uniqueParticipants.length;
  const displayName = otherParticipants.length > 0
    ? otherParticipants.map((p: Doc<"callParticipants">) => getDisplayNameForCall(p.displayName)).join(", ")
    : "Waiting for others...";

  const isConnected = state.status === "connected" || Array.from(state.peerConnections.values()).some(
    (pc) => pc.pc.connectionState === "connected"
  );
  const isWaiting = !isConnected && otherParticipants.length === 0;

  const remoteStreams = Array.from(state.peerConnections.entries())
    .filter(([, pc]) => pc.remoteStream)
    .map(([pid, pc]) => ({ pid, stream: pc.remoteStream! }));

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-gradient-to-br from-[#061125] via-[#081833] to-[#040b1e]">
      <CallBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_60%)]" />

      {remoteStreams.map(({ pid, stream }) => (
        <RemoteAudioPlayer key={pid} stream={stream} sinkId={selectedOutputId || undefined} />
      ))}

      <div className="relative z-10 h-full flex flex-col items-center justify-between py-6 sm:py-8 px-3 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-white"
        >
          <p className="text-sm sm:text-base font-medium opacity-90">
            {isConnected
              ? `${totalParticipants} participant${totalParticipants !== 1 ? "s" : ""}`
              : isOnHold
              ? "On hold"
              : isWaiting
              ? "Ringing..."
              : "Connecting..."}
          </p>
          {state.error && (
            <p className="text-sm text-red-300 mt-2">{state.error}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-4 sm:gap-6"
        >
          <CallAvatar displayName={displayName} isConnected={isConnected} />

          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {displayName}
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm sm:text-base text-white/60 font-medium"
            >
              Group voice call
            </motion.p>
          </div>
        </motion.div>
        <div className="absolute bottom-28 right-4 sm:right-8 h-20 w-28 sm:h-28 sm:w-40 rounded-xl border border-white/20 bg-white/5 backdrop-blur flex items-end justify-start p-2 text-[10px] text-white/70">
          You
        </div>

        <WhatsAppCallControls
          isAudioEnabled={state.isAudioEnabled}
          isSpeakerEnabled={!!selectedOutputId}
          isOnHold={isOnHold}
          participantsCount={totalParticipants}
          callDurationLabel={formatDuration(state.callDuration)}
          connectionQuality={isConnected ? "good" : "fair"}
          onToggleAudio={handleToggleAudio}
          onToggleSpeaker={() => {
            if (audioOutputs.length > 1) {
              const idx = audioOutputs.findIndex((d) => d.deviceId === selectedOutputId);
              const next = audioOutputs[(idx + 1) % audioOutputs.length];
              setSelectedOutputId(next?.deviceId ?? "");
            } else if (audioOutputs.length === 1) {
              setSelectedOutputId(audioOutputs[0].deviceId);
            }
          }}
          isBluetooth={isOutputBluetooth}
          onToggleHold={handleToggleHold}
          onTransferCall={handleTransferCall}
          onToggleParticipants={() => toast.message("Participants are shown in the main call header")}
          onToggleChat={() => toast.message("Use room chat panel for group call messaging")}
          onOpenSettings={() => toast.message("Open device settings from browser permission controls")}
          onEndCall={handleEndCall}
        />
      </div>
    </div>
  );
}

export default function GroupCallPage() {
  return <GroupCallPageContent />;
}
