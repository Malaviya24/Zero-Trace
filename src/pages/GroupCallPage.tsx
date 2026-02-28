import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useGroupCallStore } from "@/store/useGroupCallStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { typedApi } from "@/lib/api-types";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { CallBackground } from "@/components/call/CallBackground";
import { CallAvatar } from "@/components/call/CallAvatar";
import { WhatsAppCallControls } from "@/components/call/WhatsAppCallControls";
import { formatDuration } from "@/lib/utils";
import { CONFIG } from "@/lib/config";
import { LoadingScreen } from "@/components/LoadingScreen";

function RemoteAudioPlayer({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;

    audio.srcObject = stream;
    audio.volume = 1.0;

    const tryPlay = () => {
      audio.play().catch(err => {
        console.warn("[Audio] Autoplay blocked, retrying on gesture:", err);
      });
    };

    tryPlay();

    const handleClick = () => tryPlay();
    document.addEventListener("click", handleClick);
    document.addEventListener("touchstart", handleClick);

    const handleTrackAdded = () => {
      console.log("[Audio] New track added to remote stream, replaying");
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

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}

function GroupCallPageContent() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = useGroupCallStore((s) => s);
  const actions = useGroupCallStore((s) => s.actions);
  const hasJoinedRef = useRef(false);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const peerSetupRef = useRef<Set<string>>(new Set());
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const call = useQuery(typedApi.calls.get, callId ? { callId: callId as Id<"calls"> } : "skip");
  const participants = useQuery(typedApi.calls.getParticipants, callId ? { callId: callId as Id<"calls"> } : "skip");

  const myParticipant = participants?.find((p: any) => {
    if (state.myParticipantId) return p._id === state.myParticipantId;
    return p.userId === user?._id;
  });

  const signals = useQuery(
    typedApi.signaling.getSignals,
    state.myParticipantId ? {
      callId: callId as Id<"calls">,
      participantId: state.myParticipantId
    } : "skip"
  );

  const leaveCallMutation = useMutation(typedApi.calls.leave);
  const joinCallMutation = useMutation(typedApi.calls.join);
  const sendSignalMutation = useMutation(typedApi.signaling.sendSignal);
  const markProcessedMutation = useMutation(typedApi.signaling.markProcessed);

  const sendSignalRef = useRef(sendSignalMutation);
  sendSignalRef.current = sendSignalMutation;
  const markProcessedRef = useRef(markProcessedMutation);
  markProcessedRef.current = markProcessedMutation;

  useEffect(() => {
    if (callId && call && !hasJoinedRef.current) {
      hasJoinedRef.current = true;

      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }

      const savedName = sessionStorage.getItem("call_display_name");
      const displayName = savedName || user?.name || `User ${Math.floor(Math.random() * 1000)}`;
      actions.setDisplayName(displayName);

      joinCallMutation({
        callId: callId as Id<"calls">,
        displayName,
      }).then((participantId) => {
        console.log("[Call] Joined as:", displayName, "pid:", participantId);
        actions.setMyParticipantId(participantId as Id<"callParticipants">);
      }).catch(err => {
        console.error("[Call] Failed to join:", err);
        toast.error("Failed to join call");
        hasJoinedRef.current = false;
      });
    }
  }, [callId, call, user, actions, joinCallMutation]);

  useEffect(() => {
    if (callId) {
      actions.setCallId(callId);
      actions.startLocalMedia();
    }

    return () => {
      cleanupTimerRef.current = setTimeout(() => {
        console.log("[Call] Cleaning up (deferred)");
        useGroupCallStore.getState().actions.reset();
        peerSetupRef.current.clear();
        processedSignalsRef.current.clear();
        sessionStorage.removeItem("call_display_name");
        sessionStorage.removeItem("call_room_id");
      }, 100);
    };
  }, [callId]);

  useEffect(() => {
    let intervalId: number | undefined;
    const hasConnectedPeer = Array.from(state.peerConnections.values()).some(
      (pc) => pc.pc.connectionState === "connected"
    );
    if (hasConnectedPeer) {
      intervalId = window.setInterval(() => actions.incrementCallDuration(), 1000);
    }
    return () => { if (intervalId !== undefined) window.clearInterval(intervalId); };
  }, [state.peerConnections, actions]);

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
  }, [callId]);

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
      (p: any) => p._id !== state.myParticipantId
    );

    otherParticipants.forEach((participant: any) => {
      const pid = participant._id;

      if (!peerSetupRef.current.has(pid) && !state.peerConnections.has(pid)) {
        peerSetupRef.current.add(pid);
        console.log(`[Call] New participant: ${participant.displayName} (${pid})`);

        const pc = setupPeerConnection(pid);

        const iJoinedAfter = (myParticipant.joinedAt || 0) > (participant.joinedAt || 0);
        if (iJoinedAfter) {
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
                  callId: callId as Id<"calls">,
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
          console.log(`[Call] I joined before ${participant.displayName}, waiting for their offer`);
        }
      }
    });

    const currentPids = new Set(otherParticipants.map((p: any) => p._id));
    state.peerConnections.forEach((_, pid) => {
      if (!currentPids.has(pid)) {
        console.log(`[Call] Participant left: ${pid}`);
        actions.removePeerConnection(pid);
        peerSetupRef.current.delete(pid);
      }
    });
  }, [participants, myParticipant, state.localStream, state.myParticipantId, callId, setupPeerConnection, actions]);

  useEffect(() => {
    if (!signals || signals.length === 0 || !state.myParticipantId || isProcessingRef.current) {
      return;
    }

    const unprocessed = signals.filter((s: any) => !processedSignalsRef.current.has(s._id));
    if (unprocessed.length === 0) return;

    isProcessingRef.current = true;

    const processAll = async () => {
      console.log(`[Call] Processing ${unprocessed.length} signal(s)`);

      for (const signal of unprocessed) {
        processedSignalsRef.current.add(signal._id);

        try {
          await markProcessedRef.current({ signalId: signal._id });
        } catch {
          continue;
        }

        const fromPid = signal.fromParticipantId;
        const data = JSON.parse(signal.data);

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

            await pc.setRemoteDescription(new RTCSessionDescription(data));
            useGroupCallStore.getState().actions.markRemoteDescriptionSet(fromPid);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (myId) {
              await sendSignalRef.current({
                callId: callId as Id<"calls">,
                type: "answer",
                data: JSON.stringify(pc.localDescription),
                fromParticipantId: myId,
                toParticipantId: fromPid as Id<"callParticipants">,
              });
              console.log(`[Call] Answer sent to ${fromPid}`);
            }

          } else if (signal.type === "answer") {
            console.log(`[Call] Answer from ${fromPid}, signalingState: ${pc.signalingState}`);

            if (pc.signalingState !== "have-local-offer") {
              console.warn(`[Call] Skipping answer in state: ${pc.signalingState}`);
              continue;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(data));
            useGroupCallStore.getState().actions.markRemoteDescriptionSet(fromPid);
            console.log(`[Call] Answer applied from ${fromPid}`);

          } else if (signal.type === "ice-candidate") {
            const candidate = new RTCIceCandidate(data);
            const currentPeerConn = useGroupCallStore.getState().actions.getPeerConnection(fromPid);

            if (currentPeerConn?.hasRemoteDescription && pc.remoteDescription) {
              await pc.addIceCandidate(candidate);
              console.log(`[Call] ICE candidate added from ${fromPid}`);
            } else {
              useGroupCallStore.getState().actions.queueIceCandidate(fromPid, candidate);
              console.log(`[Call] ICE candidate queued for ${fromPid}`);
            }
          }
        } catch (error) {
          console.error(`[Call] Failed to process ${signal.type}:`, error);
        }
      }
    };

    processAll().finally(() => {
      isProcessingRef.current = false;
    });
  }, [signals, state.myParticipantId, participants, callId, setupPeerConnection]);

  const handleEndCall = async () => {
    const roomId = sessionStorage.getItem("call_room_id");

    if (callId) {
      try {
        await leaveCallMutation({ callId: callId as Id<"calls"> });
      } catch (error) {
        console.error("[Call] Backend leave failed:", error);
      }
    }

    actions.reset();
    navigate(roomId ? `/room/${roomId}` : "/");
  };

  const handleToggleAudio = () => {
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().then(() => ctx.close());
    } else {
      ctx.close();
    }
    actions.toggleAudio();
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
            <Button onClick={() => navigate("/")} className="w-full" size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return Home
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
            <Button onClick={() => navigate("/")} className="w-full" size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const otherParticipants = participants?.filter((p: any) => p._id !== state.myParticipantId) || [];
  const displayName = otherParticipants.length > 0
    ? otherParticipants.map((p: any) => p.displayName).join(", ")
    : "Waiting for others...";

  const isConnected = state.status === "connected" || Array.from(state.peerConnections.values()).some(
    (pc) => pc.pc.connectionState === "connected"
  );
  const isWaiting = !isConnected && otherParticipants.length === 0;

  const remoteStreams = Array.from(state.peerConnections.entries())
    .filter(([_, pc]) => pc.remoteStream)
    .map(([pid, pc]) => ({ pid, stream: pc.remoteStream! }));

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <CallBackground participantName={displayName} isConnected={isConnected} />

      {remoteStreams.map(({ pid, stream }) => (
        <RemoteAudioPlayer key={pid} stream={stream} />
      ))}

      <div className="relative z-10 h-full flex flex-col items-center justify-between py-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-white"
        >
          <p className="text-lg font-medium opacity-90">
            {isConnected
              ? `${otherParticipants.length} participant${otherParticipants.length !== 1 ? "s" : ""}`
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
          className="flex flex-col items-center gap-6"
        >
          <CallAvatar displayName={displayName} isConnected={isConnected} />

          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              {displayName}
            </h1>
            {isConnected && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xl text-white/80 font-medium"
              >
                {formatDuration(state.callDuration)}
              </motion.p>
            )}
          </div>
        </motion.div>

        <WhatsAppCallControls
          isAudioEnabled={state.isAudioEnabled}
          onToggleAudio={handleToggleAudio}
          onEndCall={handleEndCall}
        />
      </div>
    </div>
  );
}

export default function GroupCallPage() {
  return <GroupCallPageContent />;
}
