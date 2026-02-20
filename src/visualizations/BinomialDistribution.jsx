import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import BackButton from "../components/BackButton";

function binomCoeff(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let c = 1;
  for (let i = 0; i < k; i++) {
    c = (c * (n - i)) / (i + 1);
  }
  return c;
}

function binomPMF(k, n, p) {
  return binomCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function binomCDF(k, n, p) {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += binomPMF(i, n, p);
  }
  return sum;
}

export default function BinomialDistribution() {
  const [n, setN] = useState(20);
  const [p, setP] = useState(50);

  const pReal = p / 100;

  const analysis = useMemo(() => {
    const mean = n * pReal;
    const variance = n * pReal * (1 - pReal);
    const std = Math.sqrt(variance);
    const mode = Math.floor((n + 1) * pReal);
    const skewness = pReal === 0 || pReal === 1 ? 0 : (1 - 2 * pReal) / std;

    const data = [];
    let maxPMF = 0;
    for (let k = 0; k <= n; k++) {
      const pmf = binomPMF(k, n, pReal);
      const cdf = binomCDF(k, n, pReal);
      if (pmf > maxPMF) maxPMF = pmf;
      data.push({ k, pmf, cdf });
    }

    return { mean, variance, std, mode, skewness, data, maxPMF };
  }, [n, pReal]);

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        background: "#08080e",
        color: "#e0e0e8",
        minHeight: "100vh",
        padding: "28px 20px",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');input[type=range]{height:4px}`}</style>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <BackButton />
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 2px",
            letterSpacing: "-0.5px",
          }}
        >
          Биномиальное распределение
        </h1>
        <p style={{ color: "#555", fontSize: 11, margin: "0 0 24px" }}>
          P(X = k) = C(n, k) · p^k · (1 − p)^(n − k)
        </p>

        {/* Параметры */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "#111118",
              borderRadius: 10,
              padding: "14px 16px",
              border: "1px solid #1e1e2e",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#a78bfa",
                fontWeight: 600,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Число испытаний (n)
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 10, color: "#888" }}>n</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {n}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={n}
              onChange={(e) => setN(+e.target.value)}
              style={{ width: "100%", accentColor: "#a78bfa" }}
            />
          </div>
          <div
            style={{
              background: "#111118",
              borderRadius: 10,
              padding: "14px 16px",
              border: "1px solid #1e1e2e",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#34d399",
                fontWeight: 600,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Вероятность успеха (p)
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 10, color: "#888" }}>p</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {(p / 100).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={99}
              step={1}
              value={p}
              onChange={(e) => setP(+e.target.value)}
              style={{ width: "100%", accentColor: "#34d399" }}
            />
          </div>
        </div>

        {/* Метрики */}
        <div
          style={{
            background: "linear-gradient(135deg, #110d28 0%, #0d0a1a 100%)",
            border: "1px solid #2a2050",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 24,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>
              Мат. ожидание (μ)
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa" }}>
              {analysis.mean.toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: "#666" }}>n · p</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>
              Дисперсия (σ²)
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#60a5fa" }}>
              {analysis.variance.toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: "#666" }}>n · p · (1 − p)</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>
              Ст. отклонение (σ)
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>
              {analysis.std.toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: "#666" }}>√(n · p · (1 − p))</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>
              Мода
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>
              {analysis.mode}
            </div>
            <div style={{ fontSize: 10, color: "#666" }}>
              ⌊(n + 1) · p⌋
            </div>
          </div>
        </div>

        {/* PMF график */}
        <div
          style={{
            background: "#111118",
            borderRadius: 12,
            padding: "16px 12px 8px",
            border: "1px solid #1e1e2e",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#e0e0e8",
              fontWeight: 600,
              paddingLeft: 8,
              marginBottom: 8,
            }}
          >
            Функция вероятности P(X = k)
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analysis.data} barCategoryGap={n > 50 ? 0 : 2}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
              <XAxis
                dataKey="k"
                tick={{ fill: "#555", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#252535" }}
                interval={n <= 20 ? 0 : n <= 50 ? 4 : 9}
              />
              <YAxis
                tick={{ fill: "#555", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#252535" }}
                tickFormatter={(v) => v.toFixed(3)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a28",
                  border: "1px solid #333",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(value, name) => [
                  value.toFixed(6),
                  name === "pmf" ? "P(X = k)" : name,
                ]}
                labelFormatter={(k) => `k = ${k}`}
              />
              <ReferenceLine
                x={Math.round(analysis.mean)}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `μ ≈ ${analysis.mean.toFixed(1)}`,
                  fill: "#fbbf24",
                  fontSize: 10,
                  position: "top",
                }}
              />
              <Bar dataKey="pmf" name="P(X = k)" radius={[2, 2, 0, 0]}>
                {analysis.data.map((entry) => (
                  <Cell
                    key={entry.k}
                    fill={
                      Math.abs(entry.k - analysis.mean) <= analysis.std
                        ? "#a78bfa"
                        : Math.abs(entry.k - analysis.mean) <= 2 * analysis.std
                        ? "#7c5cbf"
                        : "#4a3580"
                    }
                    fillOpacity={
                      Math.abs(entry.k - analysis.mean) <= analysis.std
                        ? 0.9
                        : Math.abs(entry.k - analysis.mean) <= 2 * analysis.std
                        ? 0.6
                        : 0.3
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              paddingBottom: 8,
              fontSize: 10,
              color: "#666",
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "#a78bfa",
                  borderRadius: 2,
                  marginRight: 4,
                  opacity: 0.9,
                }}
              />
              ±1σ
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "#7c5cbf",
                  borderRadius: 2,
                  marginRight: 4,
                  opacity: 0.6,
                }}
              />
              ±2σ
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "#4a3580",
                  borderRadius: 2,
                  marginRight: 4,
                  opacity: 0.3,
                }}
              />
              &gt;2σ
            </span>
          </div>
        </div>

        {/* CDF график */}
        <div
          style={{
            background: "#111118",
            borderRadius: 12,
            padding: "16px 12px 8px",
            border: "1px solid #1e1e2e",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#e0e0e8",
              fontWeight: 600,
              paddingLeft: 8,
              marginBottom: 8,
            }}
          >
            Функция распределения F(k) = P(X ≤ k)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis.data} barCategoryGap={n > 50 ? 0 : 2}>
              <defs>
                <linearGradient id="cdfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
              <XAxis
                dataKey="k"
                tick={{ fill: "#555", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#252535" }}
                interval={n <= 20 ? 0 : n <= 50 ? 4 : 9}
              />
              <YAxis
                tick={{ fill: "#555", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#252535" }}
                domain={[0, 1]}
                tickFormatter={(v) => v.toFixed(1)}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a28",
                  border: "1px solid #333",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(value) => [value.toFixed(6), "F(k)"]}
                labelFormatter={(k) => `k = ${k}`}
              />
              <ReferenceLine
                y={0.5}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: "медиана",
                  fill: "#fbbf24",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Bar
                dataKey="cdf"
                name="F(k)"
                fill="url(#cdfGrad)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Формулы */}
        <div
          style={{
            background: "#0c0c14",
            borderRadius: 10,
            padding: "14px 16px",
            border: "1px solid #1e1e2e",
            fontSize: 11,
            lineHeight: 2,
          }}
        >
          <div style={{ color: "#666" }}>
            μ = n · p = {n} · {pReal.toFixed(2)} ={" "}
            <span style={{ color: "#fff", fontWeight: 600 }}>
              {analysis.mean.toFixed(2)}
            </span>
          </div>
          <div style={{ color: "#666" }}>
            σ² = n · p · (1 − p) = {n} · {pReal.toFixed(2)} ·{" "}
            {(1 - pReal).toFixed(2)} ={" "}
            <span style={{ color: "#fff", fontWeight: 600 }}>
              {analysis.variance.toFixed(2)}
            </span>
          </div>
          <div style={{ color: "#666" }}>
            σ = √σ² ={" "}
            <span style={{ color: "#fff", fontWeight: 600 }}>
              {analysis.std.toFixed(4)}
            </span>
          </div>
          <div style={{ color: "#666" }}>
            Асимметрия = (1 − 2p) / σ ={" "}
            <span style={{ color: "#fff", fontWeight: 600 }}>
              {analysis.skewness.toFixed(4)}
            </span>
            <span style={{ color: "#555", marginLeft: 8 }}>
              {Math.abs(analysis.skewness) < 0.1
                ? "(≈ симметричное)"
                : analysis.skewness > 0
                ? "(правый хвост)"
                : "(левый хвост)"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
