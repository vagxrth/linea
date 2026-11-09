// Snapshots the design generator's contracts and prompts for three fixtures (a landing page, a dense
// dashboard and a settings form), and optionally runs them against the model.
//
//   npm run eval:generation                 Dry run, the default: no model calls and no network. Prints
//                                           each fixture's design contract and its prompt.
//   npm run eval:generation -- --live       Calls the model with EVAL_GOOGLE_API_KEY, which must be set
//                                           and must not be the app's key: initial, refine and workflow
//                                           rounds, at most 9 HTTP calls with every retry counted.
//   --out <dir>                             Also writes the snapshots, and a live run's designs, there.
//
// It never touches Convex: no projects, no credits, no billing. Live runs send the outline without a
// wireframe picture and list the fixture images without attaching them, since the fixtures have none.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { buildDesignContract, contractCorrections, type DesignContract } from "@/lib/design-contract"
import {
    DESIGN_MAX_OUTPUT_TOKENS,
    DESIGN_MODEL_ID,
    DESIGN_PROVIDER_OPTIONS,
    DESIGN_TEMPERATURE,
    DESIGN_THINKING_BUDGET,
    designPrompt,
    WORKFLOW_PAGE_TYPES,
    type DesignRequest,
} from "@/lib/design-request"
import { buildImageManifest, designHtmlForPrompt, resolveDesignHtml, type ImageManifest } from "@/lib/image-manifest"
import { outlineImageSlots, truncateOutline } from "@/lib/wireframe-outline"
import { BANNED_COPY_WORDS } from "@/prompts"
import { EVAL_FIXTURES, type EvalFixture } from "./eval-fixtures"

const MAX_LIVE_CALLS = 9

type InitialRequest = Extract<DesignRequest, { mode: "initial" }>

type Prepared = { fixture: EvalFixture; contract: DesignContract; manifest: ImageManifest; initial: InitialRequest }

const prepare = (fixture: EvalFixture): Prepared => {
    const contract = buildDesignContract(fixture.guide)
    const outline = truncateOutline(fixture.outline)
    const manifest = buildImageManifest(fixture.images, outlineImageSlots(outline))
    return { fixture, contract, manifest, initial: { mode: "initial", contract, manifest, outline, hasWireframe: true } }
}

const rule = (title: string) => `\n${"=".repeat(8)} ${title} ${"=".repeat(Math.max(4, 92 - title.length))}\n`

const snapshot = ({ fixture, contract, initial }: Prepared, index: number) => {
    const { system, text } = designPrompt(initial)
    return [
        rule(`Fixture ${index + 1}/${EVAL_FIXTURES.length}: ${fixture.name} (initial design)`),
        `Settings: ${DESIGN_MODEL_ID}, temperature ${DESIGN_TEMPERATURE}, at most ${DESIGN_MAX_OUTPUT_TOKENS} output tokens with thinking capped at ${DESIGN_THINKING_BUDGET}`,
        `--- Design contract (version ${contract.version}) ---`,
        JSON.stringify(contract, null, 2),
        `\n--- System instructions (${system.length} characters) ---`,
        system,
        `\n--- Request text (${text.length} characters) ---`,
        text,
    ].join("\n")
}

const option = (args: string[], name: string) => {
    const at = args.indexOf(name)
    return at === -1 ? null : args[at + 1] ?? null
}

// --- Live runs ----------------------------------------------------------------------------------

// The app's own key, from the environment or the env files `next` reads, to make sure the eval
// never runs on it. The values are compared, never printed.
const appKeys = () => {
    const keys = new Set<string>()
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) keys.add(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    for (const file of [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local"]) {
        if (!existsSync(file)) continue
        const match = /^\s*GOOGLE_GENERATIVE_AI_API_KEY\s*=\s*["']?([^"'\s#]+)/m.exec(readFileSync(file, "utf8"))
        if (match) keys.add(match[1])
    }
    return keys
}

// Checks a design the way a reviewer would, without judging taste
const review = (html: string, request: DesignRequest, previous?: string) => {
    const style = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html)?.[1] ?? ""
    const colorClasses = ["c-bg", "c-fg", "c-card-bg", "c-card-fg", "c-primary-bg", "c-primary-fg", "c-secondary-bg", "c-secondary-fg", "c-muted-bg", "c-muted-fg", "c-accent-bg", "c-accent-fg", "c-border"]
    const typeClasses = ["t-h1", "t-h2", "t-h3", "t-body", "t-small", "t-button", "t-label"]
    const visible = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    const banned = BANNED_COPY_WORDS.map((word) => word.replace(/ \(.*\)$/, "")).filter((word) => new RegExp(`\\b${word}`, "i").test(visible))
    const ids = (markup: string) => new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]))
    const nodes = request.mode === "initial" && request.outline ? request.outline.nodes.flatMap(function all(node): string[] { return [node.id, ...(node.children ?? []).flatMap(all)] }) : []
    const marked = new Set([...html.matchAll(/data-node="([^"]+)"/g)].map((match) => match[1]))
    const kept = previous ? [...ids(previous)].filter((id) => ids(html).has(id)).length : 0
    return {
        wrapped: /^\s*<div data-generated-ui/.test(html) && /<\/div>\s*$/.test(html),
        missingColorClasses: colorClasses.filter((name) => !style.includes(`.${name}`)),
        missingTypeClasses: typeClasses.filter((name) => !style.includes(`.${name}`)),
        contractColorsInStyle: Object.values(request.contract.colors).filter((hex) => style.toUpperCase().includes(hex)).length,
        tailwindColors: (html.match(/\b(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/g) ?? []).length,
        arbitraryColors: (html.match(/\[#[0-9a-f]{3,8}\]/gi) ?? []).length,
        viewportUnits: (html.match(/\b(?:min-)?[hw]-screen\b|\d+(?:\.\d+)?v[hw]\b/g) ?? []).length,
        bannedWords: banned,
        exclamations: (visible.match(/!/g) ?? []).length,
        placeholders: (html.match(/data-placeholder=/g) ?? []).length,
        ...(nodes.length ? { outlineNodesMarked: `${nodes.filter((id) => marked.has(id)).length}/${nodes.length}` } : {}),
        ...(previous ? { idsKept: `${kept}/${ids(previous).size}` } : {}),
    }
}

const live = async (prepared: Prepared[], out: string | null) => {
    const key = process.env.EVAL_GOOGLE_API_KEY
    if (!key) {
        console.error("--live needs EVAL_GOOGLE_API_KEY: a Gemini API key of its own, not the app's.")
        return 2
    }
    if (appKeys().has(key)) {
        console.error("EVAL_GOOGLE_API_KEY is the app's GOOGLE_GENERATIVE_AI_API_KEY. Use a separate key for evals.")
        return 2
    }
    // Loaded here so a dry run doesn't even load the SDK
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google")
    const { generateText } = await import("ai")

    // Every HTTP request the SDK makes passes through here, retries included
    let calls = 0
    const cappedFetch: typeof fetch = async (input, init) => {
        if (calls >= MAX_LIVE_CALLS) throw new Error(`The eval's cap of ${MAX_LIVE_CALLS} model calls is reached`)
        calls++
        return fetch(input, init)
    }
    const model = createGoogleGenerativeAI({ apiKey: key, fetch: cappedFetch })(DESIGN_MODEL_ID)
    const directory = out ?? path.join(process.cwd(), ".eval-output", new Date().toISOString().replace(/[:.]/g, "-"))
    mkdirSync(directory, { recursive: true })

    const run = async (label: string, request: DesignRequest, previous?: string) => {
        const { system, text } = designPrompt(request)
        const startedAt = Date.now()
        try {
            const result = await generateText({ model, system, messages: [{ role: "user", content: text }], temperature: DESIGN_TEMPERATURE, maxOutputTokens: DESIGN_MAX_OUTPUT_TOKENS, providerOptions: DESIGN_PROVIDER_OPTIONS, maxRetries: 2 })
            const placeholderColors = { fill: request.contract.colors.muted, ink: request.contract.colors.mutedForeground }
            const html = resolveDesignHtml(result.text.trim(), request.manifest, placeholderColors)
            writeFileSync(path.join(directory, `${label}.html`), html)
            const summary = { label, finishReason: result.finishReason, usage: result.totalUsage, ms: Date.now() - startedAt, characters: html.length, ...review(html, request, previous) }
            console.log(JSON.stringify(summary))
            return result.finishReason === "stop" ? html : null
        } catch (error) {
            console.log(JSON.stringify({ label, error: error instanceof Error ? error.message : String(error), callsSoFar: calls }))
            return null
        }
    }

    const initial: (string | null)[] = []
    for (const item of prepared) {
        initial.push(await run(`${item.fixture.name}-initial`.replace(/\s+/g, "-"), { ...item.initial, hasWireframe: false, imagesAttached: false }))
    }
    for (const [index, item] of prepared.entries()) {
        const html = initial[index]
        if (!html) continue
        await run(`${item.fixture.name}-refine`.replace(/\s+/g, "-"), {
            mode: "refine", contract: item.contract, manifest: item.manifest, message: item.fixture.refine,
            currentHtml: designHtmlForPrompt(html, item.manifest), outline: item.initial.outline, hasWireframe: false, imagesAttached: false,
        }, html)
    }
    const main = prepared[0]
    if (initial[0]) {
        for (const pageType of WORKFLOW_PAGE_TYPES.slice(0, 3)) {
            await run(`workflow-${pageType.split(":")[0].toLowerCase()}`, { mode: "workflow", contract: main.contract, manifest: main.manifest, pageType, mainHtml: designHtmlForPrompt(initial[0], main.manifest), imagesAttached: false })
        }
    }
    console.log(`\n${calls} model call${calls === 1 ? "" : "s"} made (cap ${MAX_LIVE_CALLS}). Designs are in ${directory}.`)
    return 0
}

// --- Entry point --------------------------------------------------------------------------------

export const main = async (args: string[]) => {
    const isLive = args.includes("--live")
    const out = option(args, "--out")
    const prepared = EVAL_FIXTURES.map(prepare)

    const snapshots = prepared.map(snapshot)
    console.log(snapshots.join("\n"))
    if (out) {
        mkdirSync(out, { recursive: true })
        prepared.forEach((item, index) => writeFileSync(path.join(out, `${item.fixture.name.replace(/\s+/g, "-")}.snapshot.txt`), snapshots[index]))
    }
    console.log(rule("Summary"))
    for (const { fixture, contract } of prepared) {
        // Once per text color, however many of its pairs failed
        const corrected = [...new Set(contractCorrections(contract).map((check) => `${check.foreground} ${check.corrected!.original}→${check.corrected!.foreground}`))]
        console.log(`${fixture.name}: ${corrected.length} contrast correction${corrected.length === 1 ? "" : "s"}${corrected.length ? ` (${corrected.join(", ")})` : ""}; ${contract.notes.length} note${contract.notes.length === 1 ? "" : "s"}`)
    }
    if (!isLive) {
        console.log("\nDry run: no model calls were made. Add --live (with EVAL_GOOGLE_API_KEY) to run the fixtures against the model.")
        return 0
    }
    return live(prepared, out)
}
