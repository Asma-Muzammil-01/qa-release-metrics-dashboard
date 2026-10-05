import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeRelease, type RiskReport } from "@/lib/risk.functions";
import { readiness, type Release } from "@/lib/qa-data";

const sevTone: Record<string, string> = {
  critical: "bg-[var(--sev-critical)]", high: "bg-[var(--sev-high)]", medium: "bg-[var(--sev-medium)]", low: "bg-[var(--sev-low)]",
};

export function RiskAnalyzer({ release, report, onReport }: { release: Release; report: RiskReport | null; onReport: (r: RiskReport | null) => void }) {
  const run = useServerFn(analyzeRelease);
  const [tests, setTests] = useState("");
  const [defects, setDefects] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await run({
        data: {
          project: release.project, version: release.version, passRate: readiness(release).pass,
          coverage: release.coverage, bugs: release.bugs, density: release.density,
          testResults: tests, defects,
        },
      });
      if (res.ok) onReport(res.report); else setErr(res.error);
    } catch {
      setErr("Analysis failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="panel space-y-3 p-5 xl:col-span-2">
        <p className="eyebrow">AI risk analysis · {release.project} {release.version}</p>
        <p className="text-xs text-muted-foreground">Current dashboard metrics are included automatically. Add details below for a sharper analysis.</p>
        <label className="block">
          <span className="eyebrow">Test results</span>
          <textarea rows={7} value={tests} onChange={(e) => setTests(e.target.value.slice(0, 8000))} className="field mt-1 resize-none"
            placeholder="e.g. Regression suite: 1,240 run, 38 failed. Checkout E2E flaky on Safari. Payment timeout tests failing intermittently…" />
        </label>
        <label className="block">
          <span className="eyebrow">Defect details</span>
          <textarea rows={7} value={defects} onChange={(e) => setDefects(e.target.value.slice(0, 8000))} className="field mt-1 resize-none"
            placeholder="e.g. BUG-412 (Critical) Double charge on retry. BUG-398 (High) Search returns stale results…" />
        </label>
        <button onClick={go} disabled={busy} className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "Analyzing…" : "Identify risks & fixes"}
        </button>
        {err && <p className="font-mono text-xs text-fail">› {err}</p>}
      </div>

      <div className="space-y-4 xl:col-span-3">
        {!report ? (
          <div className="panel flex h-full min-h-60 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {busy ? "Reviewing release data…" : "Run an analysis to see release risks and prioritized fixes."}
          </div>
        ) : (
          <>
            <div className="panel p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow">AI verdict</p>
                <span className={`font-mono text-sm tracking-widest ${report.verdict === "GO" ? "text-pass" : report.verdict === "CAUTION" ? "text-warn" : "text-fail"}`}>{report.verdict}</span>
              </div>
              <p className="text-sm leading-relaxed">{report.summary}</p>
            </div>
            <div className="panel p-5">
              <p className="eyebrow mb-3">Release risks</p>
              <ul className="space-y-3">
                {report.risks?.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sevTone[r.severity] ?? "bg-muted"}`} />
                    <div>
                      <p className="text-sm font-medium">{r.title} <span className="ml-1 font-mono text-xs text-muted-foreground">{r.area} · {r.severity}</span></p>
                      <p className="text-xs text-muted-foreground">{r.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel p-5">
              <p className="eyebrow mb-3">Prioritized fixes</p>
              <ol className="space-y-3">
                {[...(report.fixes ?? [])].sort((a, b) => a.priority - b.priority).map((f, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary font-mono text-xs text-primary-foreground">{f.priority}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{f.action} <span className="ml-1 font-mono text-xs text-muted-foreground">effort {f.effort}</span></p>
                      <p className="text-xs text-muted-foreground">{f.rationale}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
