import { useEffect, useState } from "react";

export type AudioOutputInfo = {
  deviceId: string;
  label: string;
  isBluetooth: boolean;
};

export function useAudioOutputDevice(selectedDeviceId: string | null) {
  const [outputs, setOutputs] = useState<AudioOutputInfo[]>([]);
  const [isBluetooth, setIsBluetooth] = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const update = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices
          .filter((d) => d.kind === "audiooutput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Output ${d.deviceId.slice(0, 8)}`,
            isBluetooth: /bluetooth/i.test(d.label),
          }));
        if (!cancelled) setOutputs(audioOutputs);

        const current = selectedDeviceId
          ? audioOutputs.find((o) => o.deviceId === selectedDeviceId)
          : audioOutputs[0];
        if (!cancelled && current) {
          setCurrentLabel(current.label);
          setIsBluetooth(current.isBluetooth);
        }
      } catch {
        if (!cancelled) {
          setOutputs([]);
          setCurrentLabel("");
          setIsBluetooth(false);
        }
      }
    };

    update();
    return () => { cancelled = true; };
  }, [selectedDeviceId]);

  return { outputs, isBluetooth, currentLabel };
}
