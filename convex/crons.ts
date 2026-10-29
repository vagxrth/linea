import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Yearly Pro subscribers get their credits every month, not once a year (see refillYearlyCredits)
crons.hourly("refill yearly credits", { minuteUTC: 0 }, internal.subscription.refillYearlyCredits, {});

export default crons;
