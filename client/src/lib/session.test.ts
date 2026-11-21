import { describe, expect, it } from "vitest"
import { claimsOf, maxAgeFor } from "@/lib/session"

function tokenWith(claims: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64")
  return `header.${body}.signature`
}

describe("claimsOf", () => {
  it("reads the payload of a JWT", () => {
    expect(claimsOf(tokenWith({ exp: 1900000000, preview: true }))).toEqual({ exp: 1900000000, preview: true })
  })

  it("returns null without a token", () => {
    expect(claimsOf(null)).toBeNull()
    expect(claimsOf(undefined)).toBeNull()
    expect(claimsOf("")).toBeNull()
  })

  it("returns null for a payload that is not JSON", () => {
    expect(claimsOf("header.%%%.signature")).toBeNull()
  })
})

describe("maxAgeFor", () => {
  it("counts down to the token's expiry", () => {
    const exp = Math.floor(Date.now() / 1000) + 7200
    const age = maxAgeFor(tokenWith({ exp }))
    expect(age).toBeGreaterThan(7000)
    expect(age).toBeLessThanOrEqual(7200)
  })

  it("never goes below a minute", () => {
    expect(maxAgeFor(tokenWith({ exp: 1 }))).toBe(60)
  })

  it("defaults to an hour without an expiry", () => {
    expect(maxAgeFor(tokenWith({}))).toBe(3600)
  })
})
