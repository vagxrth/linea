import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, MutationCtx, QueryCtx } from "./_generated/server";
import { imageProblem } from "../src/lib/image-upload";

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
    return owner?.userId === userId ? owner : null;
};

export const ownsFile = async (ctx: QueryCtx, storageId: string, userId: Id<"users">) => {
    return (await getOwnRecord(ctx, storageId, userId)) !== null;
};

// Lets `userId` attach a file they own, or a fresh upload nobody has claimed yet, which then
// becomes theirs.
export const claimFile = async (ctx: MutationCtx, storageId: Id<"_storage">, userId: Id<"users">) => {
    const owner = await getOwnerRecord(ctx, storageId);
    if (owner) {
        if (owner.userId !== userId) throw new Error("Access denied");
        return;
    }

    const file = await ctx.db.system.get(storageId);
    if (!file) throw new Error("File not found");
    if (Date.now() - file._creationTime > CLAIM_WINDOW_MS) {
        throw new Error("Upload expired, please upload the image again");
    }
    // The browser checks first, so this only stops uploads made around it. A refused file gets no
    // owner, so deleteUnusedUploads removes it.
    if (imageProblem(file.contentType, file.size)) {
        throw new Error("Project images must be PNG, JPEG or WebP files of up to 2 MB");
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

// An upload that never made it into a project: it has no owner, and the claim window that let its
// uploader attach it has passed. Every file a project uses has an owner (claimFile records it), so
// these are only uploads that were refused or abandoned. A new way of storing files must give them
// owners too, or this deletes them.
const isUnusedUpload = async (ctx: QueryCtx, file: { _id: Id<"_storage">; _creationTime: number }) =>
    Date.now() - file._creationTime > CLAIM_WINDOW_MS && !(await getOwnerRecord(ctx, file._id));

// Deletes unused uploads. Pages through the files and schedules itself until it reaches the end.
export const deleteUnusedUploads = internalMutation({
    args: { cursor: v.optional(v.string()) },
    handler: async (ctx, { cursor }) => {
        const { page, isDone, continueCursor } = await ctx.db.system
            .query("_storage")
            .paginate({ cursor: cursor ?? null, numItems: 100 });

        let deleted = 0;
        for (const file of page) {
            if (await isUnusedUpload(ctx, file)) {
                await ctx.storage.delete(file._id);
                deleted++;
            }
        }
        if (deleted > 0) console.log(`Deleted ${deleted} unused uploads`);

        if (!isDone) {
            await ctx.scheduler.runAfter(0, internal.storage.deleteUnusedUploads, { cursor: continueCursor });
        }
    },
});

// What deleteUnusedUploads would delete, without deleting anything:
// `npx convex run storage:unusedUploadsReport`. listedByProject counts unused uploads that a project
// still lists, which would mean a file in use has no owner; it has to be 0 before the cleanup runs.
// It reads every file and project in one go, which suits a check like this but not a large table.
export const unusedUploadsReport = internalQuery({
    args: {},
    handler: async (ctx) => {
        const listed = new Set<string>();
        for await (const project of ctx.db.query("projects")) {
            for (const id of [...(project.moodboardImages ?? []), ...(project.inspirationImages ?? [])]) {
                listed.add(id);
            }
        }

        let files = 0;
        let unused = 0;
        let unusedBytes = 0;
        let listedByProject = 0;
        for await (const file of ctx.db.system.query("_storage")) {
            files++;
            if (!(await isUnusedUpload(ctx, file))) continue;
            unused++;
            unusedBytes += file.size;
            if (listed.has(file._id)) listedByProject++;
        }
        return { files, unused, unusedBytes, listedByProject };
    },
});
