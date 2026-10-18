import { NextResponse } from "next/server"
import { ConsumeCreditsQuery, CreditsBalanceQuery } from "@/convex/query.config"

const HTML_STREAM_HEADERS = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
}

export const notEnoughCredits = () =>
    NextResponse.json({ error: 'Not enough credits' }, { status: 402 })

// Returns an error response when the caller can't afford `cost`, or null when they can
export const checkCredits = async (cost: number): Promise<Response | null> => {
    const { ok, balance } = await CreditsBalanceQuery()
    if (!ok) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    if (typeof balance !== 'number' || balance < cost) return notEnoughCredits()
    return null
}

// Credits are charged only once the model has produced its first chunk, so rejected requests
// and model failures cost nothing. After output starts the charge stands: refunding a stream the
// client cancelled would let anyone stop just before the end and keep the design for free.
export const chargedGeneration = (request: Request, cost: number) => {
    const controller = new AbortController()

    return {
        abortSignal: AbortSignal.any([request.signal, controller.signal]),
        onError: ({ error }: { error: unknown }) => console.error('Generation failed:', error),
        respond: async (textStream: AsyncIterable<string>): Promise<Response> => {
            const chunks = textStream[Symbol.asyncIterator]()
            // Model errors normally end the stream quietly (and reach onError), but an abort is thrown
            let first: IteratorResult<string>
            try {
                first = await chunks.next()
            } catch (error) {
                console.error('Generation failed:', error)
                first = { done: true, value: undefined }
            }
            if (first.done) {
                return NextResponse.json(
                    { error: 'Generation failed', details: 'The model returned no output. No credits were used.' },
                    { status: 502 }
                )
            }

            const { ok } = await ConsumeCreditsQuery({ amount: cost })
            if (!ok) {
                controller.abort()
                return notEnoughCredits()
            }

            const encoder = new TextEncoder()
            const stream = new ReadableStream<Uint8Array>({
                start(streamController) {
                    streamController.enqueue(encoder.encode(first.value))
                },
                async pull(streamController) {
                    try {
                        const next = await chunks.next()
                        if (next.done) streamController.close()
                        else streamController.enqueue(encoder.encode(next.value))
                    } catch (error) {
                        streamController.error(error)
                    }
                },
                cancel() {
                    controller.abort()
                },
            })

            return new Response(stream, { headers: HTML_STREAM_HEADERS })
        },
    }
}
