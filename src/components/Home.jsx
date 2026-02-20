import { Link } from 'react-router-dom'

// ============================================
// РЕЕСТР ВИЗУАЛИЗАЦИЙ
// Добавь сюда новую карточку при добавлении визуализации
// ============================================
const VISUALIZATIONS = [
  {
    path: '/referral-optimizer',
    title: 'Реферальная программа',
    description: 'Оптимизация промокодов X и Y — эластичность, каннибализация, профит',
    color: '#34d399',
    tags: ['unit-economics', 'optimization'],
  },
  {
    path: '/ab-confidence',
    title: 'A/B тест — CI аплифта',
    description: 'Доверительные интервалы, мощность теста, MDE — всё с ползунками',
    color: '#60a5fa',
    tags: ['statistics', 'ab-test'],
  },
  {
    path: '/binomial-distribution',
    title: 'Биномиальное распределение',
    description: 'PMF, CDF, мат. ожидание, дисперсия — интерактивный калькулятор B(n, p)',
    color: '#a78bfa',
    tags: ['statistics', 'probability'],
  },
  {
    path: '/distributions',
    title: 'Distribution Explorer',
    description: '10 распределений — теория, эмпирика, μ/Me/Mo, sampling distribution + CI',
    color: '#e8c547',
    tags: ['statistics', 'probability', 'distributions'],
  },
]

export default function Home() {
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      background: '#08080e',
      color: '#e0e0e8',
      minHeight: '100vh',
      padding: '40px 24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        a { text-decoration: none; }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 32,
          fontWeight: 700,
          color: '#fff',
          margin: '0 0 4px',
          letterSpacing: '-1px',
        }}>
          dataviz hub
        </h1>
        <p style={{ color: '#555', fontSize: 12, margin: '0 0 40px' }}>
          Интерактивные калькуляторы для продуктовой аналитики · {VISUALIZATIONS.length} визуализаций
        </p>

        <div style={{ display: 'grid', gap: 16 }}>
          {VISUALIZATIONS.map(viz => (
            <Link key={viz.path} to={viz.path}>
              <div style={{
                background: '#111118',
                border: '1px solid #1e1e2e',
                borderRadius: 12,
                padding: '20px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderLeft: `3px solid ${viz.color}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#16161f'
                e.currentTarget.style.borderColor = '#2e2e45'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#111118'
                e.currentTarget.style.borderColor = '#1e1e2e'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                      {viz.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#777', lineHeight: 1.5 }}>
                      {viz.description}
                    </div>
                  </div>
                  <span style={{ color: '#444', fontSize: 18, marginLeft: 16 }}>→</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  {viz.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 10,
                      color: '#555',
                      background: '#0a0a12',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid #1a1a28',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
