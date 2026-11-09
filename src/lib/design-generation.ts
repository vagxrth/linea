import { streamText, type LanguageModel, type UserContent } from "ai"
import { DESIGN_MAX_OUTPUT_TOKENS, DESIGN_PROVIDER_OPTIONS, DESIGN_TEMPERATURE, designPrompt, type DesignRequest } from "./design-request"
import { REPLACEMENT_MARK } from "./design-stream"
import { errorCount, issueSummary, repairProblems, validate, type Issue, type ValidationContext } from "./design-validator"
import { elementsOf, parseHtml } from "./html-tree"
import { designHtmlForPrompt, resolveDesignImages } from "./image-manifest"
import type { OutlineNode } from "./wireframe-outline"

// How a design is generated, for every generate route and for scripts/eval-generation.ts: one model
// call streamed out as it's written, then the check (src/lib/design-validator.ts) on the finished
// design. When the check finds errors and the client can take a replacement, one repair call asks the
// model to fix just those, and the repaired design replaces the first only if it has fewer errors.
// Never more than one repair. Nothing here touches Convex: the routes charge for the design around it
// (src/lib/generation.ts), once, however many calls it took.

// Thrown when the model stopped before the design was finished
export class IncompleteDesignError extends Error {
    constructor(readonly finishReason: string) {
        super(`The model stopped before the design was finished (${finishReason})`)
        this.name = 'IncompleteDesignError'
    }
}

// An attachment that follows the request's text
export type DesignAttachment = Exclude<UserContent, string>[number]

// One model call, as it finished
export type AttemptReport = { mode: DesignRequest["mode"]; attempt: 1 | 2; finishReason: string; usage?: unknown; ms: number }

// What the check found, and what came of the repair: not checked (the check threw on the first
// design), not needed (no errors), not sent (the client can't take a replacement), kept, discarded (it
// wasn't better, or it dropped part of the page) or failed (it stopped, the user left, or checking it threw)
export type CheckReport = {
    mode: DesignRequest["mode"]
    before: Issue[]
    after: Issue[] | null
    repair: "not-checked" | "not-needed" | "not-sent" | "kept" | "discarded" | "failed"
    // Why a repair was discarded
    discarded?: "no fewer errors" | "dropped content"
}

export type GenerateDesignOptions = {
    model: LanguageModel
    design: Exclude<DesignRequest, { mode: "repair" }>
    // Images after the request's text: the wireframe first, when there is one, then the manifest's
    attachments: DesignAttachment[]
    abortSignal?: AbortSignal
    onError?: (event: { error: unknown }) => void
    // Whether a repaired design may follow the first: the client reads replacements
    repair: boolean
    // The SDK's retries of a failed call; the eval sets 0, so its cap counts real calls
    maxRetries?: number
    onAttempt?: (report: AttemptReport) => void
    onCheck?: (report: CheckReport) => void
}

// --- What the check needs to know about the request ----------------------------------------------

// The words written on the wireframe, as the user wrote them
const copyText = (nodes: OutlineNode[]): string[] => nodes.flatMap((node) => [...(node.text ? [node.text] : []), ...copyText(node.children ?? [])])

// A request that asks for a color, which may be one the contract doesn't have
const ASKS_FOR_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(|\b(?:colou?rs?|tints?|shades?|hues?|palette|darker|lighter|brighter|pastel|red|orange|amber|yellow|lime|green|emerald|teal|cyan|blue|indigo|violet|purple|fuchsia|pink|rose|brown|beige|cream|ivory|gold|golden|silver|gr[ae]y|black|white|navy|maroon|olive|sage|mint|coral|salmon|peach|lavender|lilac|mauve|tan|khaki|charcoal|slate|sand|terracotta|burgundy|turquoise|aqua|magenta|crimson|scarlet|ochre|mustard|plum|jade)\b/i

// The design's frame is as wide as the wireframe's, and at least 400px (src/hooks/use-canvas.ts)
const frameWidth = (outline: { frame: { width: number } } | null | undefined) => (outline ? Math.max(400, outline.frame.width) : undefined)

export const validationContextFor = (design: DesignRequest): ValidationContext => {
    switch (design.mode) {
        case "initial":
            return { mode: "initial", suppliedText: [...(design.outline ? copyText(design.outline.nodes) : []), ...(design.legacyOutline ? [design.legacyOutline] : [])].join("\n"), width: frameWidth(design.outline) }
        case "refine":
            return {
                mode: "refine",
                suppliedText: [design.message, ...(design.outline ? copyText(design.outline.nodes) : [])].join("\n"),
                previousHtml: design.currentHtml,
                colorRequested: ASKS_FOR_COLOR.test(design.message),
                width: frameWidth(design.outline),
            }
        case "workflow":
            return { mode: "workflow", previousHtml: design.mainHtml }
        case "repair":
            return {}
    }
}

// --- Model calls -------------------------------------------------------------------------------

// One call: the design's text with its images resolved as it streams, and a promise that settles
// once the model says how it finished, rejecting when it didn't finish
const callModel = (options: GenerateDesignOptions, request: DesignRequest, attachments: DesignAttachment[], attempt: 1 | 2) => {
    const startedAt = Date.now()
    const { system, text } = designPrompt(request)
    const result = streamText({
        model: options.model,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text }, ...attachments] }],
        temperature: DESIGN_TEMPERATURE,
        maxOutputTokens: DESIGN_MAX_OUTPUT_TOKENS,
        providerOptions: DESIGN_PROVIDER_OPTIONS,
        abortSignal: options.abortSignal,
        onError: options.onError,
        ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
    })
    // Every call leaves a line, how it finished and the tokens it took
    const report = (finishReason: string, usage?: unknown) => {
        const line: AttemptReport = { mode: request.mode, attempt, finishReason, ...(usage ? { usage } : {}), ms: Date.now() - startedAt }
        console.info(`[design] ${JSON.stringify(line)}`)
        options.onAttempt?.(line)
    }
    const finished = (async () => {
        let finishReason: string
        try {
            finishReason = await result.finishReason
        } catch (error) {
            // No output at all (a refused key, say)
            report('no-output')
            throw error
        }
        report(finishReason, await result.totalUsage.catch(() => undefined))
        if (finishReason !== 'stop') throw new IncompleteDesignError(finishReason)
    })()
    // The caller reports a failure; this only keeps one nobody reads (an aborted request's) quiet
    finished.catch(() => {})
    const placeholderColors = { fill: request.contract.colors.muted, ink: request.contract.colors.mutedForeground }
    return { chunks: resolveDesignImages(result.textStream, request.manifest, placeholderColors), finished }
}

// A repair keeps at least this share of the first design's length
export const MIN_REPAIR_LENGTH = 0.85

// Every id and data-node a design has: what the page is built of, which a repair has no reason to drop
const landmarks = (html: string) => {
    const found = new Set<string>()
    for (const node of elementsOf(parseHtml(html))) {
        const id = node.attributes.get("id")
        const built = node.attributes.get("data-node")
        if (id) found.add(`id=${id}`)
        if (built) found.add(`data-node=${built}`)
    }
    return found
}

// Whether a repair kept the whole page: wrapped like the first, at least 85% of its length, and with
// every id and data-node it had. A repair only fixes things, so fewer errors can't come from dropping
// a section. Lengths are compared with runs of whitespace as one space, so re-indenting isn't dropping.
export const keepsContent = (repaired: string, first: string) => {
    const [after, before] = [repaired, first].map((html) => html.replace(/\s+/g, " ").trim())
    const wrapped = (html: string) => /^<div\b[^>]*\bdata-generated-ui\b/i.test(html)
    if (!after.startsWith("<") || !after.endsWith(">") || (wrapped(before) && !wrapped(after))) return false
    if (after.length < before.length * MIN_REPAIR_LENGTH) return false
    const kept = landmarks(after)
    return [...landmarks(before)].every((landmark) => kept.has(landmark))
}

// The check's issues, or null when it threw: then there's no repair and the first design stands
const checked = (html: string, design: GenerateDesignOptions["design"], context: ValidationContext): Issue[] | null => {
    try {
        return validate(html, design.contract, context)
    } catch (error) {
        console.warn('[design-check] The check failed, so the design goes out as it is:', error)
        return null
    }
}

// --- Generating a design -----------------------------------------------------------------------

// The design as it streams, then, when a repair beat it, REPLACEMENT_MARK and the repaired design.
// Throws IncompleteDesignError when the first call didn't finish; a repair that doesn't finish only
// leaves the first design as it is.
export async function* generateDesign(options: GenerateDesignOptions): AsyncGenerator<string, void> {
    const { design } = options
    const first = callModel(options, design, options.attachments, 1)
    let html = ''
    for await (const chunk of first.chunks) {
        html += chunk
        yield chunk
    }
    await first.finished
    if (!html.trim()) return

    const context = validationContextFor(design)
    const before = checked(html, design, context)
    if (!before) {
        console.info(`[design-check] ${JSON.stringify({ mode: design.mode, repair: 'not-checked' })}`)
        options.onCheck?.({ mode: design.mode, before: [], after: null, repair: 'not-checked' })
        return
    }
    // Counts only: the log holds none of the page's words
    const report = (after: Issue[] | null, repair: CheckReport["repair"], discarded?: CheckReport["discarded"]) => {
        console.info(`[design-check] ${JSON.stringify({ mode: design.mode, ...issueSummary(before), ...(after ? { after: issueSummary(after) } : {}), repair, ...(discarded ? { discarded } : {}) })}`)
        options.onCheck?.({ mode: design.mode, before, after, repair, ...(discarded ? { discarded } : {}) })
    }
    if (errorCount(before) === 0) return report(null, 'not-needed')
    if (!options.repair) return report(null, 'not-sent')

    // The first design is whole: the client keeps it unless a better one follows
    yield REPLACEMENT_MARK
    try {
        const repair = callModel(options, {
            mode: 'repair',
            contract: design.contract,
            manifest: design.manifest,
            html: designHtmlForPrompt(html, design.manifest),
            problems: repairProblems(before),
        }, [], 2)
        let repaired = ''
        for await (const chunk of repair.chunks) repaired += chunk
        await repair.finished
        if (options.abortSignal?.aborted) return report(null, 'failed')
        const after = checked(repaired, design, context)
        if (!after) return report(null, 'failed')
        if (errorCount(after) >= errorCount(before)) return report(after, 'discarded', 'no fewer errors')
        if (!keepsContent(repaired, html)) return report(after, 'discarded', 'dropped content')
        report(after, 'kept')
        yield repaired
    } catch (error) {
        if (!options.abortSignal?.aborted) console.warn('[design-check] The repair call failed:', error)
        report(null, 'failed')
    }
}
