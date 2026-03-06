import { Badge } from "@/components/ui/badge";
import { CallStatsSnapshot, ConnectionQuality } from "./types";

type Props = {
  quality: ConnectionQuality;
  stats: CallStatsSnapshot;
  reconnecting?: boolean;
};

export function CallStats({ quality, stats, reconnecting }: Props) {
  const color =
    quality === "excellent" ? "bg-green-500" :
    quality === "good" ? "bg-yellow-500" :
    "bg-red-500";
  const label = reconnecting ? "reconnecting" : quality;
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Badge className={`${color} text-white capitalize`}>{label}</Badge>
      <Badge variant="secondary">RTT {Math.round(stats.rttMs)}ms</Badge>
      <Badge variant="secondary">Loss {Math.round(stats.packetLoss)}%</Badge>
      <Badge variant="secondary">Jitter {Math.round(stats.jitterMs)}ms</Badge>
      <Badge variant="secondary">Bitrate {Math.round(stats.bitrateKbps)}kbps</Badge>
    </div>
  );
}
