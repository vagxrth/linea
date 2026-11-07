// Runs one of this project's TypeScript scripts with Node, through Vite (already a dev dependency), so
// it can use the same "@/" imports as the app. The script exports main(args), which returns the exit code.
//
//   node scripts/run-ts.mjs scripts/eval-generation.ts [args...]
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runnerImport } from "vite"

const [script, ...args] = process.argv.slice(2)
if (!script) {
    console.error("Usage: node scripts/run-ts.mjs <script.ts> [args...]")
    process.exit(2)
}

const root = fileURLToPath(new URL("..", import.meta.url))
const { module } = await runnerImport(path.resolve(script), {
    configFile: false,
    root,
    logLevel: "error",
    resolve: { alias: { "@": path.join(root, "src") } },
})
if (typeof module.main !== "function") {
    console.error(`${script} doesn't export main(args)`)
    process.exit(2)
}
process.exitCode = (await module.main(args)) ?? 0
