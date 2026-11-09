// How a design comes back from the generate routes. The response body is the design's HTML as the
// model writes it. When the server's check finds problems in a finished design, it sends REPLACEMENT_MARK
// and, once its one repair call has made something better, the whole repaired design after it. A
// client says it reads replacements with DESIGN_STREAM_HEADERS; one that doesn't (a tab opened before
// they existed) never gets one, so it can't end up with two pages in one.

// U+001E, the record separator: never in a design, and one character, so no chunk can split it
export const REPLACEMENT_MARK = "\u001e"

export const DESIGN_STREAM_HEADER = "X-Linea-Design-Stream"
export const DESIGN_STREAM_HEADERS = { [DESIGN_STREAM_HEADER]: "replace" } as const

// Whether the client that sent `request` reads replacements
export const acceptsReplacement = (request: Request) => request.headers.get(DESIGN_STREAM_HEADER) === "replace"

// The design a whole response holds: the replacement when one came, else the design before the mark
export const finalDesign = (text: string) => {
    const mark = text.indexOf(REPLACEMENT_MARK)
    if (mark === -1) return text
    const replacement = text.slice(mark + 1)
    return replacement.trim() ? replacement : text.slice(0, mark)
}

// Reads a streamed design to its end. It resolves with the whole HTML only when the design is whole:
// the server breaks the stream off when the model stopped before finishing (out of tokens, or an
// error), and a dropped connection breaks it too, so the promise rejects then, and a caller that waits
// for it never keeps a half-written design. Once the mark has come, the first design was whole, so a
// break after it keeps that one.
//
// onProgress gets the HTML so far as it arrives, for showing a new design while it's written. After
// the mark it isn't called again: the design on screen stays until the replacement, if any, is whole.
// onRepairing is called when the mark arrives, while the server works on a repaired version.
export const readDesignStream = async (
    response: Response,
    onProgress?: (html: string) => void,
    onRepairing?: () => void
): Promise<string> => {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('The design arrived without a body')
    const decoder = new TextDecoder()
    let text = ''
    let marked = false
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) {
                // The last read flushes a character split across the final chunks
                text += decoder.decode()
                break
            }
            text += decoder.decode(value, { stream: true })
            if (!marked && text.includes(REPLACEMENT_MARK)) {
                marked = true
                onProgress?.(text.slice(0, text.indexOf(REPLACEMENT_MARK)))
                onRepairing?.()
            } else if (!marked) {
                onProgress?.(text)
            }
        }
    } catch (error) {
        const first = marked ? text.slice(0, text.indexOf(REPLACEMENT_MARK)) : ''
        if (first.trim()) return first
        throw error
    } finally {
        reader.releaseLock()
    }
    const html = finalDesign(text)
    if (!html.trim()) throw new Error('The design came back empty')
    return html
}

// What the user is told when a design stops before it's finished
export const INCOMPLETE_DESIGN_MESSAGE = 'The design stopped before it was finished, so it wasn\'t kept. Try again.'
export const INCOMPLETE_REFINE_MESSAGE = 'The new version stopped before it was finished, so your design wasn\'t changed. Try again.'
