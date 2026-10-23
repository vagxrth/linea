import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConsumeCreditsQuery, CreditsBalanceQuery } from "@/convex/query.config"
import { chargedGeneration, checkCredits } from "./credits"

// The real queries call Convex with the signed-in user's token
vi.mock("@/convex/query.config", () => ({
    ConsumeCreditsQuery: vi.fn(),
    CreditsBalanceQuery: vi.fn(),
}))

type Balance = Awaited<ReturnType<typeof CreditsBalanceQuery>>
type Consumed = Awaited<ReturnType<typeof ConsumeCreditsQuery>>

const balanceIs = (result: { ok: boolean; balance?: unknown }) =>
    vi.mocked(CreditsBalanceQuery).mockResolvedValue(result as Balance)
const consumeReturns = (result: { ok: boolean; balance?: number }) =>
    vi.mocked(ConsumeCreditsQuery).mockResolvedValue(result as Consumed)

async function* textStream(...chunks: string[]) {
    for (const chunk of chunks) yield chunk
}

// Like the AI SDK's text stream when the request is aborted before any output
async function* abortedStream(): AsyncGenerator<string> {
    throw new DOMException("The operation was aborted", "AbortError")
}

const request = () => new Request("http://localhost/api/generate", { method: "POST" })

beforeEach(() => {
    vi.clearAllMocks()
    // Failed generations are logged; keep the test output quiet
    vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("checkCredits", () => {
    it("allows a caller who can afford the cost", async () => {
        balanceIs({ ok: true, balance: 4 })
        expect(await checkCredits(4)).toBeNull()
    })

    it("refuses a caller who can't afford the cost with 402", async () => {
        balanceIs({ ok: true, balance: 3 })
        expect((await checkCredits(4))?.status).toBe(402)
    })

    it("refuses signed-out callers with 401", async () => {
        balanceIs({ ok: false, balance: 0 })
        expect((await checkCredits(1))?.status).toBe(401)
    })

    it("refuses when the balance isn't a number", async () => {
        balanceIs({ ok: true, balance: null })
        expect((await checkCredits(1))?.status).toBe(402)
    })
})

describe("chargedGeneration", () => {
    it("streams the whole design and charges the cost once", async () => {
        consumeReturns({ ok: true, balance: 0 })
        const generation = chargedGeneration(request(), 4)

        const response = await generation.respond(textStream("<div>", "Hello", "</div>"))

        expect(response.status).toBe(200)
        expect(await response.text()).toBe("<div>Hello</div>")
        expect(ConsumeCreditsQuery).toHaveBeenCalledTimes(1)
        expect(ConsumeCreditsQuery).toHaveBeenCalledWith({ amount: 4 })
    })

    it("charges nothing when the model returns no output", async () => {
        const generation = chargedGeneration(request(), 4)

        const response = await generation.respond(textStream())

        expect(response.status).toBe(502)
        expect(ConsumeCreditsQuery).not.toHaveBeenCalled()
    })

    it("charges nothing when the stream fails before any output", async () => {
        const generation = chargedGeneration(request(), 4)

        const response = await generation.respond(abortedStream())

        expect(response.status).toBe(502)
        expect(ConsumeCreditsQuery).not.toHaveBeenCalled()
    })

    it("stops the model and refuses with 402 when the charge fails", async () => {
        consumeReturns({ ok: false })
        const generation = chargedGeneration(request(), 4)

        const response = await generation.respond(textStream("<div>", "</div>"))

        expect(response.status).toBe(402)
        expect(generation.abortSignal.aborted).toBe(true)
    })

    it("stops the model when the client cancels, and keeps the charge", async () => {
        consumeReturns({ ok: true, balance: 0 })
        const generation = chargedGeneration(request(), 4)

        const response = await generation.respond(textStream("<div>", "Hello", "</div>"))
        await response.body!.cancel()

        expect(generation.abortSignal.aborted).toBe(true)
        expect(ConsumeCreditsQuery).toHaveBeenCalledTimes(1)
    })

    it("stops the model when the request is aborted", () => {
        const controller = new AbortController()
        const generation = chargedGeneration(new Request("http://localhost/api/generate", { method: "POST", signal: controller.signal }), 4)

        controller.abort()

        expect(generation.abortSignal.aborted).toBe(true)
    })
})
