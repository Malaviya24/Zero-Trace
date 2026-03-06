import { IncomingCallScreen } from "@/components/whatsapp-call/IncomingCallScreen";

type Props = {
  open: boolean;
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallModal({ open, callerName, onAccept, onReject }: Props) {
  if (!open) return null;
  return (
    <IncomingCallScreen
      callerName={callerName}
      onAccept={onAccept}
      onReject={onReject}
    />
  );
}
