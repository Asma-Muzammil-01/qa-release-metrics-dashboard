export type Severity = { critical: number; high: number; medium: number; low: number };
export type DayRun = { day: string; passed: number; failed: number };
export type ModuleDensity = { module: string; density: number };

export type Release = {
  project: string;
  version: string;
  execution: DayRun[];
  density: ModuleDensity[];
  bugs: Severity;
  coverage: number;
};

function makeRuns(seed: number, base: number, failRate: number): DayRun[] {
  const out: DayRun[] = [];
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 29; i >= 0; i--) {
    const total = Math.round(base + rnd() * base * 0.3);
    const fr = Math.max(0.01, failRate * (0.6 + rnd() * 0.8) * (1 - (29 - i) / 60));
    const failed = Math.round(total * fr);
    out.push({ day: `D-${i}`, passed: total - failed, failed });
  }
  return out;
}

export function buildReleases(): Release[] {
  return [
    {
      project: "Atlas Web",
      version: "v2.1.0",
      execution: makeRuns(7, 420, 0.14),
      density: [
        { module: "Auth", density: 0.8 },
        { module: "Checkout", density: 2.4 },
        { module: "Search", density: 1.3 },
        { module: "Profile", density: 0.6 },
        { module: "Reports", density: 1.9 },
      ],
      bugs: { critical: 3, high: 11, medium: 24, low: 31 },
      coverage: 74,
    },
    {
      project: "Atlas Web",
      version: "v2.2.0",
      execution: makeRuns(21, 480, 0.07),
      density: [
        { module: "Auth", density: 0.4 },
        { module: "Checkout", density: 1.1 },
        { module: "Search", density: 0.9 },
        { module: "Profile", density: 0.5 },
        { module: "Reports", density: 1.0 },
      ],
      bugs: { critical: 0, high: 4, medium: 13, low: 22 },
      coverage: 86,
    },
    {
      project: "Nimbus Mobile",
      version: "v5.0.3",
      execution: makeRuns(42, 300, 0.2),
      density: [
        { module: "Onboarding", density: 1.7 },
        { module: "Payments", density: 3.1 },
        { module: "Sync", density: 2.2 },
        { module: "Settings", density: 0.7 },
      ],
      bugs: { critical: 5, high: 14, medium: 19, low: 12 },
      coverage: 63,
    },
  ];
}

export function readiness(r: Release) {
  const tot = r.execution.slice(-7).reduce(
    (a, d) => ({ p: a.p + d.passed, f: a.f + d.failed }),
    { p: 0, f: 0 },
  );
  const pass = tot.p / Math.max(1, tot.p + tot.f);
  const bugPenalty = Math.min(1, (r.bugs.critical * 10 + r.bugs.high * 3 + r.bugs.medium) / 120);
  const avgDensity = r.density.reduce((a, m) => a + m.density, 0) / Math.max(1, r.density.length);
  const densityScore = Math.max(0, 1 - avgDensity / 4);
  const score = pass * 45 + (1 - bugPenalty) * 30 + (r.coverage / 100) * 15 + densityScore * 10;
  return { score: Math.round(score), pass: Math.round(pass * 1000) / 10 };
}
