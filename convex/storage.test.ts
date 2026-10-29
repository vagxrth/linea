// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

// Every Convex module except the tests, which Convex skips too (it skips files with more than one dot)
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"])

const HOUR = 60 * 60 * 1000
const MB = 1024 * 1024

type Test = TestConvex<typeof schema>

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

// Adds a user with one project, and returns a client signed in as them
const addOwner = async (t: Test) => {
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
    return { userId, projectId, asOwner: t.withIdentity({ subject: `${userId}|test-session` }) }
}

// Stores a file of `bytes` bytes as an upload of `contentType`. Real uploads take their type from the
// request; convex-test doesn't record one, so the test sets it.
const upload = (t: Test, bytes: number, contentType?: string) =>
    t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)]))
        // @ts-expect-error -- functions can't write _storage, but convex-test lets a test set a file's type
        if (contentType) await ctx.db.patch(storageId, { contentType })
        return storageId
    })

const exists = (t: Test, storageId: Id<"_storage">) =>
    t.run(async (ctx) => (await ctx.db.system.get(storageId)) !== null)

const ownerOf = (t: Test, storageId: Id<"_storage">) =>
    t.run((ctx) =>
        ctx.db.query("storage_owners").withIndex("by_storageId", (q) => q.eq("storageId", storageId)).unique()
    )

// Runs the cleanup, including the pages it schedules for itself
const cleanUp = async (t: Test) => {
    await t.mutation(internal.storage.deleteUnusedUploads, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)
}

describe("attaching an upload to a project", () => {
    it("accepts PNG, JPEG and WebP images up to 2 MB", async () => {
        const t = convexTest(schema, modules)
        const { projectId, asOwner } = await addOwner(t)

        for (const contentType of ["image/png", "image/jpeg", "image/webp"]) {
            const storageId = await upload(t, 2 * MB, contentType)
            await asOwner.mutation(api.moodboard.addMoodboardImage, { projectId, storageId })
            expect(await ownerOf(t, storageId)).not.toBeNull()
        }
    })

    it("refuses other types and images over 2 MB, leaving them without an owner", async () => {
        const t = convexTest(schema, modules)
        const { projectId, asOwner } = await addOwner(t)
        const refused = [
            await upload(t, 2 * MB + 1, "image/png"),
            await upload(t, 10, "image/gif"),
            await upload(t, 10, "application/pdf"),
            await upload(t, 10),
        ]

        for (const storageId of refused) {
            await expect(
                asOwner.mutation(api.moodboard.addMoodboardImage, { projectId, storageId })
            ).rejects.toThrow(/PNG, JPEG or WebP files of up to 2 MB/)
            await expect(
                asOwner.mutation(api.inspiration.addInspirationImage, { projectId, storageId })
            ).rejects.toThrow(/PNG, JPEG or WebP files of up to 2 MB/)
            expect(await ownerOf(t, storageId)).toBeNull()
        }
    })
})

describe("deleteUnusedUploads", () => {
    it("deletes uploads with no owner once the claim window has passed, and keeps the rest", async () => {
        const t = convexTest(schema, modules)
        const { userId, projectId, asOwner } = await addOwner(t)

        const used = await upload(t, 100, "image/png")
        await asOwner.mutation(api.moodboard.addMoodboardImage, { projectId, storageId: used })
        const disputed = await upload(t, 100, "image/png")
        await t.run((ctx) => ctx.db.insert("storage_owners", { storageId: disputed, userId, disputed: true }))
        const abandoned = await upload(t, 100, "image/png")
        const refused = await upload(t, 100, "application/pdf")

        vi.advanceTimersByTime(2 * HOUR)
        // Still inside its claim window, so its uploader may be about to attach it
        const fresh = await upload(t, 100, "image/png")

        expect(await t.query(internal.storage.unusedUploadsReport, {})).toEqual({
            files: 5,
            unused: 2,
            unusedBytes: 200,
            listedByProject: 0,
        })

        await cleanUp(t)

        expect(await exists(t, abandoned)).toBe(false)
        expect(await exists(t, refused)).toBe(false)
        expect(await exists(t, used)).toBe(true)
        expect(await exists(t, disputed)).toBe(true)
        expect(await exists(t, fresh)).toBe(true)
        // The image the project uses still loads
        const images = await asOwner.query(api.moodboard.getMoodboardImages, { projectId })
        expect(images).toHaveLength(1)
    })

    it("goes through every page of files", async () => {
        // convex-test's cursor is the last document of a page, and deleting that document ends the
        // query there. (Convex's cursor is a position, which deleting doesn't move.) So each page of
        // 100 here ends with a file the cleanup keeps.
        const t = convexTest(schema, modules)
        const { userId } = await addOwner(t)
        const ids = await t.run(async (ctx) => {
            const stored: Id<"_storage">[] = []
            for (let i = 0; i < 250; i++) {
                const storageId = await ctx.storage.store(new Blob(["x"]))
                if (i % 100 === 99) await ctx.db.insert("storage_owners", { storageId, userId })
                stored.push(storageId)
            }
            return stored
        })
        vi.advanceTimersByTime(2 * HOUR)

        await cleanUp(t)

        for (const [i, storageId] of ids.entries()) {
            expect(await exists(t, storageId)).toBe(i % 100 === 99)
        }
    })
})

describe("unusedUploadsReport", () => {
    it("counts an unused upload that a project still lists, which the cleanup would delete", async () => {
        const t = convexTest(schema, modules)
        const { projectId } = await addOwner(t)
        const ownerless = await upload(t, 100, "image/png")
        await t.run((ctx) => ctx.db.patch(projectId, { inspirationImages: [ownerless] }))
        vi.advanceTimersByTime(2 * HOUR)

        const report = await t.query(internal.storage.unusedUploadsReport, {})
        expect(report).toMatchObject({ unused: 1, listedByProject: 1 })
    })
})
