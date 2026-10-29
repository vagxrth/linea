import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"
import { describeSaveFailure } from "./save-failure"

describe("describeSaveFailure", () => {
    it("explains each reason the server gives, without retrying on a timer", () => {
        for (const code of ["not-found", "not-yours", "signed-out", "too-large"]) {
            const problem = describeSaveFailure(new ConvexError({ code }))
            expect(problem.retry).toBe(false)
            expect(problem.description).not.toMatch(/keeps trying/)
        }
        expect(describeSaveFailure(new ConvexError({ code: "not-found" })).description).toMatch(/deleted/)
        expect(describeSaveFailure(new ConvexError({ code: "signed-out" })).description).toMatch(/signed out/)
        expect(describeSaveFailure(new ConvexError({ code: "too-large" })).description).toMatch(/too big/)
    })

    it("keeps trying after an error without a known reason", () => {
        const unknown = [
            new Error("[CONVEX M(projects:updateProjectSketches)] Server Error"),
            new ConvexError({ code: "something-new" }),
            new ConvexError("a plain message"),
            new ConvexError({ code: "toString" }),
            "not an error",
            undefined,
        ]
        for (const error of unknown) {
            expect(describeSaveFailure(error)).toEqual({
                description: "Linea keeps trying. Keep this tab open until this message goes away.",
                retry: true,
            })
        }
    })
})
