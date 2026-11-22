import { Hero } from "@/components/hero"
import { SmartSorting } from "@/components/smart-sorting"
import { ReelsDemo } from "@/components/reels-demo"
import { CompareDemo } from "@/components/compare-demo"
import { PaidDemo } from "@/components/paid-demo"
import { AppsSection } from "@/components/apps-section"
import { StudioSection } from "@/components/studio-section"
import { Cta } from "@/components/cta"

export default function Home() {
  return (
    <>
      <Hero />
      <SmartSorting />
      <ReelsDemo />
      <CompareDemo />
      <PaidDemo />
      <AppsSection />
      <StudioSection />
      <Cta />
    </>
  )
}
