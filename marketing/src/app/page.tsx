import { Hero } from "@/components/hero"
import { GalleryShowcase } from "@/components/gallery-showcase"
import { StudioShowcase } from "@/components/studio-showcase"
import { ClientShowcase } from "@/components/client-showcase"
import { Features } from "@/components/features"
import { Ship } from "@/components/ship"
import { Cta } from "@/components/cta"

export default function Home() {
  return (
    <>
      <Hero />
      <GalleryShowcase />
      <StudioShowcase />
      <ClientShowcase />
      <Features />
      <Ship />
      <Cta />
    </>
  )
}
