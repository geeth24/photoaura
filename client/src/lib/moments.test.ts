import { describe, expect, it } from "vitest"
import { momentRange, spansDays } from "@/lib/moments"

describe("momentRange", () => {
  it("shows only times for a moment inside one day", () => {
    const range = momentRange({ start: "2026-08-28T17:04:00", end: "2026-08-28T18:10:00" }, false)
    expect(range).toMatch(/5:04/)
    expect(range).toMatch(/6:10/)
    expect(range).not.toMatch(/Aug/)
  })

  it("adds the date when asked", () => {
    const range = momentRange({ start: "2026-08-28T17:04:00", end: "2026-08-28T18:10:00" }, true)
    expect(range).toMatch(/Aug/)
    expect(range).toMatch(/28/)
  })

  it("adds the date when the moment crosses midnight", () => {
    const range = momentRange({ start: "2026-08-28T23:30:00", end: "2026-08-29T00:15:00" }, false)
    expect(range).toMatch(/Aug/)
  })

  it("returns an empty string for unparseable times", () => {
    expect(momentRange({ start: "not a date", end: "2026-08-28T10:00:00" }, false)).toBe("")
  })
})

describe("spansDays", () => {
  it("is false when every moment starts and ends on one day", () => {
    expect(
      spansDays([
        { start: "2026-08-28T10:00:00", end: "2026-08-28T11:00:00" },
        { start: "2026-08-28T13:00:00", end: "2026-08-28T14:00:00" },
      ]),
    ).toBe(false)
  })

  it("is true when moments land on different days", () => {
    expect(
      spansDays([
        { start: "2026-08-28T10:00:00", end: "2026-08-28T11:00:00" },
        { start: "2026-08-29T13:00:00", end: "2026-08-29T14:00:00" },
      ]),
    ).toBe(true)
  })
})
