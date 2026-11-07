// Reads a streamed design to its end. It resolves with the whole HTML only when the server ended the
// stream normally. The server breaks the stream off when the model stopped before finishing (out of
// tokens, or an error), and a dropped connection breaks it too, so the promise rejects then: a
// caller that waits for it never keeps a half-written design.
//
// onProgress gets the HTML so far as it arrives, for showing a new design while it's written.
export const readDesignStream = async (response: Response, onProgress?: (html: string) => void): Promise<string> => {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('The design arrived without a body')
    const decoder = new TextDecoder()
    let html = ''
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) {
                // The last read flushes a character split across the final chunks
                html += decoder.decode()
                break
            }
            html += decoder.decode(value, { stream: true })
            onProgress?.(html)
        }
    } finally {
        reader.releaseLock()
    }
    if (!html.trim()) throw new Error('The design came back empty')
    return html
}

// What the user is told when a design stops before it's finished
export const INCOMPLETE_DESIGN_MESSAGE = 'The design stopped before it was finished, so it wasn\'t kept. Try again.'
export const INCOMPLETE_REFINE_MESSAGE = 'The new version stopped before it was finished, so your design wasn\'t changed. Try again.'
