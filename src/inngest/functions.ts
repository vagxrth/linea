import { inngest } from "./client";

export const testFn = inngest.createFunction(
    { id: 'autosave-project-workflow' },
    { event: 'project/autosave.requested' },
    async ({ event }) => {
        console.log('Project autosave requested: ', event)
    }
)