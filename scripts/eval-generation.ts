// Snapshots the design generator's contracts and prompts for three fixtures (a landing page, a dense
// dashboard and a settings form), and optionally runs them against the model.
//
//   npm run eval:generation                 Dry run, the default: no model calls and no network. Prints
//                                           each fixture's design contract and its prompt.
//   npm run eval:generation -- --live       Runs the fixtures through the app's own generation
//                                           (src/lib/design-generation.ts: streaming, the incomplete-
//                                           design check, the validator and its one repair call) with
//                                           EVAL_GOOGLE_API_KEY, which must be set and must not be the
//                                           app's key. Initial, refine and workflow rounds: a design is
//                                           one model call, or two with its repair, and the SDK retries
//                                           nothing, so the cap counts real calls. Every call is logged
//                                           with its route, fixture, run, attempt and finish reason, and
//                                           every design with the validator's issues before and after.
//   --cap <n>                               With --live: the most model calls it makes, 9 unless set, at
//                                           most 30. The planned count is printed before any call. A
//                                           design that wouldn't fit is skipped, and one whose repair
//                                           wouldn't fit is checked without a repair.
//   --repeat <n>                            With --live: the rounds n times over (1-5), within the same
//                                           cap, to see how much the same fixture varies run to run.
//   --out <dir>                             Also writes the snapshots, and a live run's designs, there.
//
// It never touches Convex: no projects, no credits, no billing. Live runs send the outline without a
// wireframe picture and list the fixture images without attaching them, since the fixtures have none.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { buildDesignContract, contractCorrections, type DesignContract } from "@/lib/design-contract"
import { generateDesign, IncompleteDesignError, type AttemptReport, type CheckReport } from "@/lib/design-generation"
import {
    DESIGN_MAX_OUTPUT_TOKENS,
    DESIGN_MODEL_ID,
    DESIGN_TEMPERATURE,
    DESIGN_THINKING_BUDGET,
    designPrompt,
    WORKFLOW_PAGE_TYPES,
    type DesignRequest,
} from "@/lib/design-request"
import { finalDesign, REPLACEMENT_MARK } from "@/lib/design-stream"
import { errorCount, issueSummary, type Issue } from "@/lib/design-validator"
import { buildImageManifest, designHtmlForPrompt, type ImageManifest } from "@/lib/image-manifest"
import { outlineImageSlots, truncateOutline } from "@/lib/wireframe-outline"
import { EVAL_FIXTURES, type EvalFixture } from "./eval-fixtures"

// A design is at most two calls: the design, and one repair when the check finds errors
const CALLS_PER_DESIGN = 2
const MAX_REPEAT = 5
// The most model calls a live run makes, unless --cap says otherwise, and the most --cap allows
const DEFAULT_CAP = 9
const MAX_CAP = 30

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

// What the validator doesn't check, read off the HTML the way a reviewer would, without judging taste
const review = (html: string, request: DesignRequest, previous?: string) => {
    const style = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html)?.[1] ?? ""
    const colorClasses = ["c-bg", "c-fg", "c-card-bg", "c-card-fg", "c-primary-bg", "c-primary-fg", "c-secondary-bg", "c-secondary-fg", "c-muted-bg", "c-muted-fg", "c-accent-bg", "c-accent-fg", "c-border"]
    const typeClasses = ["t-h1", "t-h2", "t-h3", "t-body", "t-small", "t-button", "t-label"]
    const visible = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    const ids = (markup: string) => new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]))
    const nodes = request.mode === "initial" && request.outline ? request.outline.nodes.flatMap(function all(node): string[] { return [node.id, ...(node.children ?? []).flatMap(all)] }) : []
    const marked = new Set([...html.matchAll(/data-node="([^"]+)"/g)].map((match) => match[1]))
    const kept = previous ? [...ids(previous)].filter((id) => ids(html).has(id)).length : 0
    return {
        wrapped: /^\s*<div data-generated-ui/.test(html) && /<\/div>\s*$/.test(html),
        missingColorClasses: colorClasses.filter((name) => !style.includes(`.${name}`)),
        missingTypeClasses: typeClasses.filter((name) => !style.includes(`.${name}`)),
        viewportUnits: (html.match(/\b(?:min-)?[hw]-screen\b|\d+(?:\.\d+)?v[hw]\b/g) ?? []).length,
        exclamations: (visible.match(/!/g) ?? []).length,
        imagePlaceholders: (html.match(/data-placeholder=/g) ?? []).length,
        ...(nodes.length ? { outlineNodesMarked: `${nodes.filter((id) => marked.has(id)).length}/${nodes.length}` } : {}),
        ...(previous ? { idsKept: `${kept}/${ids(previous).size}` } : {}),
    }
}

type Outcome = {
    design: string
    route: string
    run: number
    calls: number
    // Errors in the first design, and in the one kept; null when the design didn't finish
    errorsBefore: number | null
    errorsAfter: number | null
    repair: CheckReport["repair"] | "incomplete" | "skipped"
}

const issueLines = (title: string, issues: Issue[]) =>
    issues.length === 0 ? [`  ${title}: no issues`] : [`  ${title}:`, ...issues.map((issue) => `    [${issue.severity}] ${issue.kind}${issue.count > 1 ? ` ×${issue.count}` : ""}: ${issue.message}`)]

const live = async (prepared: Prepared[], out: string | null, repeat: number, cap: number) => {
    const key = process.env.EVAL_GOOGLE_API_KEY
    if (!key) {
        console.error("--live needs EVAL_GOOGLE_API_KEY: a Gemini API key of its own, not the app's.")
        return 2
    }
    if (appKeys().has(key)) {
        console.error("EVAL_GOOGLE_API_KEY is the app's GOOGLE_GENERATIVE_AI_API_KEY. Use a separate key for evals.")
        return 2
    }
    // Initial and refine for each fixture, and three workflow pages from the first, before any call
    const designsPerRun = prepared.length * 2 + 3
    const designs = designsPerRun * repeat
    console.log(rule("Live run"))
    console.log(
        `Planned: ${designs} designs (${designsPerRun} a run × ${repeat} run${repeat === 1 ? "" : "s"}), one model call each or ${CALLS_PER_DESIGN} with a repair: ` +
        `${designs} to ${designs * CALLS_PER_DESIGN} calls. Cap: ${cap}, so at most ${Math.min(cap, designs * CALLS_PER_DESIGN)} calls are made` +
        `${designs * CALLS_PER_DESIGN > cap ? "; designs past the cap are skipped, and a repair that wouldn't fit isn't made" : ""}.`
    )

    // Only a live run loads the Google provider. A dry run loads the app's generation code too, and calls nothing.
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google")

    // Every HTTP request the SDK makes passes through here; it retries nothing, so each is one call,
    // across every run, and none goes past the cap
    let calls = 0
    const cappedFetch: typeof fetch = async (input, init) => {
        if (calls >= cap) throw new Error(`The eval's cap of ${cap} model calls is reached`)
        calls++
        return fetch(input, init)
    }
    const model = createGoogleGenerativeAI({ apiKey: key, fetch: cappedFetch })(DESIGN_MODEL_ID)
    const directory = out ?? path.join(process.cwd(), ".eval-output", new Date().toISOString().replace(/[:.]/g, "-"))
    mkdirSync(directory, { recursive: true })

    const outcomes: Outcome[] = []
    // One design through the app's generation, as the route named would make it
    const run = async (number: number, route: string, fixture: string, label: string, request: Exclude<DesignRequest, { mode: "repair" }>, previous?: string) => {
        const name = `${label}${repeat > 1 ? `-run${number}` : ""}`.replace(/\s+/g, "-")
        // Within the cap: no design that can't have its first call, no repair that can't have its own
        if (calls >= cap) {
            console.log(JSON.stringify({ design: name, route, skipped: `the cap of ${cap} calls is reached` }))
            outcomes.push({ design: label, route, run: number, calls: 0, errorsBefore: null, errorsAfter: null, repair: "skipped" })
            return null
        }
        const repairFits = calls + CALLS_PER_DESIGN <= cap
        const attempts: AttemptReport[] = []
        let check: CheckReport | null = null
        let text = ""
        try {
            for await (const chunk of generateDesign({
                model,
                design: request,
                attachments: [],
                repair: repairFits,
                maxRetries: 0,
                onAttempt: (report) => {
                    attempts.push(report)
                    console.log(JSON.stringify({ call: calls, route, fixture, run: number, attempt: report.attempt, mode: report.mode, finishReason: report.finishReason, ms: report.ms, usage: report.usage }))
                },
                onCheck: (report) => {
                    check = report
                },
            })) {
                text += chunk
            }
        } catch (error) {
            const reason = error instanceof IncompleteDesignError ? `incomplete (${error.finishReason})` : error instanceof Error ? error.message : String(error)
            console.log(JSON.stringify({ design: name, route, error: reason, calls: attempts.length }))
            outcomes.push({ design: label, route, run: number, calls: attempts.length, errorsBefore: null, errorsAfter: null, repair: "incomplete" })
            return null
        }
        const first = text.split(REPLACEMENT_MARK)[0]
        const html = finalDesign(text)
        writeFileSync(path.join(directory, `${name}.html`), html)
        if (html !== first) writeFileSync(path.join(directory, `${name}.first.html`), first)
        const result = check as CheckReport | null
        const before = result?.before ?? []
        const after = result?.repair === "kept" ? result.after ?? [] : before
        outcomes.push({ design: label, route, run: number, calls: attempts.length, errorsBefore: errorCount(before), errorsAfter: errorCount(after), repair: result?.repair ?? "not-needed" })
        const repair = result?.repair === "not-sent" && !repairFits ? "not-made (cap)" : result?.repair
        console.log(JSON.stringify({ design: name, route, calls: attempts.length, characters: html.length, check: issueSummary(before), repair, ...(result?.discarded ? { discarded: result.discarded } : {}), ...(result?.after ? { afterRepair: issueSummary(result.after) } : {}), ...review(html, request, previous) }))
        for (const line of issueLines("Issues in the first design", before)) console.log(line)
        if (result?.after) for (const line of issueLines(`Issues in the repair (${result.repair})`, result.after)) console.log(line)
        return html
    }

    // The app logs a [design] line for every call; the lines above say which design each was for
    const appInfo = console.info
    console.info = () => {}
    try {
        for (let number = 1; number <= repeat; number++) {
            if (repeat > 1) console.log(rule(`Run ${number} of ${repeat}`))
            const initial: (string | null)[] = []
            for (const item of prepared) {
                initial.push(await run(number, "/api/generate", item.fixture.name, `${item.fixture.name}-initial`, { ...item.initial, hasWireframe: false, imagesAttached: false }))
            }
            for (const [index, item] of prepared.entries()) {
                const html = initial[index]
                if (!html) continue
                await run(number, "/api/generate/redesign", item.fixture.name, `${item.fixture.name}-refine`, {
                    mode: "refine", contract: item.contract, manifest: item.manifest, message: item.fixture.refine,
                    currentHtml: designHtmlForPrompt(html, item.manifest), outline: item.initial.outline, hasWireframe: false, imagesAttached: false,
                }, html)
            }
            const main = prepared[0]
            if (initial[0]) {
                for (const pageType of WORKFLOW_PAGE_TYPES.slice(0, 3)) {
                    await run(number, "/api/generate/workflow", main.fixture.name, `workflow-${pageType.split(":")[0].toLowerCase()}`, { mode: "workflow", contract: main.contract, manifest: main.manifest, pageType, mainHtml: designHtmlForPrompt(initial[0], main.manifest), imagesAttached: false })
                }
            }
        }
    } finally {
        console.info = appInfo
    }

    console.log(rule("Validator issues, by run"))
    for (let number = 1; number <= repeat; number++) {
        const ofRun = outcomes.filter((outcome) => outcome.run === number)
        const finished = ofRun.filter((outcome) => outcome.errorsBefore !== null)
        const skipped = ofRun.filter((outcome) => outcome.repair === "skipped").length
        const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0)
        const repairs = ["kept", "discarded", "failed"].map((kind) => `${ofRun.filter((outcome) => outcome.repair === kind).length} ${kind}`).join(", ")
        console.log(`Run ${number}: ${finished.length}/${ofRun.length} designs finished${skipped ? ` (${skipped} skipped at the cap)` : ""}; errors ${sum(finished.map((outcome) => outcome.errorsBefore))} before repair, ${sum(finished.map((outcome) => outcome.errorsAfter))} after; repairs ${repairs}; ${sum(ofRun.map((outcome) => outcome.calls))} calls`)
    }
    if (repeat > 1) {
        console.log("\nErrors before → after repair, run by run, for each design:")
        for (const label of [...new Set(outcomes.map((outcome) => outcome.design))]) {
            const runs = outcomes.filter((outcome) => outcome.design === label).map((outcome) => (outcome.errorsBefore === null ? outcome.repair : `${outcome.errorsBefore}→${outcome.errorsAfter}`))
            console.log(`  ${label}: ${runs.join(", ")}`)
        }
    }
    console.log(`\n${calls} model call${calls === 1 ? "" : "s"} made (cap ${cap}). Designs are in ${directory}.`)
    return 0
}

// --- Entry point --------------------------------------------------------------------------------

export const main = async (args: string[]) => {
    const isLive = args.includes("--live")
    const out = option(args, "--out")
    const repeatOption = option(args, "--repeat")
    const repeat = repeatOption === null ? 1 : Number(repeatOption)
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT) {
        console.error(`--repeat takes a whole number from 1 to ${MAX_REPEAT}.`)
        return 2
    }
    const capOption = option(args, "--cap")
    const cap = capOption === null ? DEFAULT_CAP : Number(capOption)
    if (!Number.isInteger(cap) || cap < 1 || cap > MAX_CAP) {
        console.error(`--cap takes a whole number of model calls from 1 to ${MAX_CAP}.`)
        return 2
    }
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
        console.log(`\nDry run: no model calls were made. Add --live (with EVAL_GOOGLE_API_KEY) to run the fixtures against the model: at most ${DEFAULT_CAP} calls, or --cap <n> up to ${MAX_CAP}, and --repeat <n> to run them n times.`)
        return 0
    }
    return live(prepared, out, repeat, cap)
}
