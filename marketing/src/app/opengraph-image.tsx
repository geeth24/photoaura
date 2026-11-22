import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "PhotoAura — Client galleries that sort themselves"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// square JPEG tiles from the made-up demo wedding (shelfshot web/landing-assets.py og)
const TILES = ["og-1", "og-2", "og-3", "og-4", "og-5", "og-6", "og-7", "og-8", "og-9"]
const dataUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`

export default async function OpenGraphImage() {
  const [sans, serif, ...tiles] = await Promise.all([
    readFile(join(process.cwd(), "assets/Outfit-Regular.ttf")),
    readFile(join(process.cwd(), "assets/DMSerifDisplay-Regular.ttf")),
    ...TILES.map((t) => readFile(join(process.cwd(), `assets/og/${t}.jpg`))),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#030d14",
          color: "#edf6fc",
          fontFamily: "Outfit",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "62px 0 58px 64px",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 16,
              letterSpacing: 7,
              color: "rgba(237,246,252,0.58)",
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: 48, height: 1, background: "#00a6fb" }} />
            <span>PhotoAura</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "DM Serif Display",
              fontSize: 70,
              lineHeight: 0.98,
              letterSpacing: -1.5,
            }}
          >
            <span>Galleries that</span>
            <span style={{ color: "#00a6fb" }}>sort themselves.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 17,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "rgba(237,246,252,0.58)",
            }}
          >
            People · Highlights · Moments · Reels
          </div>
        </div>

        {/* the gallery grid, bleeding off the right edge */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, width: 626, height: 630 }}>
          {tiles.map((t, i) => (
            <img key={TILES[i]} src={dataUrl(t)} width={206} height={207} style={{ objectFit: "cover" }} alt="" />
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Outfit", data: sans, style: "normal", weight: 400 },
        { name: "DM Serif Display", data: serif, style: "normal", weight: 400 },
      ],
    },
  )
}
