import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup-expired-data",
  { minutes: 5 },
  internal.rooms.cleanupExpiredInternal,
  {}
);

export default crons;
