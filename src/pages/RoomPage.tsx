import { useParams, useLocation } from "react-router";
import { useRoomSession } from "@/hooks/useRoomSession";
import ChatRoom from "@/components/ChatRoom";
import JoinRoom from "@/components/JoinRoom";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  
  const { roomService, isRestoring, sessionData, hasUrlKey } = useRoomSession(
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
      <ChatRoom
        roomId={roomId}
        displayName={sessionData.displayName}
        avatar={sessionData.avatar}
        encryptionKey={sessionData.encryptionKey}
        participantId={sessionData.participantId}
      />
    );
  }

  return <JoinRoom />;
}
