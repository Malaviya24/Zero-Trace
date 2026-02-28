import { Button } from "@/components/ui/button";
import { Phone, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@/lib/convex-helpers";
import { typedApi } from "@/lib/api-types";
import { toast } from "sonner";

interface CallButtonProps {
  roomId: string;
  displayName?: string;
}

export function CallButton({ roomId, displayName }: CallButtonProps) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const createCallMutation = useMutation(typedApi.calls.create);

  const handleStartCall = async () => {
    try {
      setIsCreating(true);
      const name = displayName || "Anonymous";

      const callId = await createCallMutation({
        roomId,
        e2ee: true,
        displayName: name,
      });

      sessionStorage.setItem("call_display_name", name);
      sessionStorage.setItem("call_room_id", roomId);

      navigate(`/call/${callId}`);
    } catch (error) {
      console.error("Failed to create call:", error);
      toast.error("Failed to start call");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleStartCall}
      disabled={isCreating}
      className="h-9 w-9 rounded-full p-0 hover:bg-muted/60"
      aria-label="Start call"
    >
      {isCreating ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin text-muted-foreground" />
      ) : (
        <Phone className="h-[18px] w-[18px] text-muted-foreground" />
      )}
    </Button>
  );
}
