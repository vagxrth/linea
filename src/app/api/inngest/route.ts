import { inngest } from "@/inngest/client";
import { serve } from "inngest/next";
import { testFn } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [testFn],

})