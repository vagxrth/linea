import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Deletes uploads that never made it into a project (see deleteUnusedUploads in storage.ts), at
// 3:00 IST, when Linea is quietest
crons.daily("delete unused uploads", { hourUTC: 21, minuteUTC: 30 }, internal.storage.deleteUnusedUploads, {});

export default crons;
