import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCallStore } from "@/store/useCallStore";

export function DeviceSelector() {
  const { state, actions } = useCallStore();

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="microphone">Microphone</Label>
        <Select
          value={state.selectedDevices.audioInput}
          onValueChange={(value) => actions.setSelectedDevice("audioInput", value)}
        >
          <SelectTrigger id="microphone">
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent>
            {state.devices.audioInputs.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="camera">Camera</Label>
        <Select
          value={state.selectedDevices.videoInput}
          onValueChange={(value) => actions.setSelectedDevice("videoInput", value)}
        >
          <SelectTrigger id="camera">
            <SelectValue placeholder="Select camera" />
          </SelectTrigger>
          <SelectContent>
            {state.devices.videoInputs.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="speaker">Speaker</Label>
        <Select
          value={state.selectedDevices.audioOutput}
          onValueChange={(value) => actions.setSelectedDevice("audioOutput", value)}
        >
          <SelectTrigger id="speaker">
            <SelectValue placeholder="Select speaker" />
          </SelectTrigger>
          <SelectContent>
            {state.devices.audioOutputs.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}