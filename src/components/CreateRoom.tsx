import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { ChatCrypto } from "@/lib/crypto";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Eye,
  Timer,
  Users,
  Key,
  Copy,
  QrCode,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation } from "@/lib/convex-helpers";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import QRCode from "qrcode";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CreateRoom() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [settings, setSettings] = useState({
    selfDestruct: false,
    screenshotProtection: true,
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreatedRoom(null);
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
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (Number.isNaN(num) || value === '') return "Please enter a number between 2 and 50.";
    if (num < 2 || num > 50) return "Max participants must be between 2 and 50.";
    return null;
  };
  const validateKeyRotation = (value: number): string | null => {
    if (!Number.isFinite(value) || value <= 0) return "Key rotation interval must be a positive number.";
    return null;
  };

  const isFormValid = (): { ok: boolean; message?: string } => {
    // Do NOT set state here; this function is used during render
    if (roomName.length > 50) {
      return { ok: false, message: "Room name must be 50 characters or fewer." };
    }
    if (Number.isNaN(maxParticipants) || maxParticipants < 2 || maxParticipants > 50) {
      return { ok: false, message: "Max participants must be between 2 and 50." };
    }
    if (!Number.isFinite(settings.keyRotationInterval) || settings.keyRotationInterval <= 0) {
      return { ok: false, message: "Key rotation interval must be a positive number." };
    }

    return { ok: true };
  };

  const handleCreateRoom = async () => {
    // Early client-side validation to give immediate feedback
    const valid = isFormValid();
    if (!valid.ok) {
      toast.error(valid.message || "Please correct the form.");
      return;
    }

    setIsCreating(true);
    setApiError(null);
    
    try {
      const roomId = ChatCrypto.generateRoomId();
      let passwordHash: string | undefined;
      // Add: capture salt to send to server for later verification
      let passwordSalt: string | undefined;

      if (password) {
        const { hash, salt } = await ChatCrypto.hashPassword(password);
        passwordHash = hash;
        passwordSalt = salt;
      }

      const result = await createRoomMutation({
        roomId,
        name: roomName || undefined,
        passwordHash,
        // Add: send passwordSalt
        passwordSalt,
        maxParticipants,
        settings,
      });

      const finalRoomId = result.roomId;

      // Use RoomService to generate invite link
      const roomService = new (await import('@/services/RoomService')).RoomService(finalRoomId);
      await roomService.getEncryptionService().generateKey();
      const roomLink = await roomService.generateInviteLink(window.location.origin);
      const qrCodeDataUrl = await QRCode.toDataURL(roomLink, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      setCreatedRoom({
        roomId: finalRoomId,
        link: roomLink,
        qrCode: qrCodeDataUrl,
      });

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
    if (createdRoom) {
      navigator.clipboard.writeText(createdRoom.link);
      toast.success("Invite (with key) copied to clipboard");
    }
  };

  const handleCopyLinkNoKey = () => {
    if (createdRoom) {
      const url = new URL(createdRoom.link);
      const linkNoKey = `${url.origin}/join/${createdRoom.roomId}`;
      navigator.clipboard.writeText(linkNoKey);
      toast.success("Link (no key) copied to clipboard");
    }
  };

  const handleJoinRoom = () => {
    if (createdRoom) {
      const url = new URL(createdRoom.link);
      const fragment = url.hash || "";
      navigate(`/join/${createdRoom.roomId}${fragment}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Create Secure Room
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set up your ephemeral, encrypted chat room
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Add: API/server error alert */}
          {apiError && (
            <Alert variant="destructive">
              <AlertTitle>Unable to create room</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          {/* Basic Settings */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="roomName">Room Name (Optional)</Label>
              <Input
                id="roomName"
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value);
                  setRoomNameError(validateRoomName(e.target.value));
                }}
                onBlur={() => setRoomNameError(validateRoomName(roomName))}
                placeholder="My Secret Chat"
                maxLength={50}
                aria-invalid={!!roomNameError}
              />
              {roomNameError && (
                <p className="text-xs text-red-500 mt-1">{roomNameError}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter room password"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty for public room
              </p>
            </div>

            <div>
              <Label htmlFor="maxParticipants">Max Participants</Label>
              <Input
                id="maxParticipants"
                type="number"
                min="2"
                max="50"
                value={maxParticipants}
                onChange={(e) => {
                  const val = e.target.value === '' ? 10 : parseInt(e.target.value, 10);
                  setMaxParticipants(val);
                  setMaxParticipantsError(validateMaxParticipants(val));
                }}
                onBlur={() => setMaxParticipantsError(validateMaxParticipants(maxParticipants))}
                aria-invalid={!!maxParticipantsError}
              />
              {maxParticipantsError && (
                <p className="text-xs text-red-500 mt-1">{maxParticipantsError}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Privacy Settings */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Privacy Settings
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Self-Destructing Messages</Label>
                  <p className="text-xs text-muted-foreground">
                    Messages auto-delete 10 minutes after being read
                  </p>
                </div>
                <Switch
                  checked={settings.selfDestruct}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, selfDestruct: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Screenshot Protection</Label>
                  <p className="text-xs text-muted-foreground">
                    Blur content to prevent screenshots
                  </p>
                </div>
                <Switch
                  checked={settings.screenshotProtection}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, screenshotProtection: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Key Rotation Interval</Label>
                  <p className="text-xs text-muted-foreground">
                    Number of messages before rotating the encryption key
                  </p>
                </div>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  value={settings.keyRotationInterval}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSettings(prev => ({ ...prev, keyRotationInterval: val }));
                    setKeyRotationError(validateKeyRotation(val));
                  }}
                  onBlur={() =>
                    setKeyRotationError(validateKeyRotation(settings.keyRotationInterval))
                  }
                  aria-invalid={!!keyRotationError}
                />
              </div>
              {keyRotationError && (
                <p className="text-xs text-red-500">{keyRotationError}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Security Features */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Security Features</h3>
            <div className="grid grid-cols-2 gap-2">
              <Badge variant="secondary" className="justify-center text-xs">
                <Shield className="h-3 w-3 mr-1" />
                E2E Encrypted
              </Badge>
              <Badge variant="secondary" className="justify-center text-xs">
                <Timer className="h-3 w-3 mr-1" />
                Auto-Expire
              </Badge>
              <Badge variant="secondary" className="justify-center text-xs">
                <Key className="h-3 w-3 mr-1" />
                Key Rotation
              </Badge>
              <Badge variant="secondary" className="justify-center text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Zero Logs
              </Badge>
            </div>
          </div>

          <Button
            onClick={handleCreateRoom}
            disabled={isCreating || !isFormValid().ok}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Room...
              </>
            ) : (
              <>
                Create Secure Room
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Modal for Room Created */}
      <AnimatePresence>
        {createdRoom && (
          <>
            {/* Backdrop - enhance with gradient + subtle blur */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              style={{
                background:
                  "radial-gradient(1200px 600px at 50% -10%, rgba(59,130,246,0.18), transparent 60%), rgba(0,0,0,0.55)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal container - smoother spring entrance */}
            <motion.div
              key="modal"
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 22, mass: 0.8 }}
            >
              <motion.div
                className="w-full max-w-md drop-shadow-2xl"
                initial={{ filter: "blur(6px)" }}
                animate={{ filter: "blur(0px)" }}
                exit={{ filter: "blur(6px)" }}
                transition={{ duration: 0.18 }}
                whileHover={{ y: -2 }}
              >
                <Card className="border border-primary/20 shadow-xl">
                  {/* Header */}
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Room Created!</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Share this link or QR code with others
                    </p>
                  </CardHeader>

                  {/* Content */}
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      {/* Animate roomId badge: gentle float + fade-in */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 18, mass: 0.7, delay: 0.05 }}
                      >
                        <Badge variant="outline" className="text-lg font-mono px-4 py-2">
                          {createdRoom.roomId}
                        </Badge>
                      </motion.div>
                    </div>

                    <div className="flex justify-center">
                      {/* QR with hover tilt + tap feedback */}
                      <motion.img
                        src={createdRoom.qrCode}
                        alt="Room QR Code"
                        className="border rounded-lg"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 220, damping: 18 }}
                        whileHover={{ scale: 1.03, rotate: 0.25 }}
                        whileTap={{ scale: 0.98, rotate: 0 }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Room Link</Label>
                      <div className="flex gap-2">
                        <Input
                          value={createdRoom.link}
                          readOnly
                          className="text-xs"
                          aria-label="Room invite link with key"
                        />
                        {/* Copy button with hover/tap */}
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                          <Button variant="outline" size="icon" onClick={handleCopyLink} aria-label="Copy invite link with key">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      </div>
                      <div className="flex justify-end">
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                          <Button variant="ghost" size="sm" onClick={handleCopyLinkNoKey} aria-label="Copy link without key">
                            Copy link without key
                          </Button>
                        </motion.div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Action buttons with motion wrappers */}
                      <motion.div className="flex-1" whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant="outline"
                          onClick={() => setCreatedRoom(null)}
                          className="w-full"
                        >
                          Create Another
                        </Button>
                      </motion.div>
                      <motion.div className="flex-1" whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                        <Button onClick={handleJoinRoom} className="w-full">
                          Join Room
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}