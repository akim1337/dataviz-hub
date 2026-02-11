import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ ЗАМЕНИ 'dataviz-hub' на имя твоего репозитория на GitHub
export default defineConfig({
  plugins: [react()],
  base: '/dataviz-hub/',
})
