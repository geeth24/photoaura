import { describe, expect, it } from "vitest"
import { MAX_BATCH_BYTES, MAX_BATCH_FILES, planBatches } from "@/lib/upload-batches"

const file = (name: string, size: number) => ({ name, size })
const MB = 1024 * 1024

describe("planBatches", () => {
  it("returns no batches for no files", () => {
    expect(planBatches([])).toEqual([])
  })

  it("keeps a batch under the file-count cap", () => {
    const files = Array.from({ length: MAX_BATCH_FILES * 2 + 20 }, (_, i) => file(`f${i}`, 1))
    expect(planBatches(files).map((b) => b.length)).toEqual([MAX_BATCH_FILES, MAX_BATCH_FILES, 20])
  })

  it("starts a new batch before the byte cap is crossed", () => {
    const a = file("a", 600 * MB)
    const b = file("b", 600 * MB)
    const c = file("c", 300 * MB)
    expect(planBatches([a, b, c])).toEqual([[a], [b, c]])
  })

  it("gives a file bigger than the cap a batch to itself, in order", () => {
    const small = file("small", MB)
    const huge = file("huge", MAX_BATCH_BYTES + MB)
    const tail = file("tail", MB)
    expect(planBatches([small, huge, tail])).toEqual([[small], [huge], [tail]])
  })

  it("preserves file order across batches", () => {
    const files = Array.from({ length: 120 }, (_, i) => file(`f${i}`, MB))
    expect(planBatches(files).flat()).toEqual(files)
  })
})
