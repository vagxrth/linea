// Runs one of this project's TypeScript scripts with Node, through Vite (already a dev dependency), so
// it can use the same "@/" imports as the app. The script exports main(args), which returns the exit code.
//
//   node scripts/run-ts.mjs scripts/eval-generation.ts [args...]
//
// It sets up what Vite's runnerImport() does, but keeps the module runner open until main() has
// finished: runnerImport closes it once the script's module has loaded, so a module the script
// imports while it runs (the Google SDK in a live eval) found the runner already gone.
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRunnableDevEnvironment, mergeConfig, resolveConfig } from "vite"

const [script, ...args] = process.argv.slice(2)
if (!script) {
    console.error("Usage: node scripts/run-ts.mjs <script.ts> [args...]")
    process.exit(2)
}

const root = fileURLToPath(new URL("..", import.meta.url))
const config = await resolveConfig(
    mergeConfig(
        { root, logLevel: "error", resolve: { alias: { "@": path.join(root, "src") } } },
        {
            configFile: false,
            envDir: false,
            cacheDir: process.cwd(),
            environments: {
                inline: {
                    consumer: "server",
                    dev: { moduleRunnerTransform: true },
                    // Packages load straight from node_modules, as Node loads them
                    resolve: { external: true, mainFields: [], conditions: ["node"] },
                },
            },
        }
    ),
    "serve"
)
const environment = createRunnableDevEnvironment("inline", config, { runnerOptions: { hmr: { logger: false } }, hot: false })
await environment.init()
try {
    const loaded = await environment.runner.import(path.resolve(script))
    if (typeof loaded.main !== "function") {
        console.error(`${script} doesn't export main(args)`)
        process.exitCode = 2
    } else {
        process.exitCode = (await loaded.main(args)) ?? 0
    }
} finally {
    await environment.close()
}
