import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
 
const schema = defineSchema({
  ...authTables,
  // Your other tables...

  // Projects
  projects: defineTable({
    userId: v.id('users'),
    projectNumber: v.number(),
    title: v.string(),
    description: v.string(),
    styleGuide: v.optional(v.string()),
    sketchesData: v.any(),
    viewportData: v.optional(v.any()),
    generatedDesignData: v.optional(v.any()),
    thumbnail: v.optional(v.string()),
    moodboardImages: v.optional(v.array(v.string())),
    inspirationImages: v.optional(v.array(v.string())),
    lastModified: v.number(),
    createdAt: v.number(),
    isPublic: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  }).index('by_userId', ['userId']),

  // Project counters
  project_counters: defineTable({
    userId: v.id('users'),
    nextProjectNumber: v.number(),
  }).index('by_userId', ['userId']),
});
 
export default schema;