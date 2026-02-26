import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line,
  BarChart, Bar, Cell
} from "recharts";

// ─── Math ─────────────────────────────────────────────────────────
const PHI = (z) => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
};
const phiInv = (p) => {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  if (p < 0.5) return -phiInv(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
};
const normalPDF = (x, mu, sigma) => {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
};
const calcPower = (mode, tailType, d, alpha, sigma, n1, ratio) => {
  const absD = Math.abs(d);
  if (absD < 0.001) return alpha;
  const n2 = Math.round(n1 * ratio);
  const se = mode === "one" ? sigma / Math.sqrt(n1) : sigma * Math.sqrt(1 / n1 + 1 / n2);
  const delta = absD * sigma, muH1 = delta / se;
  if (tailType === "one") {
    return d > 0 ? 1 - PHI(phiInv(1 - alpha) - muH1) : PHI(-phiInv(1 - alpha) + muH1);
  }
  const zc = phiInv(1 - alpha / 2);
  return 1 - PHI(zc - muH1) + PHI(-zc - muH1);
};

const PRESETS = [
  { name: "A/B тест",       mode: "two", tail: "two", effect: 230, alpha: 34, sigma: 36, n1: 500, ratio: 100 },
  { name: "Клинический",    mode: "two", tail: "two", effect: 240, alpha: 3,  sigma: 50, n1: 300, ratio: 100 },
  { name: "Малая выборка",  mode: "two", tail: "one", effect: 270, alpha: 34, sigma: 36, n1: 30,  ratio: 100 },
  { name: "Деградация",     mode: "two", tail: "one", effect: 150, alpha: 34, sigma: 36, n1: 200, ratio: 100 },
  { name: "Big data",       mode: "two", tail: "two", effect: 210, alpha: 7,  sigma: 36, n1: 2000,ratio: 100 },
];
const DEF = { mode: "two", tail: "two", effect: 250, alpha: 34, sigma: 36, n1: 100, ratio: 100, ci: 0.95 };

// ─── Colour palette (boxplot-explorer style) ─────────────────────
const C = {
  bg:   "#0c0e14",
  card: "#151820",
  brd:  "#252a36",
  txt:  "#cdd1da",
  dim:  "#5c6170",
  acc:  "#6193f0",
  yel:  "#f0c95b",
  pink: "#ef7b5e",
  grn:  "#4ade80",
  pur:  "#c084fc",
  ann:  "#8a90a0",
};

// ─── Module-level components (stable refs → no drag interruption) ──

function Pill({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.brd}` }}>
      {options.map(o => (
        <button key={String(o.value)} onClick={() => onChange(o.value)} style={{
          padding: "5px 12px", fontSize: 11, fontFamily: "inherit", cursor: "pointer", border: "none",
          background: value === o.value ? C.acc : "transparent",
          color: value === o.value ? "#fff" : C.dim,
          fontWeight: value === o.value ? 600 : 400,
          transition: "all 0.15s",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step = 1, display, color, disabled }) {
  return (
    <div style={{ marginBottom: 14, opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.dim }}>{label}</span>
        <span style={{ fontSize: 12, color: color || C.acc, fontWeight: 600 }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color || C.acc }} />
    </div>
  );
}

function ChartTT({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0c0e14f0", border: `1px solid ${C.brd}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontFamily: "inherit" }}>
      <div style={{ color: C.dim, marginBottom: 2 }}>{label}</div>
      {payload.filter(p => p.value > 0.001).map((p, i) => (
        <div key={i} style={{ color: p.stroke || p.color || C.txt }}>{p.name}: {p.value.toFixed(4)}</div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function ZTestViz() {
  const [mode,     setMode]     = useState("two");
  const [tailType, setTailType] = useState("two");
  const [effect,   setEffect]   = useState(250);
  const [alpha,    setAlpha]    = useState(34);
  const [sigma,    setSigma]    = useState(36);
  const [n1,       setN1]       = useState(100);
  const [ratio,    setRatio]    = useState(100);
  const [ciLevel,  setCiLevel]  = useState(0.95);
  const [showTornado, setShowTornado] = useState(false);

  const dReal     = (effect - 200) / 100;
  const alphaReal = 0.005 + (alpha / 100) * 0.145;
  const sigmaReal = 1 + (sigma / 100) * 14;
  const ratioReal = 0.25 + (ratio / 100) * 2.75;
  const isNeg     = dReal < 0;
  const absD      = Math.abs(dReal);

  const applyPreset = useCallback((p) => {
    setMode(p.mode); setTailType(p.tail); setEffect(p.effect);
    setAlpha(p.alpha); setSigma(p.sigma); setN1(p.n1); setRatio(p.ratio);
  }, []);
  const resetAll = useCallback(() => {
    setMode(DEF.mode); setTailType(DEF.tail); setEffect(DEF.effect);
    setAlpha(DEF.alpha); setSigma(DEF.sigma); setN1(DEF.n1); setRatio(DEF.ratio); setCiLevel(DEF.ci);
  }, []);

  const calc = useMemo(() => {
    const n2 = Math.round(n1 * ratioReal);
    const se = mode === "one" ? sigmaReal / Math.sqrt(n1) : sigmaReal * Math.sqrt(1 / n1 + 1 / n2);
    const delta = dReal * sigmaReal;
    let zCritUpper, zCritLower;
    if (tailType === "one") {
      if (dReal >= 0) { zCritUpper = phiInv(1 - alphaReal); zCritLower = null; }
      else            { zCritLower = -phiInv(1 - alphaReal); zCritUpper = null; }
    } else {
      zCritUpper = phiInv(1 - alphaReal / 2); zCritLower = -zCritUpper;
    }
    const muH1  = delta / se;
    const power = calcPower(mode, tailType, dReal, alphaReal, sigmaReal, n1, ratioReal);
    const beta  = 1 - power;
    const zAlpha  = tailType === "one" ? phiInv(1 - alphaReal) : phiInv(1 - alphaReal / 2);
    const zBeta80 = phiInv(0.80);
    let requiredN;
    if (absD < 0.001) requiredN = Infinity;
    else if (mode === "one") requiredN = Math.ceil(((zAlpha + zBeta80) * sigmaReal / Math.abs(delta)) ** 2);
    else requiredN = Math.ceil((zAlpha + zBeta80) ** 2 * sigmaReal ** 2 * (1 + 1 / ratioReal) / delta ** 2);
    const zCI = phiInv(1 - (1 - ciLevel) / 2);
    return { n2, se, delta, zCritUpper, zCritLower, muH1, power, beta, requiredN, ciLower: delta - zCI * se, ciUpper: delta + zCI * se };
  }, [mode, tailType, dReal, alphaReal, sigmaReal, n1, ratioReal, ciLevel]);

  const distData = useMemo(() => {
    const { muH1, zCritUpper, zCritLower } = calc;
    const range = Math.max(Math.abs(muH1) + 4, 5);
    const data = [];
    for (let i = 0; i <= 300; i++) {
      const z = -range + (2 * range * i) / 300;
      const h0 = normalPDF(z, 0, 1), h1 = normalPDF(z, muH1, 1);
      let aZ = 0, bZ = 0, pZ = 0;
      if (tailType === "one") {
        if (dReal >= 0) { aZ = z >= zCritUpper ? h0 : 0; bZ = z < zCritUpper ? h1 : 0; pZ = z >= zCritUpper ? h1 : 0; }
        else            { aZ = z <= zCritLower ? h0 : 0; bZ = z > zCritLower ? h1 : 0; pZ = z <= zCritLower ? h1 : 0; }
      } else {
        aZ = (z >= zCritUpper || z <= zCritLower) ? h0 : 0;
        bZ = (z < zCritUpper && z > zCritLower) ? h1 : 0;
        pZ = (z >= zCritUpper || z <= zCritLower) ? h1 : 0;
      }
      data.push({ z: Math.round(z * 100) / 100, h0, h1, aZ, bZ, pZ });
    }
    return data;
  }, [calc, tailType, dReal]);

  const ciData = useMemo(() => {
    const { delta, se, ciLower, ciUpper } = calc;
    const lo = delta - 4.5 * se, hi = delta + 4.5 * se;
    return Array.from({ length: 201 }, (_, i) => {
      const x = lo + (hi - lo) * i / 200;
      const pdf = normalPDF(x, delta, se);
      const inCI = x >= ciLower && x <= ciUpper;
      return { x: Math.round(x * 100) / 100, pdf, ci: inCI ? pdf : 0, tail: !inCI ? pdf : 0 };
    });
  }, [calc]);

  const powerByN = useMemo(() => {
    const maxN = Math.max(n1 * 3, calc.requiredN * 1.5, 200);
    const st = Math.max(1, Math.round(maxN / 60));
    const pts = [];
    for (let n = 10; n <= maxN; n += st)
      pts.push({ n, power: calcPower(mode, tailType, dReal, alphaReal, sigmaReal, n, ratioReal) });
    if (!pts.find(p => p.n === n1)) { pts.push({ n: n1, power: calc.power }); pts.sort((a, b) => a.n - b.n); }
    return pts;
  }, [mode, tailType, dReal, alphaReal, sigmaReal, n1, ratioReal, calc]);

  const powerByEffect = useMemo(() => {
    const pts = [];
    for (let d = -200; d <= 200; d += 5)
      pts.push({ d: d / 100, power: calcPower(mode, tailType, d / 100, alphaReal, sigmaReal, n1, ratioReal) });
    return pts;
  }, [mode, tailType, alphaReal, sigmaReal, n1, ratioReal]);

  const tornadoData = useMemo(() => {
    const base = calc.power;
    const params = [
      { name: "Effect (d)", lo: Math.max(absD * 0.5, 0.05), hi: Math.min(absD * 1.5, 2),    fn: v => calcPower(mode, tailType, isNeg ? -v : v, alphaReal, sigmaReal, n1, ratioReal) },
      { name: "n₁",         lo: Math.max(n1 * 0.5, 10),     hi: n1 * 2,                     fn: v => calcPower(mode, tailType, dReal, alphaReal, sigmaReal, Math.round(v), ratioReal) },
      { name: "α",          lo: Math.max(alphaReal * 0.5, 0.005), hi: Math.min(alphaReal * 2, 0.15), fn: v => calcPower(mode, tailType, dReal, v, sigmaReal, n1, ratioReal) },
      { name: "σ",          lo: Math.max(sigmaReal * 0.5, 1), hi: sigmaReal * 1.5,            fn: v => calcPower(mode, tailType, dReal, alphaReal, v, n1, ratioReal) },
    ];
    if (mode === "two") params.push({ name: "n₂/n₁", lo: Math.max(ratioReal * 0.5, 0.25), hi: Math.min(ratioReal * 2, 3), fn: v => calcPower(mode, tailType, dReal, alphaReal, sigmaReal, n1, v) });
    return params.map(p => {
      const pLo = p.fn(p.lo), pHi = p.fn(p.hi);
      const low = Math.min(pLo, pHi) - base, high = Math.max(pLo, pHi) - base;
      return { name: p.name, low: Math.round(low * 1000) / 10, high: Math.round(high * 1000) / 10, range: Math.round((high - low) * 1000) / 10 };
    }).sort((a, b) => b.range - a.range);
  }, [calc, mode, tailType, dReal, absD, isNeg, alphaReal, sigmaReal, n1, ratioReal]);

  const insights = useMemo(() => {
    const list = [];
    const { power, beta, requiredN, n2 } = calc;
    if (absD < 0.001) return [{ icon: "∅", text: "Effect ≈ 0. Нет эффекта для обнаружения.", c: C.dim }];
    if (isNeg) list.push({ icon: "↓", text: `Отрицательный эффект (d=${dReal.toFixed(2)}). ${tailType === "one" ? "One-tailed ловит это." : "Two-tailed поймает оба."}`, c: C.pink });
    if (power >= 0.95) list.push({ icon: "⚡", text: `Power ${(power*100).toFixed(1)}% — избыточна. Сократи выборку или ужесточи α.`, c: C.grn });
    else if (power >= 0.8) list.push({ icon: "✓", text: `Power ${(power*100).toFixed(1)}% — достаточна для |d|=${absD.toFixed(2)}.`, c: C.grn });
    else if (power >= 0.5) list.push({ icon: "⚠", text: `Power ${(power*100).toFixed(1)}% < 80%. Нужно n₁≥${requiredN < 99999 ? requiredN.toLocaleString() : "∞"}.`, c: C.yel });
    else list.push({ icon: "✗", text: `Power ${(power*100).toFixed(1)}% — монетка надёжнее. β=${(beta*100).toFixed(1)}%.`, c: C.pink });
    if (tailType === "two") {
      const o = calcPower(mode, "one", dReal, alphaReal, sigmaReal, n1, ratioReal);
      const d2 = ((o - power) * 100).toFixed(1);
      if (parseFloat(d2) > 2) list.push({ icon: "↗", text: `Two-tailed теряет ~${d2}pp vs one-tailed.`, c: C.acc });
    } else list.push({ icon: "→", text: `One-tailed: только ${isNeg ? "↓" : "↑"}. Обратный эффект не обнаружишь.`, c: C.acc });
    if (mode === "two" && (ratioReal < 0.7 || ratioReal > 1.4)) {
      const b = calcPower(mode, tailType, dReal, alphaReal, sigmaReal, n1, 1.0);
      list.push({ icon: "⚖", text: `Дисбаланс ${n1}:${n2} стоит ~${((b - power) * 100).toFixed(1)}pp.`, c: C.pur });
    }
    if (absD < 0.2)  list.push({ icon: "🔬", text: `|d|=${absD.toFixed(2)} — очень малый. Нужны сотни+ наблюдений.`, c: C.dim });
    else if (absD >= 0.8) list.push({ icon: "🚀", text: `|d|=${absD.toFixed(2)} — большой. Реалистично?`, c: C.yel });
    if (tornadoData.length > 0) list.push({ icon: "🎯", text: `Главный рычаг: ${tornadoData[0].name} (±${tornadoData[0].range.toFixed(1)}pp).`, c: C.yel });
    const ciSig = isNeg ? calc.ciUpper < 0 : calc.ciLower > 0;
    list.push({ icon: ciSig ? "✓" : "∅", text: `${(ciLevel*100).toFixed(0)}% CI ${ciSig ? "≠ 0 → значим" : "∋ 0 → не значим"}.`, c: ciSig ? C.grn : C.pink });
    return list;
  }, [calc, mode, tailType, dReal, absD, isNeg, alphaReal, sigmaReal, n1, ratioReal, ciLevel, tornadoData]);

  const fmt    = (v, d = 1) => Number(v).toFixed(d);
  const fmtPct = v => `${(v * 100).toFixed(1)}%`;

  const kpis = [
    { label: "Power (1−β)", value: fmtPct(calc.power),  color: calc.power >= 0.8 ? C.grn : calc.power >= 0.5 ? C.yel : C.pink },
    { label: "β (Type II)", value: fmtPct(calc.beta),   color: C.pur },
    { label: "α (Type I)",  value: fmtPct(alphaReal),   color: C.pink },
    { label: "Z critical",  value: fmt(calc.zCritUpper ?? calc.zCritLower, 3), color: C.yel },
    { label: "SE",          value: fmt(calc.se, 3),      color: C.acc },
    { label: "Нужно n₁",   value: calc.requiredN < 99999 ? calc.requiredN.toLocaleString() : "—", color: n1 >= calc.requiredN ? C.grn : C.pink },
  ];

  const legend = [
    { c: C.dim,  l: "H₀" }, { c: C.acc,  l: "H₁" },
    { c: C.pink, l: "α" },  { c: C.pur,  l: "β" },
    { c: C.grn,  l: "Power" }, { c: C.yel, l: "Z crit" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.txt, fontFamily: "'JetBrains Mono','SF Mono',monospace", padding: "28px 24px", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* ─── Header ─── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: 0 }}>Z-Test Explorer</h1>
            <p style={{ fontSize: 12, color: C.dim, margin: "4px 0 0", letterSpacing: 1 }}>STATISTICAL POWER ANALYSIS</p>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={resetAll} style={{ padding: "8px 16px", fontSize: 12, fontFamily: "inherit", cursor: "pointer", background: "transparent", border: `1px solid ${C.brd}`, borderRadius: 8, color: C.dim }}>↺ Reset</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
          <Pill options={[{ value: "one", label: "1-sample" }, { value: "two", label: "2-sample" }]} value={mode} onChange={setMode} />
          <Pill options={[{ value: "one", label: "1-tail" }, { value: "two", label: "2-tail" }]} value={tailType} onChange={setTailType} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>

        {/* ─── Sidebar ─── */}
        <div style={{ width: 270, flexShrink: 0 }}>

          {/* KPIs */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Ключевые метрики</div>
            {kpis.map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7, padding: "5px 10px", background: C.bg, borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: C.dim }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Presets */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Пресеты</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PRESETS.map(p => (
                <button key={p.name} onClick={() => applyPreset(p)} style={{
                  padding: "4px 10px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                  border: `1px solid ${C.brd}`, background: "transparent", borderRadius: 5, color: C.dim,
                }}>{p.name}</button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Параметры</div>
            <Slider label="Effect size (d)" value={effect} onChange={setEffect} min={0} max={400} step={1}
              display={`${dReal > 0 ? "+" : ""}${dReal.toFixed(2)}`} color={dReal < 0 ? C.pink : C.acc} />
            <Slider label="α (significance)" value={alpha} onChange={setAlpha} min={0} max={100} step={1}
              display={fmtPct(alphaReal)} color={C.pink} />
            <Slider label="σ (std dev)" value={sigma} onChange={setSigma} min={0} max={100} step={1}
              display={fmt(sigmaReal, 1)} color={C.yel} />
            <Slider label={mode === "two" ? "n₁ (control)" : "n (sample)"} value={n1} onChange={setN1} min={10} max={2000} step={5}
              display={n1.toLocaleString()} color={C.acc} />
            <Slider label="n₂ / n₁" value={ratio} onChange={setRatio} min={0} max={100} step={1}
              display={`${ratioReal.toFixed(2)}  n₂=${Math.round(n1 * ratioReal)}`} disabled={mode === "one"} color={C.pur} />
          </div>

          {/* CI level + result */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1 }}>CI Level</span>
              <Pill options={[{ value: 0.90, label: "90%" }, { value: 0.95, label: "95%" }, { value: 0.99, label: "99%" }]} value={ciLevel} onChange={setCiLevel} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: calc.ciLower > 0 ? C.grn : C.dim }}>[{fmt(calc.ciLower, 2)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: C.bg, color: isNeg ? C.pink : C.yel }}>Δ={fmt(calc.delta, 2)}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: calc.ciUpper < 0 ? C.pink : C.grn }}>{fmt(calc.ciUpper, 2)}]</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, marginTop: 6, color: (calc.ciLower > 0 || calc.ciUpper < 0) ? C.grn : C.pink }}>
              {calc.ciLower > 0 ? "✓ значимый рост" : calc.ciUpper < 0 ? "✓ значимое падение" : "✗ CI содержит 0"}
            </div>
          </div>

          {/* Tornado toggle */}
          <button onClick={() => setShowTornado(!showTornado)} style={{
            width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${showTornado ? C.acc : C.brd}`,
            background: showTornado ? `${C.acc}18` : "transparent",
            color: showTornado ? C.acc : C.dim, marginBottom: 12,
          }}>
            {showTornado ? "Скрыть" : "Показать"} Sensitivity Tornado
          </button>

          {/* Insights */}
          <div style={{ padding: 16, background: `${C.acc}08`, border: `1px solid ${C.acc}20`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: C.acc, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>Insights</div>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}>
                <span style={{ flexShrink: 0, color: ins.c }}>{ins.icon}</span>
                <span style={{ color: C.dim }}>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Main area ─── */}
        <div style={{ flex: 1, minWidth: 400 }}>

          {/* Distribution H0/H1 */}
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.brd}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>Распределения H₀ / H₁</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {legend.map(({ c, l }) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.dim }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />{l}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={distData} margin={{ top: 6, right: 10, bottom: 6, left: 0 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.pink} stopOpacity={0.5} /><stop offset="100%" stopColor={C.pink} stopOpacity={0.05} /></linearGradient>
                  <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.pur}  stopOpacity={0.3} /><stop offset="100%" stopColor={C.pur}  stopOpacity={0.03} /></linearGradient>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.grn}  stopOpacity={0.4} /><stop offset="100%" stopColor={C.grn}  stopOpacity={0.05} /></linearGradient>
                </defs>
                <CartesianGrid stroke={C.brd} strokeDasharray="2 4" />
                <XAxis dataKey="z"  tick={{ fill: C.dim, fontSize: 9 }} tickCount={13} axisLine={{ stroke: C.brd }} />
                <YAxis              tick={{ fill: C.dim, fontSize: 9 }} tickCount={5}  axisLine={{ stroke: C.brd }} width={30} />
                <Tooltip content={<ChartTT />} />
                <Area type="monotone" dataKey="aZ"   name="α"     stroke="none" fill="url(#gA)" isAnimationActive={false} />
                <Area type="monotone" dataKey="bZ"   name="β"     stroke="none" fill="url(#gB)" isAnimationActive={false} />
                <Area type="monotone" dataKey="pZ"   name="Power" stroke="none" fill="url(#gP)" isAnimationActive={false} />
                <Area type="monotone" dataKey="h0"   name="H₀"   stroke={C.dim} strokeWidth={2} fill="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="h1"   name="H₁"   stroke={C.acc} strokeWidth={2} fill="none" isAnimationActive={false} />
                {calc.zCritUpper !== null && <ReferenceLine x={Math.round(calc.zCritUpper * 100) / 100} stroke={C.yel} strokeWidth={1.5} strokeDasharray="5 3" />}
                {calc.zCritLower !== null && <ReferenceLine x={Math.round(calc.zCritLower * 100) / 100} stroke={C.yel} strokeWidth={1.5} strokeDasharray="5 3" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* CI chart */}
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.brd}`, padding: 20, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.txt, display: "block", marginBottom: 12 }}>Доверительный интервал аплифта (Δ)</span>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={ciData} margin={{ top: 6, right: 10, bottom: 6, left: 0 }}>
                <defs>
                  <linearGradient id="gCI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.pur} stopOpacity={0.45} /><stop offset="100%" stopColor={C.pur} stopOpacity={0.06} /></linearGradient>
                </defs>
                <CartesianGrid stroke={C.brd} strokeDasharray="2 4" />
                <XAxis dataKey="x" tick={{ fill: C.dim, fontSize: 9 }} tickCount={9} axisLine={{ stroke: C.brd }} />
                <YAxis             tick={{ fill: C.dim, fontSize: 9 }} tickCount={4} axisLine={{ stroke: C.brd }} width={30} />
                <Area type="monotone" dataKey="ci"   stroke="none"    fill="url(#gCI)" isAnimationActive={false} />
                <Area type="monotone" dataKey="tail" stroke="none"    fill={C.brd} fillOpacity={0.5} isAnimationActive={false} />
                <Area type="monotone" dataKey="pdf"  stroke={C.pur}   strokeWidth={1.5} fill="none" isAnimationActive={false} />
                <ReferenceLine x={Math.round(calc.ciLower * 100) / 100} stroke={C.pur}  strokeWidth={1} strokeDasharray="4 3" />
                <ReferenceLine x={Math.round(calc.ciUpper * 100) / 100} stroke={C.pur}  strokeWidth={1} strokeDasharray="4 3" />
                <ReferenceLine x={Math.round(calc.delta  * 100) / 100} stroke={C.yel}  strokeWidth={1.5} />
                <ReferenceLine x={0} stroke={`${C.pink}66`} strokeWidth={1} strokeDasharray="2 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Power curves + tornado */}
          <div style={{ display: "grid", gridTemplateColumns: showTornado ? "1fr 1fr 1fr" : "1fr 1fr", gap: 16 }}>

            {/* Power vs n */}
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.brd}`, padding: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.txt, display: "block", marginBottom: 10 }}>Power → f(n₁)</span>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={powerByN} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={C.brd} strokeDasharray="2 4" />
                  <XAxis dataKey="n" tick={{ fill: C.dim, fontSize: 9 }} axisLine={{ stroke: C.brd }} />
                  <YAxis tick={{ fill: C.dim, fontSize: 9 }} domain={[0, 1]} tickCount={5} axisLine={{ stroke: C.brd }} width={28} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                  <Tooltip content={({ active, payload }) => active && payload?.[0]
                    ? <div style={{ background: "#0c0e14f0", border: `1px solid ${C.brd}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>
                        <span style={{ color: C.dim }}>n₁={payload[0].payload.n} </span>
                        <span style={{ color: C.grn }}>{(payload[0].value*100).toFixed(1)}%</span>
                      </div> : null} />
                  <ReferenceLine y={0.8} stroke={`${C.yel}44`} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="power" stroke={C.grn} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="power" stroke="none" isAnimationActive={false}
                    dot={p => Math.abs(p.payload.n - n1) < 8
                      ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={C.yel} stroke={C.bg} strokeWidth={2} />
                      : null} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Power vs d */}
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.brd}`, padding: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.txt, display: "block", marginBottom: 10 }}>Power → f(d)</span>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={powerByEffect} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={C.brd} strokeDasharray="2 4" />
                  <XAxis dataKey="d" tick={{ fill: C.dim, fontSize: 9 }} axisLine={{ stroke: C.brd }} />
                  <YAxis tick={{ fill: C.dim, fontSize: 9 }} domain={[0, 1]} tickCount={5} axisLine={{ stroke: C.brd }} width={28} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                  <Tooltip content={({ active, payload }) => active && payload?.[0]
                    ? <div style={{ background: "#0c0e14f0", border: `1px solid ${C.brd}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>
                        <span style={{ color: C.dim }}>d={payload[0].payload.d} </span>
                        <span style={{ color: C.acc }}>{(payload[0].value*100).toFixed(1)}%</span>
                      </div> : null} />
                  <ReferenceLine y={0.8} stroke={`${C.yel}44`} strokeDasharray="4 4" />
                  <ReferenceLine x={0} stroke={C.dim} strokeWidth={0.5} />
                  <Line type="monotone" dataKey="power" stroke={C.acc} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="power" stroke="none" isAnimationActive={false}
                    dot={p => Math.abs(p.payload.d - dReal) < 0.06
                      ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={C.yel} stroke={C.bg} strokeWidth={2} />
                      : null} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tornado */}
            {showTornado && (
              <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.brd}`, padding: 20 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.txt, display: "block", marginBottom: 10 }}>Sensitivity ±50%</span>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={tornadoData} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={C.brd} strokeDasharray="2 4" horizontal={false} />
                    <XAxis type="number" tick={{ fill: C.dim, fontSize: 9 }} axisLine={{ stroke: C.brd }} tickFormatter={v => `${v > 0 ? "+" : ""}${v}pp`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: C.dim, fontSize: 10 }} axisLine={{ stroke: C.brd }} width={42} />
                    <Tooltip content={({ active, payload }) => active && payload?.[0]
                      ? <div style={{ background: "#0c0e14f0", border: `1px solid ${C.brd}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>
                          <span style={{ color: C.dim }}>{payload[0].payload.name}</span><br />
                          <span style={{ color: C.pink }}>{payload[0].payload.low.toFixed(1)}pp</span>
                          {" → "}
                          <span style={{ color: C.grn }}>+{payload[0].payload.high.toFixed(1)}pp</span>
                        </div> : null} />
                    <Bar dataKey="low"  stackId="a" isAnimationActive={false}>{tornadoData.map((_, i) => <Cell key={i} fill={C.pink} fillOpacity={0.65} />)}</Bar>
                    <Bar dataKey="high" stackId="a" isAnimationActive={false}>{tornadoData.map((_, i) => <Cell key={i} fill={C.grn}  fillOpacity={0.65} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
