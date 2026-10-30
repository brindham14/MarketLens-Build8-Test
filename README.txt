MARKETLENS NEXT — SEPARATE TEST BUILD

This is a separate build. It does not replace your existing MarketLens site.

HOW TO TEST
1. Keep index.html, core.js, app.js, styles.css, data/, update_data.py and .github/ together.
2. Open this folder using a local web server (recommended) or publish it to a NEW GitHub repository for private testing.
3. Do not open index.html directly as a file:// URL; browsers may block local JSON fetches.
4. For a local server with Python installed, open a terminal in this folder and run:
      python -m http.server 8000
   Then open http://localhost:8000

WHAT THIS BUILD CORRECTS IN THIS ITERATION
- Adds the missing shared core.js file to the deliverable and uses it from app.js.
- Loads summary, quotes, close history, themes, gaps and IPO data through one normalized data layer.
- Uses quote-file price/day-change values when present, keeps missing numeric fields blank, and does not convert null to zero.
- Uses strict screener predicates for RS, turnover, above-50DMA, VCP, breakout and Trend Template 8/8.
- Corrects Popular Scans to use the actual supplied flags; Trend Template 8/8 requires trend >= 8.
- Removes the unsupported Cup & Handle filter because the supplied summary dataset has no Cup & Handle field.
- Displays separate quote and history dates; stock chart is explicitly close-only, not OHLC candlesticks.

KNOWN LIMITATIONS / STILL PENDING
- The supplied summary has 2,193 stocks; history.json has close-only history for 705 stocks. It is not a full OHLCV candle dataset.
- Index constituent membership is not verified by the supplied files; this build does not claim an accurate Nifty Total Market constituent filter.
- The supplied daily stage field is retained from the generator; it is not represented as the full weekly Weinstein stage model.
- Pattern flags (VCP, Pocket Pivot, Flag, breakout) are the supplied generator's calculations. They have not yet been independently reconciled against chart pattern detection.
- No full OHLCV chart, benchmark candlestick data, or verified TejHQ fallback has been integrated in this iteration.
- Backtest engines, persistent cross-page watchlists/tags, custom scans, alert delivery and mobile/browser QA remain pending.
- The GitHub Actions workflow runs update_data.py and commits data/ outputs. Test it in a separate repository before using it in production.

DATA SNAPSHOT
Quotes asOf: 2026-10-29
Close history through: 2026-10-29
Use this as a test build only; it is not live market data and is not investment advice.
