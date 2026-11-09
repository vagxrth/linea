import { describe, expect, it, vi } from "vitest"
import { readDesignStream } from "./design-stream"

const encoder = new TextEncoder()

// A response whose body sends the given byte chunks one read at a time, then ends, or breaks off
// with `error` after the last of them, as a connection the server dropped would
const response = (chunks: Uint8Array[], error?: Error) => {
    let next = 0
    return new Response(new ReadableStream<Uint8Array>({
        pull(controller) {
            if (next < chunks.length) controller.enqueue(chunks[next++])
            else if (error) controller.error(error)
            else controller.close()
        },
    }))
}

describe("readDesignStream", () => {
    it("resolves with the whole design, a character split between chunks included", async () => {
        const bytes = encoder.encode('<div data-generated-ui><p>Café</p></div>')
        const split = bytes.indexOf(0xc3) + 1
        const progress = vi.fn()
        const html = await readDesignStream(response([bytes.slice(0, split), bytes.slice(split)]), progress)
        expect(html).toBe('<div data-generated-ui><p>Café</p></div>')
        expect(progress).toHaveBeenCalledTimes(2)
        expect(progress.mock.calls[0][0]).toBe('<div data-generated-ui><p>Caf')
    })

    it("rejects when the stream breaks off, so a half-written design is never kept", async () => {
        const progress = vi.fn()
        await expect(readDesignStream(response([encoder.encode("<div data-generated-ui><p>Half")], new Error("stopped early")), progress)).rejects.toThrow("stopped early")
        // The caller saw the partial design arrive, but gets no design back
        expect(progress).toHaveBeenCalledWith("<div data-generated-ui><p>Half")
    })

    it("rejects an empty design", async () => {
        await expect(readDesignStream(response([encoder.encode("  ")]))).rejects.toThrow("empty")
        await expect(readDesignStream(new Response(null))).rejects.toThrow("without a body")
    })
})
