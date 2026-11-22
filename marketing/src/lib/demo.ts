// A made-up wedding that every product demo on the page draws from.
// The photos are generated (shelfshot, projects/photoaura/gallery-v2); nobody in them is real.

export type PersonId = "sofia" | "daniel" | "carmen" | "imani" | "kenji"
export type MomentKey = "ready" | "ceremony" | "portraits" | "reception"

export type DemoPhoto = {
  id: string
  alt: string
  // capture time, minutes after midnight
  at: number
  moment: MomentKey
  people: PersonId[]
  highlight?: boolean
  portrait?: boolean
  version?: number
}

export const ALBUM = {
  name: "Sofia & Daniel",
  date: "Oct 18, 2026",
  client: "Sofia Marquez",
}

export const PEOPLE: { id: PersonId; name: string }[] = [
  { id: "sofia", name: "Sofia" },
  { id: "daniel", name: "Daniel" },
  { id: "carmen", name: "Carmen" },
  { id: "imani", name: "Imani" },
  { id: "kenji", name: "Kenji" },
]

export const MOMENTS: { key: MomentKey; label: string }[] = [
  { key: "ready", label: "Getting ready" },
  { key: "ceremony", label: "Ceremony on the bluff" },
  { key: "portraits", label: "Golden hour portraits" },
  { key: "reception", label: "Reception" },
]

const t = (h: number, m: number) => h * 60 + m

export const PHOTOS: DemoPhoto[] = [
  { id: "wed-dress", alt: "The gown hanging in a bright window", at: t(13, 42), moment: "ready", people: [], portrait: true },
  { id: "wed-makeup", alt: "Sofia laughing during a makeup touch-up", at: t(13, 58), moment: "ready", people: ["sofia"], highlight: true, portrait: true },
  { id: "wed-details", alt: "Rings, pearls and the bouquet on linen", at: t(14, 10), moment: "ready", people: [] },
  { id: "wed-mother", alt: "Carmen buttoning Sofia's dress", at: t(14, 31), moment: "ready", people: ["sofia", "carmen"], highlight: true },
  { id: "wed-cufflinks", alt: "Daniel fastening a cufflink", at: t(14, 44), moment: "ready", people: ["daniel"], portrait: true },
  { id: "wed-carmen", alt: "Carmen, the bride's mother", at: t(14, 52), moment: "ready", people: ["carmen"], portrait: true },
  { id: "wed-aisle", alt: "Sofia walking down the aisle with Carmen", at: t(16, 2), moment: "ceremony", people: ["sofia", "carmen"], highlight: true, portrait: true },
  { id: "wed-vows", alt: "The ceremony on the bluff above the sea", at: t(16, 9), moment: "ceremony", people: ["sofia", "daniel"] },
  { id: "wed-rings", alt: "The ring exchange", at: t(16, 21), moment: "ceremony", people: [] },
  { id: "wed-kiss", alt: "The first kiss under the arch", at: t(16, 27), moment: "ceremony", people: ["sofia", "daniel"], highlight: true },
  { id: "wed-petals", alt: "Walking back up the aisle through petals", at: t(16, 31), moment: "ceremony", people: ["sofia", "daniel"], highlight: true, portrait: true },
  { id: "wed-bride", alt: "Sofia", at: t(17, 12), moment: "portraits", people: ["sofia"], highlight: true, portrait: true, version: 2 },
  { id: "wed-groom", alt: "Daniel", at: t(17, 18), moment: "portraits", people: ["daniel"], portrait: true },
  { id: "wed-bluff", alt: "Sofia and Daniel on the bluff at golden hour", at: t(17, 40), moment: "portraits", people: ["sofia", "daniel"], highlight: true },
  { id: "wed-imani", alt: "Imani, the maid of honor", at: t(17, 52), moment: "portraits", people: ["imani"], portrait: true },
  { id: "wed-kenji", alt: "Kenji, the best man", at: t(17, 55), moment: "portraits", people: ["kenji"], portrait: true },
  { id: "wed-party", alt: "The couple with Imani and Kenji", at: t(18, 3), moment: "portraits", people: ["sofia", "daniel", "imani", "kenji"] },
  { id: "wed-cypress", alt: "Walking under the cypress trees", at: t(18, 16), moment: "portraits", people: ["sofia", "daniel"], highlight: true },
  { id: "wed-veil", alt: "The veil lifting on the beach at sunset", at: t(18, 34), moment: "portraits", people: ["sofia", "daniel"], highlight: true, portrait: true },
  { id: "wed-entrance", alt: "The entrance into the tent", at: t(19, 14), moment: "reception", people: ["sofia", "daniel"] },
  { id: "wed-firstdance", alt: "The first dance under string lights", at: t(19, 40), moment: "reception", people: ["sofia", "daniel"], highlight: true, portrait: true },
  { id: "wed-toast", alt: "Kenji's toast", at: t(20, 5), moment: "reception", people: ["kenji", "sofia", "daniel"], highlight: true },
  { id: "wed-dinner", alt: "Dinner at the long table", at: t(20, 22), moment: "reception", people: ["sofia", "daniel"] },
  { id: "wed-cake", alt: "Cutting the cake", at: t(21, 3), moment: "reception", people: ["sofia", "daniel"], portrait: true },
  { id: "wed-sparklers", alt: "The sparkler send-off", at: t(22, 12), moment: "reception", people: ["sofia", "daniel"], highlight: true },
]

export const src = (id: string) => `/demo/${id}.webp`
export const faceSrc = (id: PersonId) => `/demo/face-${id}.webp`

export function clock(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

export function momentRange(photos: DemoPhoto[]) {
  const times = photos.map((p) => p.at)
  const a = clock(Math.min(...times))
  const b = clock(Math.max(...times))
  // same meridiem reads like Intl's formatRange: "1:42 – 2:52 PM"
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`
}
