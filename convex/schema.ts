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
    name: v.string(),
    description: v.optional(v.string()),
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

  // Who owns each uploaded project image. Image functions only touch the caller's files.
  storage_owners: defineTable({
    storageId: v.id('_storage'),
    userId: v.id('users'),
    // Set by the backfill when projects of different users list the same file. Nobody owns
    // a disputed file until someone fixes the row.
    disputed: v.optional(v.boolean()),
  }).index('by_storageId', ['storageId']),

  // Project counters
  project_counters: defineTable({
    userId: v.id('users'),
    nextProjectNumber: v.number(),
  }).index('by_userId', ['userId']),

  // Credits ledger
  credits_ledger: defineTable({
    userId: v.id('users'),
    subscriptionId: v.id('subscriptions'),
    amount: v.number(),
    type: v.string(),
    reasons: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    meta: v.optional(v.any()),
  })
    .index('by_subscriptionId', ['subscriptionId'])
    .index('by_userId', ['userId'])
    .index('by_idempotencyKey', ['idempotencyKey']),

  // Subscriptions
  subscriptions: defineTable({
    userId: v.id('users'),
    polarCustomerId: v.string(),
    polarSubscriptionId: v.string(),
    productId: v.optional(v.string()),
    priceId: v.optional(v.string()),
    planCode: v.optional(v.string()),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancelAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    seats: v.optional(v.number()),
    // No longer written. Kept so existing rows still match the schema until
    // subscription:clearPolarMetadata has run; the field can be dropped after that.
    metadata: v.optional(v.any()),
    creditsBalance: v.number(),
    creditsGrantPerPeriod: v.number(),
    creditsRolloverLimit: v.number(),
    lastGrantCursor: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_polarSubscriptionId', ['polarSubscriptionId'])
    .index('by_status', ['status'])
});
 
export default schema;