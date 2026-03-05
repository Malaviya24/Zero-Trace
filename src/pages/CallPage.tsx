import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { CallProvider, useCallStore } from "@/store/useCallStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { CallBackground } from "@/components/call/CallBackground";
import { CallAvatar } from "@/components/call/CallAvatar";
import { WhatsAppCallControls } from "@/components/call/WhatsAppCallControls";
import { formatDuration } from "@/lib/utils";

function CallPageContent() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state, actions } = useCallStore();
  const hasJoinedRef = useRef(false);
  const isInitiatorRef = useRef(false);

  const call = useQuery((api as any).calls.get, callId ? { callId: callId as Id<"calls"> } : "skip");
  const participants = useQuery((api as any).calls.getParticipants, callId ? { callId: callId as Id<"calls"> } : "skip");
  const myParticipant = participants?.find((p: any) => p.userId === user?._id || p.displayName === state.displayName);
  const signals = useQuery(
    (api as any).signaling.getSignals,
    myParticipant?._id ? {
      callId: callId as Id<"calls">,
      participantId: myParticipant._id
    } : "skip"
  );

  const endCallMutation = useMutation((api as any).calls.end);
  const leaveCallMutation = useMutation((api as any).calls.leave);
  const joinCallMutation = useMutation((api as any).calls.join);
  const logCallEventMutation = useMutation((api as any).callHistory.logCallEvent);
  const sendSignalMutation = useMutation((api as any).signaling.sendSignal);
  const markProcessedMutation = useMutation((api as any).signaling.markProcessed);
  const updateOfferMutation = useMutation((api as any).calls.updateOffer);

  // Initialize devices
  useEffect(() => {
    if (callId) {
      actions.setCallId(callId);
      actions.initDevices();
      actions.startLocalMedia();
    }
    return () => {
      actions.stopLocalMedia();
      if (state.peerConnection) {
        state.peerConnection.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // Create peer connection helper
  const createPeerConnection = (participantId?: string) => {
    const pid = participantId || myParticipant?._id;
    if (!pid) return null;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
          ],
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate && pid) {
        try {
          await sendSignalMutation({
            callId: callId as Id<"calls">,
            type: "ice-candidate",
            data: JSON.stringify(event.candidate),
            fromParticipantId: pid as Id<"callParticipants">,
          });
        } catch (error) {
          console.error("Failed to send ICE candidate:", error);
        }
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      actions.setRemoteStream(remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        actions.setStatus("connected");
        actions.resetReconnectAttempts();
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        actions.setStatus("disconnected");
        // Simple reconnect logic: ICE restart could go here
      }
    };

    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, state.localStream!);
      });
    }

    actions.setPeerConnection(pc);
    return pc;
  };

  // Join Call & Initial Signaling Logic
  useEffect(() => {
    if (!callId || !user || !call || hasJoinedRef.current) return;
    
    // Wait for local stream to be ready before creating offers
    if (!state.localStream) return;

    const joinAndSetup = async () => {
      hasJoinedRef.current = true;
      const displayName = user.name || `User ${Math.floor(Math.random() * 1000)}`;
      actions.setDisplayName(displayName);

      try {
        const result: any = await joinCallMutation({
          callId: callId as Id<"calls">,
          displayName,
        });

        const isFirst = result.isFirst;
        const existingOffer = result.offer;
        const myPid = result.participantId;
        
        console.log("Joined call. Is First?", isFirst, "Has Offer?", !!existingOffer);

        if (isFirst) {
          // I am the initiator. Create offer immediately.
          isInitiatorRef.current = true;
          const pc = createPeerConnection(myPid);
          if (pc) {
            actions.setStatus("connecting");
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);
            
            // Store offer in DB for second user
            await updateOfferMutation({
              callId: callId as Id<"calls">,
              offer: JSON.stringify(offer),
            });
            console.log("Offer created and stored.");
          }
        } else if (existingOffer) {
          // I am the second user. Accept offer immediately.
          const pc = createPeerConnection(myPid);
          if (pc) {
            actions.setStatus("connecting");
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(existingOffer)));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            // Send answer via signaling
            if (result.participantId && result.offererId) {
              await sendSignalMutation({
                callId: callId as Id<"calls">,
                type: "answer",
                data: JSON.stringify(answer),
                fromParticipantId: result.participantId,
                toParticipantId: result.offererId,
              });
              console.log("Answer created and sent.");
            } else {
              console.error("Missing participant IDs for signaling", result);
              toast.error("Failed to send answer signal");
            }
          }
        } else {
          // I am second user but offer is missing (race condition or delay).
          // Wait for offer via polling/subscription (handled by separate effect).
          console.log("Waiting for offer...");
        }

      } catch (err) {
        console.error("Failed to join call:", err);
        toast.error("Failed to join call");
        hasJoinedRef.current = false;
      }
    };

    joinAndSetup();
    
    return () => {
      const pc = useCallStore.getState().peerConnection;
      if (pc) {
        pc.close();
        actions.setPeerConnection(null);
      }
      hasJoinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, !!user, !!call, !!state.localStream]); 
  // Added state.localStream dependency so we don't start until we have media

  // Handle late arrival of offer (if I joined before offer was ready)
  useEffect(() => {
    if (!call?.offer || !state.localStream || state.peerConnection || isInitiatorRef.current || !myParticipant) return;
    
    let isMounted = true;

    const handleLateOffer = async () => {
      console.log("Late offer detected. Processing...");
      if (!isMounted) return;
      
      const pc = createPeerConnection();
      if (pc) {
        actions.setStatus("connecting");
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(call.offer!)));
        
        if (!isMounted) return;
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        try {
          const target = participants?.find((p: any) => p._id !== myParticipant._id);
          if (target && isMounted) {
            await sendSignalMutation({
              callId: callId as Id<"calls">,
              type: "answer",
              data: JSON.stringify(answer),
              fromParticipantId: myParticipant._id,
              toParticipantId: target._id,
            });
          }
        } catch (error) {
          console.error('Failed to send answer:', error);
          toast.error('Failed to establish connection');
        }
      }
    };
    
    handleLateOffer();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.offer, state.localStream, myParticipant]);

  // Handle Signals (Answer & ICE)
  const processedSignalsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!signals || signals.length === 0 || !myParticipant || !state.peerConnection) return;

    const processSignals = async () => {
      for (const signal of signals) {
        if (processedSignalsRef.current.has(signal._id)) continue;
        processedSignalsRef.current.add(signal._id);

        try {
          await markProcessedMutation({ signalId: signal._id, participantId: myParticipant._id });
          
          const data = JSON.parse(signal.data);
          const pc = state.peerConnection!;

          if (signal.type === "answer" && isInitiatorRef.current) {
            if (pc.signalingState === "have-local-offer") {
              console.log("Received answer, setting remote description");
              await pc.setRemoteDescription(new RTCSessionDescription(data));
            }
          } else if (signal.type === "ice-candidate") {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(data));
            }
          }
        } catch (e) {
          console.error("Error processing signal:", e);
        }
      }
    };

    processSignals();
  }, [signals, myParticipant, state.peerConnection, markProcessedMutation]);

  // Call Duration Timer
  useEffect(() => {
    let intervalId: number;
    if (state.status === "connected") {
      intervalId = window.setInterval(() => {
        actions.incrementCallDuration();
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [state.status, actions]);

  const handleEndCall = async () => {
    const roomId = sessionStorage.getItem("call_room_id") || call?.roomId || null;
    if (callId) {
      if (isInitiatorRef.current) {
        await endCallMutation({ callId: callId as Id<"calls"> });
      } else {
        await leaveCallMutation({
          callId: callId as Id<"calls">,
          participantId: myParticipant?._id,
        });
      }
    }
    actions.reset();
    navigate(roomId ? `/room/${roomId}` : "/");
  };

  const handleToggleAudio = () => {
    actions.toggleAudio();
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !state.isAudioEnabled;
    }
  };

  // Render Logic
  if (!callId) return <ErrorScreen message="Invalid Call ID" onHome={() => navigate("/")} />;
  if (call === undefined) return <LoadingScreen />;
  if (call === null) return <ErrorScreen message="Call Not Found" onHome={() => navigate("/")} />;

  const remoteParticipant = participants?.find((p: any) => p._id !== myParticipant?._id);
  const remoteDisplayName = remoteParticipant?.displayName || "Waiting...";
  const isConnected = state.status === "connected";

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <CallBackground participantName={remoteDisplayName} isConnected={isConnected} />
      <div className="relative z-10 h-full flex flex-col items-center justify-between py-16 px-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center text-white">
          <p className="text-lg font-medium opacity-90">
            {isConnected ? "Connected" : "Calling..."}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6">
          <CallAvatar displayName={remoteDisplayName} isConnected={isConnected} />
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">{remoteDisplayName}</h1>
            {isConnected && (
              <p className="text-xl text-white/80 font-medium">{formatDuration(state.callDuration)}</p>
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

function ErrorScreen({ message, onHome }: { message: string, onHome: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <Card className="w-96 shadow-lg border-destructive/20">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive animate-pulse mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{message}</h2>
          <Button onClick={onHome} className="w-full mt-4">Return Home</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

export default function CallPage() {
  return (
    <CallProvider>
      <CallPageContent />
    </CallProvider>
  );
}
