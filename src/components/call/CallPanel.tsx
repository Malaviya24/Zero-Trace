import { useEffect, useState, useRef } from "react";
import { VideoTile } from "./VideoTile";
import { CallControls } from "./CallControls";
import { DeviceSelector } from "./DeviceSelector";
import { ParticipantList } from "./ParticipantList";
import { CallChat } from "./CallChat";
import { useCallStore } from "@/store/useCallStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

interface CallPanelProps {
  callId: string;
  onEndCall: () => void;
}

export function CallPanel({ callId, onEndCall }: CallPanelProps) {
  const { state, actions } = useCallStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const call = useQuery((api as any).calls.get, { callId: callId as Id<"calls"> });
  const participants = useQuery((api as any).calls.getParticipants, { callId: callId as Id<"calls"> });
  const myParticipant = participants?.find((p: any) => p.displayName === state.displayName);
  const signals = useQuery(
    (api as any).signaling.getSignals, 
    myParticipant?._id ? { 
      callId: callId as Id<"calls">,
      participantId: myParticipant._id 
    } : "skip"
  );
  
  const sendSignalMutation = useMutation((api as any).signaling.sendSignal);
  const markProcessedMutation = useMutation((api as any).signaling.markProcessed);
  const logCallEventMutation = useMutation((api as any).callHistory.logCallEvent);
  const updateConnectionQualityMutation = useMutation((api as any).connectionQuality.updateConnectionQuality);
  const trackReconnectionMutation = useMutation((api as any).connectionQuality.trackReconnection);

  // Initialize devices and media
  useEffect(() => {
    actions.initDevices();
    actions.startLocalMedia();

    // Log call joined event
    if (myParticipant) {
      logCallEventMutation({
        callId: callId as Id<"calls">,
        eventType: "joined",
        participantId: myParticipant._id,
      }).catch(err => console.error("Failed to log join event:", err));
    }

    return () => {
      actions.stopLocalMedia();
      if (state.peerConnection) {
        state.peerConnection.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Log call left event
      if (myParticipant) {
        logCallEventMutation({
          callId: callId as Id<"calls">,
          eventType: "left",
          participantId: myParticipant._id,
        }).catch(err => console.error("Failed to log leave event:", err));
      }
    };
  }, [actions, callId, myParticipant, logCallEventMutation]);

  // Apply background blur effect
  useEffect(() => {
    if (!state.localStream || !state.isBackgroundBlurred || !state.isVideoEnabled) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Restore original video track if blur was disabled
      if (!state.isBackgroundBlurred && state.peerConnection && state.localStream) {
        const originalVideoTrack = state.localStream.getVideoTracks()[0];
        if (originalVideoTrack) {
          const sender = state.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === "video"
          );
          if (sender) {
            sender.replaceTrack(originalVideoTrack).catch(err => 
              console.error("Failed to restore original video track:", err)
            );
          }
        }
      }
      return;
    }

    const applyBlur = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext("2d");
      
      if (!ctx || video.readyState < 2) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      ctx.filter = "blur(10px)";
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      animationFrameRef.current = requestAnimationFrame(applyBlur);
    };

    const video = document.createElement("video");
    video.srcObject = state.localStream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    videoRef.current = video;

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    video.onloadedmetadata = () => {
      video.play().then(() => {
        applyBlur();
        
        // Replace video track with canvas stream
        const canvasStream = canvas.captureStream(30);
        const videoTrack = canvasStream.getVideoTracks()[0];
        
        if (state.peerConnection && videoTrack) {
          const sender = state.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === "video"
          );
          if (sender) {
            sender.replaceTrack(videoTrack).catch(err => 
              console.error("Failed to replace video track with blur:", err)
            );
          }
        }
      }).catch(err => console.error("Failed to play video for blur:", err));
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [state.isBackgroundBlurred, state.localStream, state.isVideoEnabled, state.peerConnection]);

  // Control audio track based on isAudioEnabled state
  useEffect(() => {
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach(track => {
        track.enabled = state.isAudioEnabled;
      });
    }
  }, [state.isAudioEnabled, state.localStream]);

  // Control video track based on isVideoEnabled state (only when blur is not active)
  useEffect(() => {
    if (state.localStream && !state.isBackgroundBlurred) {
      state.localStream.getVideoTracks().forEach(track => {
        track.enabled = state.isVideoEnabled;
      });
    }
  }, [state.isVideoEnabled, state.localStream, state.isBackgroundBlurred]);

  // Track call duration
  useEffect(() => {
    let intervalId: number | undefined;
    if (state.status === "connected") {
      intervalId = window.setInterval(() => {
        actions.setCallDuration(state.callDuration + 1);
      }, 1000);
    }
    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [state.status, state.callDuration, actions]);

  // Monitor connection quality
  useEffect(() => {
    if (!state.peerConnection || !myParticipant || state.status !== "connected") return;

    const monitorQuality = setInterval(async () => {
      try {
        const stats = await state.peerConnection!.getStats();
        let rtt = 0;
        let packetLoss = 0;
        let jitter = 0;

        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            rtt = report.currentRoundTripTime * 1000 || 0;
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            packetLoss = report.packetsLost || 0;
            jitter = report.jitter || 0;
          }
        });

        // Determine quality based on metrics
        let quality: "excellent" | "good" | "fair" | "poor";
        if (rtt < 100 && packetLoss < 1) {
          quality = "excellent";
        } else if (rtt < 200 && packetLoss < 3) {
          quality = "good";
        } else if (rtt < 400 && packetLoss < 5) {
          quality = "fair";
        } else {
          quality = "poor";
        }

        actions.setConnectionQuality(quality);
        actions.setConnectionMetrics({ rtt, packetLoss, jitter, bandwidth: 0 });

        // Update in database
        await updateConnectionQualityMutation({
          participantId: myParticipant._id,
          quality,
          metrics: { rtt, packetLoss, jitter },
        });

        // Log quality degradation
        if (quality === "poor" || quality === "fair") {
          await logCallEventMutation({
            callId: callId as Id<"calls">,
            eventType: "quality_degraded",
            participantId: myParticipant._id,
            metadata: JSON.stringify({ quality, rtt, packetLoss }),
          });
        }
      } catch (error) {
        console.error("Failed to monitor connection quality:", error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(monitorQuality);
  }, [state.peerConnection, state.status, myParticipant, actions, updateConnectionQualityMutation, logCallEventMutation, callId]);

  // Handle connection failures and reconnection
  useEffect(() => {
    if (!state.peerConnection) return;

    const handleConnectionStateChange = async () => {
      const connectionState = state.peerConnection!.connectionState;
      
      if (connectionState === "failed" || connectionState === "disconnected") {
        actions.setStatus("reconnecting");
        
        // Track reconnection attempt
        if (myParticipant) {
          await trackReconnectionMutation({
            participantId: myParticipant._id,
          }).catch(err => console.error("Failed to track reconnection:", err));
          
          await logCallEventMutation({
            callId: callId as Id<"calls">,
            eventType: "reconnected",
            participantId: myParticipant._id,
          }).catch(err => console.error("Failed to log reconnection:", err));
        }
        
        // Attempt reconnection
        await actions.attemptReconnection();
      }
    };

    state.peerConnection.addEventListener("connectionstatechange", handleConnectionStateChange);

    return () => {
      state.peerConnection?.removeEventListener("connectionstatechange", handleConnectionStateChange);
    };
  }, [state.peerConnection, actions, myParticipant, trackReconnectionMutation, logCallEventMutation, callId]);

  // Create peer connection
  const createPeerConnection = () => {
    if (!myParticipant) {
      console.error("Cannot create peer connection: myParticipant is undefined");
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // TURN servers for relay fallback when P2P fails
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
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate && myParticipant) {
        try {
          await sendSignalMutation({
            callId: callId as Id<"calls">,
            type: "ice-candidate",
            data: JSON.stringify(event.candidate),
            fromParticipantId: myParticipant._id,
          });
        } catch (error) {
          console.error("Failed to send ICE candidate:", error);
        }
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote stream with tracks:", event.streams[0].getTracks().length);
      actions.setRemoteStream(event.streams[0]);
      actions.setStatus("connected");
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        actions.setStatus("connected");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        actions.setStatus("disconnected");
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

  // Auto-initiate connection when there are 2+ participants
  useEffect(() => {
    if (!call || !state.localStream || state.peerConnection || !myParticipant) return;
    if (!participants || participants.length < 2) return;
    
    const initConnection = async () => {
      const pc = createPeerConnection();
      if (!pc) return;

      actions.setStatus("connecting");
      
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        
        console.log("Sending offer to other participants");
        await sendSignalMutation({
          callId: callId as Id<"calls">,
          type: "offer",
          data: JSON.stringify(offer),
          fromParticipantId: myParticipant._id,
        });
      } catch (error) {
        console.error("Failed to create offer:", error);
        actions.setError("Failed to initiate call");
        actions.setStatus("error");
      }
    };

    // First participant to join initiates the connection
    const sortedParticipants = [...participants].sort((a, b) => 
      (a.joinedAt || 0) - (b.joinedAt || 0)
    );
    
    // If I'm the first participant, initiate
    if (sortedParticipants[0]?._id === myParticipant._id) {
      console.log("I'm the first participant, initiating connection");
      initConnection();
    }
  }, [call, state.localStream, participants, myParticipant, state.peerConnection, callId, sendSignalMutation, actions]);

  // Process incoming signals
  useEffect(() => {
    if (!signals || signals.length === 0 || !myParticipant) return;

    const processSignals = async () => {
      for (const signal of signals) {
        try {
          console.log("Processing signal:", signal.type, "from:", signal.fromUserId);
          const data = JSON.parse(signal.data);

          if (signal.type === "offer") {
            let pc = state.peerConnection;
            if (!pc) {
              console.log("Creating peer connection to handle offer");
              pc = createPeerConnection();
              if (!pc) continue;
            }

            actions.setStatus("connecting");
            console.log("Setting remote description (offer)");
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            
            console.log("Creating answer");
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            console.log("Sending answer");
            await sendSignalMutation({
              callId: callId as Id<"calls">,
              type: "answer",
              data: JSON.stringify(answer),
              fromParticipantId: myParticipant._id,
            });
          } else if (signal.type === "answer" && state.peerConnection) {
            console.log("Setting remote description (answer)");
            await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
          } else if (signal.type === "ice-candidate" && state.peerConnection) {
            console.log("Adding ICE candidate");
            await state.peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }

          await markProcessedMutation({ signalId: signal._id, participantId: myParticipant._id });
        } catch (error) {
          console.error("Failed to process signal:", error);
          actions.setError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          actions.setStatus("error");
        }
      }
    };

    processSignals();
  }, [signals, myParticipant, state.peerConnection, callId, sendSignalMutation, markProcessedMutation, actions]);

  // Get remote participant name
  const remoteParticipant = participants?.find((p: any) => p._id !== myParticipant?._id);
  const remoteDisplayName = remoteParticipant?.displayName || "Connecting...";

  // Prepare participant list data
  const participantListData = [
    {
      _id: "local",
      displayName: state.displayName || "You",
      isLocal: true,
      isAudioEnabled: state.isAudioEnabled,
      isVideoEnabled: state.isVideoEnabled,
      connectionStatus: state.status as "connected" | "connecting" | "disconnected",
    },
    ...(remoteParticipant ? [{
      _id: remoteParticipant._id,
      displayName: remoteParticipant.displayName,
      isLocal: false,
      isAudioEnabled: true,
      isVideoEnabled: true,
      connectionStatus: state.status as "connected" | "connecting" | "disconnected",
    }] : []),
  ];

  // Show ringing/waiting state
  if (call?.status === "ringing" && participants && participants.length === 1) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-primary/5 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <Card className="w-[480px] shadow-2xl border-border/50 backdrop-blur-sm bg-card/95 relative z-10">
          <CardContent className="p-10 text-center">
            {/* Animated phone icon */}
            <div className="mb-8 relative inline-flex">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 ring-4 ring-primary/30 shadow-lg">
                <Phone className="h-12 w-12 text-primary animate-pulse" />
              </div>
            </div>

            {/* Title and description */}
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Waiting for others...
            </h2>
            <p className="text-muted-foreground mb-8 text-base leading-relaxed max-w-sm mx-auto">
              You're the first one here. Share the call link to invite others and start the conversation.
            </p>

            {/* Call info */}
            <div className="mb-8 p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Call is ready • Waiting for participants</span>
              </div>
            </div>

            {/* Action button */}
            <Button 
              onClick={onEndCall} 
              variant="outline" 
              size="lg"
              className="w-full shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary/50"
            >
              <Phone className="mr-2 h-4 w-4" />
              Leave Call
            </Button>

            {/* Tip */}
            <p className="mt-6 text-xs text-muted-foreground/70">
              💡 Tip: Copy the URL from your browser to share this call
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show reconnecting state
  if (state.status === "reconnecting") {
    const progress = ((state.reconnectAttempts || 0) / (state.maxReconnectAttempts || 5)) * 100;
    
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-primary/5 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <Card className="w-[480px] shadow-2xl border-border/50 backdrop-blur-sm bg-card/95 relative z-10">
          <CardContent className="p-10 text-center">
            {/* Multi-layered animated spinner */}
            <div className="mb-8 relative inline-flex">
              <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-orange-500/20 animate-ping delay-150" />
              <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 ring-4 ring-yellow-500/30 shadow-lg">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500/30 border-t-yellow-500"></div>
              </div>
            </div>

            {/* Title with gradient */}
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              Reconnecting...
            </h2>
            <p className="text-muted-foreground mb-2 text-base leading-relaxed">
              Connection lost. Attempting to reconnect.
            </p>
            <p className="text-sm font-medium text-foreground/80 mb-6">
              Attempt {state.reconnectAttempts || 0} of {state.maxReconnectAttempts || 5}
            </p>

            {/* Visual progress bar */}
            <div className="mb-8 w-full bg-muted/30 rounded-full h-2.5 overflow-hidden border border-border/50">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>

            {/* Action button */}
            <Button 
              onClick={onEndCall} 
              variant="outline" 
              size="lg"
              className="w-full shadow-sm hover:shadow-md transition-all duration-200 hover:border-destructive/50 hover:text-destructive"
            >
              <Phone className="mr-2 h-4 w-4" />
              End Call
            </Button>

            {/* Status message */}
            <p className="mt-6 text-xs text-muted-foreground/70">
              {state.reconnectAttempts === state.maxReconnectAttempts 
                ? "⚠️ Final attempt - call will end if unsuccessful" 
                : "🔄 Please wait while we restore your connection"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 flex overflow-hidden">
        {/* Main video area */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          (showParticipants || showChat) && "mr-80"
        )}>
          {/* Video Grid */}
          <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VideoTile
              stream={state.localStream}
              displayName="You"
              isLocal={true}
              isAudioEnabled={state.isAudioEnabled}
              isVideoEnabled={state.isVideoEnabled}
              className="h-full min-h-[300px]"
            />
            
            <VideoTile
              stream={state.remoteStream}
              displayName={remoteDisplayName}
              isAudioEnabled={true}
              isVideoEnabled={true}
              className="h-full min-h-[300px]"
            />
          </div>

          {/* Status Bar */}
          <div className="px-4 py-2 bg-muted/50 border-t border-b">
            <div className="flex items-center justify-center gap-2">
              <Badge 
                variant={
                  state.status === "connected" 
                    ? "default" 
                    : state.status === "disconnected" || state.status === "error"
                    ? "destructive"
                    : "secondary"
                }
                className="text-xs font-medium"
              >
                {state.status === "connecting" && (
                  <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
                )}
                {state.status}
              </Badge>
              
              {state.error && (
                <Badge 
                  variant="destructive" 
                  className="flex items-center gap-1 animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <AlertCircle className="h-3 w-3 animate-pulse" />
                  {state.error}
                </Badge>
              )}
            </div>
          </div>

          {/* Controls */}
          <CallControls
            onEndCall={onEndCall}
            onOpenSettings={() => setShowSettings(true)}
            onToggleParticipants={() => setShowParticipants(!showParticipants)}
            onToggleChat={() => setShowChat(!showChat)}
            showParticipants={showParticipants}
            showChat={showChat}
          />
        </div>

        {/* Sidebars */}
        {showParticipants && (
          <div className="w-80 h-full animate-in slide-in-from-right duration-300">
            <ParticipantList participants={participantListData} />
          </div>
        )}
        
        {showChat && (
          <div className="w-80 h-full animate-in slide-in-from-right duration-300">
            <CallChat 
              callId={callId}
              roomId={call?.roomId}
              displayName={state.displayName || "Anonymous"}
            />
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Call Settings</DialogTitle>
          </DialogHeader>
          <DeviceSelector />
        </DialogContent>
      </Dialog>
    </div>
  );
}