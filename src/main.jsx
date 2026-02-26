import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import ReferralOptimizer from './visualizations/ReferralOptimizer'
import ABConfidence from './visualizations/ABConfidence'
import BinomialDistribution from './visualizations/BinomialDistribution'
import Distributions from './visualizations/Distributions'
import BoxplotExplorer from './visualizations/boxplot-explorer'
import ZTestViz from './visualizations/ztest-viz'

// ============================================
// ДОБАВЛЯЙ НОВЫЕ ВИЗУАЛИЗАЦИИ ТАК:
// 1. Создай файл в src/visualizations/
// 2. Импортируй его здесь
// 3. Добавь <Route> ниже
// 4. Добавь карточку в src/components/Home.jsx
// ============================================

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/referral-optimizer" element={<ReferralOptimizer />} />
        <Route path="/ab-confidence" element={<ABConfidence />} />
        <Route path="/binomial-distribution" element={<BinomialDistribution />} />
        <Route path="/distributions" element={<Distributions />} />
        <Route path="/boxplot-explorer" element={<BoxplotExplorer />} />
        <Route path="/ztest-viz" element={<ZTestViz />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
