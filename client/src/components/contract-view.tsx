import { Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Block =
  | { kind: "title" | "heading"; text: string }
  | { kind: "para"; lines: string[] }
  | { kind: "list"; items: { text: string; children: string[] }[] }

// the contract is a tiny markdown subset; parsing it ourselves keeps it out of
// dangerouslySetInnerHTML and lets the typography match the site
function parse(md: string): Block[] {
  const blocks: Block[] = []
  let para: string[] | null = null
  let list: Extract<Block, { kind: "list" }> | null = null
  const close = () => {
    if (para) blocks.push({ kind: "para", lines: para })
    if (list) blocks.push(list)
    para = null
    list = null
  }

  for (const raw of md.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.replace(/\s+$/, "")
    if (!line.trim()) {
      close()
    } else if (line.startsWith("# ")) {
      close()
      blocks.push({ kind: "title", text: line.slice(2).trim() })
    } else if (line.startsWith("## ")) {
      close()
      blocks.push({ kind: "heading", text: line.slice(3).trim() })
    } else if (/^\s{2,}- /.test(line) && list) {
      list.items[list.items.length - 1].children.push(line.replace(/^\s+- /, ""))
    } else if (line.startsWith("- ")) {
      if (para) close()
      if (!list) list = { kind: "list", items: [] }
      list.items.push({ text: line.slice(2), children: [] })
    } else {
      if (list) close()
      if (!para) para = []
      para.push(line.trim())
    }
  }
  close()
  return blocks
}

function inline(text: string): ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-medium text-text-primary">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

export function ContractView({
  markdown,
  className,
  compact = false,
}: {
  markdown: string
  className?: string
  // the smaller type used in the admin preview pane
  compact?: boolean
}) {
  const blocks = parse(markdown)
  const body = compact ? "text-[13px] leading-[1.7]" : "text-[15px] leading-[1.8]"

  return (
    <article className={cn("font-body text-text-secondary", body, className)}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "title":
            return (
              <h1
                key={i}
                className={cn(
                  "mb-8 border-b border-border-subtle pb-6 text-center font-heading leading-tight tracking-tight text-text-primary",
                  compact ? "text-xl" : "text-[clamp(1.5rem,3vw,2.1rem)]",
                )}
              >
                {b.text}
              </h1>
            )
          case "heading":
            return (
              <h2
                key={i}
                className={cn(
                  "font-heading tracking-tight text-text-primary",
                  compact ? "mb-2 mt-7 text-base" : "mb-3 mt-10 text-xl",
                )}
              >
                {b.text}
              </h2>
            )
          case "para":
            return (
              <p key={i} className="my-4">
                {b.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(l)}
                  </Fragment>
                ))}
              </p>
            )
          case "list":
            return (
              <ul key={i} className="my-4 space-y-2.5">
                {b.items.map((item, j) => (
                  <li key={j} className="relative pl-5">
                    <span className="absolute left-0 top-[0.8em] block h-px w-2.5 bg-brand" />
                    {inline(item.text)}
                    {item.children.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {item.children.map((c, k) => (
                          <li key={k} className="relative pl-4">
                            <span className="absolute left-0 top-[0.75em] block size-1 bg-text-faint" />
                            {inline(c)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )
        }
      })}
    </article>
  )
}
