// Runs every quality tool over the PhotoAura repo and folds the results into
// one summary: lint, dead code, duplication, complexity, tests and coverage.
//
//   bun run .github/scripts/quality-report.ts [--out analysis] [--md docs/quality/report.md]
//     [--base origin/main | --areas client,python,ios] [--max-duplication 3] [--comment]
//   bun run .github/scripts/quality-report.ts --base origin/main --print-areas
//
// Run from the repo root. --base limits the areas to what the branch changed;
// --comment upserts one sticky PR comment (needs GH_TOKEN, REPO, PR_NUMBER).
//
// Gates (exit 1): any oxlint, knip, ruff or vulture finding; any eslint error;
// any swiftlint error; duplication above --max-duplication; a failing test run
// or coverage under the floor. Warnings and complexity hot spots are reported only.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type Finding = { file: string; line?: number; rule: string; message: string; severity?: "error" | "warning" };
type ToolResult = {
  tool: string;
  area: string;
  ok: boolean;
  skipped?: boolean;
  count: number;
  detail: string;
  findings: Finding[];
};
type Hotspot = { file: string; line?: number; name: string; complexity: number; tool: string };
type TestTally = { passed: number; failed: number; coverage?: number; floor: number };
type Summary = {
  ok: boolean;
  generatedAt: string;
  commit: string;
  areas: string[];
  maxDuplication: number;
  results: ToolResult[];
  hotspots: Hotspot[];
  tests: Record<string, TestTally>;
  duplication?: { percentage: number; duplicatedLines: number; lines: number; clones: number };
};

const ALL_AREAS = ["client", "python", "ios"];
const FLOORS = { pytest: 50, vitest: 45 };
const COVERED_MODULES = [
  "services.smart_gallery",
  "services.reel_renderer",
  "utils.face_recog",
  "utils.utils",
];
const ROOT = process.cwd();
const CLIENT = join(ROOT, "client");
const MARK = "<!-- photoaura-quality -->";
const MAX_FINDINGS_SHOWN = 40;

const args = parseArgs(process.argv.slice(2));
if (args["print-areas"]) {
  console.log(areasToRun().join(","));
  process.exit(0);
}
const outDir = resolve(args.out ?? "analysis");
const maxDuplication = Number(args["max-duplication"] ?? 3);
mkdirSync(outDir, { recursive: true });

// ---- helpers -----------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i]!.startsWith("--")) continue;
    const key = argv[i]!.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = "true";
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function run(cmd: string, cmdArgs: string[], cwd = ROOT) {
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    missing: r.error !== undefined && (r.error as NodeJS.ErrnoException).code === "ENOENT",
  };
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const rel = (from: string, file: string) => relative(ROOT, resolve(from, file));

function crashed(tool: string, area: string, r: ReturnType<typeof run>): ToolResult {
  const why = r.missing ? "not installed" : `exit ${r.status}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`;
  return { tool, area, ok: false, count: 0, detail: `did not run, ${why}`, findings: [] };
}

function result(tool: string, area: string, findings: Finding[], detail?: string, extraOk = true): ToolResult {
  const errors = findings.filter((f) => f.severity !== "warning").length;
  return {
    tool,
    area,
    ok: errors === 0 && extraOk,
    count: findings.length,
    detail: detail ?? plural(findings.length, "finding"),
    findings,
  };
}

// ---- which areas ----------------------------------------------------------------

function areasToRun(): string[] {
  if (args.areas) return args.areas.split(",").map((a) => a.trim());
  if (!args.base) return ALL_AREAS;
  const r = run("git", ["diff", "--name-only", `${args.base}...HEAD`]);
  if (r.status !== 0) return ALL_AREAS;
  const hit = new Set<string>();
  for (const f of r.stdout.split("\n").filter(Boolean)) {
    if (f.startsWith("client/")) hit.add("client");
    if (f.startsWith("server/") || f.startsWith("face-service/") || /^requirements.*\.txt$/.test(f) || f === "ruff.toml" || f === ".jscpd.json") hit.add("python");
    if (f.startsWith("ios/") || f === ".swiftlint.yml") hit.add("ios");
  }
  return ALL_AREAS.filter((a) => hit.has(a));
}

// ---- client (TypeScript) --------------------------------------------------------

function oxlint(): ToolResult {
  const r = run("bunx", ["oxlint", "--format", "json"], CLIENT);
  type Out = { diagnostics: { message: string; code: string; filename: string; labels?: { span?: { line?: number } }[] }[] };
  const out = parseJson<Out>(r.stdout);
  if (!out) return crashed("oxlint", "client", r);
  return result(
    "oxlint",
    "client",
    out.diagnostics.map((d) => ({
      file: rel(CLIENT, d.filename),
      line: d.labels?.[0]?.span?.line,
      rule: d.code,
      message: d.message,
    })),
  );
}

const COGNITIVE = /from (\d+) to the \d+ allowed/;

function eslint(hotspots: Hotspot[]): ToolResult {
  type EslintFile = { filePath: string; messages: { line?: number; severity: 1 | 2; ruleId: string | null; message: string }[] };
  const r = run("bunx", ["eslint", "-f", "json", "src"], CLIENT);
  const files = parseJson<EslintFile[]>(r.stdout);
  if (!files) return crashed("eslint + sonarjs", "client", r);
  const findings: Finding[] = [];
  for (const f of files) {
    for (const m of f.messages) {
      const file = rel(CLIENT, f.filePath);
      const rule = m.ruleId ?? "fatal";
      const severity = m.severity === 2 ? "error" : "warning";
      findings.push({ file, line: m.line, rule, message: m.message.split("\n")[0]!, severity });
      const cc = COGNITIVE.exec(m.message);
      if (cc) hotspots.push({ file, line: m.line, name: "function", complexity: Number(cc[1]), tool: "sonarjs" });
    }
  }
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;
  return result("eslint + sonarjs", "client", findings, `${plural(errors, "error")}, ${plural(warnings, "warning")}`);
}

function knip(): ToolResult {
  const r = run("bunx", ["knip", "--no-progress", "--reporter", "json"], CLIENT);
  type Issue = { file: string } & Record<string, unknown>;
  const out = parseJson<{ issues: Issue[] }>(r.stdout);
  if (!out) return crashed("knip", "client", r);
  const findings: Finding[] = [];
  for (const issue of out.issues) {
    for (const [kind, items] of Object.entries(issue)) {
      if (kind === "file" || !Array.isArray(items)) continue;
      for (const item of items as { name?: string; line?: number }[]) {
        findings.push({ file: issue.file, line: item.line, rule: kind, message: item.name ?? "" });
      }
    }
  }
  return result("knip", "client", findings);
}

// ---- python ------------------------------------------------------------------------

function ruff(): ToolResult {
  type RuffFinding = { code: string; message: string; filename: string; location: { row: number } };
  const r = run("ruff", ["check", "--output-format", "json", "server", "face-service"]);
  const out = parseJson<RuffFinding[]>(r.stdout);
  if (!out) return crashed("ruff", "python", r);
  return result(
    "ruff",
    "python",
    out.map((d) => ({ file: rel(ROOT, d.filename), line: d.location.row, rule: d.code, message: d.message, severity: "error" })),
    "pyflakes, bugbear, mccabe (E9, F, B, C90)",
  );
}

function ruffComplexity(hotspots: Hotspot[]) {
  type RuffFinding = { message: string; filename: string; location: { row: number } };
  const r = run("ruff", [
    "check",
    "--select",
    "C901",
    "--config",
    "lint.mccabe.max-complexity=10",
    "--output-format",
    "json",
    "server",
    "face-service",
  ]);
  const out = parseJson<RuffFinding[]>(r.stdout) ?? [];
  for (const d of out) {
    const m = /`([^`]+)` is too complex \((\d+) > \d+\)/.exec(d.message);
    if (m) hotspots.push({ file: rel(ROOT, d.filename), line: d.location.row, name: m[1]!, complexity: Number(m[2]), tool: "ruff C901" });
  }
}

function vulture(): ToolResult {
  const r = run("vulture", [
    "server",
    "face-service",
    "--min-confidence",
    "80",
    "--exclude",
    "server/alembic/versions,server/scripts,server/tests",
  ]);
  if (r.missing) return crashed("vulture", "python", r);
  const findings: Finding[] = [];
  for (const line of r.stdout.split("\n")) {
    const m = /^(.*?):(\d+): (.*) \((\d+)% confidence\)$/.exec(line.trim());
    if (m) findings.push({ file: m[1]!, line: Number(m[2]), rule: "dead code", message: m[3]! });
  }
  return result("vulture", "python", findings, `${plural(findings.length, "finding")} at 80% confidence`);
}

function pytest(): { result: ToolResult; tests: TestTally } {
  const serverDir = join(ROOT, "server");
  const covJson = join(outDir, "server-coverage.json");
  const cov = COVERED_MODULES.flatMap((m) => [`--cov=${m}`]);
  const r = run(process.env.PYTHON ?? "python3", ["-m", "pytest", "-q", ...cov, `--cov-report=json:${covJson}`, "--cov-report=term"], serverDir);
  const tail = r.stdout + r.stderr;
  const passed = Number(/(\d+) passed/.exec(tail)?.[1] ?? 0);
  const failed = Number(/(\d+) failed/.exec(tail)?.[1] ?? 0);
  const errored = Number(/(\d+) error/.exec(tail)?.[1] ?? 0);
  const coverage = existsSync(covJson)
    ? (parseJson<{ totals: { percent_covered: number } }>(readFileSync(covJson, "utf8"))?.totals.percent_covered ?? 0)
    : 0;
  const findings: Finding[] = tail
    .split("\n")
    .filter((l) => l.startsWith("FAILED ") || l.startsWith("ERROR "))
    .map((l) => ({ file: l.split(" ")[1]!.split("::")[0]!, rule: "test", message: l.slice(0, 200) }));
  const floorOk = coverage >= FLOORS.pytest;
  if (!floorOk) findings.push({ file: "server", rule: "coverage", message: `${coverage.toFixed(1)}% is under the ${FLOORS.pytest}% floor` });
  const ok = r.status === 0 && failed + errored === 0 && floorOk;
  return {
    result: {
      tool: "pytest",
      area: "python",
      ok,
      count: findings.length,
      detail: `${passed} passed, ${failed + errored} failed; ${coverage.toFixed(1)}% of ${COVERED_MODULES.length} modules (floor ${FLOORS.pytest}%)`,
      findings,
    },
    tests: { passed, failed: failed + errored, coverage, floor: FLOORS.pytest },
  };
}

// ---- ios -------------------------------------------------------------------------

function swiftlint(): ToolResult {
  const probe = run("swiftlint", ["version"]);
  if (probe.missing || probe.status !== 0) {
    return { tool: "swiftlint", area: "ios", ok: true, skipped: true, count: 0, detail: "skipped: swiftlint not installed (local only)", findings: [] };
  }
  type SwiftFinding = { file: string; line: number; rule_id: string; severity: "Error" | "Warning"; reason: string };
  const r = run("swiftlint", ["lint", "--config", ".swiftlint.yml", "--quiet", "--reporter", "json"]);
  const out = parseJson<SwiftFinding[]>(r.stdout) ?? [];
  const findings: Finding[] = out.map((d) => ({
    file: rel(ROOT, d.file),
    line: d.line,
    rule: d.rule_id,
    message: d.reason,
    severity: d.severity === "Error" ? "error" : "warning",
  }));
  const errors = findings.filter((f) => f.severity === "error").length;
  return result("swiftlint", "ios", findings, `${plural(errors, "error")}, ${plural(findings.length - errors, "warning")}`);
}

// ---- tests (client) --------------------------------------------------------------

function vitest(): { result: ToolResult; tests: TestTally } {
  const r = run("bunx", ["vitest", "run", "--coverage"], CLIENT);
  const line = (r.stdout + r.stderr).split("\n").find((l) => /^\s*Tests\s/.test(l)) ?? "";
  const passed = Number(/(\d+) passed/.exec(line)?.[1] ?? 0);
  const failed = Number(/(\d+) failed/.exec(line)?.[1] ?? 0);
  const summaryPath = join(CLIENT, "coverage", "coverage-summary.json");
  const coverage = existsSync(summaryPath)
    ? (parseJson<{ total: { lines: { pct: number } } }>(readFileSync(summaryPath, "utf8"))?.total.lines.pct ?? 0)
    : 0;
  const findings: Finding[] = [];
  if (coverage < FLOORS.vitest) findings.push({ file: "client/src/lib", rule: "coverage", message: `${coverage.toFixed(1)}% lines is under the ${FLOORS.vitest}% floor` });
  const ok = r.status === 0 && failed === 0 && coverage >= FLOORS.vitest;
  return {
    result: {
      tool: "vitest",
      area: "client",
      ok,
      count: findings.length,
      detail: `${passed} passed, ${failed} failed; ${coverage.toFixed(1)}% lines of pure helpers (floor ${FLOORS.vitest}%)`,
      findings,
    },
    tests: { passed, failed, coverage, floor: FLOORS.vitest },
  };
}

// ---- duplication (client + python) --------------------------------------------------

function jscpd(): { result: ToolResult; stats?: Summary["duplication"] } {
  const reportDir = join(outDir, "jscpd");
  const bin = join(CLIENT, "node_modules", ".bin", "jscpd");
  run(bin, ["--config", ".jscpd.json", "--reporters", "json", "--silent", "--output", reportDir]);
  const reportPath = join(reportDir, "jscpd-report.json");
  if (!existsSync(reportPath)) {
    return { result: { tool: "jscpd", area: "client, python", ok: false, count: 0, detail: "did not run, no report written", findings: [] } };
  }
  type Report = {
    statistics: { total: { percentage: number; lines: number; duplicatedLines: number; clones: number } };
    duplicates: { lines: number; firstFile: { name: string; startLoc: { line: number } }; secondFile: { name: string; startLoc: { line: number } } }[];
  };
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as Report;
  const total = report.statistics.total;
  const findings: Finding[] = report.duplicates.map((d) => ({
    file: rel(ROOT, d.firstFile.name),
    line: d.firstFile.startLoc.line,
    rule: `${d.lines} lines`,
    message: `also at ${rel(ROOT, d.secondFile.name)}:${d.secondFile.startLoc.line}`,
    severity: "warning",
  }));
  return {
    result: {
      tool: "jscpd",
      area: "client, python",
      ok: total.percentage <= maxDuplication,
      count: findings.length,
      detail: `${total.percentage.toFixed(2)}% duplicated lines (${total.duplicatedLines} of ${total.lines}), ${findings.length} clones, gate at most ${maxDuplication}%`,
      findings,
    },
    stats: { percentage: total.percentage, duplicatedLines: total.duplicatedLines, lines: total.lines, clones: total.clones },
  };
}

// ---- report ------------------------------------------------------------------------

const areas = areasToRun();
const hotspots: Hotspot[] = [];
const results: ToolResult[] = [];
const tests: Summary["tests"] = {};

function collect(r: ToolResult, t?: TestTally) {
  results.push(r);
  if (t) tests[r.tool] = t;
}

if (areas.includes("client")) {
  collect(oxlint());
  collect(eslint(hotspots));
  collect(knip());
  const v = vitest();
  collect(v.result, v.tests);
}
if (areas.includes("python")) {
  collect(ruff());
  ruffComplexity(hotspots);
  collect(vulture());
  const p = pytest();
  collect(p.result, p.tests);
}
if (areas.includes("ios")) collect(swiftlint());

let duplication: Summary["duplication"];
if (areas.includes("client") || areas.includes("python")) {
  const dup = jscpd();
  collect(dup.result);
  duplication = dup.stats;
}

const gated = results.filter((r) => !r.skipped);
const allOk = gated.every((r) => r.ok);
const sha = run("git", ["rev-parse", "--short", "HEAD"]).stdout.trim();
const summary: Summary = {
  ok: allOk,
  generatedAt: new Date().toISOString(),
  commit: sha,
  areas,
  maxDuplication,
  results,
  hotspots: hotspots.sort((a, b) => b.complexity - a.complexity).slice(0, 15),
  tests,
  duplication,
};
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

// ---- markdown --------------------------------------------------------------------------

const where = (f: Finding) => (f.line ? `${f.file}:${f.line}` : f.file);
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const status = (ok: boolean, skipped?: boolean) => (skipped ? "skipped" : ok ? "PASS" : "FAIL");

function topOffenders(r: ToolResult): string {
  const counts = new Map<string, number>();
  for (const f of r.findings) counts.set(f.file, (counts.get(f.file) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return top.length ? top.map(([file, n]) => `${file} (${n})`).join(", ") : "none";
}

function markdown(): string {
  let md = `# Code quality report\n\n`;
  md += `Generated ${date} at commit \`${sha}\`. Areas: ${areas.join(", ") || "none"}. Gate: ${status(allOk)}.\n\n`;
  md += `## Summary\n\n| tool | scope | findings | detail | gate |\n|---|---|---|---|---|\n`;
  for (const r of results) md += `| ${r.tool} | ${r.area} | ${r.count} | ${cell(r.detail)} | ${status(r.ok, r.skipped)} |\n`;

  if (Object.keys(tests).length) {
    md += `\n## Tests and coverage\n\n| suite | passed | failed | coverage | floor |\n|---|---|---|---|---|\n`;
    for (const [name, t] of Object.entries(tests)) {
      md += `| ${name} | ${t.passed} | ${t.failed} | ${(t.coverage ?? 0).toFixed(1)}% | ${t.floor}% |\n`;
    }
    md += `\nPytest covers ${COVERED_MODULES.map((m) => `\`${m}\``).join(", ")}. Vitest covers the pure helpers in \`client/src/lib\`.\n`;
  }

  if (duplication) {
    md += `\n## Duplication\n\n${duplication.percentage.toFixed(2)}% of ${duplication.lines} lines are duplicated in ${duplication.clones} clones (gate at most ${maxDuplication}%).\n`;
  }

  if (hotspots.length) {
    md += `\n## Complexity hot spots (report only)\n\nRuff C901 above 10 and sonarjs cognitive complexity above 15, highest first.\n\n| file | line | function | complexity | tool |\n|---|---|---|---|---|\n`;
    for (const h of summary.hotspots) md += `| \`${h.file}\` | ${h.line ?? ""} | ${cell(h.name)} | ${h.complexity} | ${h.tool} |\n`;
  }

  md += `\n## Top offenders\n\n| tool | files with the most findings |\n|---|---|\n`;
  for (const r of results.filter((x) => x.findings.length)) md += `| ${r.tool} | ${cell(topOffenders(r))} |\n`;

  for (const r of results) {
    if (!r.findings.length) continue;
    const shown = r.findings.slice(0, MAX_FINDINGS_SHOWN);
    md += `\n## ${r.tool}\n\n| location | rule | message |\n|---|---|---|\n`;
    for (const f of shown) md += `| \`${where(f)}\` | ${cell(f.rule)} | ${cell(f.message)} |\n`;
    if (r.findings.length > shown.length) md += `| … | ${r.findings.length - shown.length} more | |\n`;
  }
  return md + "\n";
}

const md = markdown();
writeFileSync(join(outDir, "report.md"), md);
if (args.md) {
  mkdirSync(resolve(ROOT, args.md, ".."), { recursive: true });
  writeFileSync(resolve(ROOT, args.md), md);
}
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

// ---- sticky PR comment ------------------------------------------------------------------

function upsertComment(body: string) {
  const repo = process.env.REPO!;
  const pr = process.env.PR_NUMBER!;
  const list = run("gh", ["api", `repos/${repo}/issues/${pr}/comments`, "--paginate", "-q", `[.[] | select(.body | startswith("${MARK}")) | .id]`]);
  const ids = parseJson<number[]>(list.stdout) ?? [];
  const bodyPath = join(outDir, "comment.md");
  writeFileSync(bodyPath, body);
  if (ids.length) {
    run("gh", ["api", "-X", "PATCH", `repos/${repo}/issues/comments/${ids[0]}`, "-F", `body=@${bodyPath}`]);
    console.log(`updated comment ${ids[0]}`);
  } else {
    run("gh", ["api", "-X", "POST", `repos/${repo}/issues/${pr}/comments`, "-F", `body=@${bodyPath}`]);
    console.log("created comment");
  }
}

if (args.comment && process.env.PR_NUMBER) {
  const rows = results.map((r) => `| ${r.tool} | ${r.area} | ${cell(r.detail)} | ${status(r.ok, r.skipped)} |`).join("\n");
  const body = `${MARK}\n## Code quality: ${allOk ? "PASS" : "FAIL"}\n\n| tool | scope | result | gate |\n|---|---|---|---|\n${rows}\n\n<sub>Full report in the job summary. Gates: lint, dead code and swiftlint errors, duplication above ${maxDuplication}%, failing tests, coverage under the floors. Warnings and hot spots are informational.</sub>\n`;
  upsertComment(body);
}

if (!allOk) process.exit(1);
