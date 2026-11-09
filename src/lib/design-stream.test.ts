import { describe, expect, it, vi } from "vitest"
import { acceptsReplacement, DESIGN_STREAM_HEADERS, finalDesign, readDesignStream, REPLACEMENT_MARK } from "./design-stream"

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

describe("a design the server replaced with a repaired one", () => {
    const first = '<div data-generated-ui><p class="text-white">Discover</p></div>'
    const repaired = '<div data-generated-ui><p class="c-fg">Houseplants</p></div>'

    it("resolves with the replacement, and shows only the first while it's on its way", async () => {
        const progress = vi.fn()
        const repairing = vi.fn()
        const html = await readDesignStream(response([encoder.encode(first.slice(0, 20)), encoder.encode(`${first.slice(20)}${REPLACEMENT_MARK}`), encoder.encode(repaired.slice(0, 10)), encoder.encode(repaired.slice(10))]), progress, repairing)
        expect(html).toBe(repaired)
        expect(progress.mock.calls.map(([markup]) => markup)).toEqual([first.slice(0, 20), first])
        expect(repairing).toHaveBeenCalledTimes(1)
    })

    it("keeps the first design when nothing better followed the mark", async () => {
        expect(await readDesignStream(response([encoder.encode(first), encoder.encode(REPLACEMENT_MARK)]))).toBe(first)
    })

    it("keeps the first design, which was whole, when the connection breaks after the mark", async () => {
        const html = await readDesignStream(response([encoder.encode(`${first}${REPLACEMENT_MARK}`), encoder.encode(repaired.slice(0, 12))], new Error("dropped")))
        expect(html).toBe(first)
    })

    it("still rejects a break before the mark", async () => {
        await expect(readDesignStream(response([encoder.encode(first.slice(0, 12))], new Error("dropped")))).rejects.toThrow("dropped")
    })
})

describe("finalDesign", () => {
    it("is the replacement when one came, else the design before the mark", () => {
        expect(finalDesign("<div>a</div>")).toBe("<div>a</div>")
        expect(finalDesign(`<div>a</div>${REPLACEMENT_MARK}<div>b</div>`)).toBe("<div>b</div>")
        expect(finalDesign(`<div>a</div>${REPLACEMENT_MARK}  `)).toBe("<div>a</div>")
    })
})

describe("acceptsReplacement", () => {
    it("is true only for a client that says it reads replacements", () => {
        expect(acceptsReplacement(new Request("http://localhost/api/generate", { headers: DESIGN_STREAM_HEADERS }))).toBe(true)
        expect(acceptsReplacement(new Request("http://localhost/api/generate"))).toBe(false)
    })
})
