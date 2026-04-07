import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Room, RoomEvent, Track } from "livekit-client";
import { useMutation, useQuery } from "@/lib/convex-helpers";
import { typedApi } from "@/lib/api-types";
import { Id } from "@/convex/_generated/dataModel";
import { Button, Card, CardContent } from "@/components/app/AppUI";
import { LoadingScreen } from "@/components/LoadingScreen";
import { WhatsAppCallControls } from "@/components/call/WhatsAppCallControls";
import { CONFIG } from "@/lib/config";
import { formatDuration } from "@/lib/utils";
import { clearCallReturnPath, resolveCallReturnPath } from "@/lib/call-navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type JoinCallResult = {
  participantId: Id<"callParticipants">;
  participantToken?: string;
  leaveToken?: string;
};

type SfuSessionResult = {
  provider: "livekit" | "mesh";
  endpoint: string | null;
  token: string | null;
};

type RemoteMedia = {
  displayName: string;
  videoStream?: MediaStream;
  audioStream?: MediaStream;
};

function readRoomSession(roomId: string | null | undefined): { participantId: string; participantToken: string; displayName?: string } | null {
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
      displayName: typeof parsed?.displayName === "string" ? parsed.displayName : undefined,
    };
  } catch {
    return null;
  }
}

function attachMedia(el: HTMLMediaElement | null, stream: MediaStream | undefined | null) {
  if (!el) return;
  el.srcObject = stream ?? null;
  if (stream) {
    el.play().catch(() => {});
  }
}

export default function SfuCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const roomIdHint = sessionStorage.getItem("call_room_id");
  const roomSession = useMemo(() => readRoomSession(roomIdHint), [roomIdHint]);
  const isNew = callId === "new";
  const validCallId = !isNew && callId ? (callId as Id<"calls">) : null;
  const videoPreference = useMemo(() => {
    const rawValue = new URLSearchParams(location.search).get("video");
    if (rawValue === null) return null;
    return rawValue === "true" || rawValue === "1";
  }, [location.search]);
  const shouldStartWithVideo = videoPreference ?? sessionStorage.getItem("call_video_mode") === "1";

  const createCallMutation = useMutation(typedApi.calls.create);
  const joinCallMutation = useMutation(typedApi.calls.join);
  const createSessionMutation = useMutation(typedApi.calls.createSession);
  const leaveCallMutation = useMutation(typedApi.calls.leave);
  const updateParticipantStateMutation = useMutation(typedApi.calls.updateParticipantState);

  const [myParticipantId, setMyParticipantId] = useState<Id<"callParticipants"> | null>(null);
  const [myParticipantToken, setMyParticipantToken] = useState<string | null>(null);
  const [leaveToken, setLeaveToken] = useState<string | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<Record<string, RemoteMedia>>({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(shouldStartWithVideo);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());

  const roomRef = useRef<Room | null>(null);
  const joinedRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

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

  const callPreflightError = CONFIG.callPreflight.canStartCalls
    ? null
    : CONFIG.callPreflight.missingCallInfraReason ||
      "Calls are unavailable because call infrastructure is not configured.";

  const getReturnPath = useCallback(() => {
    const sessionRoomId = sessionStorage.getItem("call_room_id");
    return resolveCallReturnPath(sessionRoomId ?? undefined);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isNew) return;
    if (!roomSession || !roomIdHint) {
      toast.error("Room session missing. Rejoin room first.");
      navigate("/", { replace: true });
      return;
    }
    if (callPreflightError) {
      toast.error(callPreflightError);
      navigate(resolveCallReturnPath(roomIdHint ?? undefined), { replace: true });
      return;
    }

    void createCallMutation({
      roomId: roomIdHint,
      roomParticipantId: roomSession.participantId as Id<"participants">,
      roomParticipantToken: roomSession.participantToken,
      displayName: roomSession.displayName || "Anonymous",
      e2ee: false,
      sfuEnabled: true,
    })
      .then((newCallId) => navigate(`/call/${newCallId}?video=${shouldStartWithVideo ? "1" : "0"}`, { replace: true }))
      .catch(() => {
        toast.error("Failed to start call");
        navigate(resolveCallReturnPath(roomIdHint ?? undefined), { replace: true });
      });
  }, [callPreflightError, createCallMutation, isNew, navigate, roomIdHint, roomSession, shouldStartWithVideo]);

  useEffect(() => {
    if (!validCallId || !call || !roomSession || joinedRef.current) return;
    joinedRef.current = true;
    void joinCallMutation({
      callId: validCallId,
      roomParticipantId: roomSession.participantId as Id<"participants">,
      roomParticipantToken: roomSession.participantToken,
      displayName: roomSession.displayName || "Anonymous",
    })
      .then((result: JoinCallResult) => {
        setMyParticipantId(result.participantId);
        setMyParticipantToken(result.participantToken || roomSession.participantToken);
        setLeaveToken(result.leaveToken || null);
      })
      .catch(() => {
        toast.error("Failed to join call");
        joinedRef.current = false;
      });
  }, [call, joinCallMutation, roomSession, validCallId]);

  useEffect(() => {
    if (!validCallId || !myParticipantId || !myParticipantToken || !call) return;
    if (roomRef.current) return;
    let cancelled = false;

    const connect = async () => {
      const session = (await createSessionMutation({
        callId: validCallId,
        participantId: myParticipantId,
        participantToken: myParticipantToken,
      })) as SfuSessionResult;

      if (cancelled) return;
      if (session.provider !== "livekit" || !session.endpoint || !session.token) {
        throw new Error("SFU session unavailable");
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        const stream = new MediaStream([track.mediaStreamTrack]);
        setRemoteMedia((prev) => {
          const current = prev[participant.identity] || { displayName: participant.name || participant.identity };
          return {
            ...prev,
            [participant.identity]:
              track.kind === Track.Kind.Video
                ? { ...current, videoStream: stream }
                : { ...current, audioStream: stream },
          };
        });
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        setRemoteMedia((prev) => {
          const current = prev[participant.identity];
          if (!current) return prev;
          return {
            ...prev,
            [participant.identity]:
              track.kind === Track.Kind.Video ? { ...current, videoStream: undefined } : { ...current, audioStream: undefined },
          };
        });
      });

      await room.connect(session.endpoint, session.token, { autoSubscribe: true });
      await room.localParticipant.setMicrophoneEnabled(true);
      if (shouldStartWithVideo) {
        await room.localParticipant.setCameraEnabled(true);
      }

      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        const track = publication.track;
        if (track?.mediaStreamTrack) {
          attachMedia(localVideoRef.current, new MediaStream([track.mediaStreamTrack]));
          break;
        }
      }

      await updateParticipantStateMutation({
        callId: validCallId,
        participantId: myParticipantId,
        participantToken: myParticipantToken,
        participantState: "connected",
        connectionState: "connected",
        isMuted: false,
        isVideoOn: shouldStartWithVideo,
      });
    };

    void connect().catch((error) => {
      console.error("[SFU] connect failed", error);
      toast.error("Unable to connect media session");
    });

    return () => {
      cancelled = true;
    };
  }, [call, createSessionMutation, myParticipantId, myParticipantToken, shouldStartWithVideo, updateParticipantStateMutation, validCallId]);

  useEffect(() => {
    for (const [participantId, media] of Object.entries(remoteMedia)) {
      attachMedia(remoteVideoRefs.current.get(participantId) ?? null, media.videoStream);
      const audioEl = remoteAudioRefs.current.get(participantId) ?? null;
      attachMedia(audioEl, media.audioStream);
      if (audioEl) audioEl.muted = !isSpeakerEnabled;
    }
  }, [isSpeakerEnabled, remoteMedia]);

  const handleEndCall = useCallback(async () => {
    if (!validCallId || !myParticipantId || !myParticipantToken) return;
    try {
      await leaveCallMutation({
        callId: validCallId,
        participantId: myParticipantId,
        participantToken: myParticipantToken,
        leaveToken: leaveToken ?? undefined,
      });
    } finally {
      roomRef.current?.disconnect();
      clearCallReturnPath();
      navigate(getReturnPath(), { replace: true });
    }
  }, [getReturnPath, leaveCallMutation, leaveToken, myParticipantId, myParticipantToken, navigate, validCallId]);

  const handleToggleAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !validCallId || !myParticipantId || !myParticipantToken) return;
    const next = !isAudioEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setIsAudioEnabled(next);
    await updateParticipantStateMutation({
      callId: validCallId,
      participantId: myParticipantId,
      participantToken: myParticipantToken,
      participantState: next ? "connected" : "muted",
      isMuted: !next,
    });
  }, [isAudioEnabled, myParticipantId, myParticipantToken, updateParticipantStateMutation, validCallId]);

  const handleToggleVideo = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !validCallId || !myParticipantId || !myParticipantToken) return;
    const next = !isVideoEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setIsVideoEnabled(next);
    await updateParticipantStateMutation({
      callId: validCallId,
      participantId: myParticipantId,
      participantToken: myParticipantToken,
      participantState: next ? "videoOn" : "connected",
      isVideoOn: next,
    });
  }, [isVideoEnabled, myParticipantId, myParticipantToken, updateParticipantStateMutation, validCallId]);

  const startedAt = call?.startedAt ?? Date.now();
  const durationLabel = formatDuration(Math.max(0, Math.floor((now - startedAt) / 1000)));
  const remoteEntries = Object.entries(remoteMedia);

  if (callPreflightError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4 py-8 text-[#fafafa] [font-family:Space_Grotesk,_Inter,_sans-serif]">
        <Card className="w-full max-w-2xl rounded-none border-2 border-[#3f3f46] bg-[#09090b] text-[#fafafa] shadow-none">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-[#dfe104]" />
            <h2 className="mb-2 text-[clamp(2rem,6vw,4rem)] font-bold uppercase leading-[0.85] tracking-[-0.06em]">Call setup required</h2>
            <p className="mb-6 text-sm uppercase tracking-[0.14em] text-[#a1a1aa]">{callPreflightError}</p>
            <Button onClick={() => navigate(getReturnPath())} className="h-12 w-full rounded-none border-2 border-[#dfe104] bg-[#dfe104] text-xs font-bold uppercase tracking-[0.18em] text-black shadow-none hover:bg-[#d3d53c]"><ArrowLeft className="mr-2 h-4 w-4" />Return to room</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isNew || call === undefined) {
    return <LoadingScreen variant="page" message="Preparing call..." submessage="Connecting global media edge" />;
  }

  return (
    <div className="flex h-screen flex-col bg-[#0b141a] text-white">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-[680px] gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {remoteEntries.map(([participantId, media]) => (
            <div key={participantId} className="relative aspect-[9/16] overflow-hidden border-2 border-[#3f3f46] bg-[#111217]">
              <video ref={(el) => { if (el) remoteVideoRefs.current.set(participantId, el); }} autoPlay playsInline className="h-full w-full object-cover" />
              <audio ref={(el) => { if (el) remoteAudioRefs.current.set(participantId, el); }} autoPlay playsInline style={{ display: "none" }} />
              <div className="absolute left-2 top-2 border border-[#3f3f46] bg-[#09090b] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">{media.displayName}</div>
            </div>
          ))}
          <div className="relative aspect-[9/16] overflow-hidden border-2 border-[#dfe104] bg-[#111217]">
            <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover scale-x-[-1]" />
            <div className="absolute left-2 top-2 border border-[#3f3f46] bg-[#dfe104] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black">You</div>
          </div>
        </div>
      </div>

      <WhatsAppCallControls
        isAudioEnabled={isAudioEnabled}
        isSpeakerEnabled={isSpeakerEnabled}
        isVideoEnabled={isVideoEnabled}
        participantsCount={Math.max(1, remoteEntries.length + 1)}
        callDurationLabel={durationLabel}
        connectionQuality="good"
        onToggleAudio={() => void handleToggleAudio()}
        onToggleSpeaker={() => setIsSpeakerEnabled((prev) => !prev)}
        onToggleVideo={() => void handleToggleVideo()}
        onEndCall={() => void handleEndCall()}
      />
    </div>
  );
}




