import { useParams, useLocation } from "react-router";
import { useRoomSession } from "@/hooks/useRoomSession";
import CometChatRoom from "@/components/cometchat/CometChatRoom";
import JoinRoom from "@/components/JoinRoom";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  
  const { isRestoring, sessionData } = useRoomSession(
    roomId,
    location.hash
  );

  if (isRestoring) {
    return (
      <LoadingScreen
        variant="page"
        message="Loading Room..."
        submessage="Restoring your session"
      />
    );
  }

  if (sessionData && sessionData.participantId && roomId) {
    return (
      <CometChatRoom
        roomId={roomId}
        displayName={sessionData.displayName}
        encryptionKey={sessionData.encryptionKey}
        participantId={sessionData.participantId}
      />
    );
  }

  return <JoinRoom />;
}
