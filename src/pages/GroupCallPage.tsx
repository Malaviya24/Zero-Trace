import { useMemo } from "react";
import { useParams } from "react-router";
import { useQuery } from "@/lib/convex-helpers";
import { typedApi } from "@/lib/api-types";
import { Id } from "@/convex/_generated/dataModel";
import { LoadingScreen } from "@/components/LoadingScreen";
import GroupCallPageLegacy from "./GroupCallPageLegacy";
import SfuCallPage from "./SfuCallPage";

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

export default function GroupCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const isNew = callId === "new" || !callId;

  const roomIdHint = sessionStorage.getItem("call_room_id");
  const roomSession = useMemo(() => readRoomSession(roomIdHint), [roomIdHint]);
  const call = useQuery(
    typedApi.calls.get,
    !isNew && roomSession
      ? {
          callId: callId as Id<"calls">,
          roomParticipantId: roomSession.participantId as Id<"participants">,
          roomParticipantToken: roomSession.participantToken,
        }
      : "skip"
  );

  if (isNew) {
    return <SfuCallPage />;
  }

  if (call === undefined && roomSession) {
    return (
      <LoadingScreen
        variant="page"
        message="Loading call..."
        submessage="Selecting the best media route"
      />
    );
  }

  if (call?.sfuEnabled || call?.mediaProvider === "livekit" || !roomSession) {
    return <SfuCallPage />;
  }

  return <GroupCallPageLegacy />;
}
