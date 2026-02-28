import { useQuery } from "@/lib/convex-helpers";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, Users, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDuration } from "@/lib/utils";

interface CallHistoryProps {
  roomId: string;
  limit?: number;
}

export function CallHistory({ roomId, limit = 10 }: CallHistoryProps) {
  const callHistory = useQuery((api as any).callHistory.getCallHistory, { roomId, limit });

  if (!callHistory || callHistory.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Phone className="h-4 w-4 text-primary" />
            Call History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-3">
            <Phone className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No calls yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Start a call to see history here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Phone className="h-4 w-4 text-primary" />
          Call History
          <Badge variant="secondary" className="ml-auto text-xs">
            {callHistory.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="p-3 space-y-2">
            <AnimatePresence>
              {callHistory.map((call: any, index: number) => {
                const duration = call.endedAt && call.startedAt 
                  ? call.endedAt - call.startedAt 
                  : call.startedAt 
                  ? Date.now() - call.startedAt 
                  : 0;

                const statusColor = 
                  call.status === "active" 
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" 
                    : call.status === "ended"
                    ? "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"
                    : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";

                return (
                  <motion.div
                    key={call._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative p-3 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-200"
                  >
                    {/* Status indicator dot */}
                    <div className="absolute top-3 right-3">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-2 py-0.5 ${statusColor}`}
                      >
                        {call.status === "active" && (
                          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        )}
                        {call.status}
                      </Badge>
                    </div>

                    {/* Call info */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 pr-16">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            Call
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(call._creationTime).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(call._creationTime).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Duration and participants */}
                      <div className="flex items-center gap-3 pl-10 text-xs">
                        {duration > 0 && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">
                              {formatDuration(Math.floor(duration / 1000))}
                            </span>
                          </div>
                        )}
                        {call.maxParticipants && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>Max {call.maxParticipants}</span>
                          </div>
                        )}
                        {call.sfuEnabled && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            SFU
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Hover effect overlay */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}