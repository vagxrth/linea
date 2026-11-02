import { afterEach, describe, expect, it, vi } from "vitest"
import { createUploadQueue, type QueuedImage } from "./upload-queue"

type Image = QueuedImage & { storageId?: string }

const added = (id: string): Image => ({ id, file: new File([id], `${id}.png`, { type: "image/png" }), uploaded: false, uploading: false })

// The moodboard's setup: a list in a form, and an effect that hands the list to the queue after
// every change, the queue's own changes included
const moodboard = (images: Image[], upload: (image: Image) => Promise<Partial<Image>>) => {
    const state = { images }
    const snapshots: Image[][] = []
    const queue = createUploadQueue<Image>({
        current: () => state.images,
        update: (id, patch) => {
            state.images = state.images.map((image) => (image.id === id ? { ...image, ...patch } : image))
            snapshots.push(state.images)
            queue.add(state.images)
        },
        upload,
    })
    return { state, snapshots, queue }
}

describe("createUploadQueue", () => {
    afterEach(() => vi.restoreAllMocks())

    it("uploads each of several images added at once exactly once, in order", async () => {
        const uploads: string[] = []
        const { state, snapshots, queue } = moodboard([added("a"), added("b"), added("c"), added("d")], async (image) => {
            uploads.push(image.id)
            await new Promise((resolve) => setTimeout(resolve, 5))
            return { storageId: `storage-${image.id}` }
        })

        await queue.add(state.images)
        // The old loop wrote back stale copies of the list; replaying them must not upload anything again
        for (const snapshot of snapshots) await queue.add(snapshot)

        expect(uploads).toEqual(["a", "b", "c", "d"])
        expect(state.images.map((image) => [image.id, image.uploaded, image.uploading, image.storageId])).toEqual([
            ["a", true, false, "storage-a"],
            ["b", true, false, "storage-b"],
            ["c", true, false, "storage-c"],
            ["d", true, false, "storage-d"],
        ])
    })

    it("skips an image removed before its turn", async () => {
        const uploads: string[] = []
        const { state, queue } = moodboard([added("a"), added("b")], async (image) => {
            uploads.push(image.id)
            // While the first uploads, the second is removed
            state.images = state.images.filter((item) => item.id !== "b")
            return { storageId: `storage-${image.id}` }
        })

        await queue.add(state.images)

        expect(uploads).toEqual(["a"])
        expect(state.images.map((image) => image.id)).toEqual(["a"])
    })

    it("marks a failed upload and carries on with the rest", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        const { state, queue } = moodboard([added("a"), added("b")], async (image) => {
            if (image.id === "a") throw new Error("network")
            return { storageId: "storage-b" }
        })

        await queue.add(state.images)

        expect(state.images).toMatchObject([
            { id: "a", uploaded: false, uploading: false, error: "Upload Failed" },
            { id: "b", uploaded: true, uploading: false, storageId: "storage-b" },
        ])
    })

    it("leaves images that came from the server alone", async () => {
        const upload = vi.fn(async () => ({}))
        const { state, queue } = moodboard([{ id: "saved", uploaded: true, uploading: false }], upload)

        await queue.add(state.images)

        expect(upload).not.toHaveBeenCalled()
    })
})
