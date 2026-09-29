import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "PhotoAura — Your photos, beautifully managed."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`

export default async function OpenGraphImage() {
  // the device PNGs are exported by shelfshot (bun run mockups projects/photoaura)
  const [sans, serif, mac, phone] = await Promise.all([
    readFile(join(process.cwd(), "assets/Outfit-Regular.ttf")),
    readFile(join(process.cwd(), "assets/DMSerifDisplay-Regular.ttf")),
    readFile(join(process.cwd(), "assets/og/hero-mac.png")),
    readFile(join(process.cwd(), "assets/og/app-viewer.png")),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#030d14",
          backgroundImage:
            "radial-gradient(circle at 12% 20%, rgba(0,166,251,0.22), transparent 55%), radial-gradient(circle at 80% 85%, rgba(0,166,251,0.18), transparent 50%)",
          color: "#edf6fc",
          fontFamily: "Outfit",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 0 60px 68px",
            width: 560,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 16,
              letterSpacing: 7,
              color: "rgba(237,246,252,0.55)",
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
              fontSize: 84,
              lineHeight: 0.98,
              letterSpacing: -1.5,
            }}
          >
            <span>Your photos,</span>
            <span style={{ color: "#00a6fb" }}>beautifully</span>
            <span style={{ color: "#00a6fb" }}>managed.</span>
          </div>

          <div style={{ display: "flex", fontSize: 22, color: "rgba(237,246,252,0.55)" }}>
            Client galleries · Face recognition · iPhone app
          </div>
        </div>

        {/* studio on a Mac, the client's app in front — bleeding off the edge */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl(mac)} width={760} height={557} style={{ position: "absolute", left: 540, top: 110 }} alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl(phone)} width={218} height={388} style={{ position: "absolute", left: 1000, top: 250 }} alt="" />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Outfit", data: sans, style: "normal", weight: 400 },
        { name: "DM Serif Display", data: serif, style: "normal", weight: 400 },
      ],
    }
  )
}
