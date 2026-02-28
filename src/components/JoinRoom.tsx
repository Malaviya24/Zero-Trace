import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { ChatCrypto } from "@/lib/crypto";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/convex-helpers";
import { toast } from "sonner";
import { useNavigate, useParams, useLocation } from "react-router";
import ChatRoom from "@/components/ChatRoom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRoomSession } from "@/hooks/useRoomSession";
import { LoadingScreen, PageTransition } from "@/components/LoadingScreen";

export default function JoinRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const [password, setPassword] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [manualKeyInput, setManualKeyInput] = useState("");
  const [manualKeySet, setManualKeySet] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  
  const room = useQuery((api as any).rooms.getRoomByRoomId, roomId ? { roomId } : "skip");
  const joinRoomMutation = useMutation((api as any).rooms.joinRoom);

  // Use the new OOP service layer for session management
  const { roomService, isRestoring, sessionData, hasUrlKey, setSessionData } = useRoomSession(roomId, location.hash);

  // Sync session data to component state
  useEffect(() => {
    if (sessionData) {
      setDisplayName(sessionData.displayName);
      setAvatar(sessionData.avatar);
      setEncryptionKey(sessionData.encryptionKey);
      
      if (sessionData.participantId) {
        setParticipantId(sessionData.participantId);
        setHasJoined(true);
      }
    }
  }, [sessionData]);

  // ADD: handler to manually import key using EncryptionService
  const handleImportKey = async () => {
    try {
      if (!manualKeyInput.trim() || !roomService) {
        toast.error("Paste the room key to import.");
        return;
      }
      const key = await roomService.getEncryptionService().importKey(manualKeyInput.trim());
      setEncryptionKey(key);
      setManualKeySet(true);
      toast.success("Room key imported.");
    } catch (e) {
      console.error("Failed to import key:", e);
      toast.error("Invalid key. Ensure you pasted the full exported key string.");
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId || !displayName.trim() || !encryptionKey || !roomService) {
      toast.error("Missing required information to join room");
      return;
    }

    if (!hasUrlKey && !manualKeySet) {
      toast.error("Missing room key. Paste the key or use the invite link with #k= fragment.");
      return;
    }

    setIsJoining(true);
    
    try {
      let computedPasswordHash: string | undefined = undefined;
      if (room?.hasPassword) {
        if (!password) {
          toast.error("Password required to join this room");
          setIsJoining(false);
          return;
        }
        const { hash } = await ChatCrypto.hashPassword(password, room.passwordSalt || undefined);
        computedPasswordHash = hash;
      }

      // Capture returned participant id
      const pid = await joinRoomMutation({
        roomId,
        displayName: displayName.trim(),
        avatar,
        passwordHash: computedPasswordHash,
      });

      if (!pid) {
        throw new Error("Failed to join room: No participant ID returned");
      }

      setParticipantId(pid as unknown as string);
      setHasJoined(true);
      
      // Use RoomService to save session
      await roomService.saveSession({
        displayName: displayName.trim(),
        avatar,
        participantId: pid as string,
      });
      
      toast.success("Joined room successfully!");
    } catch (error) {
      console.error("Join room error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to join room");
      setIsJoining(false);
    }
  };

  const handleRegenerateIdentity = () => {
    setDisplayName(ChatCrypto.generateAnonymousName());
    setAvatar(ChatCrypto.generateAvatar());
  };

  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Invalid Room</h2>
            <p className="text-muted-foreground mb-4">
              No room ID provided in the URL.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasJoined && encryptionKey && participantId) {
    return (
      <ChatRoom
        roomId={roomId}
        displayName={displayName}
        avatar={avatar}
        encryptionKey={encryptionKey}
        participantId={participantId}
      />
    );
  }

  if (isRestoring || room === undefined) {
    return (
      <LoadingScreen
        variant="page"
        message={isRestoring ? "Restoring your session..." : "Loading room..."}
        submessage={isRestoring ? "Reconnecting you securely" : "Fetching room details"}
      />
    );
  }

  if (room === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Room Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This room may have expired or doesn't exist.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Join Room {roomId}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {room.name || "Secure Chat Room"}
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* ADD: Missing Key Warning */}
            {!hasUrlKey && !manualKeySet && (
              <Alert variant="destructive">
                <AlertTitle>Room key required</AlertTitle>
                <AlertDescription>
                  This link does not include the room key (#k=...). You won't be able to read messages.
                  Paste the key below or ask for the invite link that includes the key.
                </AlertDescription>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={manualKeyInput}
                    onChange={(e) => setManualKeyInput(e.target.value)}
                    placeholder="Paste exported key"
                    aria-label="Paste exported room key"
                  />
                  <Button onClick={handleImportKey} aria-label="Import room key">Import</Button>
                </div>
              </Alert>
            )}

            {/* Room Info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Max Participants:</span>
                <span>{room.maxParticipants}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Password Protected:</span>
                <span>{room.hasPassword ? "Yes" : "No"}</span>
              </div>
            </div>

            {/* Anonymous Identity */}
            <div className="space-y-3">
              <Label>Your Anonymous Identity</Label>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="text-2xl">{avatar}</span>
                <div className="flex-1">
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Anonymous • No data stored
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateIdentity}
                >
                  Regenerate
                </Button>
              </div>
            </div>

            {/* Custom Display Name */}
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                maxLength={30}
              />
            </div>

            {/* Password (if required) */}
            {room.hasPassword && (
              <div>
                <Label htmlFor="password">Room Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter room password"
                  required
                />
              </div>
            )}

            {/* Security Notice */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-primary mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-primary">End-to-End Encrypted</p>
                  <p className="text-muted-foreground">
                    Messages are encrypted on your device. No data is permanently stored.
                    Room expires in 2 hours.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleJoinRoom}
              disabled={
                isJoining ||
                !displayName.trim() ||
                (!!room?.hasPassword && !password) ||
                (!hasUrlKey && !manualKeySet)
              }
              className="w-full"
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining Room...
                </>
              ) : (
                <>
                  Join Secure Room
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="w-full"
              aria-label="Back to Home"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}