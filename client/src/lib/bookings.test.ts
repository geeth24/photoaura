import { describe, expect, it, vi } from "vitest"
import { fmtDay, fmtStamp, fmtTime, money, moneyShort, parseDay } from "@/lib/bookings"

vi.mock("@/lib/api", () => ({ bookingsApi: {} }))

describe("money", () => {
  it("formats cents as US dollars", () => {
    expect(money(12345)).toBe("$123.45")
    expect(money(null)).toBe("$0.00")
    expect(money(undefined)).toBe("$0.00")
  })

  it("drops the cents from whole-dollar amounts", () => {
    expect(moneyShort(50000)).toBe("$500")
    expect(moneyShort(50050)).toBe("$500.50")
  })
})

describe("parseDay", () => {
  it("reads a calendar day as local midnight", () => {
    const day = parseDay("2026-11-14")
    expect(day).not.toBeNull()
    expect([day!.getFullYear(), day!.getMonth(), day!.getDate()]).toEqual([2026, 10, 14])
  })

  it("returns null for empty or malformed input", () => {
    expect(parseDay(null)).toBeNull()
    expect(parseDay("14/11/2026")).toBeNull()
  })
})

describe("fmtDay", () => {
  it("writes the long and short forms", () => {
    expect(fmtDay("2026-11-14")).toBe("Saturday, November 14, 2026")
    expect(fmtDay("2026-11-14", "short")).toBe("Nov 14, 2026")
  })

  it("passes unparseable input through", () => {
    expect(fmtDay("someday")).toBe("someday")
    expect(fmtDay(null)).toBe("")
  })
})

describe("fmtTime", () => {
  it.each([
    ["14:05", "2:05 PM"],
    ["00:30", "12:30 AM"],
    ["12:00", "12:00 PM"],
    ["09:15:00", "9:15 AM"],
  ])("formats %s as %s", (input, expected) => {
    expect(fmtTime(input)).toBe(expected)
  })

  it("passes unparseable input through", () => {
    expect(fmtTime("noon-ish")).toBe("noon-ish")
    expect(fmtTime(null)).toBe("")
  })
})

describe("fmtStamp", () => {
  it("is empty without a timestamp", () => {
    expect(fmtStamp(null)).toBe("")
  })

  it("includes the year for a timestamp", () => {
    expect(fmtStamp("2026-08-28T17:04:00")).toContain("2026")
  })
})
