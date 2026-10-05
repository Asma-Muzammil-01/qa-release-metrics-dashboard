import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { readiness, type Release } from "@/lib/qa-data";

const COLORS = ["var(--pass)", "var(--sev-low)", "var(--warn)", "var(--sev-high)", "var(--fail)"];
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
};
const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false };

export function CompareView({ releases }: { releases: Release[] }) {
  const [sel, setSel] = useState<number[]>(() => releases.map((_, i) => i));
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort()));
  const picked = sel.map((i) => ({ r: releases[i]!, i }));
  const label = (r: Release) => `${r.project} ${r.version}`;

  const rows = picked.map(({ r }) => {
    const { score, pass } = readiness(r);
    const total = r.bugs.critical + r.bugs.high + r.bugs.medium + r.bugs.low;
    const avgD = r.density.reduce((a, m) => a + m.density, 0) / Math.max(1, r.density.length);
    return { name: label(r), score, pass, coverage: r.coverage, total, critical: r.bugs.critical, high: r.bugs.high, medium: r.bugs.medium, low: r.bugs.low, density: Math.round(avgD * 100) / 100 };
  });
  const base = rows[0];

  const trend = Array.from({ length: 30 }, (_, d) => {
    const o: Record<string, number | string> = { day: `D-${29 - d}` };
    picked.forEach(({ r }) => {
      const x = r.execution[r.execution.length - 30 + d];
      if (x) o[label(r)] = Math.round((x.passed / Math.max(1, x.passed + x.failed)) * 1000) / 10;
    });
    return o;
  });

  const metrics: [keyof (typeof rows)[number], string, boolean, string][] = [
    ["score", "Readiness", true, "%"], ["pass", "7d pass rate", true, "%"], ["coverage", "Coverage", true, "%"],
    ["total", "Open bugs", false, ""], ["critical", "Critical", false, ""], ["density", "Avg density", false, ""],
  ];

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <span className="eyebrow px-1">Compare</span>
        {releases.map((r, i) => (
          <button key={i} onClick={() => toggle(i)} className={`rounded-md border px-3 py-1 font-mono text-xs ${sel.includes(i) ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent"}`}>
            {label(r)}
          </button>
        ))}
      </div>

      {picked.length < 2 ? (
        <p className="panel p-6 text-sm text-muted-foreground">Select at least two releases to compare.</p>
      ) : (
        <>
          <div className="panel overflow-x-auto p-5">
            <p className="eyebrow mb-3">Metric comparison · Δ vs {base?.name}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="eyebrow pb-2">Metric</th>
                  {rows.map((r) => <th key={r.name} className="eyebrow pb-2 text-right">{r.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {metrics.map(([k, name, higherBetter, unit]) => (
                  <tr key={k} className="border-t">
                    <td className="py-2 text-muted-foreground">{name}</td>
                    {rows.map((r, j) => {
                      const v = r[k] as number;
                      const d = j === 0 || !base ? 0 : Math.round((v - (base[k] as number)) * 10) / 10;
                      const good = higherBetter ? d > 0 : d < 0;
                      return (
                        <td key={r.name} className="py-2 text-right font-mono">
                          {v}{unit}
                          {j > 0 && d !== 0 && <span className={`ml-2 text-xs ${good ? "text-pass" : "text-fail"}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="panel p-5">
              <p className="eyebrow mb-3">Readiness · Pass rate · Coverage</p>
              <ResponsiveContainer height={240}>
                <BarChart data={rows}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} width={36} domain={[0, 100]} />
                  <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="score" name="Readiness" fill="var(--pass)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="pass" name="Pass rate" fill="var(--sev-low)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="coverage" name="Coverage" fill="var(--warn)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="panel p-5">
              <p className="eyebrow mb-3">Open bugs by severity</p>
              <ResponsiveContainer height={240}>
                <BarChart data={rows}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} width={36} />
                  <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="critical" stackId="s" name="Critical" fill="var(--sev-critical)" />
                  <Bar dataKey="high" stackId="s" name="High" fill="var(--sev-high)" />
                  <Bar dataKey="medium" stackId="s" name="Medium" fill="var(--sev-medium)" />
                  <Bar dataKey="low" stackId="s" name="Low" fill="var(--sev-low)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="panel p-5 xl:col-span-2">
              <p className="eyebrow mb-3">Pass rate trend · 30 days</p>
              <ResponsiveContainer height={240}>
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" {...axis} interval={4} />
                  <YAxis {...axis} width={36} domain={["dataMin - 3", 100]} />
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {picked.map(({ r }, j) => (
                    <Line key={label(r)} type="monotone" dataKey={label(r)} stroke={COLORS[j % COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
