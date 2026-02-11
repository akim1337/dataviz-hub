import { Link } from 'react-router-dom'

export default function BackButton() {
  return (
    <Link to="/" style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: '#555',
      textDecoration: 'none',
      fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace",
      marginBottom: 20,
      padding: '4px 0',
      transition: 'color 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
    onMouseLeave={e => e.currentTarget.style.color = '#555'}>
      ← все визуализации
    </Link>
  )
}
