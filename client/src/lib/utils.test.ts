import { describe, expect, it } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("joins class names and skips falsy values", () => {
    expect(cn("text-sm", false, null, "font-body")).toBe("text-sm font-body")
  })

  it("lets the later Tailwind utility win", () => {
    expect(cn("p-2 text-sm", "p-4")).toBe("text-sm p-4")
  })
})
