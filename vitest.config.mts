import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: {
        // The same "@/" alias as tsconfig.json
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        // Tests sit next to the code they cover
        include: ["src/**/*.test.ts", "convex/**/*.test.ts"],
        // convex-test has to be bundled with the tests rather than loaded from node_modules
        server: { deps: { inline: ["convex-test"] } },
    },
})
