import { describe, expect, it } from "vitest"
import { checkoutProducts, planProductIds } from "./plans"

describe("plan product ids", () => {
    it("reads the comma-separated ids, monthly first", () => {
        expect(planProductIds(" monthly-id, yearly-id ,")).toEqual(["monthly-id", "yearly-id"])
    })

    it("is empty when nothing is set", () => {
        expect(planProductIds(undefined)).toEqual([])
        expect(planProductIds("")).toEqual([])
    })
})

describe("checkout products", () => {
    const ids = ["monthly-id", "yearly-id"]

    it("keeps monthly first for a monthly checkout", () => {
        expect(checkoutProducts(ids, "monthly")).toEqual(["monthly-id", "yearly-id"])
    })

    it("puts yearly first for a yearly checkout, keeping monthly to switch to", () => {
        expect(checkoutProducts(ids, "yearly")).toEqual(["yearly-id", "monthly-id"])
    })

    it("falls back to the one product there is", () => {
        expect(checkoutProducts(["monthly-id"], "yearly")).toEqual(["monthly-id"])
    })
})
