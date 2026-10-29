import { getFunctionName } from "convex/server"
import { describe, expect, it } from "vitest"
import { internal } from "./_generated/api"
import crons from "./crons"

describe("crons", () => {
    it("deletes unused uploads every day at 3:00 IST", () => {
        expect(crons.crons["delete unused uploads"]).toEqual({
            name: getFunctionName(internal.storage.deleteUnusedUploads),
            args: [{}],
            schedule: { type: "daily", hourUTC: 21, minuteUTC: 30 },
        })
    })
})
