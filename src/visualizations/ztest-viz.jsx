import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line,
  BarChart, Bar, Cell
} from "recharts";

// ─── Math ───────────────────────────────────────────────────
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
  { name: "A/B тест", desc: "Типичный продуктовый", mode: "two", tail: "two", effect: 230, alpha: 34, sigma: 36, n1: 500, ratio: 100 },
  { name: "Клинический", desc: "Строгий RCT", mode: "two", tail: "two", effect: 240, alpha: 3, sigma: 50, n1: 300, ratio: 100 },
  { name: "Малая выборка", desc: "Пилот / MVP", mode: "two", tail: "one", effect: 270, alpha: 34, sigma: 36, n1: 30, ratio: 100 },
  { name: "Деградация", desc: "Ловим ухудшение", mode: "two", tail: "one", effect: 150, alpha: 34, sigma: 36, n1: 200, ratio: 100 },
  { name: "Big data", desc: "Микро-эффект", mode: "two", tail: "two", effect: 210, alpha: 7, sigma: 36, n1: 2000, ratio: 100 },
];
const DEF = { mode: "two", tail: "two", effect: 250, alpha: 34, sigma: 36, n1: 100, ratio: 100, ci: 0.95 };

const C = {
  bg: "#08080e", card: "#111118", border: "#1e1e2e", grid: "#1a1a28",
  yellow: "#f5c542", purple: "#a78bfa", cyan: "#06b6d4", pink: "#ec4899", green: "#22c55e",
  text: "#e0e0e8", dim: "#888", muted: "#555", dark: "#333",
};

export default function ZTestViz() {
  const [mode, setMode] = useState("two");
  const [tailType, setTailType] = useState("two");
  const [effect, setEffect] = useState(250);
  const [alpha, setAlpha] = useState(34);
  const [sigma, setSigma] = useState(36);
  const [n1, setN1] = useState(100);
  const [ratio, setRatio] = useState(100);
  const [ciLevel, setCiLevel] = useState(0.95);
  const [showTornado, setShowTornado] = useState(false);

  const dReal = (effect - 200) / 100;
  const alphaReal = 0.005 + (alpha / 100) * 0.145;
  const sigmaReal = 1 + (sigma / 100) * 14;
  const ratioReal = 0.25 + (ratio / 100) * 2.75;
  const isNeg = dReal < 0;
  const absD = Math.abs(dReal);

  const applyPreset = useCallback((p) => { setMode(p.mode); setTailType(p.tail); setEffect(p.effect); setAlpha(p.alpha); setSigma(p.sigma); setN1(p.n1); setRatio(p.ratio); }, []);
  const resetAll = useCallback(() => { setMode(DEF.mode); setTailType(DEF.tail); setEffect(DEF.effect); setAlpha(DEF.alpha); setSigma(DEF.sigma); setN1(DEF.n1); setRatio(DEF.ratio); setCiLevel(DEF.ci); }, []);

  const calc = useMemo(() => {
    const n2 = Math.round(n1 * ratioReal);
    const se = mode === "one" ? sigmaReal / Math.sqrt(n1) : sigmaReal * Math.sqrt(1 / n1 + 1 / n2);
    const delta = dReal * sigmaReal, absDelta = Math.abs(delta);
    let zCritUpper, zCritLower;
    if (tailType === "one") { if (dReal >= 0) { zCritUpper = phiInv(1 - alphaReal); zCritLower = null; } else { zCritLower = -phiInv(1 - alphaReal); zCritUpper = null; } }
    else { zCritUpper = phiInv(1 - alphaReal / 2); zCritLower = -zCritUpper; }
    const muH1 = delta / se;
    const power = calcPower(mode, tailType, dReal, alphaReal, sigmaReal, n1, ratioReal);
    const beta = 1 - power;
    const zAlpha = tailType === "one" ? phiInv(1 - alphaReal) : phiInv(1 - alphaReal / 2);
    const zBeta80 = phiInv(0.80);
    let requiredN;
    if (absD < 0.001) requiredN = Infinity;
    else if (mode === "one") requiredN = Math.ceil(((zAlpha + zBeta80) * sigmaReal / absDelta) ** 2);
    else requiredN = Math.ceil((zAlpha + zBeta80) ** 2 * sigmaReal ** 2 * (1 + 1 / ratioReal) / absDelta ** 2);
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
        else { aZ = z <= zCritLower ? h0 : 0; bZ = z > zCritLower ? h1 : 0; pZ = z <= zCritLower ? h1 : 0; }
      } else { aZ = (z >= zCritUpper || z <= zCritLower) ? h0 : 0; bZ = (z < zCritUpper && z > zCritLower) ? h1 : 0; pZ = (z >= zCritUpper || z <= zCritLower) ? h1 : 0; }
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
    for (let n = 10; n <= maxN; n += st) pts.push({ n, power: calcPower(mode, tailType, dReal, alphaReal, sigmaReal, n, ratioReal) });
    if (!pts.find(p => p.n === n1)) { pts.push({ n: n1, power: calc.power }); pts.sort((a, b) => a.n - b.n); }
    return pts;
  }, [mode, tailType, dReal, alphaReal, sigmaReal, n1, ratioReal, calc]);

  const powerByEffect = useMemo(() => {
    const pts = [];
    for (let d = -200; d <= 200; d += 5) pts.push({ d: d / 100, power: calcPower(mode, tailType, d / 100, alphaReal, sigmaReal, n1, ratioReal) });
    return pts;
  }, [mode, tailType, alphaReal, sigmaReal, n1, ratioReal]);

  const tornadoData = useMemo(() => {
    const base = calc.power;
    const params = [
      { name: "Effect (d)", lo: Math.max(absD * 0.5, 0.05), hi: Math.min(absD * 1.5, 2), fn: v => calcPower(mode, tailType, isNeg ? -v : v, alphaReal, sigmaReal, n1, ratioReal) },
      { name: "n₁", lo: Math.max(n1 * 0.5, 10), hi: n1 * 2, fn: v => calcPower(mode, tailType, dReal, alphaReal, sigmaReal, Math.round(v), ratioReal) },
      { name: "α", lo: Math.max(alphaReal * 0.5, 0.005), hi: Math.min(alphaReal * 2, 0.15), fn: v => calcPower(mode, tailType, dReal, v, sigmaReal, n1, ratioReal) },
      { name: "σ", lo: Math.max(sigmaReal * 0.5, 1), hi: sigmaReal * 1.5, fn: v => calcPower(mode, tailType, dReal, alphaReal, v, n1, ratioReal) },
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
    if (absD < 0.001) return [{ icon: "∅", text: "Effect ≈ 0. Нет эффекта для обнаружения.", c: C.muted }];
    if (isNeg) list.push({ icon: "↓", text: `Отрицательный эффект (d=${dReal.toFixed(2)}): тест ухудшает метрику. ${tailType === "one" ? "One-tailed ловит это." : "Two-tailed поймает оба."}`, c: C.pink });
    if (power >= 0.95) list.push({ icon: "⚡", text: `Power ${(power*100).toFixed(1)}% — избыточна. Сократи выборку или ужесточи α.`, c: C.green });
    else if (power >= 0.8) list.push({ icon: "✓", text: `Power ${(power*100).toFixed(1)}% — достаточна для |d|=${absD.toFixed(2)}.`, c: C.green });
    else if (power >= 0.5) list.push({ icon: "⚠", text: `Power ${(power*100).toFixed(1)}% < 80%. Нужно n₁≥${requiredN < 99999 ? requiredN.toLocaleString() : "∞"}.`, c: C.yellow });
    else list.push({ icon: "✗", text: `Power ${(power*100).toFixed(1)}% — монетка надёжнее. β=${(beta*100).toFixed(1)}%.`, c: C.pink });
    if (tailType === "two") {
      const o = calcPower(mode, "one", dReal, alphaReal, sigmaReal, n1, ratioReal);
      const d2 = ((o - power) * 100).toFixed(1);
      if (parseFloat(d2) > 2) list.push({ icon: "↗", text: `Two-tailed теряет ~${d2}pp vs one-tailed.`, c: C.cyan });
    } else list.push({ icon: "→", text: `One-tailed: только ${isNeg ? "↓" : "↑"}. Обратный эффект не обнаружишь.`, c: C.cyan });
    if (mode === "two" && (ratioReal < 0.7 || ratioReal > 1.4)) {
      const b = calcPower(mode, tailType, dReal, alphaReal, sigmaReal, n1, 1.0);
      list.push({ icon: "⚖", text: `Дисбаланс ${n1}:${n2} стоит ~${((b - power) * 100).toFixed(1)}pp.`, c: C.purple });
    }
    if (absD < 0.2) list.push({ icon: "🔬", text: `|d|=${absD.toFixed(2)} — очень малый. Нужны сотни+ наблюдений.`, c: C.dim });
    else if (absD >= 0.8) list.push({ icon: "🚀", text: `|d|=${absD.toFixed(2)} — большой. Реалистично?`, c: C.yellow });
    if (tornadoData.length > 0) list.push({ icon: "🎯", text: `Главный рычаг: ${tornadoData[0].name} (±${tornadoData[0].range.toFixed(1)}pp).`, c: C.yellow });
    const ciSig = isNeg ? calc.ciUpper < 0 : calc.ciLower > 0;
    list.push({ icon: ciSig ? "✓" : "∅", text: `${(ciLevel*100).toFixed(0)}% CI ${ciSig ? "≠ 0 → значим" : "∋ 0 → не значим"}.`, c: ciSig ? C.green : C.pink });
    return list;
  }, [calc, mode, tailType, dReal, absD, isNeg, alphaReal, sigmaReal, n1, ratioReal, ciLevel, tornadoData]);

  const fmt = (v, d = 1) => Number(v).toFixed(d);
  const fmtPct = v => `${(v * 100).toFixed(1)}%`;
  const HELP = {
    effect: "Cohen's d — стандартизированная разница. +улучшение, −ухудшение. 0.2 малый, 0.5 средний, 0.8 большой.",
    alpha: "P(Type I) — false positive rate. 5% стандарт. Меньше → строже → больше данных.",
    sigma: "σ популяции. Больше шума → труднее обнаружить эффект.",
    n1: "Размер выборки. Основной рычаг power.",
    ratio: "Пропорция тест/контроль. 1:1 = максимум power.",
  };

  const KPI = ({ label, value, sub, color = C.yellow }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: `0 0 12px ${color}12, inset 0 0 12px ${color}06` }}>
      <span style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1, textShadow: `0 0 10px ${color}44` }}>{value}</span>
      <span style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
      {sub && <span style={{ fontSize: 10, color: C.dark }}>{sub}</span>}
    </div>
  );

  const Pill = ({ options, value, onChange }) => (
    <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
      {options.map(o => (
        <button key={String(o.value)} onClick={() => onChange(o.value)} style={{
          padding: "4px 10px", fontSize: 11, fontFamily: "inherit", cursor: "pointer", border: "none",
          background: value === o.value ? C.yellow : "transparent",
          color: value === o.value ? "#000" : C.muted,
          fontWeight: value === o.value ? 700 : 400,
          boxShadow: value === o.value ? `0 0 8px ${C.yellow}33` : "none",
          transition: "all 0.15s",
        }}>{o.label}</button>
      ))}
    </div>
  );

  const Sld = ({ id, label, value, onChange, min, max, step, display, color = C.yellow, disabled }) => (
    <div className="sld-wrap" style={{ position: "relative", opacity: disabled ? 0.2 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div className="sld-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: color, height: 4 }} />
      {HELP[id] && (
        <div className="sld-tip" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", marginBottom: 8, zIndex: 50, padding: "8px 12px", borderRadius: 8, fontSize: 11, lineHeight: 1.5, background: "#111118F8", border: `1px solid ${C.border}`, color: C.dim, boxShadow: `0 0 20px ${color}15` }}>
          {HELP[id]}
        </div>
      )}
    </div>
  );

  const TT = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#111118F0", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontFamily: "inherit" }}>
        <div style={{ color: C.muted }}>{label}</div>
        {payload.filter(p => p.value > 0.001).map((p, i) => (
          <div key={i} style={{ color: p.stroke || p.color || C.text }}>{p.name}: {p.value.toFixed(4)}</div>
        ))}
      </div>
    );
  };

  const Legend = ({ items }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 10 }}>
      {items.map(({ c, l }) => (
        <span key={l} style={{ display: "flex", alignItems: "center", gap: 3, color: C.dark }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />{l}
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: C.bg, color: C.text, minHeight: "100vh", padding: "12px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');input[type=range]{height:4px}*{box-sizing:border-box}.sld-label:hover~.sld-tip{opacity:1}.sld-tip{opacity:0;pointer-events:none;transition:opacity 0.15s}.sld-label{cursor:default}`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ═══ Header ═══ */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>
              <span style={{ color: C.yellow, textShadow: `0 0 20px ${C.yellow}33` }}>Z-Test</span>
              <span style={{ color: C.dark }}> Explorer</span>
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={resetAll} style={{ padding: "4px 10px", fontSize: 10, fontFamily: "inherit", cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted }}>↺ Reset</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Pill options={[{ value: "one", label: "1-sample" }, { value: "two", label: "2-sample" }]} value={mode} onChange={setMode} />
            <Pill options={[{ value: "one", label: "1-tail" }, { value: "two", label: "2-tail" }]} value={tailType} onChange={setTailType} />
            <div style={{ width: 1, height: 20, background: C.border, margin: "0 4px" }} />
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => applyPreset(p)} style={{
                padding: "3px 8px", fontSize: 10, fontFamily: "inherit", cursor: "pointer",
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.dim, lineHeight: 1.2,
              }}>
                <span style={{ color: C.yellow, fontWeight: 600 }}>{p.name}</span>
                {" "}<span style={{ color: C.muted, fontSize: 9 }}>{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ KPIs ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 6, marginBottom: 10 }}>
          <KPI label="Power (1−β)" value={fmtPct(calc.power)} color={calc.power >= 0.8 ? C.green : calc.power >= 0.5 ? C.yellow : C.pink} />
          <KPI label="β error" value={fmtPct(calc.beta)} color={C.purple} />
          <KPI label="α error" value={fmtPct(alphaReal)} color={C.pink} />
          <KPI label="Z critical" value={fmt(calc.zCritUpper ?? calc.zCritLower, 3)} sub={tailType === "two" ? `±${fmt(Math.abs(calc.zCritUpper), 2)}` : (dReal >= 0 ? `>${fmt(calc.zCritUpper, 2)}` : `<${fmt(calc.zCritLower, 2)}`)} color={C.yellow} />
          <KPI label="SE" value={fmt(calc.se, 3)} sub={`δ/SE=${fmt(calc.muH1, 2)}`} color={C.cyan} />
          <KPI label="Need n₁" value={calc.requiredN < 99999 ? calc.requiredN.toLocaleString() : "—"} sub={n1 >= calc.requiredN ? "✓ ок" : `✗ +${Math.max(0, calc.requiredN - n1).toLocaleString()}`} color={n1 >= calc.requiredN ? C.green : C.pink} />
        </div>

        {/* ═══ Distribution chart (full width) ═══ */}
        <div style={{ background: C.card, borderRadius: 12, padding: "10px 8px 4px", border: `1px solid ${C.border}`, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Распределения H₀ / H₁ {isNeg && <span style={{ color: C.pink }}>• negative effect</span>}
            </span>
            <Legend items={[{ c: C.dim, l: "H₀" }, { c: C.cyan, l: "H₁" }, { c: C.pink, l: "α zone" }, { c: C.purple, l: "β zone" }, { c: C.green, l: "Power" }, { c: C.yellow, l: "Z crit" }]} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={distData} margin={{ top: 6, right: 10, bottom: 6, left: 0 }}>
              <defs>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.pink} stopOpacity={0.5} /><stop offset="100%" stopColor={C.pink} stopOpacity={0.05} /></linearGradient>
                <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.purple} stopOpacity={0.3} /><stop offset="100%" stopColor={C.purple} stopOpacity={0.03} /></linearGradient>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.4} /><stop offset="100%" stopColor={C.green} stopOpacity={0.05} /></linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="2 4" />
              <XAxis dataKey="z" tick={{ fill: C.muted, fontSize: 9 }} tickCount={13} axisLine={{ stroke: C.border }} />
              <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickCount={5} axisLine={{ stroke: C.border }} width={30} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="aZ" name="α" stroke="none" fill="url(#gA)" isAnimationActive={false} />
              <Area type="monotone" dataKey="bZ" name="β" stroke="none" fill="url(#gB)" isAnimationActive={false} />
              <Area type="monotone" dataKey="pZ" name="Power" stroke="none" fill="url(#gP)" isAnimationActive={false} />
              <Area type="monotone" dataKey="h0" name="H₀" stroke={C.dim} strokeWidth={2} fill="none" isAnimationActive={false} />
              <Area type="monotone" dataKey="h1" name="H₁" stroke={C.cyan} strokeWidth={2} fill="none" isAnimationActive={false} />
              {calc.zCritUpper !== null && <ReferenceLine x={Math.round(calc.zCritUpper * 100) / 100} stroke={C.yellow} strokeWidth={1.5} strokeDasharray="5 3" />}
              {calc.zCritLower !== null && <ReferenceLine x={Math.round(calc.zCritLower * 100) / 100} stroke={C.yellow} strokeWidth={1.5} strokeDasharray="5 3" />}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ═══ CI chart (full width) ═══ */}
        <div style={{ background: C.card, borderRadius: 12, padding: "10px 8px 8px", border: `1px solid ${C.border}`, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 4, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Доверительный интервал аплифта (Δ)</span>
              <Legend items={[{ c: C.purple, l: "CI" }, { c: C.yellow, l: "Δ point" }, { c: C.pink, l: "zero" }]} />
            </div>
            <Pill options={[{ value: 0.90, label: "90%" }, { value: 0.95, label: "95%" }, { value: 0.99, label: "99%" }]} value={ciLevel} onChange={setCiLevel} />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ciData} margin={{ top: 6, right: 10, bottom: 6, left: 0 }}>
              <defs>
                <linearGradient id="gCI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.purple} stopOpacity={0.45} /><stop offset="100%" stopColor={C.purple} stopOpacity={0.06} /></linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="2 4" />
              <XAxis dataKey="x" tick={{ fill: C.muted, fontSize: 9 }} tickCount={9} axisLine={{ stroke: C.border }} />
              <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickCount={4} axisLine={{ stroke: C.border }} width={30} />
              <Area type="monotone" dataKey="ci" stroke="none" fill="url(#gCI)" isAnimationActive={false} />
              <Area type="monotone" dataKey="tail" stroke="none" fill={C.grid} fillOpacity={0.5} isAnimationActive={false} />
              <Area type="monotone" dataKey="pdf" stroke={C.purple} strokeWidth={1.5} fill="none" isAnimationActive={false} />
              <ReferenceLine x={Math.round(calc.ciLower * 100) / 100} stroke={C.purple} strokeWidth={1} strokeDasharray="4 3" />
              <ReferenceLine x={Math.round(calc.ciUpper * 100) / 100} stroke={C.purple} strokeWidth={1} strokeDasharray="4 3" />
              <ReferenceLine x={Math.round(calc.delta * 100) / 100} stroke={C.yellow} strokeWidth={1.5} />
              <ReferenceLine x={0} stroke={`${C.pink}66`} strokeWidth={1} strokeDasharray="2 3" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: calc.ciLower > 0 ? C.green : calc.ciUpper < 0 ? C.pink : C.dim }}>[{fmt(calc.ciLower, 2)}</span>
            <span style={{ fontSize: 15, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: C.grid, color: isNeg ? C.pink : C.yellow, boxShadow: `0 0 10px ${isNeg ? C.pink : C.yellow}22` }}>Δ = {fmt(calc.delta, 2)}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: calc.ciUpper < 0 ? C.pink : C.green }}>{fmt(calc.ciUpper, 2)}]</span>
            <span style={{ fontSize: 11, marginLeft: 8, color: (calc.ciLower > 0 || calc.ciUpper < 0) ? C.green : C.pink }}>
              {calc.ciLower > 0 ? "✓ значимый рост" : calc.ciUpper < 0 ? "✓ значимое падение" : "✗ CI ∋ 0"}
            </span>
          </div>
        </div>

        {/* ═══ Power curves + optional tornado ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: showTornado ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 8px 4px", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Power → f(n₁)</span>
              <Legend items={[{ c: C.green, l: "power" }, { c: C.yellow, l: "current" }]} />
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={powerByN} margin={{ top: 6, right: 10, bottom: 6, left: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="2 4" />
                <XAxis dataKey="n" tick={{ fill: C.muted, fontSize: 9 }} axisLine={{ stroke: C.border }} />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} domain={[0, 1]} tickCount={5} axisLine={{ stroke: C.border }} width={28} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                <Tooltip content={({ active, payload }) => active && payload?.[0] ? (<div style={{ background: "#111118F0", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}><span style={{ color: C.muted }}>n₁={payload[0].payload.n}</span> <span style={{ color: C.green }}>{(payload[0].value*100).toFixed(1)}%</span></div>) : null} />
                <ReferenceLine y={0.8} stroke={`${C.yellow}33`} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="power" stroke={C.green} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="power" stroke="none" isAnimationActive={false} dot={p => Math.abs(p.payload.n - n1) < 8 ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4.5} fill={C.yellow} stroke={C.bg} strokeWidth={2} /> : null} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 8px 4px", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Power → f(d)</span>
              <Legend items={[{ c: C.cyan, l: "power" }, { c: C.yellow, l: "current" }]} />
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={powerByEffect} margin={{ top: 6, right: 10, bottom: 6, left: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="2 4" />
                <XAxis dataKey="d" tick={{ fill: C.muted, fontSize: 9 }} axisLine={{ stroke: C.border }} />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} domain={[0, 1]} tickCount={5} axisLine={{ stroke: C.border }} width={28} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                <Tooltip content={({ active, payload }) => active && payload?.[0] ? (<div style={{ background: "#111118F0", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}><span style={{ color: C.muted }}>d={payload[0].payload.d}</span> <span style={{ color: C.cyan }}>{(payload[0].value*100).toFixed(1)}%</span></div>) : null} />
                <ReferenceLine y={0.8} stroke={`${C.yellow}33`} strokeDasharray="4 4" />
                <ReferenceLine x={0} stroke={C.muted} strokeWidth={0.5} />
                <Line type="monotone" dataKey="power" stroke={C.cyan} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="power" stroke="none" isAnimationActive={false} dot={p => Math.abs(p.payload.d - dReal) < 0.06 ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4.5} fill={C.yellow} stroke={C.bg} strokeWidth={2} /> : null} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {showTornado && (
            <div style={{ background: C.card, borderRadius: 12, padding: "10px 8px 4px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Sensitivity ±50%</span>
                <Legend items={[{ c: C.pink, l: "−impact" }, { c: C.green, l: "+impact" }]} />
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={tornadoData} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke={C.grid} strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" tick={{ fill: C.muted, fontSize: 9 }} axisLine={{ stroke: C.border }} tickFormatter={v => `${v > 0 ? "+" : ""}${v}pp`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: C.dim, fontSize: 10 }} axisLine={{ stroke: C.border }} width={42} />
                  <Tooltip content={({ active, payload }) => active && payload?.[0] ? (<div style={{ background: "#111118F0", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}><span style={{ color: C.dim }}>{payload[0].payload.name}</span><br /><span style={{ color: C.pink }}>{payload[0].payload.low.toFixed(1)}pp</span> → <span style={{ color: C.green }}>+{payload[0].payload.high.toFixed(1)}pp</span></div>) : null} />
                  <Bar dataKey="low" stackId="a" isAnimationActive={false}>{tornadoData.map((_, i) => <Cell key={i} fill={C.pink} fillOpacity={0.6} />)}</Bar>
                  <Bar dataKey="high" stackId="a" isAnimationActive={false}>{tornadoData.map((_, i) => <Cell key={i} fill={C.green} fillOpacity={0.6} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tornado toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <button onClick={() => setShowTornado(!showTornado)} style={{
            padding: "5px 14px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
            background: showTornado ? C.yellow : "transparent", border: `1px solid ${showTornado ? C.yellow : C.border}`,
            borderRadius: 6, color: showTornado ? "#000" : C.muted, fontWeight: showTornado ? 700 : 400,
          }}>
            {showTornado ? "Скрыть" : "Показать"} Sensitivity Tornado
          </button>
        </div>

        {/* ═══ Controls (static height) ═══ */}
        <div style={{ background: C.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.yellow, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Параметры</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            <Sld id="effect" label="Effect size (d)" value={effect} onChange={setEffect} min={0} max={400} step={1}
              display={<span style={{ color: dReal < 0 ? C.pink : dReal > 0 ? C.cyan : C.muted }}>{dReal > 0 ? "+" : ""}{dReal.toFixed(2)}</span>}
              color={dReal < 0 ? C.pink : C.cyan} />
            <Sld id="alpha" label="α (significance)" value={alpha} onChange={setAlpha} min={0} max={100} step={1} display={fmtPct(alphaReal)} color={C.pink} />
            <Sld id="sigma" label="σ (std dev)" value={sigma} onChange={setSigma} min={0} max={100} step={1} display={fmt(sigmaReal, 1)} color={C.yellow} />
            <Sld id="n1" label={mode === "two" ? "n₁ (control)" : "n (sample)"} value={n1} onChange={setN1} min={10} max={2000} step={5} display={n1.toLocaleString()} color={C.yellow} />
            <Sld id="ratio" label="n₂ / n₁" value={ratio} onChange={setRatio} min={0} max={100} step={1}
              display={`${ratioReal.toFixed(2)} → n₂=${Math.round(n1 * ratioReal)}`} disabled={mode === "one"} color={C.purple} />
          </div>
        </div>

        {/* ═══ Insights (below controls, variable height ok) ═══ */}
        <div style={{ background: C.card, borderRadius: 12, padding: 12, border: `1px solid ${C.border}`, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.yellow, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Insights</div>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5, marginBottom: 2 }}>
              <span style={{ flexShrink: 0, width: 18, textAlign: "center" }}>{ins.icon}</span>
              <span style={{ color: C.dim }}>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
