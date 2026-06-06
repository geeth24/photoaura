import type { SVGProps } from "react"

const RAD_SOFT_PATH =
  "M869.688 498.419V246.323L434.815 0L0 246.323V713.676L205.925 830.329V411.357L434.815 274.197L438.559 276.469L687.092 417.189L448.443 560.061L283.163 466.431V874.105L434.815 960L869.688 712.203V591.619L667.215 710.312V615.207L869.688 498.419Z"

export function RadSoftMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 870 960"
      fill="currentColor"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d={RAD_SOFT_PATH} />
    </svg>
  )
}
