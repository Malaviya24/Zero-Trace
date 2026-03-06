import { ReactNode } from "react";
import { useCall } from "./useCall";
import { IncomingCallModal } from "./IncomingCallModal";
import { CallModal } from "./CallModal";

type Props = {
  remoteName?: string;
  children?: ReactNode;
  onAcceptIncoming?: () => Promise<void> | void;
  onRejectIncoming?: () => Promise<void> | void;
};

export function CallManager({ remoteName = "Contact", children, onAcceptIncoming, onRejectIncoming }: Props) {
  const { state, acceptIncomingCall, rejectIncomingCall, endCall, toggleMute, toggleSpeaker, bindRemoteAudioElement } = useCall();

  return (
    <>
      {children}
      <IncomingCallModal
        open={state.status === "incoming"}
        callerName={state.incomingFrom || remoteName}
        onAccept={async () => {
          await acceptIncomingCall();
          await onAcceptIncoming?.();
        }}
        onReject={async () => {
          rejectIncomingCall();
          await onRejectIncoming?.();
        }}
      />
      <CallModal
        open={state.status === "connecting" || state.status === "connected" || state.status === "reconnecting"}
        remoteName={remoteName}
        muted={state.muted}
        speakerOn={state.speakerOn}
        onHold={state.onHold}
        remoteStream={state.remoteStream}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onEndCall={endCall}
        onBindRemoteAudio={bindRemoteAudioElement}
      />
    </>
  );
}
