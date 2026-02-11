# dataviz-hub

Хаб интерактивных визуализаций для продуктовой аналитики.  
Автодеплой на GitHub Pages при пуше в `main`.

## Быстрый старт

```bash
git clone <your-repo-url>
cd dataviz-hub
npm install
npm run dev        # локально на http://localhost:5173
```

## Деплой

1. Создай репозиторий на GitHub (например `dataviz-hub`)
2. В `vite.config.js` замени `base: '/dataviz-hub/'` на имя своего репо
3. Пуш в main:
```bash
git init
git add .
git commit -m "init"
git remote add origin git@github.com:YOUR_USER/dataviz-hub.git
git push -u origin main
```
4. В GitHub: Settings → Pages → Source → **GitHub Actions**
5. Готово. Сайт на `https://YOUR_USER.github.io/dataviz-hub/`

## Добавить новую визуализацию

1. Создай файл `src/visualizations/MyNewViz.jsx`
2. В `src/main.jsx` — импорт + Route
3. В `src/components/Home.jsx` — карточка в массив `VISUALIZATIONS`
4. `git push` — автодеплой

## Структура

```
src/
├── main.jsx                    # Роутинг
├── components/
│   ├── Home.jsx                # Главная с карточками
│   └── BackButton.jsx          # Навигация назад
└── visualizations/
    ├── ReferralOptimizer.jsx   # Оптимизация реферальной программы
    └── ABConfidence.jsx        # CI для A/B тестов
```
