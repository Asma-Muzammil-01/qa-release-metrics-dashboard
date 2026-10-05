import { readiness, type Release } from "./qa-data";
import type { RiskReport } from "./risk.functions";

export async function exportReleasePdf(release: Release, chartsEl: HTMLElement, report: RiskReport | null) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
  const { score, pass } = readiness(release);
  const b = release.bugs;
  const total = b.critical + b.high + b.medium + b.low;
  const verdict = score >= 85 ? "GO" : score >= 70 ? "CAUTION" : "NO-GO";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  doc.setFillColor(22, 28, 38); doc.rect(0, 0, W, 110, "F");
  doc.setTextColor(120, 220, 160); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("QUALITYPULSE · RELEASE READINESS REPORT", M, 44);
  doc.setTextColor(255, 255, 255); doc.setFontSize(22);
  doc.text(`${release.project} ${release.version}`, M, 76);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(180, 190, 200);
  doc.text(`Generated ${new Date().toLocaleString()}`, M, 94);
  y = 150;

  const col: [number, number, number] = verdict === "GO" ? [34, 160, 90] : verdict === "CAUTION" ? [210, 150, 20] : [210, 60, 50];
  doc.setTextColor(30, 30, 30); doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Executive summary", M, y); y += 22;
  doc.setFontSize(40); doc.setTextColor(...col); doc.text(`${score}%`, M, y + 28);
  doc.setFontSize(12); doc.text(verdict, M + 120, y + 26);
  doc.setFont("helvetica", "normal"); doc.setTextColor(90, 90, 90); doc.setFontSize(9);
  doc.text("Release readiness score", M, y + 46);
  y += 76;

  const kpis: [string, string][] = [
    ["7-day pass rate", `${pass}%`], ["Code coverage", `${release.coverage}%`],
    ["Open bugs", String(total)], ["Critical / High", `${b.critical} / ${b.high}`],
  ];
  const cw = (W - M * 2) / 4;
  kpis.forEach(([l, v], i) => {
    const x = M + i * cw;
    doc.setFillColor(244, 246, 248); doc.roundedRect(x, y, cw - 8, 54, 4, 4, "F");
    doc.setFontSize(8); doc.setTextColor(110, 110, 110); doc.text(l.toUpperCase(), x + 10, y + 18);
    doc.setFontSize(16); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold"); doc.text(v, x + 10, y + 42);
    doc.setFont("helvetica", "normal");
  });
  y += 80;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Defect density by module (defects / KLOC)", M, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const maxD = Math.max(...release.density.map((m) => m.density), 1);
  release.density.forEach((m) => {
    doc.setTextColor(60, 60, 60); doc.text(m.module, M, y + 8);
    const c: [number, number, number] = m.density > 2 ? [210, 60, 50] : m.density > 1.2 ? [210, 150, 20] : [34, 160, 90];
    doc.setFillColor(...c); doc.rect(M + 90, y, ((W - M * 2 - 140) * m.density) / maxD, 10, "F");
    doc.text(m.density.toFixed(1), W - M - 30, y + 8);
    y += 18;
  });
  y += 14;

  const write = (t: string, size = 9, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(40, 40, 40);
    for (const line of doc.splitTextToSize(t, W - M * 2) as string[]) {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(line, M, y); y += size + 4;
    }
  };

  if (report) {
    write("AI risk assessment", 11, true); y += 2;
    write(`Verdict: ${report.verdict}. ${report.summary}`);
    y += 6; write("Key risks", 10, true);
    report.risks?.forEach((r) => write(`• [${r.severity.toUpperCase()}] ${r.title} (${r.area}) — ${r.detail}`));
    y += 6; write("Prioritized fixes", 10, true);
    [...(report.fixes ?? [])].sort((a, z) => a.priority - z.priority)
      .forEach((f) => write(`${f.priority}. ${f.action} (effort ${f.effort}) — ${f.rationale}`));
  }

  const canvas = await html2canvas(chartsEl, { backgroundColor: getComputedStyle(document.body).backgroundColor, scale: 2 });
  doc.addPage();
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
  doc.text("Dashboard charts", M, M);
  const iw = W - M * 2;
  const ih = (canvas.height * iw) / canvas.width;
  const maxH = H - M * 2 - 20;
  const scale = Math.min(1, maxH / ih);
  doc.addImage(canvas.toDataURL("image/png"), "PNG", M, M + 14, iw * scale, ih * scale);

  doc.save(`QualityPulse_${release.project.replace(/\s+/g, "-")}_${release.version}.pdf`);
}
