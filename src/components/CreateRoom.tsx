import { api } from "@/convex/_generated/api";
import { SiteButton, SiteBadge, SiteInput, SitePanel, SiteSwitch } from "@/components/site/SitePrimitives";
import { ChatCrypto } from "@/lib/crypto";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation } from "@/lib/convex-helpers";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router";
import QRCode from "qrcode";

export default function CreateRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const [roomName, setRoomName] = useState(location.state?.defaultName || "");
  const [password, setPassword] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [settings, setSettings] = useState({
    selfDestruct: false,
    screenshotProtection: false,
    linkPreviewsEnabled: true,
    keyRotationInterval: 50,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{
    roomId: string;
    link: string;
    qrCode: string;
  } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [roomNameError, setRoomNameError] = useState<string | null>(null);
  const [maxParticipantsError, setMaxParticipantsError] = useState<string | null>(null);
  const [keyRotationError, setKeyRotationError] = useState<string | null>(null);

  useEffect(() => {
    if (!createdRoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreatedRoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createdRoom]);

  const createRoomMutation = useMutation((api as any).rooms.createRoom);

  const validateRoomName = (value: string): string | null => {
    if (value.length > 50) return "Room name must be 50 characters or fewer.";
    return null;
  };

  const validateMaxParticipants = (value: number | string): string | null => {
    const parsed = typeof value === "string" ? parseInt(value, 10) : value;
    if (Number.isNaN(parsed) || value === "") return "Enter a number between 2 and 50.";
    if (parsed < 2 || parsed > 50) return "Max participants must stay between 2 and 50.";
    return null;
  };

  const validateKeyRotation = (value: number): string | null => {
    if (!Number.isFinite(value) || value <= 0) return "Key rotation interval must be a positive number.";
    return null;
  };

  const isFormValid = (): { ok: boolean; message?: string } => {
    if (roomName.length > 50) return { ok: false, message: "Room name must be 50 characters or fewer." };
    if (Number.isNaN(maxParticipants) || maxParticipants < 2 || maxParticipants > 50) {
      return { ok: false, message: "Max participants must be between 2 and 50." };
    }
    if (!Number.isFinite(settings.keyRotationInterval) || settings.keyRotationInterval <= 0) {
      return { ok: false, message: "Key rotation interval must be a positive number." };
    }
    return { ok: true };
  };

  const handleCreateRoom = async () => {
    const valid = isFormValid();
    if (!valid.ok) {
      toast.error(valid.message || "Please correct the form.");
      return;
    }

    setIsCreating(true);
    setApiError(null);

    const createRoomOnce = async () => {
      const roomId = ChatCrypto.generateRoomId();
      let passwordHash: string | undefined;
      let passwordSalt: string | undefined;

      if (password) {
        const hashed = await ChatCrypto.hashPassword(password);
        passwordHash = hashed.hash;
        passwordSalt = hashed.salt;
      }

      const result = await createRoomMutation({
        roomId,
        name: roomName || undefined,
        passwordHash,
        passwordSalt,
        maxParticipants,
        settings,
      });

      const finalRoomId = result.roomId;
      const roomService = new (await import("@/services/RoomService")).RoomService(finalRoomId);
      await roomService.getEncryptionService().generateKey();
      const roomLink = await roomService.generateInviteLink(window.location.origin);
      const qrCodeDataUrl = await QRCode.toDataURL(roomLink, {
        width: 220,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      setCreatedRoom({
        roomId: finalRoomId,
        link: roomLink,
        qrCode: qrCodeDataUrl,
      });
    };

    try {
      await createRoomOnce();
      toast.success("Room created successfully!");
    } catch (error) {
      console.error("Create room error:", error);
      const message = error instanceof Error ? error.message : "Failed to create room";
      setApiError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdRoom) return;
    navigator.clipboard.writeText(createdRoom.link);
    toast.success("Invite copied to clipboard");
  };

  const handleCopyLinkNoKey = () => {
    if (!createdRoom) return;
    const url = new URL(createdRoom.link);
    const linkNoKey = `${url.origin}/join/${createdRoom.roomId}`;
    navigator.clipboard.writeText(linkNoKey);
    toast.success("Link without key copied");
  };

  const handleJoinRoom = () => {
    if (!createdRoom) return;
    const url = new URL(createdRoom.link);
    navigate(`/join/${createdRoom.roomId}${url.hash || ""}`);
  };

  return (
    <>
      <div className="grid gap-8 md:gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <div>
            <p className="site-kicker text-accent">Control surface</p>
            <h2 className="mt-4 text-[clamp(2.75rem,8vw,6rem)] font-bold uppercase leading-[0.82] tracking-[-0.08em]">
              Set the rules. Then let the room run hot and short.
            </h2>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2">
            {[
              "Two hour expiry window",
              "Optional password gate",
              "Self-destruct message mode",
              "Shareable link and QR invite",
            ].map((feature) => (
              <div key={feature} className="bg-background p-4">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <SitePanel className="p-5 sm:p-6 md:p-8">
          <form
            className="space-y-8"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateRoom();
            }}
          >
            {apiError ? <p className="text-sm uppercase tracking-[0.16em] text-red-400">{apiError}</p> : null}

            <div className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="roomName" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                  Room name
                </label>
                <SiteInput
                  id="roomName"
                  autoComplete="username"
                  value={roomName}
                  onChange={(event) => {
                    setRoomName(event.target.value);
                    setRoomNameError(validateRoomName(event.target.value));
                  }}
                  onBlur={() => setRoomNameError(validateRoomName(roomName))}
                  placeholder="Operations room"
                  maxLength={50}
                  aria-invalid={!!roomNameError}
                />
                {roomNameError ? <p className="mt-2 text-sm uppercase tracking-[0.14em] text-red-400">{roomNameError}</p> : null}
              </div>

              <div>
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                  Password
                </label>
                <SiteInput
                  id="password"
                  type="password"
                  displayUppercase={false}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Leave blank for open entry"
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="maxParticipants" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                  Max participants
                </label>
                <SiteInput
                  id="maxParticipants"
                  type="number"
                  min="2"
                  max="50"
                  displayUppercase={false}
                  value={maxParticipants}
                  onChange={(event) => {
                    const value = event.target.value === "" ? 10 : parseInt(event.target.value, 10);
                    setMaxParticipants(value);
                    setMaxParticipantsError(validateMaxParticipants(value));
                  }}
                  onBlur={() => setMaxParticipantsError(validateMaxParticipants(maxParticipants))}
                  aria-invalid={!!maxParticipantsError}
                />
                {maxParticipantsError ? <p className="mt-2 text-sm uppercase tracking-[0.14em] text-red-400">{maxParticipantsError}</p> : null}
              </div>
            </div>

            <div className="site-rule pt-6">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-accent">Privacy switches</p>
              <div className="mt-5 space-y-5">
                <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xl font-bold uppercase tracking-[-0.04em]">Self-destruct messages</p>
                    <p className="mt-2 text-sm text-muted-foreground">Delete messages 10 minutes after they are read.</p>
                  </div>
                  <SiteSwitch
                    checked={settings.selfDestruct}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, selfDestruct: checked }))}
                    label="Toggle self-destruct messages"
                  />
                </div>

                <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xl font-bold uppercase tracking-[-0.04em]">Rich link previews</p>
                    <p className="mt-2 text-sm text-muted-foreground">Generate preview cards for shared URLs inside the room.</p>
                  </div>
                  <SiteSwitch
                    checked={settings.linkPreviewsEnabled}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, linkPreviewsEnabled: checked }))}
                    label="Toggle link previews"
                  />
                </div>

                <div>
                  <label htmlFor="keyRotation" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    Key rotation interval
                  </label>
                  <SiteInput
                    id="keyRotation"
                    type="number"
                    min={1}
                    displayUppercase={false}
                    value={settings.keyRotationInterval}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSettings((current) => ({ ...current, keyRotationInterval: value }));
                      setKeyRotationError(validateKeyRotation(value));
                    }}
                    onBlur={() => setKeyRotationError(validateKeyRotation(settings.keyRotationInterval))}
                    aria-invalid={!!keyRotationError}
                  />
                  {keyRotationError ? <p className="mt-2 text-sm uppercase tracking-[0.14em] text-red-400">{keyRotationError}</p> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <SiteBadge>E2E encryption</SiteBadge>
              <SiteBadge>Auto expiry</SiteBadge>
              <SiteBadge>QR invite</SiteBadge>
              <SiteBadge>Key rotation</SiteBadge>
            </div>

            <SiteButton type="submit" size="lg" disabled={isCreating || !isFormValid().ok}>
              {isCreating ? "Creating room" : "Create secure room"}
              <ArrowRight className="h-5 w-5" />
            </SiteButton>
          </form>
        </SitePanel>
      </div>

      <AnimatePresence>
        {createdRoom ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-auto border-2 border-border bg-background"
              role="dialog"
              aria-modal="true"
            >
              <div className="grid gap-px bg-border lg:grid-cols-[0.78fr_1.22fr]">
                <div className="flex items-center justify-center bg-accent p-6 text-black sm:p-8 md:p-10">
                  <div className="space-y-6 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.3em]">Room live</p>
                    <img src={createdRoom.qrCode} alt="Room QR code" className="mx-auto w-full max-w-[220px] border-2 border-black bg-white p-2" />
                    <p className="text-5xl font-bold uppercase tracking-[-0.08em]">{createdRoom.roomId}</p>
                  </div>
                </div>
                <div className="space-y-6 bg-background p-6 sm:p-8 md:space-y-8 md:p-10">
                  <div>
                    <p className="site-kicker text-accent">Invite generated</p>
                    <h3 className="mt-4 text-[clamp(2rem,6vw,4.25rem)] font-bold uppercase leading-[0.84] tracking-[-0.08em]">
                      The room is ready.
                    </h3>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Invite link with key</label>
                    <SiteInput value={createdRoom.link} readOnly displayUppercase={false} className="text-base font-medium normal-case tracking-normal" />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <SiteButton type="button" onClick={handleCopyLink}>
                      <Copy className="h-4 w-4" />
                      Copy invite
                    </SiteButton>
                    <SiteButton type="button" variant="outline" onClick={handleCopyLinkNoKey}>
                      Copy without key
                    </SiteButton>
                    <SiteButton type="button" variant="ghost" onClick={() => setCreatedRoom(null)}>
                      Create another
                    </SiteButton>
                  </div>

                  <div className="site-rule pt-6">
                    <SiteButton type="button" size="lg" onClick={handleJoinRoom}>
                      Join room now
                      <ArrowRight className="h-5 w-5" />
                    </SiteButton>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}


