import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalMutation, MutationCtx, QueryCtx } from "./_generated/server";

// An unowned file can only be claimed this soon after upload. Uploaders claim theirs right
// away, so a storage id that leaks later can't be used to take over someone else's file.
const CLAIM_WINDOW_MS = 60 * 60 * 1000;

const getOwnerRecord = async (ctx: QueryCtx, storageId: Id<"_storage">) => {
    return await ctx.db
        .query("storage_owners")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .unique();
};

// Project image lists hold plain strings, so normalize before looking up the owner.
const getOwnRecord = async (ctx: QueryCtx, storageId: string, userId: Id<"users">) => {
    const id = ctx.db.system.normalizeId("_storage", storageId);
    if (!id) return null;

    const owner = await getOwnerRecord(ctx, id);
    return owner && !owner.disputed && owner.userId === userId ? owner : null;
};

export const ownsFile = async (ctx: QueryCtx, storageId: string, userId: Id<"users">) => {
    return (await getOwnRecord(ctx, storageId, userId)) !== null;
};

// Lets `userId` attach a file they own, or a fresh upload nobody has claimed yet, which then
// becomes theirs.
export const claimFile = async (ctx: MutationCtx, storageId: Id<"_storage">, userId: Id<"users">) => {
    const owner = await getOwnerRecord(ctx, storageId);
    if (owner) {
        if (owner.disputed || owner.userId !== userId) throw new Error("Access denied");
        return;
    }

    const file = await ctx.db.system.get(storageId);
    if (!file) throw new Error("File not found");
    if (Date.now() - file._creationTime > CLAIM_WINDOW_MS) {
        throw new Error("Upload expired, please upload the image again");
    }

    await ctx.db.insert("storage_owners", { storageId, userId });
};

// Deletes the file only if `userId` owns it. Anyone else's file stays in storage.
export const deleteFileIfOwned = async (ctx: MutationCtx, storageId: string, userId: Id<"users">) => {
    const owner = await getOwnRecord(ctx, storageId, userId);
    if (!owner) return;

    try {
        await ctx.storage.delete(owner.storageId);
    } catch (error) {
        console.error(`Failed to delete file from storage ${storageId}`, error);
    }
    await ctx.db.delete(owner._id);
};

// Records owners for the images projects listed before ownership was tracked. Run it once after
// deploying with `npx convex run storage:backfillOwners` (add `--prod` for production). It pages
// through projects and schedules itself until it reaches the end. Re-running it is harmless.
export const backfillOwners = internalMutation({
    args: { cursor: v.optional(v.string()) },
    handler: async (ctx, { cursor }) => {
        const { page, isDone, continueCursor } = await ctx.db
            .query("projects")
            .paginate({ cursor: cursor ?? null, numItems: 20 });

        for (const project of page) {
            const listed = new Set([...(project.moodboardImages ?? []), ...(project.inspirationImages ?? [])]);
            for (const listedId of listed) {
                const storageId = ctx.db.system.normalizeId("_storage", listedId);
                if (!storageId) continue;

                const owner = await getOwnerRecord(ctx, storageId);
                if (!owner) {
                    await ctx.db.insert("storage_owners", { storageId, userId: project.userId });
                } else if (owner.userId !== project.userId && !owner.disputed) {
                    // Any project could list any file before, so we can't tell who uploaded it.
                    await ctx.db.patch(owner._id, { disputed: true });
                    console.warn(
                        `File ${storageId} is listed by projects of users ${owner.userId} and ${project.userId} ` +
                        `(project ${project._id}). Marked it disputed.`
                    );
                }
            }
        }

        if (isDone) {
            console.log("Storage owner backfill finished");
        } else {
            await ctx.scheduler.runAfter(0, internal.storage.backfillOwners, { cursor: continueCursor });
        }
    },
});
