import { useEffect, useRef } from "react";
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

  // Join call on mount
  useEffect(() => {
    if (callId && call && !state.displayName && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      const displayName = user?.name || `User ${Math.floor(Math.random() * 1000)}`;
      actions.setDisplayName(displayName);
      
      // Join the call and wait for participant to be created
      joinCallMutation({
        callId: callId as Id<"calls">,
        displayName,
      }).then(() => {
        console.log("Successfully joined call as:", displayName);
      }).catch(err => {
        console.error("Failed to join call:", err);
        toast.error("Failed to join call");
        hasJoinedRef.current = false; // Allow retry
      });
    }
  }, [callId, call, user, state.displayName, actions, joinCallMutation]);

  // Initialize call - only run once on mount
  useEffect(() => {
    if (callId) {
      actions.setCallId(callId);
      actions.initDevices();
      actions.startLocalMedia();
    }

    return () => {
      // Cleanup only on unmount
      console.log("CallPage unmounting - stopping local media");
      actions.stopLocalMedia();
      if (state.peerConnection) {
        state.peerConnection.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]); // Only depend on callId, not actions

  // Track call duration - only start when we have remote stream (actual connection)
  useEffect(() => {
    let intervalId: number | undefined;
    
    // Only start timer when we actually have remote media flowing
    if (state.remoteStream && state.status === "connected") {
      console.log("⏱️ Starting call timer");
      intervalId = window.setInterval(() => {
        actions.incrementCallDuration();
      }, 1000);
    }
    
    return () => {
      if (intervalId !== undefined) {
        console.log("⏱️ Stopping call timer");
        window.clearInterval(intervalId);
      }
    };
  }, [state.remoteStream, state.status, actions]);

  // Create peer connection with enhanced state tracking
  const createPeerConnection = () => {
    if (!myParticipant) {
      console.error("Cannot create peer connection: myParticipant is undefined");
      return null;
    }

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

    // Trickle ICE: Send candidates immediately as they're discovered
    pc.onicecandidate = async (event) => {
      if (event.candidate && myParticipant) {
        console.log("🧊 New ICE candidate discovered:", event.candidate.type, event.candidate.protocol);
        try {
          await sendSignalMutation({
            callId: callId as Id<"calls">,
            type: "ice-candidate",
            data: JSON.stringify(event.candidate),
            fromParticipantId: myParticipant._id,
          });
          console.log("✅ ICE candidate sent successfully");
        } catch (error) {
          console.error("❌ Failed to send ICE candidate:", error);
        }
      } else if (!event.candidate) {
        console.log("🏁 ICE candidate gathering complete (null candidate received)");
      }
    };

    // Track ICE gathering state changes
    pc.onicegatheringstatechange = () => {
      console.log("📊 ICE gathering state changed:", pc.iceGatheringState);
      if (pc.iceGatheringState === "complete") {
        console.log("✅ All ICE candidates have been gathered");
      }
    };

    pc.ontrack = (event) => {
      console.log("✅ Received remote stream with tracks:", event.streams[0].getTracks().map(t => `${t.kind}: ${t.enabled}`));
      const remoteStream = event.streams[0];
      actions.setRemoteStream(remoteStream);
      
      // Verify tracks are actually receiving data
      remoteStream.getTracks().forEach(track => {
        console.log(`Remote ${track.kind} track state:`, track.readyState, track.enabled);
      });
    };

    pc.onconnectionstatechange = () => {
      console.log("🔌 Connection state changed:", pc.connectionState);
      
      if (pc.connectionState === "connected") {
        console.log("✅ WebRTC connection established");
        actions.setStatus("connected");
        actions.resetReconnectAttempts();
      } else if (pc.connectionState === "connecting") {
        actions.setStatus("connecting");
      } else if (pc.connectionState === "disconnected") {
        console.log("⚠️ Connection disconnected - attempting reconnection");
        actions.setStatus("disconnected");
        // Attempt ICE restart after brief delay
        setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            console.log("🔄 Initiating ICE restart");
            handleIceRestart(pc);
          }
        }, 2000);
      } else if (pc.connectionState === "failed") {
        console.log("❌ Connection failed - ICE restart required");
        actions.setStatus("error");
        actions.setError("Connection failed");
        handleIceRestart(pc);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", pc.iceConnectionState);
      
      // Additional ICE state monitoring
      if (pc.iceConnectionState === "failed") {
        console.log("❌ ICE connection failed - restart needed");
        handleIceRestart(pc);
      } else if (pc.iceConnectionState === "disconnected") {
        console.log("⚠️ ICE disconnected - monitoring for recovery");
      } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        console.log("✅ ICE connection established");
      }
    };

    // Add local stream tracks to peer connection
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => {
        console.log("Adding track to peer connection:", track.kind, track.enabled);
        pc.addTrack(track, state.localStream!);
      });
    }

    actions.setPeerConnection(pc);
    return pc;
  };

  // ICE restart handler for connection recovery
  const handleIceRestart = async (pc: RTCPeerConnection) => {
    if (!myParticipant || !callId) return;
    
    try {
      console.log("🔄 Starting ICE restart...");
      actions.setStatus("reconnecting");
      
      // Create new offer with iceRestart flag
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      
      console.log("📤 Sending ICE restart offer");
      await sendSignalMutation({
        callId: callId as Id<"calls">,
        type: "offer",
        data: JSON.stringify(offer),
        fromParticipantId: myParticipant._id,
      });
      
      console.log("✅ ICE restart initiated successfully");
    } catch (error) {
      console.error("❌ ICE restart failed:", error);
      actions.setError("Failed to restart connection");
    }
  };

  // Auto-initiate connection when there are 2+ participants
  const hasInitiatedConnectionRef = useRef(false);
  
  useEffect(() => {
    if (!call || !state.localStream || state.peerConnection || !myParticipant || hasInitiatedConnectionRef.current) {
      if (!myParticipant && participants && participants.length > 0) {
        console.log("⏳ Waiting for myParticipant to be available...", { 
          displayName: state.displayName, 
          participantCount: participants.length 
        });
      }
      return;
    }
    if (!participants || participants.length < 2) {
      console.log("⏳ Waiting for second participant...", { participantCount: participants?.length || 0 });
      return;
    }
    
    const initConnection = async () => {
      console.log("=== INITIATING CONNECTION ===");
      console.log("My participant:", myParticipant?.displayName, myParticipant?._id);
      console.log("All participants:", participants.map((p: any) => ({ name: p.displayName, id: p._id })));
      
      const pc = createPeerConnection();
      if (!pc) {
        console.error("Failed to create peer connection");
        return;
      }

      actions.setStatus("connecting");
      
      try {
        console.log("📝 Creating SDP offer...");
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        
        console.log("📝 Setting local description...");
        await pc.setLocalDescription(offer);
        console.log("✅ Local description set, signaling state:", pc.signalingState);
        
        // Note: ICE candidates will be sent via trickle ICE as they're discovered
        console.log("📤 Sending offer to remote peer");
        await sendSignalMutation({
          callId: callId as Id<"calls">,
          type: "offer",
          data: JSON.stringify(offer),
          fromParticipantId: myParticipant._id,
        });
        console.log("✅ Offer sent successfully - waiting for answer and ICE candidates");
      } catch (error) {
        console.error("❌ Failed to create offer:", error);
        actions.setError("Failed to initiate call");
        actions.setStatus("error");
      }
    };

    // First participant to join initiates the connection
    const sortedParticipants = [...participants].sort((a, b) => 
      (a.joinedAt || 0) - (b.joinedAt || 0)
    );
    
    console.log("Sorted participants by join time:", sortedParticipants.map((p: any) => ({ 
      name: p.displayName, 
      id: p._id, 
      joinedAt: p.joinedAt 
    })));
    
    // If I'm the first participant, initiate
    if (sortedParticipants[0]?._id === myParticipant._id) {
      console.log("🎯 I'm the first participant, initiating connection");
      hasInitiatedConnectionRef.current = true;
      initConnection();
    } else {
      console.log("⏳ I'm not the first participant, waiting for offer");
    }
  }, [call, state.localStream, participants, myParticipant, state.peerConnection, callId, sendSignalMutation]);

  // Process incoming signals - use ref to track processed signals
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!signals || signals.length === 0 || !myParticipant || isProcessingRef.current) {
      return;
    }

    const processSignals = async () => {
      // Prevent concurrent processing
      if (isProcessingRef.current) return;
      
      // Filter out already processed signals
      const unprocessedSignals = signals.filter((s: any) => !processedSignalsRef.current.has(s._id));
      
      if (unprocessedSignals.length === 0) {
        return;
      }

      isProcessingRef.current = true;
      console.log(`=== PROCESSING ${unprocessedSignals.length} NEW SIGNAL(S) ===`);
      
      for (const signal of unprocessedSignals) {
        // Mark as being processed immediately to prevent reprocessing
        processedSignalsRef.current.add(signal._id);
        
        // Mark as processed in backend FIRST to prevent infinite loop
        try {
          await markProcessedMutation({ signalId: signal._id, participantId: myParticipant._id });
        } catch (error) {
          console.error("Failed to mark signal as processed:", error);
          continue;
        }
        
        try {
          console.log(`📨 Processing signal: ${signal.type} from user: ${signal.fromUserId}`);
          const data = JSON.parse(signal.data);

          // Process based on signal type
          if (signal.type === "offer") {
            console.log("📞 Received OFFER from remote peer");
            
            // Create or get peer connection
            let pc = state.peerConnection;
            
            // If connection exists but is closed, create new one
            if (pc && (pc.signalingState === "closed" || pc.connectionState === "closed")) {
              console.log("⚠️ Existing peer connection is closed, creating new one");
              pc.close();
              pc = null;
            }
            
            // Create new peer connection if needed
            if (!pc) {
              console.log("🔧 Creating new peer connection to handle offer");
              pc = createPeerConnection();
              if (!pc) {
                console.error("❌ Failed to create peer connection for offer");
                continue;
              }
            }

            // Validate we can accept an offer
            if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
              console.warn(`⚠️ Cannot process offer in signaling state: ${pc.signalingState}`);
              continue;
            }

            actions.setStatus("connecting");
            
            console.log("📝 Setting remote description (offer), current state:", pc.signalingState);
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            console.log("✅ Remote description set, new state:", pc.signalingState);
            
            console.log("📝 Creating answer...");
            const answer = await pc.createAnswer();
            console.log("✅ Answer created");
            
            console.log("📝 Setting local description (answer)...");
            await pc.setLocalDescription(answer);
            console.log("✅ Local description set, signaling state:", pc.signalingState);
            console.log("🧊 ICE gathering state:", pc.iceGatheringState);
            
            // Trickle ICE will send candidates as they're discovered
            console.log("📤 Sending answer to remote peer");
            await sendSignalMutation({
              callId: callId as Id<"calls">,
              type: "answer",
              data: JSON.stringify(answer),
              fromParticipantId: myParticipant._id,
            });
            console.log("✅ Answer sent - ICE candidates will follow via trickle ICE");
          } else if (signal.type === "answer" && state.peerConnection) {
            console.log("📞 Received ANSWER");
            
            // Validate peer connection state before processing answer
            if (state.peerConnection.signalingState === "closed") {
              console.warn("Cannot process answer: peer connection is closed");
              continue;
            }
            
            if (state.peerConnection.signalingState !== "have-local-offer") {
              console.warn(`Cannot process answer: wrong signaling state (${state.peerConnection.signalingState})`);
              continue;
            }
            
            console.log("⚙️ Setting remote description (answer)");
            await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            console.log("✅ Answer processed successfully");
          } else if (signal.type === "ice-candidate" && state.peerConnection) {
            console.log("🧊 Received ICE candidate:", data.type, data.protocol);
            
            // Validate peer connection state before adding ICE candidate
            if (state.peerConnection.signalingState === "closed") {
              console.warn("⚠️ Cannot add ICE candidate: peer connection is closed");
              continue;
            }
            
            if (!state.peerConnection.remoteDescription) {
              console.warn("⚠️ Cannot add ICE candidate: no remote description set yet");
              continue;
            }
            
            try {
              await state.peerConnection.addIceCandidate(new RTCIceCandidate(data));
              console.log("✅ ICE candidate added successfully");
            } catch (error) {
              console.error("❌ Failed to add ICE candidate:", error);
              // Don't fail the entire call for one bad candidate
            }
          }

        } catch (error) {
          console.error("Failed to process signal:", error);
          // Signal already marked as processed above
        }
      }
    };

    processSignals().finally(() => {
      isProcessingRef.current = false;
    });
  }, [signals, myParticipant, callId, sendSignalMutation, markProcessedMutation, state.peerConnection]);

  const handleEndCall = async () => {
    try {
      if (callId) {
        await logCallEventMutation({
          callId: callId as Id<"calls">,
          eventType: "ended",
        }).catch(err => console.error("Failed to log end event:", err));

        if (call?.createdBy === user?._id) {
          await endCallMutation({ callId: callId as Id<"calls"> });
        } else {
          await leaveCallMutation({ callId: callId as Id<"calls"> });
        }
      }
      actions.reset();
      navigate("/");
    } catch (error) {
      console.error("Failed to end call:", error);
      toast.error("Failed to end call");
    }
  };

  const handleToggleAudio = () => {
    actions.toggleAudio();
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !state.isAudioEnabled;
      }
    }
  };

  if (!callId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <Card className="w-96 shadow-lg border-destructive/20">
          <CardContent className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/20">
              <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">Invalid Call</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              No call ID was provided. Please use a valid call link.
            </p>
            <Button 
              onClick={() => navigate("/")} 
              className="w-full shadow-sm hover:shadow-md transition-shadow"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (call === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading call...</p>
        </div>
      </div>
    );
  }

  if (call === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <Card className="w-96 shadow-lg border-destructive/20">
          <CardContent className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/20">
              <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">Call Not Found</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              This call may have ended or doesn't exist. Please check the call link and try again.
            </p>
            <Button 
              onClick={() => navigate("/")} 
              className="w-full shadow-sm hover:shadow-md transition-shadow"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get remote participant name - exclude myself by ID or displayName
  const remoteParticipant = participants?.find((p: any) => 
    p._id !== myParticipant?._id && 
    p.displayName !== state.displayName
  );
  const remoteDisplayName = remoteParticipant?.displayName || "Connecting...";
  
  // Determine connection status based on WebRTC state (not backend status)
  const isConnected = state.status === "connected" && !!state.remoteStream;
  const isRinging = !isConnected && (!participants || participants.length < 2);

  // WhatsApp-style calling interface
  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Background */}
      <CallBackground participantName={remoteDisplayName} isConnected={isConnected} />
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-between py-16 px-6">
        {/* Top section - Status */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-white"
        >
          <p className="text-lg font-medium opacity-90">
            {isConnected ? "Connected" : isRinging ? "Calling..." : "Connecting..."}
          </p>
        </motion.div>

        {/* Middle section - Avatar and name */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-6"
        >
          <CallAvatar displayName={remoteDisplayName} isConnected={isConnected} />
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              {remoteDisplayName}
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

        {/* Bottom section - Controls */}
        <WhatsAppCallControls
          isAudioEnabled={state.isAudioEnabled}
          onToggleAudio={handleToggleAudio}
          onEndCall={handleEndCall}
        />
      </div>
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