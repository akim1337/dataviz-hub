import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import BackButton from "../components/BackButton";

const REF_POINTS = [
  { val: 0, prob: 0 },
  { val: 50, prob: 0.10 },
  { val: 100, prob: 0.20 },
  { val: 200, prob: 0.30 },
  { val: 300, prob: 0.35 },
  { val: 400, prob: 0.37 },
];

const CONV_POINTS = [
  { val: 0, prob: 0 },
  { val: 50, prob: 0.10 },
  { val: 100, prob: 0.20 },
  { val: 200, prob: 0.30 },
  { val: 300, prob: 0.45 },
  { val: 400, prob: 0.60 },
  { val: 500, prob: 0.80 },
];

function lerp(points, x) {
  if (x <= points[0].val) return points[0].prob;
  if (x >= points[points.length - 1].val) return points[points.length - 1].prob;
  for (let i = 0; i < points.length - 1; i++) {
    if (x >= points[i].val && x <= points[i + 1].val) {
      const t = (x - points[i].val) / (points[i + 1].val - points[i].val);
      return points[i].prob + t * (points[i + 1].prob - points[i].prob);
    }
  }
  return 0;
}

function profit(x, y, revenue) {
  return lerp(REF_POINTS, x) * lerp(CONV_POINTS, y) * (revenue - x - y);
}

const STEP = 10;

export default function ReferralOptimizer() {
  const [revenue, setRevenue] = useState(450);
  const [selectedX, setSelectedX] = useState(100);
  const [selectedY, setSelectedY] = useState(100);
  const [showLTV, setShowLTV] = useState(false);

  const effectiveRevenue = showLTV ? revenue * 5 : revenue;

  const { optimal } = useMemo(() => {
    let best = { x: 0, y: 0, profit: -Infinity };
    for (let x = 0; x <= 400; x += STEP) {
      for (let y = 0; y <= 500; y += STEP) {
        const p = profit(x, y, effectiveRevenue);
        if (p > best.profit) best = { x, y, profit: p };
      }
    }
    return { optimal: best };
  }, [effectiveRevenue]);

  const refCurveData = [];
  for (let x = 0; x <= 400; x += 10) {
    refCurveData.push({ x, prob: Math.round(lerp(REF_POINTS, x) * 100) });
  }
  const convCurveData = [];
  for (let y = 0; y <= 500; y += 10) {
    convCurveData.push({ y, prob: Math.round(lerp(CONV_POINTS, y) * 100) });
  }

  const profitByY = useMemo(() => {
    const xVals = [50, 100, 150, 200, 300];
    const data = [];
    for (let y = 0; y <= 500; y += 10) {
      const point = { y };
      xVals.forEach(x => { point[`x${x}`] = Math.round(profit(x, y, effectiveRevenue) * 100) / 100; });
      data.push(point);
    }
    return { data, xVals };
  }, [effectiveRevenue]);

  const heatmapData = useMemo(() => {
    const xVals = [50, 100, 150, 200, 250, 300, 350, 400];
    const yVals = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    return { xVals, yVals, cells: xVals.map(x => yVals.map(y => ({ x, y, p: profit(x, y, effectiveRevenue) }))) };
  }, [effectiveRevenue]);

  const maxProfit = useMemo(() => Math.max(...heatmapData.cells.flat().map(c => c.p)), [heatmapData]);
  const minProfit = useMemo(() => Math.min(...heatmapData.cells.flat().map(c => c.p)), [heatmapData]);

  function heatColor(val) {
    if (val <= 0) {
      const t = Math.min(1, Math.abs(val) / Math.abs(minProfit || 1));
      return `rgb(${Math.round(30 + t * 180)},${Math.round(30 - t * 15)},${Math.round(40 - t * 20)})`;
    }
    const t = Math.min(1, val / (maxProfit || 1));
    return `rgb(${Math.round(25 - t * 10)},${Math.round(45 + t * 160)},${Math.round(45 + t * 80)})`;
  }

  const currentProfit = profit(selectedX, selectedY, effectiveRevenue);
  const pRef = lerp(REF_POINTS, selectedX);
  const pConv = lerp(CONV_POINTS, selectedY);
  const colors = ["#f472b6", "#a78bfa", "#60a5fa", "#34d399", "#fbbf24"];

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "#0a0a0f", color: "#e0e0e8", minHeight: "100vh", padding: "32px 24px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <BackButton />
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          Оптимизация реферальной программы
        </h1>
        <p style={{ color: "#666", fontSize: 13, margin: "0 0 28px" }}>f(X, Y) = P_ref(X) × P_conv(Y) × (Revenue − X − Y)</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 28, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#151520", borderRadius: 8, border: "1px solid #252535", overflow: "hidden" }}>
            <button onClick={() => setShowLTV(false)} style={{ padding: "8px 16px", background: !showLTV ? "#252540" : "transparent", color: !showLTV ? "#fff" : "#555", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>1 поездка: {revenue}₽</button>
            <button onClick={() => setShowLTV(true)} style={{ padding: "8px 16px", background: showLTV ? "#252540" : "transparent", color: showLTV ? "#fff" : "#555", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>LTV (×5): {revenue * 5}₽</button>
          </div>
          <input type="range" min={200} max={800} step={50} value={revenue} onChange={e => setRevenue(+e.target.value)} style={{ width: 120, accentColor: "#60a5fa" }} />
          <span style={{ color: "#555", fontSize: 11 }}>ср. чек</span>
        </div>

        <div style={{ background: "linear-gradient(135deg, #0d2818 0%, #0a1a2e 100%)", border: "1px solid #1a4030", borderRadius: 12, padding: "16px 20px", marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: "#34d399", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Оптимальная точка</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>X = {optimal.x}₽ · Y = {optimal.y}₽</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#666", fontSize: 11 }}>Профит на юзера</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#34d399" }}>{optimal.profit.toFixed(1)}₽</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
          <div style={{ background: "#111118", borderRadius: 12, padding: "16px 12px 8px", border: "1px solid #1e1e2e" }}>
            <div style={{ fontSize: 12, color: "#a78bfa", marginBottom: 8, fontWeight: 600, paddingLeft: 8 }}>P_ref(X) — вероятность приглашения</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={refCurveData}>
                <defs><linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="x" tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#252535" }} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#252535" }} unit="%" />
                <Tooltip contentStyle={{ background: "#1a1a28", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="prob" stroke="#a78bfa" strokeWidth={2.5} fill="url(#refGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#111118", borderRadius: 12, padding: "16px 12px 8px", border: "1px solid #1e1e2e" }}>
            <div style={{ fontSize: 12, color: "#60a5fa", marginBottom: 8, fontWeight: 600, paddingLeft: 8 }}>P_conv(Y) — вероятность конверсии</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={convCurveData}>
                <defs><linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} /><stop offset="100%" stopColor="#60a5fa" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="y" tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#252535" }} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#252535" }} unit="%" />
                <Tooltip contentStyle={{ background: "#1a1a28", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="prob" stroke="#60a5fa" strokeWidth={2.5} fill="url(#convGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "#111118", borderRadius: 12, padding: "16px 12px 8px", border: "1px solid #1e1e2e", marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: "#e0e0e8", marginBottom: 4, fontWeight: 600, paddingLeft: 8 }}>Профит при разных X (ось — Y)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={profitByY.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="y" tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#252535" }} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#252535" }} />
              <Tooltip contentStyle={{ background: "#1a1a28", border: "1px solid #333", borderRadius: 8, fontSize: 11 }} />
              {profitByY.xVals.map((x, i) => (
                <Line key={x} type="monotone" dataKey={`x${x}`} stroke={colors[i]} strokeWidth={2} dot={false} name={`X=${x}₽`} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#111118", borderRadius: 12, padding: "16px 16px 12px", border: "1px solid #1e1e2e", marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: "#e0e0e8", marginBottom: 12, fontWeight: 600 }}>Карта профита: X × Y</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 2, margin: "0 auto" }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 10, color: "#666", padding: "4px 6px", textAlign: "right" }}>X \ Y</th>
                  {heatmapData.yVals.map(y => <th key={y} style={{ fontSize: 10, color: "#60a5fa", padding: "4px 2px", textAlign: "center", minWidth: 44 }}>{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {heatmapData.cells.map((row, xi) => (
                  <tr key={heatmapData.xVals[xi]}>
                    <td style={{ fontSize: 10, color: "#a78bfa", padding: "2px 6px", textAlign: "right", fontWeight: 600 }}>{heatmapData.xVals[xi]}</td>
                    {row.map((cell, yi) => {
                      const isOpt = cell.x === optimal.x && cell.y === optimal.y;
                      return (
                        <td key={yi} onClick={() => { setSelectedX(cell.x); setSelectedY(cell.y); }} style={{
                          background: heatColor(cell.p), color: cell.p > maxProfit * 0.4 ? "#fff" : cell.p < 0 ? "#ff8888" : "#ccc",
                          fontSize: 10, fontWeight: isOpt ? 700 : 400, padding: "5px 2px", textAlign: "center", borderRadius: 4, cursor: "pointer",
                          border: isOpt ? "2px solid #34d399" : "1px solid transparent", minWidth: 44,
                        }}>{cell.p.toFixed(1)}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: "#111118", borderRadius: 12, padding: "20px", border: "1px solid #1e1e2e", marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: "#e0e0e8", marginBottom: 16, fontWeight: 600 }}>Калькулятор</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#a78bfa" }}>X (рефереру)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{selectedX}₽</span>
              </div>
              <input type="range" min={0} max={400} step={10} value={selectedX} onChange={e => setSelectedX(+e.target.value)} style={{ width: "100%", accentColor: "#a78bfa" }} />
              <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>P_ref = {(pRef * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#60a5fa" }}>Y (приглашённому)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{selectedY}₽</span>
              </div>
              <input type="range" min={0} max={500} step={10} value={selectedY} onChange={e => setSelectedY(+e.target.value)} style={{ width: "100%", accentColor: "#60a5fa" }} />
              <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>P_conv = {(pConv * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div style={{ background: "#0a0a12", borderRadius: 8, padding: "14px 16px", fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ color: "#666" }}>
              <span style={{ color: "#a78bfa" }}>{(pRef * 100).toFixed(1)}%</span> × <span style={{ color: "#60a5fa" }}>{(pConv * 100).toFixed(1)}%</span> × <span style={{ color: "#fbbf24" }}>({effectiveRevenue} − {selectedX} − {selectedY})</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: currentProfit > 0 ? "#34d399" : "#ff6666" }}>
              = {currentProfit.toFixed(2)}₽ на юзера
            </div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
              vs оптимум {optimal.profit.toFixed(2)}₽ — теряешь {currentProfit > 0 && optimal.profit > 0 ? ((1 - currentProfit / optimal.profit) * 100).toFixed(0) : "—"}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
