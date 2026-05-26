import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "PhotoAura — Your photos, beautifully managed."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#030d14",
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(0,166,251,0.25), transparent 60%), radial-gradient(circle at 85% 80%, rgba(0,166,251,0.15), transparent 55%)",
          color: "#edf6fc",
        }}
      >
        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 18,
            letterSpacing: 8,
            color: "rgba(237,246,252,0.55)",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          <div style={{ width: 48, height: 1, background: "#00a6fb" }} />
          <span>PhotoAura · For Photographers</span>
        </div>

        {/* headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "serif",
            fontSize: 124,
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          <span style={{ color: "#edf6fc" }}>Your photos,</span>
          <span style={{ color: "#00a6fb" }}>beautifully managed.</span>
        </div>

        {/* footer line */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "rgba(237,246,252,0.55)",
          }}
        >
          <span>photoaura.app</span>
          <span style={{ letterSpacing: 4, textTransform: "uppercase", fontSize: 16 }}>
            Open Source · Self-Hosted
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
