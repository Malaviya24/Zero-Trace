import { api } from "@/convex/_generated/api";
import { SiteButton, SiteInput, SitePanel } from "@/components/site/SitePrimitives";
import { ChatCrypto } from "@/lib/crypto";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Loader2, Shield } from "lucide-react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import CometChatRoom from "@/components/cometchat/CometChatRoom";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useRoomSession } from "@/hooks/useRoomSession";
import { useMutation, useQuery } from "@/lib/convex-helpers";
import { isRoomFullError, mapJoinRoomErrorMessage } from "@/lib/room-capacity";

function Surface({ children }: { children: ReactNode }) {
  return <div className="relative min-h-dvh">{children}</div>;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <SitePanel className={className}>{children}</SitePanel>;
}

function KineticInput(props: ComponentProps<typeof SiteInput>) {
  return (
    <SiteInput
      {...props}
      className={[
        "h-14 text-base tracking-[0.03em] placeholder:tracking-[0.12em] sm:h-16 sm:text-lg md:text-2xl",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

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
  const [participantToken, setParticipantToken] = useState<string | null>(null);

  const room = useQuery((api as any).rooms.getRoomByRoomId, roomId ? { roomId } : "skip");
  const capacity = useQuery((api as any).rooms.getJoinCapacity, roomId ? { roomId } : "skip");
  const joinRoomMutation = useMutation((api as any).rooms.joinRoom);
  const purgeIfExpiredMutation = useMutation((api as any).rooms.purgeIfExpired);
  const { roomService, isRestoring, sessionData, hasUrlKey } = useRoomSession(roomId, location.hash);

  useEffect(() => {
    if (sessionData) {
      setDisplayName(sessionData.displayName);
      setAvatar(sessionData.avatar);
      setEncryptionKey(sessionData.encryptionKey);

      if (sessionData.participantId) {
        setParticipantId(sessionData.participantId);
        setParticipantToken(sessionData.participantToken);
        setHasJoined(true);
      }
      return;
    }

    setDisplayName((current) => current || ChatCrypto.generateAnonymousName());
    setAvatar((current) => current || ChatCrypto.generateAvatar());
  }, [sessionData]);

  useEffect(() => {
    if (!roomId) return;
    purgeIfExpiredMutation({ roomId }).catch(() => {
      // Best-effort purge trigger.
    });
  }, [roomId, purgeIfExpiredMutation]);

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
    } catch (error) {
      console.error("Failed to import key:", error);
      toast.error("Invalid key. Ensure you pasted the full exported key string.");
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId || !displayName.trim() || !encryptionKey || !roomService) {
      toast.error("Missing required information to join room");
      return;
    }
    if (capacity?.isFull) {
      toast.error("Room is full. Try later or ask admin to increase limit.");
      return;
    }
    if (!hasUrlKey && !manualKeySet) {
      toast.error("Missing room key. Paste the key or use the invite link with #k= fragment.");
      return;
    }

    setIsJoining(true);

    try {
      let computedPasswordHash: string | undefined;
      if (room?.hasPassword) {
        if (!password) {
          toast.error("Password required to join this room");
          setIsJoining(false);
          return;
        }
        const { hash } = await ChatCrypto.hashPassword(password, room.passwordSalt || undefined);
        computedPasswordHash = hash;
      }

      const joinResult = await joinRoomMutation({
        roomId,
        displayName: displayName.trim(),
        avatar,
        passwordHash: computedPasswordHash,
      });

      const pid = (joinResult as { participantId?: string; participantToken?: string } | null)?.participantId;
      const token = (joinResult as { participantId?: string; participantToken?: string } | null)?.participantToken;
      if (!pid || !token) {
        throw new Error("Failed to join room: No participant ID returned");
      }

      setParticipantId(pid as string);
      setParticipantToken(token);
      setHasJoined(true);

      await roomService.saveSession({
        displayName: displayName.trim(),
        avatar,
        participantId: pid as string,
        participantToken: token,
      });

      toast.success("Joined room successfully!");
    } catch (error) {
      console.error("Join room error:", error);
      if (isRoomFullError(error)) {
        toast.error("Room is full. Try later or ask admin to increase limit.");
      } else {
        toast.error(mapJoinRoomErrorMessage(error));
      }
      setIsJoining(false);
    }
  };

  const handleRegenerateIdentity = () => {
    setDisplayName(ChatCrypto.generateAnonymousName());
    setAvatar(ChatCrypto.generateAvatar());
  };

  if (!roomId) {
    return (
      <Surface>
        <div className="flex min-h-dvh items-center justify-center px-4 py-10">
          <Panel className="w-full max-w-2xl p-8 text-center md:p-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-accent" />
            <h2 className="mt-6 text-[clamp(2rem,6vw,4rem)] font-bold uppercase leading-[0.85] tracking-[-0.06em]">Invalid room</h2>
            <p className="mt-4 text-lg text-muted-foreground">No room ID was provided in the URL.</p>
            <SiteButton type="button" onClick={() => navigate("/")} className="mt-8">
              Return home
            </SiteButton>
          </Panel>
        </div>
      </Surface>
    );
  }

  if (hasJoined && encryptionKey && participantId && participantToken) {
    return (
      <CometChatRoom
        roomId={roomId}
        displayName={displayName}
        encryptionKey={encryptionKey}
        participantId={participantId}
        participantToken={participantToken}
      />
    );
  }

  if (isRestoring || room === undefined) {
    return (
      <LoadingScreen
        variant="page"
        message={isRestoring ? "Restoring your session" : "Loading room"}
        submessage={isRestoring ? "Reconnecting you securely" : "Fetching room details"}
      />
    );
  }

  if (room === null) {
    return (
      <Surface>
        <div className="flex min-h-dvh items-center justify-center px-4 py-10">
          <Panel className="w-full max-w-2xl p-8 text-center md:p-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-accent" />
            <h2 className="mt-6 text-[clamp(2rem,6vw,4rem)] font-bold uppercase leading-[0.85] tracking-[-0.06em]">Room not found</h2>
            <p className="mt-4 text-lg text-muted-foreground">This room may have expired or no longer exists.</p>
            <SiteButton type="button" onClick={() => navigate("/")} className="mt-8">
              Return home
            </SiteButton>
          </Panel>
        </div>
      </Surface>
    );
  }

  return (
    <Surface>
      <div className="mx-auto max-w-[95vw] px-4 py-8 sm:py-10 md:px-8 md:py-14">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="grid gap-px bg-border lg:grid-cols-[0.92fr_1.08fr]">
            <div className="bg-background p-6 sm:p-8 md:p-12 lg:p-16">
              <p className="site-kicker text-accent">Room access</p>
              <h1 className="mt-4 text-[clamp(2.8rem,9vw,7rem)] font-bold uppercase leading-[0.8] tracking-[-0.08em]">
                Join room {roomId}
              </h1>
              <p className="mt-5 text-lg text-muted-foreground md:text-xl">{room.name || "Secure chat room"}</p>

              <div className="mt-8 space-y-3 border-t-2 border-border pt-6">
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Max participants</span>
                  <span className="text-foreground">{capacity?.maxParticipants ?? room.maxParticipants ?? 10}</span>
                </div>
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Active now</span>
                  <span className="text-foreground">{capacity?.activeCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Password</span>
                  <span className="text-foreground">{room.hasPassword ? "Required" : "Open"}</span>
                </div>
              </div>
            </div>

            <div className="bg-muted p-6 sm:p-8 md:p-12 lg:p-16">
              <div className="space-y-6">
                {!hasUrlKey && !manualKeySet ? (
                  <Panel className="bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Room key required</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      This invite does not include the room key fragment. Paste the exported key below or ask for the complete invite link.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <KineticInput
                        value={manualKeyInput}
                        onChange={(event) => setManualKeyInput(event.target.value)}
                        placeholder="Paste exported key"
                        aria-label="Paste exported room key"
                        displayUppercase={false}
                        className="h-14 flex-1 text-sm normal-case tracking-normal"
                      />
                      <SiteButton type="button" variant="outline" size="default" onClick={handleImportKey} className="h-14 px-5">
                        Import key
                      </SiteButton>
                    </div>
                  </Panel>
                ) : null}

                {capacity?.isFull ? (
                  <Panel className="bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Room full</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      This room is currently at capacity ({capacity.activeCount}/{capacity.maxParticipants}). Try again later or ask the admin to increase room size.
                    </p>
                  </Panel>
                ) : null}

                <Panel className="bg-background p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-16 w-16 items-center justify-center border-2 border-border bg-muted text-3xl">{avatar}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Anonymous identity</p>
                      <p className="mt-2 truncate text-xl font-bold uppercase tracking-[-0.04em] text-foreground">{displayName}</p>
                    </div>
                    <SiteButton
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateIdentity}
                      className="w-full bg-transparent text-foreground hover:bg-muted sm:w-auto"
                    >
                      Regenerate
                    </SiteButton>
                  </div>
                </Panel>

                <div>
                  <label htmlFor="displayName" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    Display name
                  </label>
                  <KineticInput
                    id="displayName"
                    autoComplete="username"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Enter your display name"
                    maxLength={30}
                  />
                </div>

                {room.hasPassword ? (
                  <div>
                    <label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                      Room password
                    </label>
                    <KineticInput
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter room password"
                      required
                      displayUppercase={false}
                      className="normal-case"
                    />
                  </div>
                ) : null}

                <Panel className="bg-background p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="mt-0.5 h-5 w-5 text-accent" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Encrypted room surface</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Messages are encrypted on-device, room access is session-based, and inactive rooms expire automatically.
                      </p>
                    </div>
                  </div>
                </Panel>

                <div className="flex flex-col gap-3">
                  <SiteButton
                    type="button"
                    onClick={handleJoinRoom}
                    disabled={
                      isJoining ||
                      !displayName.trim() ||
                      (!!room?.hasPassword && !password) ||
                      (!hasUrlKey && !manualKeySet) ||
                      !!capacity?.isFull
                    }
                    className="h-14"
                  >
                    {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {isJoining ? "Joining room" : "Join secure room"}
                  </SiteButton>

                  <SiteButton
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => navigate("/")}
                    className="min-h-11 w-full bg-transparent"
                    aria-label="Back to home"
                  >
                    Back to home
                  </SiteButton>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Surface>
  );
}

