# ⚡ TrackPulse — Intelligent Stock Watchlist Engine
> **Groww Capstone Project Submission | Vaishnavi M**  
> *End-to-End Real-Time Anomaly Scoring, Automatic Session Checkpoints & Cross-Device Persistence*

---

## 📌 Executive Product Pitch (100-Word Summary)
Standard stock watchlists are noisy, alphabetical, or sorted by raw % gainers—flooding investors with penny-stock volatility and missing true market developments. **"TrackPulse — Since You Checked"** transforms the watchlist into an actionable intelligence feed. Built with an end-to-end FastAPI backend and Supabase PostgreSQL database, it dynamically calculates statistical anomalies ($Z$-score volatility normalization, 20-day volume surges, and NIFTY 50 alpha) that occurred specifically since the user's last session checkpoint. With robust edge-case resilience (low-liquidity warnings, graceful error handling) and seamless cross-device persistence, it delivers high-conviction insights in plain English—directly connected to a 1-click Groww trading sheet.

---

## 🌟 Key Engineering Features & Highlights

1. **⏱️ Automatic Lifecycle Checkpointing (Zero-Effort Persistence):**
   - Automatically captures baseline prices and timestamps whenever the user closes the tab or switches windows via `visibilitychange`, `beforeunload`, and `pagehide` browser events.
   - On return, instantly displays the exact delta and volume anomalies that occurred during the user's absence (e.g. `Just now`, `5m ago`, `1h 15m ago`).

2. **🎙️ AI Voice Intelligence (Text-to-Speech & Speech-to-Text):**
   - **`🔊 Listen Briefing`**: Real-time voice readout of the *"Since You Last Checked"* market delta and volume spikes via Web Speech API.
   - **`🎙️ Voice Search`**: Hands-free search allowing traders to speak ticker names (e.g. *"Zomato"*, *"Tata Motors"*) to filter and select stocks.
   - **`🔊 Voice Analysis`**: Audio readout of key support, target, and stop-loss levels on stock detail cards.

3. **📜 Real-Time System & Order Activity Logs:**
   - In-app live audit trail tracking orders (`FILLED`), anomaly triggers, price streaming ticks, and user authentication events.

4. **🔴 Solid Red Sell & Emerald Buy Order Execution:**
   - High-contrast 1-click order simulation modal supporting Intraday MIS and Delivery CNC modes with real-time portfolio margin calculation.

5. **🏛️ 202+ NSE Master Directory & Edge Case Testing:**
   - Master catalog of 202+ NSE listed companies with dynamic custom ticker addition.
   - Built-in edge cases for evaluators:
     - **`PENNYTEST`**: Microcap with turnover $< ₹2\text{ Cr}$ rendering amber `⚠️ Low Liquidity` warning.
     - **`BROKENSTOCK`**: Simulated exchange network feed outage rendering isolated `⚠️ Exchange Feed Offline` without crashing the UI.

---

## 🏗️ Architecture & End-to-End Persistence

```
┌─────────────────────────────────────────────────────────────┐
│               Frontend: React (Vite, SPA)                   │
│  - Categorized Sectors  - Live/Closed Hours Precision Badge │
│  - 1-Click Groww Order Sheet  - Cross-Device Sync Modal     │
│  - AI Voice Module (TTS/STT)  - System Activity Logs Modal  │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API (JSON)
┌──────────────────────────────▼──────────────────────────────┐
│             Backend: FastAPI (Python 3.12)                  │
│  - Market Anomaly Scoring Engine (Z-score, Alpha, Volume)   │
│  - In-Memory 30s TTL Multi-Ticker Concurrent Price Cache    │
│  - Liquidity Calibration Filter (Rupee Turnover < ₹2 Cr)    │
│  - IST Market-Hours Clock & Graceful Error Formatter        │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQLAlchemy 2.0 (IPv4 Pooler)
┌──────────────────────────────▼──────────────────────────────┐
│             Database: Supabase PostgreSQL (Cloud)           │
│  - `watchlists` (user_id, name, created_at) [Indexed]       │
│  - `watchlist_items` (watchlist_id, symbol) [Indexed]       │
│  - `sessions` (watchlist_id, opened_at) [Indexed]           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Definition of "Meaningful Change" & Mathematical Defense

### Why Raw % Gain is Flawed
A $+2\%$ gain on a low-beta defensive stock like **ITC** ($\sigma = 0.75\%$) represents a massive $+2.67\sigma$ statistical breakout. The same $+2\%$ on a high-beta stock ($\sigma = 3.0\%$) is merely random daily noise. Sorting purely by raw percentage misleads retail investors.

### The 3-Factor Quantitative Scoring Formula
Every stock's conviction score (0 to 100) is calculated via:

$$\text{Priority Score} = 40 \times \min\left(1.0, \frac{|\Delta P|}{\sigma_{20}}\right) + 35 \times \min\left(1.0, \frac{V_{\text{today}}}{2 \cdot \bar{V}_{20}}\right) + 25 \times \min\left(1.0, \frac{|\text{Alpha}_{\text{NIFTY}}|}{1.5\%}\right)$$

1. **Price Move vs Historical Normal (40% Weight):** Normalizes price change by the stock's 20-day historical standard deviation ($\sigma$).
2. **Trading Volume Surge (35% Weight):** Measures whether volume exceeds $1.5\times - 2.5\times$ its 20-day moving average, signaling institutional accumulation or distribution.
3. **Decoupled Benchmark Alpha (25% Weight):** Measures return relative to NIFTY 50 ($\text{Alpha} = R_{\text{stock}} - R_{\text{NIFTY}}$). A stock rallying while the market drops exhibits true idiosyncratic momentum.

---

## 🛡️ Reliability & Edge-Case Handling

| Scenario / Edge Case | Handled Behavior | User-Facing Result |
| :--- | :--- | :--- |
| **Low-Liquidity / Microcaps (`PENNYTEST`)** | Evaluates **Rupee Turnover** ($\text{Turnover} = \text{Price} \times \text{Volume} < ₹2\text{ Cr}$). | Renders amber `⚠️ Low Liquidity (< ₹2 Cr Turnover)` warning badge. |
| **Exchange Feed Outage (`BROKENSTOCK`)** | Try/catch isolation with structured fallback. | Renders isolated red `⚠️ Exchange Feed Offline` warning card without crashing the UI or blocking other stocks. |
| **Market Closed Hours** | Time-aware IST clock (9:15 AM - 3:30 PM). | Shows `🔵 Closing price · 3:30 PM` instead of falsely claiming "Live" data. |
| **Connection Stability** | Supabase IPv4 transaction pooler with `pool_pre_ping=True`. | Eliminates dropped connections and IPv6 DNS timeouts. |

---

## ⚡ Concrete Scaling Decisions & Technical Trade-offs

1. **In-Memory 30s TTL Multi-Ticker Price Caching:**
   - *Trade-off:* Calling external exchange APIs on every single user request risks rate-limiting and high network latency.
   - *Implementation:* FastAPI in-memory TTL cache serves repeated requests for identical stocks across concurrent sessions directly from memory, avoiding redundant external round-trips while capping price staleness at 30 seconds.
2. **Supabase PostgreSQL Compound B-Tree Indexing:**
   - *Trade-off:* Without indexes, querying items and sessions by foreign key requires full sequential table scans as tables grow.
   - *Implementation:* Added indexed keys on `idx_watchlists_user_id`, `idx_watchlist_items_wid`, and `idx_sessions_wid` so watchlist retrieval scales efficiently with indexed lookups.
3. **Client-Side Memoized Filtering & Sorting:**
   - *Trade-off:* Server-side sorting on every keystroke causes unnecessary network overhead and UI stutter.
   - *Implementation:* Sector filtering, search matching, and plain-English sort toggles are computed locally in React, keeping interactions instant and responsive.

---

## 🛡️ Alignment with Groww's 5 Core Values

1. **Customer First:** Plain-English insights and 1-click voice audio catch-up replace confusing raw data tables.
2. **Reliability, Always:** Zero silent crashes; broken feeds and illiquid stocks are gracefully isolated with warnings.
3. **Being Transparent:** Auditable mathematical formula attribution (40% P · 35% V · 25% α) and clear checkpoint numbers.
4. **Keeping It Simple:** High-contrast 2-column layout, consolidated "+ Add Stock" modal, tactile buttons, and no confusing sub-menus.
5. **Thinking Long-Term:** Scalable PostgreSQL schema with B-Tree indexes, modular FastAPI endpoints, and extensible React architecture.

---

## 🛠️ Local Setup Instructions

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
*Health Check:* `http://127.0.0.1:8000/health`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend URL:* `http://localhost:5173`
