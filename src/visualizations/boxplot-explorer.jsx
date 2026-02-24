import { useState, useMemo } from "react";
import * as d3 from "d3";

function boxMuller() {
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const GEN = {
  normal: (n, p) => Array.from({ length: n }, () => p.mean + p.sd * boxMuller()),
  uniform: (n, p) => Array.from({ length: n }, () => p.lo + Math.random() * (p.hi - p.lo)),
  exponential: (n, p) => Array.from({ length: n }, () => -Math.log(1 - Math.random()) / p.lambda),
  poisson: (n, p) => Array.from({ length: n }, () => {
    let L = Math.exp(-p.lambda), k = 0, pr = 1;
    do { k++; pr *= Math.random(); } while (pr > L); return k - 1;
  }),
  binomial: (n, p) => Array.from({ length: n }, () => {
    let s = 0; for (let i = 0; i < p.trials; i++) if (Math.random() < p.p) s++; return s;
  }),
  geometric: (n, p) => Array.from({ length: n }, () => Math.floor(Math.log(1 - Math.random()) / Math.log(1 - p.p)) + 1),
  chiSquared: (n, p) => Array.from({ length: n }, () => {
    let s = 0; for (let i = 0; i < p.df; i++) { const z = boxMuller(); s += z * z; } return s;
  }),
  studentT: (n, p) => Array.from({ length: n }, () => {
    const z = boxMuller(); let chi = 0;
    for (let i = 0; i < p.df; i++) { const w = boxMuller(); chi += w * w; }
    return z / Math.sqrt(chi / p.df);
  }),
  logNormal: (n, p) => Array.from({ length: n }, () => Math.exp(p.mu + p.sigma * boxMuller())),
};

const DISTS = {
  normal:      { label: "Нормальное", discrete: false, params: [{ key: "mean", label: "Mean (μ)", min: -50, max: 50, step: 1, def: 0 }, { key: "sd", label: "SD (σ)", min: 0.5, max: 30, step: 0.5, def: 8 }] },
  uniform:     { label: "Равномерное", discrete: false, params: [{ key: "lo", label: "Min", min: -50, max: 20, step: 1, def: -10 }, { key: "hi", label: "Max", min: -20, max: 80, step: 1, def: 30 }] },
  exponential: { label: "Экспоненциальное", discrete: false, params: [{ key: "lambda", label: "λ (rate)", min: 0.1, max: 5, step: 0.1, def: 1 }] },
  poisson:     { label: "Пуассона", discrete: true, params: [{ key: "lambda", label: "λ (mean)", min: 0.5, max: 30, step: 0.5, def: 5 }] },
  binomial:    { label: "Биномиальное", discrete: true, params: [{ key: "trials", label: "n (trials)", min: 1, max: 100, step: 1, def: 20 }, { key: "p", label: "p (probability)", min: 0.01, max: 0.99, step: 0.01, def: 0.5 }] },
  geometric:   { label: "Геометрическое", discrete: true, params: [{ key: "p", label: "p (probability)", min: 0.01, max: 0.8, step: 0.01, def: 0.3 }] },
  chiSquared:  { label: "Хи-квадрат (χ²)", discrete: false, params: [{ key: "df", label: "df", min: 1, max: 30, step: 1, def: 4 }] },
  studentT:    { label: "Стьюдента (t)", discrete: false, params: [{ key: "df", label: "df", min: 1, max: 30, step: 1, def: 5 }] },
  logNormal:   { label: "Логнормальное", discrete: false, params: [{ key: "mu", label: "μ (log-mean)", min: -2, max: 4, step: 0.1, def: 1 }, { key: "sigma", label: "σ (log-sd)", min: 0.1, max: 2, step: 0.1, def: 0.5 }] },
};

const INSIGHTS = {
  normal: [
    "Среднее ≈ медиана. Если видишь расхождение — выборка мала или данные не нормальные.",
    "68-95-99.7: в пределах ±1σ лежит 68% данных, ±2σ — 95%, ±3σ — 99.7%. Проверь через strip plot.",
    "Боксплот для нормального — максимально честный. IQR ≈ 1.35×SD. Усы покрывают ~99.3%.",
  ],
  uniform: [
    "Нет центральной тенденции — данные равномерно размазаны. Медиана и среднее совпадают, но это не значит «нормальность».",
    "IQR = ровно половина диапазона. Боксплот выглядит «нормально», но violin покажет плоскую плотность — включи его.",
    "Выбросов по Тьюки почти не будет — у равномерного нет хвостов.",
  ],
  exponential: [
    "Среднее всегда больше медианы. Если Mean ≈ Median в реальных данных — это НЕ экспонента.",
    "Куча «выбросов» справа — но это не ошибки, а нормальный длинный хвост. Правило 1.5×IQR тут врёт.",
    "Типичное для: время между событиями, GMV, время ответа сервера.",
  ],
  poisson: [
    "Дискретное: strip plot покажет горизонтальные полоски — значения только целые.",
    "При λ > 20 Пуассон визуально неотличим от нормального. Покрути λ и увидь переход.",
    "Дисперсия = среднему (σ² = λ). Если дисперсия >> среднего — это overdispersion, Пуассон не подходит.",
  ],
  binomial: [
    "При n×p > 5 и n×(1−p) > 5 — визуально неотличим от нормального. Попробуй.",
    "При малом p — асимметричен. Боксплот покажет скос, но violin нагляднее.",
    "Возможные значения от 0 до n. Чем больше trials — тем больше «разрешение».",
  ],
  geometric: [
    "«Сколько попыток до первого успеха». Всегда скошено вправо, начинается с 1.",
    "Чем меньше p — тем длиннее хвост. При p=0.05 хвост дикий.",
    "Memoryless: прошлые неудачи не влияют на вероятность следующего успеха.",
  ],
  chiSquared: [
    "При df=1-3 — сильно скошено вправо. При df>30 — почти нормальное. Покрути и увидь переход.",
    "Среднее = df, дисперсия = 2×df. Чем больше df — тем симметричнее.",
    "Используется в χ²-тесте независимости. Это распределение суммы квадратов стандартных нормальных.",
  ],
  studentT: [
    "При df=1 — хвосты бесконечно тяжёлые. При df>30 — почти неотличим от нормального.",
    "Больше выбросов чем у нормального — t-распределение моделирует неопределённость при малых выборках.",
    "Именно поэтому t-тест использует это распределение: он учитывает, что мы не знаем истинное σ.",
  ],
  logNormal: [
    "Данные не могут быть отрицательными. Правый хвост + нет отрицательных = думай логнормальное.",
    "Среднее всегда > медианы. Разница растёт с σ. Посмотри Δ M−Md при разных σ.",
    "Типичное для: зарплаты, цены, размеры файлов. Если log(данные) выглядит нормально — это оно.",
  ],
};

function boxStats(data) {
  const s = [...data].sort((a, b) => a - b);
  const q1 = d3.quantile(s, 0.25), q3 = d3.quantile(s, 0.75), med = d3.quantile(s, 0.5), mean = d3.mean(s);
  const iqr = q3 - q1, lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
  const wLo = d3.min(s.filter(d => d >= lf)) ?? q1, wHi = d3.max(s.filter(d => d <= uf)) ?? q3;
  const out = s.filter(d => d < lf || d > uf), sd = d3.deviation(s) || 0;
  const sk = s.length > 2 && sd > 0 ? (s.length / ((s.length - 1) * (s.length - 2))) * d3.sum(s.map(d => Math.pow((d - mean) / sd, 3))) : 0;
  return { q1, q3, med, mean, iqr, wLo, wHi, out, sd, sk, n: s.length, sorted: s };
}

function kde(data, bw, nPts = 100) {
  const s = [...data].sort((a, b) => a - b);
  const lo = s[0] - 3 * bw, hi = s[s.length - 1] + 3 * bw, step = (hi - lo) / nPts;
  const pts = [];
  for (let x = lo; x <= hi; x += step) {
    let sum = 0;
    for (const d of data) { const u = (x - d) / bw; sum += Math.exp(-0.5 * u * u) / 2.5066; }
    pts.push({ x, y: sum / (data.length * bw) });
  }
  return pts;
}

function genSameBox(tQ1, tMed, tQ3, n = 300) {
  const iqr = tQ3 - tQ1, wL = tQ1 - 1.4 * iqr, wH = tQ3 + 1.4 * iqr;
  const fill = (gen) => { const a = []; while (a.length < n) { const v = gen(); if (v >= wL && v <= wH) a.push(v); } return a; };
  const sd = iqr / 1.35;
  const norm = fill(() => tMed + sd * boxMuller());
  const bim = fill(() => { const pk = Math.random() > 0.5 ? tQ1 - iqr * 0.06 : tQ3 + iqr * 0.06; return pk + iqr * 0.25 * boxMuller(); });
  const uni = fill(() => wL + Math.random() * (wH - wL));
  const cc = [tQ1 - iqr * 0.2, tQ1 + iqr * 0.3, tQ3 - iqr * 0.3, tQ3 + iqr * 0.2];
  const comb = fill(() => { const c = cc[Math.floor(Math.random() * 4)]; return c + iqr * 0.06 * boxMuller(); });
  const match = (data) => {
    const ss = [...data].sort((a, b) => a - b);
    const cQ1 = d3.quantile(ss, 0.25), cM = d3.quantile(ss, 0.5), cQ3 = d3.quantile(ss, 0.75);
    return data.map(d => d <= cM ? tQ1 + (cQ1 === cM ? 0 : (d - cQ1) / (cM - cQ1)) * (tMed - tQ1) : tMed + (cQ3 === cM ? 0 : (d - cM) / (cQ3 - cM)) * (tQ3 - tMed));
  };
  return { normal: match(norm), bimodal: match(bim), uniform: match(uni), comb: match(comb) };
}

const SB_INFO = {
  normal: { t: "Нормальное", d: "Классический колокол. Боксплот честен." },
  bimodal: { t: "Бимодальное", d: "Два пика, пустота в центре. Медиана — в зоне без данных." },
  uniform: { t: "Равномерное", d: "Плоская плотность. Бокс создаёт иллюзию." },
  comb: { t: "Кластерное", d: "Дискретные сгустки скрыты непрерывным боксом." },
};

function nCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sg = x < 0 ? -1 : 1; x = Math.abs(x) / 1.4142;
  const t = 1 / (1 + p * x);
  return 0.5 * (1 + sg * (1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)));
}

function tTest(a, b) {
  const nA = a.length, nB = b.length, mA = d3.mean(a), mB = d3.mean(b), vA = d3.variance(a), vB = d3.variance(b);
  const se = Math.sqrt(vA / nA + vB / nB);
  if (se === 0) return { t: "0", df: "1", p: "1.0000" };
  const t = (mA - mB) / se;
  const df = Math.pow(vA / nA + vB / nB, 2) / (Math.pow(vA / nA, 2) / (nA - 1) + Math.pow(vB / nB, 2) / (nB - 1));
  return { t: t.toFixed(3), df: df.toFixed(1), p: Math.max(0.0001, 2 * (1 - nCDF(Math.abs(t)))).toFixed(4) };
}

const C = {
  bg: "#0c0e14", card: "#151820", brd: "#252a36", txt: "#cdd1da", dim: "#5c6170",
  acc: "#6193f0", out: "#ef7b5e", vio: "#6193f025", vioS: "#6193f060",
  med: "#f0c95b", mn: "#ef7b5e", grn: "#4ade80", gry: "#5c6170", wh: "#7a8294",
  ann: "#8a90a0", pct: "#c084fc",
};

function Slider({ label, value, onChange, min, max, step = 1 }) {
  const disp = Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.dim }}>{label}</span>
        <span style={{ fontSize: 11, color: C.acc, fontWeight: 600 }}>{disp}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: C.acc }} />
    </div>
  );
}

function BPlot({ data, width = 500, height = 500, showV, showS, showL, label, color = C.acc, disc, pctTh }) {
  if (!data || data.length < 4) return null;
  const st = boxStats(data);
  const margin = { top: 28, bottom: 38, left: 56, right: showL ? 270 : 24 };
  const pH = height - margin.top - margin.bottom;
  const pW = width - margin.left - margin.right;
  const cx = pW / 2;
  const range = d3.max(data) - d3.min(data);
  const pad = range * 0.07 || 1;
  const yMin = d3.min(data) - pad, yMax = d3.max(data) + pad;
  const yS = v => margin.top + pH - ((v - yMin) / (yMax - yMin)) * pH;
  const boxW = Math.min(110, pW * 0.25);

  let pctLines = null;
  if (pctTh) {
    const pctMap = { "99": [0.005, 0.995], "99.9": [0.0005, 0.9995], "99.99": [0.00005, 0.99995] };
    const bounds = pctMap[pctTh];
    if (bounds) {
      pctLines = { lo: d3.quantile(st.sorted, bounds[0]), hi: d3.quantile(st.sorted, bounds[1]), label: pctTh };
    }
  }

  let vPath = null;
  if (showV) {
    const bw = st.sd ? st.sd * 0.5 : (st.iqr || 1) * 0.4;
    const dens = kde(data, Math.max(bw, 0.3));
    const mx = d3.max(dens, d => d.y) || 1;
    const vW = boxW * 2.2;
    const pts = dens.map(d => ({ x: (d.y / mx) * (vW / 2), y: yS(d.x) }));
    const l = pts.map(p => `${margin.left + cx - p.x},${p.y}`).join(" L");
    const r = [...pts].reverse().map(p => `${margin.left + cx + p.x},${p.y}`).join(" L");
    vPath = `M ${l} L ${r} Z`;
  }

  const jit = useMemo(() => {
    if (!showS) return [];
    const jW = boxW * 0.7;
    let pts = data;
    if (data.length > 600) { const step = Math.ceil(data.length / 600); pts = data.filter((_, i) => i % step === 0); }
    return pts.map(d => ({ x: cx + (Math.random() - 0.5) * jW, y: yS(d), isO: d < st.wLo || d > st.wHi }));
  }, [data, showS]);

  const nTk = 8, tkS = (yMax - yMin) / nTk;
  const tks = Array.from({ length: nTk + 1 }, (_, i) => yMin + i * tkS);

  const anno = (val, text, yOff = 0) => {
    if (val == null || !isFinite(val)) return null;
    const y = yS(val) + yOff;
    const x1 = margin.left + cx + boxW / 2 + 10, x2 = x1 + 22, xT = x2 + 8;
    return (
      <g key={text}>
        <line x1={x1} x2={x2} y1={y} y2={y} stroke={C.ann} strokeWidth={0.8} strokeDasharray="2,2" />
        <text x={xT} y={y + 4} fontSize={11} fill={C.ann} fontFamily="inherit">{text}: {val.toFixed(disc ? 0 : 2)}</text>
      </g>
    );
  };

  return (
    <svg width={width} height={height} style={{ overflow: "visible", fontFamily: "'JetBrains Mono', monospace" }}>
      {tks.map((t, i) => (
        <g key={i}>
          <line x1={margin.left} x2={margin.left + pW} y1={yS(t)} y2={yS(t)} stroke={C.brd} strokeWidth={0.5} />
          <text x={margin.left - 10} y={yS(t) + 3} textAnchor="end" fontSize={10} fill={C.dim}>{t.toFixed(disc ? 0 : 1)}</text>
        </g>
      ))}
      {pctLines && (
        <g>
          <rect x={margin.left} y={yS(pctLines.hi)} width={pW} height={Math.max(0, yS(pctLines.lo) - yS(pctLines.hi))} fill={C.pct} opacity={0.04} />
          {[{ v: pctLines.hi, lbl: `P${(50 + parseFloat(pctLines.label) / 2).toFixed(2)}%` }, { v: pctLines.lo, lbl: `P${(50 - parseFloat(pctLines.label) / 2).toFixed(2)}%` }].map((item, i) => (
            <g key={i}>
              <line x1={margin.left} x2={margin.left + pW} y1={yS(item.v)} y2={yS(item.v)} stroke={C.pct} strokeWidth={1.5} strokeDasharray="6,4" opacity={0.7} />
              <text x={margin.left + 4} y={yS(item.v) - 5} fontSize={10} fill={C.pct} fontFamily="inherit" opacity={0.85}>
                {item.lbl}: {item.v.toFixed(disc ? 0 : 2)}
              </text>
            </g>
          ))}
        </g>
      )}
      {vPath && <path d={vPath} fill={C.vio} stroke={C.vioS} strokeWidth={1.5} />}
      {showS && jit.map((p, i) => <circle key={i} cx={margin.left + p.x} cy={p.y} r={2.2} fill={p.isO ? C.out : color} opacity={0.3} />)}
      <line x1={margin.left + cx} x2={margin.left + cx} y1={yS(st.wHi)} y2={yS(st.q3)} stroke={C.wh} strokeWidth={1.5} strokeDasharray="4,3" />
      <line x1={margin.left + cx} x2={margin.left + cx} y1={yS(st.q1)} y2={yS(st.wLo)} stroke={C.wh} strokeWidth={1.5} strokeDasharray="4,3" />
      {[st.wHi, st.wLo].map((w, i) => <line key={i} x1={margin.left + cx - boxW * 0.22} x2={margin.left + cx + boxW * 0.22} y1={yS(w)} y2={yS(w)} stroke={C.wh} strokeWidth={1.5} />)}
      <rect x={margin.left + cx - boxW / 2} y={yS(st.q3)} width={boxW} height={Math.max(1, yS(st.q1) - yS(st.q3))} fill={`${color}15`} stroke={color} strokeWidth={2} rx={4} />
      <line x1={margin.left + cx - boxW / 2} x2={margin.left + cx + boxW / 2} y1={yS(st.med)} y2={yS(st.med)} stroke={C.med} strokeWidth={2.5} />
      <polygon points={`${margin.left + cx},${yS(st.mean) - 6} ${margin.left + cx + 6},${yS(st.mean)} ${margin.left + cx},${yS(st.mean) + 6} ${margin.left + cx - 6},${yS(st.mean)}`} fill={C.mn} opacity={0.9} />
      {!showS && st.out.map((o, i) => <circle key={i} cx={margin.left + cx} cy={yS(o)} r={4} fill="none" stroke={C.out} strokeWidth={1.5} />)}
      {showL && (
        <g>
          {anno(st.wHi, "Upper whisker")}
          {anno(st.q3, "Q3 (75-й перцентиль)", Math.abs(yS(st.q3) - yS(st.wHi)) < 18 ? 18 : 0)}
          {anno(st.med, "Медиана (50-й)", 0)}
          {anno(st.q1, "Q1 (25-й перцентиль)", Math.abs(yS(st.q1) - yS(st.wLo)) < 18 ? -18 : 0)}
          {anno(st.wLo, "Lower whisker")}
          {st.out.length > 0 && <text x={margin.left + cx + boxW / 2 + 40} y={yS(st.out[st.out.length - 1]) + 4} fontSize={11} fill={C.out} fontFamily="inherit">← Выбросы ({st.out.length})</text>}
          {(() => {
            const bx = margin.left + cx - boxW / 2 - 12;
            const yT = yS(st.q3), yB = yS(st.q1), yM = (yT + yB) / 2;
            return (
              <g>
                <line x1={bx} x2={bx} y1={yT} y2={yB} stroke={C.ann} strokeWidth={1} />
                <line x1={bx - 5} x2={bx} y1={yT} y2={yT} stroke={C.ann} strokeWidth={1} />
                <line x1={bx - 5} x2={bx} y1={yB} y2={yB} stroke={C.ann} strokeWidth={1} />
                <text x={bx - 7} y={yM} textAnchor="end" fontSize={10} fill={C.ann} fontFamily="inherit" transform={`rotate(-90,${bx - 7},${yM})`}>50% данных (IQR)</text>
              </g>
            );
          })()}
        </g>
      )}
      {label && <text x={margin.left + cx} y={height - 8} textAnchor="middle" fill={C.dim} fontSize={13} fontFamily="inherit">{label}</text>}
    </svg>
  );
}

const STAT_DESC = {
  n: "Размер выборки — сколько точек данных",
  Mean: "Среднее арифметическое — сумма всех значений / n",
  Median: "Медиана — значение посередине (50-й перцентиль)",
  SD: "Standard Deviation — насколько далеко в среднем точки от Mean",
  IQR: "Interquartile Range (Q3−Q1) — диапазон центральных 50% данных",
  Skew: "Skewness — асимметрия. 0 = симметрично, >0 хвост вправо, <0 влево",
  Outliers: "Выбросы — точки за пределами 1.5×IQR от краёв бокса",
  "Δ M−Md": "Разница Mean − Median. Чем больше — тем сильнее асимметрия",
};

function Stats({ data }) {
  if (!data || data.length < 4) return null;
  const s = boxStats(data);
  const items = [["n", s.n], ["Mean", s.mean?.toFixed(2)], ["Median", s.med?.toFixed(2)], ["SD", s.sd?.toFixed(2)], ["IQR", s.iqr?.toFixed(2)], ["Skew", s.sk?.toFixed(3)], ["Outliers", s.out.length]];
  const dv = Math.abs(s.mean - s.med);
  if (dv > 0.5) items.push(["Δ M−Md", dv.toFixed(2)]);
  const [hover, setHover] = useState(null);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 14, background: C.card, borderRadius: 10, border: `1px solid ${C.brd}` }}>
        {items.map(([k, v]) => (
          <div key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}
            style={{ textAlign: "center", minWidth: 70, padding: "6px 10px", borderRadius: 6, cursor: "help", background: hover === k ? `${C.acc}10` : "transparent", border: `1px solid ${k === "Δ M−Md" ? `${C.out}30` : "transparent"}`, transition: "background 0.15s" }}>
            <div style={{ fontSize: 9, color: k === "Δ M−Md" ? C.out : C.dim, textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
            <div style={{ fontSize: 16, color: k === "Δ M−Md" ? C.out : C.txt, fontWeight: 600, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
      {hover && STAT_DESC[hover] && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 6, padding: "10px 14px", background: "#1e2230", border: `1px solid ${C.brd}`, borderRadius: 8, fontSize: 12, color: C.txt, lineHeight: 1.5, zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <span style={{ color: C.acc, fontWeight: 600 }}>{hover}</span> — {STAT_DESC[hover]}
        </div>
      )}
    </div>
  );
}

const TABS = ["Explorer", "Same Box", "Compare"];

export default function App() {
  const [tab, setTab] = useState("Explorer");
  const [distKey, setDistKey] = useState("normal");
  const [n, setN] = useState(200);
  const [seed, setSeed] = useState(0);
  const [showV, setShowV] = useState(false);
  const [showS, setShowS] = useState(true);
  const [showL, setShowL] = useState(true);
  const [pctTh, setPctTh] = useState(null);

  const cfg = DISTS[distKey];
  const initP = {}; cfg.params.forEach(p => { initP[p.key] = p.def; });
  const [dp, setDp] = useState(initP);
  const changeDist = k => { setDistKey(k); const np = {}; DISTS[k].params.forEach(p => { np[p.key] = p.def; }); setDp(np); };

  const data = useMemo(() => GEN[distKey](n, dp), [distKey, n, dp, seed]);
  const insights = INSIGHTS[distKey] || [];

  const [rev, setRev] = useState(false);
  const sbData = useMemo(() => genSameBox(25, 50, 75, 300), [seed]);

  const [gc, setGc] = useState(2);
  const [gp, setGp] = useState([{ n: 100, mean: 0, sd: 8 }, { n: 100, mean: 5, sd: 8 }, { n: 100, mean: -3, sd: 12 }]);
  const ug = (i, k, v) => setGp(prev => { const x = [...prev]; x[i] = { ...x[i], [k]: v }; return x; });
  const cData = useMemo(() => gp.slice(0, gc).map(p => GEN.normal(p.n, p)), [gp, gc, seed]);
  const tt = useMemo(() => gc === 2 && cData.length === 2 ? tTest(cData[0], cData[1]) : null, [cData, gc]);
  const gcol = ["#6193f0", "#ef7b5e", "#4ade80"];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.txt, fontFamily: "'JetBrains Mono','SF Mono',monospace", padding: "28px 24px", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: 0 }}>Boxplot Explorer</h1>
        <p style={{ fontSize: 12, color: C.dim, margin: "4px 0 0", letterSpacing: 1 }}>INTERACTIVE DISTRIBUTION ANALYSIS</p>
      </div>

      <div style={{ display: "flex", gap: 3, marginBottom: 28, background: C.card, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === "Same Box") setRev(false); }}
            style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: tab === t ? C.acc : "transparent", color: tab === t ? "#fff" : C.dim, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Explorer" && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ width: 270, flexShrink: 0 }}>
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Распределение</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {Object.entries(DISTS).map(([k, c]) => (
                  <button key={k} onClick={() => changeDist(k)}
                    style={{ padding: "5px 11px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${distKey === k ? C.acc : C.brd}`, background: distKey === k ? `${C.acc}20` : "transparent", color: distKey === k ? C.acc : C.dim }}>
                    {c.label}
                  </button>
                ))}
              </div>
              {cfg.discrete && <div style={{ marginTop: 10, fontSize: 11, color: C.med, background: `${C.med}15`, padding: "5px 10px", borderRadius: 5 }}>⚡ Дискретное распределение</div>}
            </div>

            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Параметры</div>
              <Slider label="n (sample size)" value={n} onChange={setN} min={10} max={1000} step={5} />
              {cfg.params.map(p => (
                <Slider key={p.key} label={p.label} value={dp[p.key] ?? p.def} onChange={v => setDp(prev => ({ ...prev, [p.key]: v }))} min={p.min} max={p.max} step={p.step} />
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Порог перцентилей</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[null, "99", "99.9", "99.99"].map(p => (
                  <button key={p ?? "off"} onClick={() => setPctTh(p)}
                    style={{ padding: "5px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${pctTh === p ? C.pct : C.brd}`, background: pctTh === p ? `${C.pct}20` : "transparent", color: pctTh === p ? C.pct : C.dim }}>
                    {p ? `${p}%` : "Off"}
                  </button>
                ))}
              </div>
              {pctTh && <div style={{ marginTop: 8, fontSize: 10, color: C.pct, lineHeight: 1.5, opacity: 0.8 }}>Фиолетовые линии — границы {pctTh}% интервала. Сравни с усами Тьюки.</div>}
            </div>

            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["Violin", showV, setShowV], ["Strip", showS, setShowS], ["Labels", showL, setShowL]].map(([l, v, s]) => (
                  <button key={l} onClick={() => s(!v)}
                    style={{ padding: "5px 14px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${v ? C.acc : C.brd}`, background: v ? `${C.acc}20` : "transparent", color: v ? C.acc : C.dim }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setSeed(s => s + 1)}
              style={{ width: "100%", padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${C.grn}50`, background: `${C.grn}15`, color: C.grn, marginBottom: 12 }}>
              ↻ Перегенерировать данные
            </button>

            <div style={{ padding: 14, background: C.card, borderRadius: 10, border: `1px solid ${C.brd}` }}>
              <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Legend</div>
              {[[C.med, "━", "Медиана (50-й перцентиль)"], [C.mn, "◆", "Среднее (mean)"], [C.out, "○", "Выброс (> 1.5×IQR)"], [C.acc, "█", "Бокс = IQR (25–75-й)"], [C.wh, "┊", "Усы (до 1.5×IQR)"], [C.pct, "╌", "Перцентильный порог"]].map(([c, sym, lbl]) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ color: c, fontSize: 14, width: 18, textAlign: "center" }}>{sym}</span>
                  <span style={{ fontSize: 11, color: C.dim }}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 440 }}>
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.brd}`, padding: 24, display: "flex", justifyContent: "center", marginBottom: 14, overflowX: "auto" }}>
              <BPlot data={data} width={showL ? 800 : 520} height={600} showV={showV} showS={showS} showL={showL} disc={cfg.discrete} pctTh={pctTh} />
            </div>
            <Stats data={data} />
            {insights.length > 0 && (
              <div style={{ marginTop: 14, padding: 16, background: `${C.acc}08`, border: `1px solid ${C.acc}20`, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.acc, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>💡 Инсайты: {cfg.label}</div>
                {insights.map((ins, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.txt, lineHeight: 1.7, marginBottom: i < insights.length - 1 ? 10 : 0, paddingLeft: 12, borderLeft: `2px solid ${C.acc}30` }}>{ins}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Same Box" && (
        <div>
          <div style={{ marginBottom: 20, maxWidth: 640 }}>
            <p style={{ fontSize: 16, color: C.txt, lineHeight: 1.7, margin: 0 }}>Четыре разных распределения. <span style={{ color: C.med, fontWeight: 700 }}>Один боксплот.</span></p>
            <p style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>Q1, медиана, Q3, усы — совпадают. Нажми Reveal.</p>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {Object.entries(sbData).map(([k, d]) => (
              <div key={k} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: "16px 12px", width: 210, textAlign: "center" }}>
                <BPlot data={d} width={200} height={360} showV={rev} showS={rev} showL={false} label={rev ? SB_INFO[k].t : "???"} />
                {rev && <p style={{ fontSize: 11, color: C.dim, margin: "10px 6px 0", lineHeight: 1.6, textAlign: "left" }}>{SB_INFO[k].d}</p>}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={() => setRev(!rev)}
              style={{ padding: "14px 48px", borderRadius: 10, border: "none", background: rev ? C.brd : C.acc, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {rev ? "Hide" : "✦ Reveal"}
            </button>
          </div>
          {rev && (
            <div style={{ marginTop: 20, padding: 18, background: `${C.out}0d`, border: `1px solid ${C.out}30`, borderRadius: 10, maxWidth: 640 }}>
              <p style={{ fontSize: 14, color: C.out, margin: 0, fontWeight: 700 }}>Вывод</p>
              <p style={{ fontSize: 13, color: C.txt, margin: "8px 0 0", lineHeight: 1.7 }}>Боксплот — 5 чисел. Бимодальность, кластеры, пустоты невидимы. Дополняй violin или strip plot.</p>
            </div>
          )}
        </div>
      )}

      {tab === "Compare" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[2, 3].map(g => (
              <button key={g} onClick={() => setGc(g)}
                style={{ padding: "8px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${gc === g ? C.acc : C.brd}`, background: gc === g ? `${C.acc}20` : "transparent", color: gc === g ? C.acc : C.dim }}>
                {g} groups
              </button>
            ))}
            <button onClick={() => setSeed(s => s + 1)}
              style={{ padding: "8px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${C.grn}50`, background: `${C.grn}15`, color: C.grn, marginLeft: 8 }}>↻ Reseed</button>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {gp.slice(0, gc).map((p, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, padding: 16, width: 220, borderLeft: `3px solid ${gcol[i]}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: gcol[i], marginBottom: 10 }}>Group {i + 1}</div>
                  <Slider label="n" value={p.n} onChange={v => ug(i, "n", v)} min={20} max={500} step={5} />
                  <Slider label="Mean" value={p.mean} onChange={v => ug(i, "mean", v)} min={-30} max={30} />
                  <Slider label="SD" value={p.sd} onChange={v => ug(i, "sd", v)} min={1} max={25} step={0.5} />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 380 }}>
              <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.brd}`, padding: 24, display: "flex", justifyContent: "center", gap: 10 }}>
                {cData.map((d, i) => <BPlot key={i} data={d} width={200} height={440} showV={true} showS={true} showL={false} label={`Group ${i + 1}`} color={gcol[i]} />)}
              </div>
              {tt && gc === 2 && (
                <div style={{ marginTop: 14, padding: 18, background: C.card, borderRadius: 10, border: `1px solid ${C.brd}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1 }}>Welch's t-test</span>
                    <div style={{ fontSize: 14, color: C.txt, marginTop: 4 }}>t = {tt.t} &nbsp; df = {tt.df}</div>
                  </div>
                  <div style={{ padding: "10px 24px", borderRadius: 8, background: parseFloat(tt.p) < 0.05 ? `${C.grn}18` : `${C.gry}18`, border: `1px solid ${parseFloat(tt.p) < 0.05 ? C.grn : C.gry}40` }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: parseFloat(tt.p) < 0.05 ? C.grn : C.gry }}>p = {tt.p}</span>
                    <span style={{ fontSize: 12, marginLeft: 10, color: C.dim }}>{parseFloat(tt.p) < 0.05 ? "significant" : "not significant"}</span>
                  </div>
                </div>
              )}
              {gc === 3 && <div style={{ marginTop: 14, padding: 16, background: C.card, borderRadius: 10, border: `1px solid ${C.brd}` }}><span style={{ fontSize: 12, color: C.dim }}>ANOVA — визуальное сравнение. t-test доступен для 2 групп.</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
