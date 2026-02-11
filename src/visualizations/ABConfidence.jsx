import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import BackButton from "../components/BackButton";

function normalPDF(x, mean, std) {
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / std) ** 2);
}

function getZ(conf) {
  const zMap = { 0.80: 1.282, 0.85: 1.44, 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
  return zMap[conf] || 1.96;
}

function calcPower(nC, nT, pC, pT, alpha) {
  const delta = pT - pC;
  if (delta === 0) return 0;
  const seAlt = Math.sqrt(pC * (1 - pC) / nC + pT * (1 - pT) / nT);
  const zAlpha = getZ(1 - alpha / 2);
  const powerZ = Math.abs(delta) / seAlt - zAlpha;
  const t = 1 / (1 + 0.2316419 * Math.abs(powerZ));
  const d = 0.3989422804014327;
  const p = d * Math.exp(-powerZ * powerZ / 2) * (t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))));
  return powerZ >= 0 ? 1 - p : p;
}

function minSampleSize(pC, pT, alpha, power) {
  const z_alpha = getZ(1 - alpha / 2);
  const z_beta = getZ(power);
  const delta = Math.abs(pT - pC);
  if (delta === 0) return Infinity;
  return Math.ceil(((z_alpha * Math.sqrt(2 * pC * (1 - pC)) + z_beta * Math.sqrt(pC * (1 - pC) + pT * (1 - pT))) ** 2) / (delta ** 2));
}

export default function ABConfidence() {
  const [nC, setNC] = useState(1000);
  const [nT, setNT] = useState(1000);
  const [pC, setPC] = useState(10);
  const [pT, setPT] = useState(12);
  const [confLevel, setConfLevel] = useState(0.95);

  const pCr = pC / 100;
  const pTr = pT / 100;

  const analysis = useMemo(() => {
    const uplift = pTr - pCr;
    const relUplift = pCr > 0 ? uplift / pCr : 0;
    const seDiff = Math.sqrt(pCr * (1 - pCr) / nC + pTr * (1 - pTr) / nT);
    const z = getZ(confLevel);
    const ciLow = uplift - z * seDiff;
    const ciHigh = uplift + z * seDiff;
    const pPooled = (pCr * nC + pTr * nT) / (nC + nT);
    const sePooled = Math.sqrt(pPooled * (1 - pPooled) * (1 / nC + 1 / nT));
    const zStat = sePooled > 0 ? uplift / sePooled : 0;
    const absZ = Math.abs(zStat);
    const t = 1 / (1 + 0.2316419 * absZ);
    const d = 0.3989422804014327;
    const tail = d * Math.exp(-absZ * absZ / 2) * (t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))));
    const pValue = 2 * tail;
    const significant = pValue < (1 - confLevel);
    const power = calcPower(nC, nT, pCr, pTr, 1 - confLevel);
    const minN = minSampleSize(pCr, pTr, 1 - confLevel, 0.80);

    const seC = Math.sqrt(pCr * (1 - pCr) / nC);
    const seT = Math.sqrt(pTr * (1 - pTr) / nT);
    const minX = Math.min(pCr - 4 * seC, pTr - 4 * seT);
    const maxX = Math.max(pCr + 4 * seC, pTr + 4 * seT);
    const steps = 200;
    const distData = [];
    for (let i = 0; i <= steps; i++) {
      const x = minX + (maxX - minX) * (i / steps);
      distData.push({ x: +(x * 100).toFixed(3), control: normalPDF(x, pCr, seC), test: normalPDF(x, pTr, seT) });
    }

    const upliftData = [];
    const minU = uplift - 4 * seDiff;
    const maxU = uplift + 4 * seDiff;
    for (let i = 0; i <= steps; i++) {
      const x = minU + (maxU - minU) * (i / steps);
      const pdf = normalPDF(x, uplift, seDiff);
      upliftData.push({ x: +(x * 100).toFixed(3), pdf, negative: x < 0 ? pdf : 0, positive: x >= 0 ? pdf : 0 });
    }

    return { uplift, relUplift, seDiff, ciLow, ciHigh, zStat, pValue, significant, power, minN, distData, upliftData };
  }, [nC, nT, pCr, pTr, confLevel]);

  const fmtPP = (v) => (v * 100 >= 0 ? "+" : "") + (v * 100).toFixed(2) + " п.п.";

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "#08080e", color: "#e0e0e8", minHeight: "100vh", padding: "28px 20px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');input[type=range]{height:4px}`}</style>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <BackButton />
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: "#fff", margin: "0 0 2px", letterSpacing: "-0.5px" }}>
          A/B тест — доверительный интервал аплифта
        </h1>
        <p style={{ color: "#555", fontSize: 11, margin: "0 0 24px" }}>Δ = p_test − p_control · CI = Δ ± z × SE(Δ)</p>

        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[0.80, 0.90, 0.95, 0.99].map(c => (
            <button key={c} onClick={() => setConfLevel(c)} style={{
              padding: "6px 14px", background: confLevel === c ? "#252545" : "#111118", color: confLevel === c ? "#fff" : "#555",
              border: confLevel === c ? "1px solid #454570" : "1px solid #1e1e2e", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
            }}>{(c * 100).toFixed(0)}%</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#111118", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e1e2e" }}>
            <div style={{ fontSize: 11, color: "#f472b6", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Control</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#888" }}>n</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{nC.toLocaleString()}</span>
              </div>
              <input type="range" min={100} max={50000} step={100} value={nC} onChange={e => setNC(+e.target.value)} style={{ width: "100%", accentColor: "#f472b6" }} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#888" }}>p</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{pC.toFixed(1)}%</span>
              </div>
              <input type="range" min={0.5} max={50} step={0.5} value={pC} onChange={e => setPC(+e.target.value)} style={{ width: "100%", accentColor: "#f472b6" }} />
            </div>
          </div>
          <div style={{ background: "#111118", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e1e2e" }}>
            <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Test</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#888" }}>n</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{nT.toLocaleString()}</span>
              </div>
              <input type="range" min={100} max={50000} step={100} value={nT} onChange={e => setNT(+e.target.value)} style={{ width: "100%", accentColor: "#60a5fa" }} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#888" }}>p</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{pT.toFixed(1)}%</span>
              </div>
              <input type="range" min={0.5} max={50} step={0.5} value={pT} onChange={e => setPT(+e.target.value)} style={{ width: "100%", accentColor: "#60a5fa" }} />
            </div>
          </div>
        </div>

        <div style={{
          background: analysis.significant ? "linear-gradient(135deg, #0d2818 0%, #0a1a10 100%)" : "linear-gradient(135deg, #281a0d 0%, #1a1410 100%)",
          border: `1px solid ${analysis.significant ? "#1a4030" : "#403020"}`, borderRadius: 12, padding: "16px 20px", marginBottom: 24,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>Аплифт</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: analysis.uplift >= 0 ? "#34d399" : "#ff6666" }}>{fmtPP(analysis.uplift)}</div>
            <div style={{ fontSize: 10, color: "#666" }}>({(analysis.relUplift * 100).toFixed(1)}% отн.)</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>CI ({(confLevel * 100).toFixed(0)}%)</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>[{fmtPP(analysis.ciLow)}, {fmtPP(analysis.ciHigh)}]</div>
            <div style={{ fontSize: 10, color: analysis.ciLow > 0 || analysis.ciHigh < 0 ? "#34d399" : "#fbbf24" }}>
              {analysis.ciLow > 0 || analysis.ciHigh < 0 ? "не содержит 0 ✓" : "содержит 0"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>p-value</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: analysis.pValue < 0.05 ? "#34d399" : "#fbbf24" }}>
              {analysis.pValue < 0.001 ? "<0.001" : analysis.pValue.toFixed(4)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: analysis.significant ? "#34d399" : "#fbbf24" }}>
              {analysis.significant ? "значимо ✓" : "не значимо"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>Мощность</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: analysis.power >= 0.8 ? "#34d399" : analysis.power >= 0.5 ? "#fbbf24" : "#ff6666" }}>
              {(analysis.power * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 10, color: "#666" }}>нужно ≥{analysis.minN.toLocaleString()} на группу</div>
          </div>
        </div>

        <div style={{ background: "#111118", borderRadius: 12, padding: "16px 12px 8px", border: "1px solid #1e1e2e", marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#e0e0e8", fontWeight: 600, paddingLeft: 8, marginBottom: 8 }}>Распределения средних</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analysis.distData}>
              <defs>
                <linearGradient id="ctrlGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" stopOpacity={0.4} /><stop offset="100%" stopColor="#f472b6" stopOpacity={0} /></linearGradient>
                <linearGradient id="testGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} /><stop offset="100%" stopColor="#60a5fa" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
              <XAxis dataKey="x" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "#252535" }} unit="%" />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#1a1a28", border: "1px solid #333", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="control" stroke="#f472b6" strokeWidth={2} fill="url(#ctrlGrad)" dot={false} />
              <Area type="monotone" dataKey="test" stroke="#60a5fa" strokeWidth={2} fill="url(#testGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#111118", borderRadius: 12, padding: "16px 12px 8px", border: "1px solid #1e1e2e", marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#e0e0e8", fontWeight: 600, paddingLeft: 8, marginBottom: 8 }}>Распределение аплифта (Δ)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analysis.upliftData}>
              <defs>
                <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.5} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.05} /></linearGradient>
                <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6666" stopOpacity={0.5} /><stop offset="100%" stopColor="#ff6666" stopOpacity={0.05} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
              <XAxis dataKey="x" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "#252535" }} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#1a1a28", border: "1px solid #333", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="positive" stroke="#34d399" strokeWidth={1.5} fill="url(#posGrad)" dot={false} name="Δ > 0" />
              <Area type="monotone" dataKey="negative" stroke="#ff6666" strokeWidth={1.5} fill="url(#negGrad)" dot={false} name="Δ < 0" />
              <ReferenceLine x={0} stroke="#fbbf24" strokeDasharray="4 4" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#0c0c14", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e1e2e", fontSize: 11, lineHeight: 2 }}>
          <div style={{ color: "#666" }}>SE(Δ) = √(p_c·(1−p_c)/n_c + p_t·(1−p_t)/n_t) = <span style={{ color: "#fff", fontWeight: 600 }}>{(analysis.seDiff * 100).toFixed(4)} п.п.</span></div>
          <div style={{ color: "#666" }}>CI = {fmtPP(analysis.uplift)} ± {getZ(confLevel).toFixed(3)} × {(analysis.seDiff * 100).toFixed(4)} = <span style={{ color: "#fff", fontWeight: 600 }}>[{fmtPP(analysis.ciLow)}, {fmtPP(analysis.ciHigh)}]</span></div>
        </div>
      </div>
    </div>
  );
}
