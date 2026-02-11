import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import ReferralOptimizer from './visualizations/ReferralOptimizer'
import ABConfidence from './visualizations/ABConfidence'

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
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
