import { getFunctionName } from "convex/server"
import { describe, expect, it } from "vitest"
import { internal } from "./_generated/api"
import crons from "./crons"

describe("crons", () => {
    it("refills yearly subscribers' credits every hour", () => {
        expect(crons.crons["refill yearly credits"]).toEqual({
            name: getFunctionName(internal.subscription.refillYearlyCredits),
            args: [{}],
            schedule: { type: "hourly", minuteUTC: 0 },
        })
    })
})
