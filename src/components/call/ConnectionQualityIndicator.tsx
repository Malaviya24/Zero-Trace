import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Signal, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionQualityIndicatorProps {
  quality: "excellent" | "good" | "fair" | "poor" | null;
  className?: string;
}

export function ConnectionQualityIndicator({ quality, className }: ConnectionQualityIndicatorProps) {
  if (!quality) return null;

  const getIcon = () => {
    switch (quality) {
      case "excellent":
        return <SignalHigh className="h-3 w-3" />;
      case "good":
        return <Signal className="h-3 w-3" />;
      case "fair":
        return <SignalMedium className="h-3 w-3" />;
      case "poor":
        return <SignalLow className="h-3 w-3" />;
      default:
        return <WifiOff className="h-3 w-3" />;
    }
  };

  const getVariant = () => {
    switch (quality) {
      case "excellent":
      case "good":
        return "default";
      case "fair":
        return "secondary";
      case "poor":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Badge 
      variant={getVariant()} 
      className={cn("text-xs flex items-center gap-1", className)}
    >
      {getIcon()}
      {quality}
    </Badge>
  );
}
