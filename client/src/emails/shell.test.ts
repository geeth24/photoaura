import { describe, expect, it } from "vitest"
import { firstName } from "./shell"

describe("firstName", () => {
  it.each([
    ["Jordan Ellis", "Jordan"],
    ["Jordan", "Jordan"],
    [" Jordan Ellis", "Jordan"],
    ["Jordan  Ellis", "Jordan"],
    ["", "there"],
    ["   ", "there"],
    [undefined, "there"],
  ])("%j greets %s", (name, expected) => {
    expect(firstName(name)).toBe(expected)
  })
})
