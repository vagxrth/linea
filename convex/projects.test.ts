// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

// Every Convex module except the tests, which Convex skips too (it skips files with more than one dot)
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"])

// Adds a user with one project, and returns a client signed in as them
const setup = async () => {
    const t = convexTest(schema, modules)
    const { userId, projectId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", { email: "owner@example.com" })
        const projectId = await ctx.db.insert("projects", {
            userId,
            name: "Project 1",
            projectNumber: 1,
            lastModified: 0,
            createdAt: 0,
        })
        return { userId, projectId }
    })
    // Convex Auth puts "userId|sessionId" in the token's subject
    return { t, projectId, asOwner: t.withIdentity({ subject: `${userId}|test-session` }) }
}

// A drawing of `count` rectangles, each labelled with `text`
const drawing = (count: number, text = "") => {
    const ids = Array.from({ length: count }, (_, i) => `shape-${i}`)
    const entities = Object.fromEntries(
        ids.map((id, i) => [id, { id, type: "rect", x: i, y: i, w: 10, h: 10, text }])
    )
    return { shapes: { ids, entities }, frameCounter: 0 }
}

const viewportData = { scale: 1, translate: { x: 0, y: 0 } }

// The reason a save was refused, from the ConvexError it threw. convex-test hands over the error's
// data as JSON text, where the browser gets the object.
const reasonFor = async (save: Promise<unknown>) => {
    try {
        await save
    } catch (error) {
        if (!(error instanceof ConvexError)) throw error
        const data = typeof error.data === "string" ? JSON.parse(error.data) : error.data
        return (data as { code: string }).code
    }
    return "saved"
}

describe("updateProjectSketches", () => {
    it("saves the owner's drawing", async () => {
        const { t, projectId, asOwner } = await setup()
        const sketchesData = drawing(3)

        await asOwner.mutation(api.projects.updateProjectSketches, { projectId, sketchesData, viewportData })

        const project = await asOwner.query(api.projects.getProject, { projectId })
        expect(project?.sketchesData).toEqual(sketchesData)
        expect(project?.viewportData).toEqual(viewportData)
        const saved = await t.run((ctx) => ctx.db.query("project_sketches").collect())
        expect(saved).toHaveLength(1)
    })

    it("says the caller is signed out", async () => {
        const { t, projectId } = await setup()
        const save = t.mutation(api.projects.updateProjectSketches, { projectId, sketchesData: drawing(1) })
        expect(await reasonFor(save)).toBe("signed-out")
    })

    it("says the project was deleted", async () => {
        const { t, projectId, asOwner } = await setup()
        await t.run((ctx) => ctx.db.delete(projectId))
        const save = asOwner.mutation(api.projects.updateProjectSketches, { projectId, sketchesData: drawing(1) })
        expect(await reasonFor(save)).toBe("not-found")
    })

    it("says the project belongs to someone else", async () => {
        const { t, projectId } = await setup()
        const otherId: Id<"users"> = await t.run((ctx) => ctx.db.insert("users", { email: "other@example.com" }))
        const asOther = t.withIdentity({ subject: `${otherId}|test-session` })
        const save = asOther.mutation(api.projects.updateProjectSketches, { projectId, sketchesData: drawing(1) })
        expect(await reasonFor(save)).toBe("not-yours")
    })

    it("refuses a drawing over Convex's 1 MiB limit, keeping the saved one", async () => {
        const { projectId, asOwner } = await setup()
        const fits = drawing(2)
        await asOwner.mutation(api.projects.updateProjectSketches, { projectId, sketchesData: fits, viewportData })

        // Two shapes with half a MiB of text each
        const tooBig = drawing(2, "a".repeat(1 << 19))
        const save = asOwner.mutation(api.projects.updateProjectSketches, { projectId, sketchesData: tooBig, viewportData })
        expect(await reasonFor(save)).toBe("too-large")

        const project = await asOwner.query(api.projects.getProject, { projectId })
        expect(project?.sketchesData).toEqual(fits)
    })

    it("refuses a drawing with more shapes than one Convex object can hold", async () => {
        const { projectId, asOwner } = await setup()
        expect(await reasonFor(asOwner.mutation(api.projects.updateProjectSketches, {
            projectId,
            sketchesData: drawing(1024),
        }))).toBe("saved")
        expect(await reasonFor(asOwner.mutation(api.projects.updateProjectSketches, {
            projectId,
            sketchesData: drawing(1025),
        }))).toBe("too-large")
    })
})
