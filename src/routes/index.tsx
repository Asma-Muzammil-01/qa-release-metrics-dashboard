import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, RadialBar, RadialBarChart, PolarAngleAxis,
} from "recharts";
import { buildReleases, readiness, type Release } from "@/lib/qa-data";
import { CompareView } from "@/components/CompareView";
import { RiskAnalyzer } from "@/components/RiskAnalyzer";
import { exportReleasePdf } from "@/lib/pdf-export";
import type { RiskReport } from "@/lib/risk.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QualityPulse — QA Metrics & Release Readiness" },
      { name: "description", content: "Executive dashboard for test execution, defect density, open bugs and release readiness." },
      { property: "og:title", content: "QualityPulse — QA Metrics & Release Readiness" },
      { property: "og:description", content: "Executive dashboard for test execution, defect density, open bugs and release readiness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
};
const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false };

function Dashboard() {
  const [releases, setReleases] = useState<Release[]>(() => buildReleases());
  const [idx, setIdx] = useState(1);
  const [view, setView] = useState<"dashboard" | "compare" | "ai">("dashboard");
  const [reports, setReports] = useState<Record<string, RiskReport | null>>({});
  const [exporting, setExporting] = useState(false);
  const chartsRef = useRef<HTMLElement>(null);
  const r = releases[idx] ?? releases[0]!;
  const rKey = r.project + r.version;
  const { score, pass } = useMemo(() => readiness(r), [r]);
  const projects = [...new Set(releases.map((x) => x.project))];

  const update = (next: Release) =>
    setReleases((all) => all.map((x, i) => (i === idx ? next : x)));

  const doExport = async () => {
    setExporting(true);
    if (view !== "dashboard") { setView("dashboard"); await new Promise((res) => setTimeout(res, 600)); }
    try {
      if (chartsRef.current) await exportReleasePdf(r, chartsRef.current, reports[rKey] ?? null);
    } finally {
      setExporting(false);
    }
  };

  const sevData = [
    { name: "Critical", value: r.bugs.critical, color: "var(--sev-critical)" },
    { name: "High", value: r.bugs.high, color: "var(--sev-high)" },
    { name: "Medium", value: r.bugs.medium, color: "var(--sev-medium)" },
    { name: "Low", value: r.bugs.low, color: "var(--sev-low)" },
  ];
  const totalBugs = sevData.reduce((a, s) => a + s.value, 0);
  const rateData = r.execution.map((d) => ({
    day: d.day,
    rate: Math.round((d.passed / Math.max(1, d.passed + d.failed)) * 1000) / 10,
  }));
  const status = score >= 85 ? ["GO", "text-pass"] : score >= 70 ? ["CAUTION", "text-warn"] : ["NO-GO", "text-fail"];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar release={r} onApply={update} />
      <main className="flex-1 p-5 lg:p-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">QualityPulse · Release Readiness</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {r.project} <span className="font-mono text-primary">{r.version}</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <div key={p} className="panel flex items-center gap-1 p-1">
                <span className="eyebrow px-2">{p}</span>
                {releases.map((x, i) => x.project === p && (
                  <button
                    key={x.version}
                    onClick={() => setIdx(i)}
                    className={`rounded-md px-3 py-1 font-mono text-xs transition-colors ${i === idx ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    {x.version}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </header>

        <nav className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="panel flex gap-1 p-1">
            {([["dashboard", "Dashboard"], ["compare", "Compare releases"], ["ai", "AI risk analysis"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === k ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
            ))}
          </div>
          <button onClick={doExport} disabled={exporting} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50">
            {exporting ? "Preparing PDF…" : `Export ${r.version} report (PDF)`}
          </button>
        </nav>

        {view === "compare" && <CompareView releases={releases} />}
        {view === "ai" && <RiskAnalyzer release={r} report={reports[rKey] ?? null} onReport={(rep) => setReports((s) => ({ ...s, [rKey]: rep }))} />}

        {view === "dashboard" && (
        <section ref={chartsRef} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="panel row-span-2 flex flex-col p-5">
            <p className="eyebrow">Release Readiness Score</p>
            <div className="relative h-52">
              <ResponsiveContainer>
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ v: score }]} startAngle={220} endAngle={-40}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="v" cornerRadius={8} fill={score >= 85 ? "var(--pass)" : score >= 70 ? "var(--warn)" : "var(--fail)"} background={{ fill: "var(--muted)" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-5xl font-semibold">{score}%</span>
                <span className={`mt-1 font-mono text-xs tracking-widest ${status[1]}`}>{status[0]}</span>
              </div>
            </div>
            <dl className="mt-auto grid grid-cols-2 gap-3 text-sm">
              <Stat label="7d pass rate" value={`${pass}%`} />
              <Stat label="Coverage" value={`${r.coverage}%`} />
              <Stat label="Open bugs" value={totalBugs} />
              <Stat label="Critical" value={r.bugs.critical} tone={r.bugs.critical ? "text-fail" : "text-pass"} />
            </dl>
          </div>

          <Card title="Test Execution · Pass / Fail (30 days)" className="md:col-span-1 xl:col-span-3">
            <ResponsiveContainer height={220}>
              <BarChart data={r.execution}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={4} />
                <YAxis {...axis} width={36} />
                <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="passed" stackId="a" fill="var(--pass)" />
                <Bar dataKey="failed" stackId="a" fill="var(--fail)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Pass Rate Trend" className="xl:col-span-2">
            <ResponsiveContainer height={200}>
              <AreaChart data={rateData}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pass)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--pass)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={5} />
                <YAxis {...axis} width={36} domain={["dataMin - 3", 100]} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="rate" stroke="var(--pass)" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Open Bugs by Severity">
            <div className="relative">
              <ResponsiveContainer height={160}>
                <PieChart>
                  <Pie data={sevData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none">
                    {sevData.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip {...tip} />
                </PieChart>
              </ResponsiveContainer>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-2xl">{totalBugs}</span>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
              {sevData.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="ml-auto font-mono">{s.value}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Defect Density by Module (defects / KLOC)" className="md:col-span-2 xl:col-span-2">
            <ResponsiveContainer height={220}>
              <BarChart data={r.density} layout="vertical">
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} />
                <YAxis type="category" dataKey="module" {...axis} width={80} />
                <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="density" radius={[0, 4, 4, 0]}>
                  {r.density.map((m) => (
                    <Cell key={m.module} fill={m.density > 2 ? "var(--fail)" : m.density > 1.2 ? "var(--warn)" : "var(--pass)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Daily Failures" className="md:col-span-2 xl:col-span-2">
            <ResponsiveContainer height={220}>
              <LineChart data={r.execution}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={5} />
                <YAxis {...axis} width={36} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="failed" stroke="var(--fail)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <dt className="eyebrow">{label}</dt>
      <dd className={`font-mono text-lg ${tone}`}>{value}</dd>
    </div>
  );
}

function Card({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`panel p-5 ${className}`}>
      <p className="eyebrow mb-3">{title}</p>
      {children}
    </div>
  );
}

function Sidebar({ release, onApply }: { release: Release; onApply: (r: Release) => void }) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ passed: "", failed: "", critical: "", high: "", medium: "", low: "", coverage: "" });
  const key = release.project + release.version;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    const last = release.execution[release.execution.length - 1] ?? { day: "D-0", passed: 0, failed: 0 };
    setForm({ passed: String(last.passed), failed: String(last.failed), critical: String(release.bugs.critical), high: String(release.bugs.high), medium: String(release.bugs.medium), low: String(release.bugs.low), coverage: String(release.coverage) });
    setJson("");
  }

  const num = (v: string, fb: number) => {
    const n = Number(v);
    return v.trim() === "" || !Number.isFinite(n) || n < 0 ? fb : Math.min(n, 100000);
  };

  const applyForm = (e: React.FormEvent) => {
    e.preventDefault();
    const exec = [...release.execution];
    const last = exec[exec.length - 1] ?? { day: "D-0", passed: 0, failed: 0 };
    exec[exec.length - 1] = { ...last, passed: num(form.passed, last.passed), failed: num(form.failed, last.failed) };
    onApply({
      ...release,
      execution: exec,
      coverage: Math.min(100, num(form.coverage, release.coverage)),
      bugs: {
        critical: num(form.critical, release.bugs.critical),
        high: num(form.high, release.bugs.high),
        medium: num(form.medium, release.bugs.medium),
        low: num(form.low, release.bugs.low),
      },
    });
    setMsg("Dashboard updated");
  };

  const applyJson = () => {
    try {
      const d = JSON.parse(json);
      const next: Release = { ...release };
      if (d.bugs && typeof d.bugs === "object") next.bugs = { ...release.bugs, ...pickNums(d.bugs, ["critical", "high", "medium", "low"]) };
      if (typeof d.coverage === "number") next.coverage = Math.max(0, Math.min(100, d.coverage));
      if (Array.isArray(d.density)) next.density = d.density.filter((m: any) => typeof m?.module === "string" && typeof m?.density === "number").slice(0, 20).map((m: any) => ({ module: String(m.module).slice(0, 30), density: m.density }));
      if (Array.isArray(d.execution)) next.execution = d.execution.filter((x: any) => typeof x?.passed === "number" && typeof x?.failed === "number").slice(-60).map((x: any, i: number, a: any[]) => ({ day: `D-${a.length - 1 - i}`, passed: x.passed, failed: x.failed }));
      onApply(next);
      setMsg("JSON applied");
    } catch {
      setMsg("Invalid JSON");
    }
  };

  const loadSample = () => {
    setJson(JSON.stringify({ coverage: release.coverage, bugs: release.bugs, density: release.density }, null, 2));
  };

  const fields: [keyof typeof form, string][] = [
    ["passed", "Today · passed"], ["failed", "Today · failed"], ["critical", "Critical bugs"], ["high", "High bugs"],
    ["medium", "Medium bugs"], ["low", "Low bugs"], ["coverage", "Coverage %"],
  ];

  return (
    <aside className="w-full shrink-0 border-b bg-panel p-5 lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="mb-6 flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
        <span className="font-mono text-sm font-semibold tracking-wider">QUALITYPULSE</span>
      </div>
      <p className="eyebrow mb-2">Update metrics</p>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-background p-1">
        {(["form", "json"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); }} className={`rounded px-2 py-1.5 text-xs font-medium ${tab === t ? "bg-accent text-foreground" : "text-muted-foreground"}`}>
            {t === "form" ? "Data entry" : "JSON upload"}
          </button>
        ))}
      </div>
      {tab === "form" ? (
        <form onSubmit={applyForm} className="grid grid-cols-2 gap-3">
          {fields.map(([k, label]) => (
            <label key={k} className={k === "coverage" ? "col-span-2" : ""}>
              <span className="eyebrow">{label}</span>
              <input type="number" min={0} className="field mt-1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <button className="col-span-2 mt-2 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Apply to {release.version}</button>
        </form>
      ) : (
        <div className="space-y-3">
          <textarea rows={14} value={json} onChange={(e) => setJson(e.target.value.slice(0, 20000))} placeholder='{ "bugs": { "critical": 1 }, "coverage": 90 }' className="field resize-none" />
          <label className="block cursor-pointer rounded-md border border-dashed py-2 text-center text-xs text-muted-foreground hover:bg-accent">
            Upload .json file
            <input type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && f.size < 200000) setJson(await f.text()); }} />
          </label>
          <div className="flex gap-2">
            <button onClick={loadSample} className="flex-1 rounded-md border py-2 text-xs hover:bg-accent">Load current</button>
            <button onClick={applyJson} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">Apply JSON</button>
          </div>
        </div>
      )}
      {msg && <p className={`mt-3 font-mono text-xs ${msg.startsWith("Invalid") ? "text-fail" : "text-pass"}`}>› {msg}</p>}
    </aside>
  );
}

function pickNums(o: any, keys: string[]) {
  const out: Record<string, number> = {};
  for (const k of keys) if (typeof o[k] === "number" && o[k] >= 0) out[k] = Math.round(o[k]);
  return out;
}
