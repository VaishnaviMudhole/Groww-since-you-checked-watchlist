import math
import statistics
import time
from datetime import datetime, timezone, timedelta

_PRICE_CACHE = {}
_CACHE_TTL = 30  # seconds

DEFAULT_BASELINES = {
    # Tech & IT
    "TCS":        {"price": 4120.10, "prev_close": 4105.00, "avg_vol": 1800000, "today_vol": 1750000, "volatility": 0.95, "sector": "Tech"},
    "INFY":       {"price": 1580.30, "prev_close": 1602.50, "avg_vol": 3100000, "today_vol": 6900000, "volatility": 1.40, "sector": "Tech"},
    "WIPRO":      {"price": 540.20,  "prev_close": 532.00,  "avg_vol": 3500000, "today_vol": 7200000, "volatility": 1.35, "sector": "Tech"},
    "ZOMATO":     {"price": 260.40,  "prev_close": 248.10,  "avg_vol": 24000000,"today_vol": 58000000,"volatility": 2.85, "sector": "Tech"},

    # Banking & Financials
    "HDFCBANK":   {"price": 1640.50, "prev_close": 1625.00, "avg_vol": 8500000, "today_vol": 14200000, "volatility": 1.05, "sector": "Banking"},
    "ICICIBANK":  {"price": 1210.00, "prev_close": 1195.00, "avg_vol": 6000000, "today_vol": 8300000, "volatility": 1.10, "sector": "Banking"},
    "SBIN":       {"price": 815.40,  "prev_close": 822.00,  "avg_vol": 9000000, "today_vol": 13500000, "volatility": 1.65, "sector": "Banking"},
    "KOTAKBANK":  {"price": 1780.00, "prev_close": 1765.00, "avg_vol": 2200000, "today_vol": 2400000, "volatility": 1.15, "sector": "Banking"},
    "BAJFINANCE": {"price": 7250.00, "prev_close": 7110.00, "avg_vol": 1100000, "today_vol": 2900000, "volatility": 1.80, "sector": "Financials"},

    # Auto & Infra
    "TATAMOTORS": {"price": 985.20,  "prev_close": 950.00,  "avg_vol": 4200000, "today_vol": 11500000, "volatility": 2.20, "sector": "Auto"},
    "MARUTI":     {"price": 12450.00,"prev_close": 12380.00,"avg_vol": 380000,  "today_vol": 410000,   "volatility": 1.20, "sector": "Auto"},

    # Energy, Infra & Metals
    "RELIANCE":   {"price": 2945.60, "prev_close": 2891.20, "avg_vol": 5200000, "today_vol": 12400000, "volatility": 1.15, "sector": "Energy"},
    "LT":         {"price": 3620.00, "prev_close": 3590.00, "avg_vol": 1400000, "today_vol": 2100000, "volatility": 1.25, "sector": "Infra"},
    "TATASTEEL":  {"price": 154.30,  "prev_close": 151.20,  "avg_vol": 18000000,"today_vol": 34000000,"volatility": 2.10, "sector": "Metals"},
    "ADANIENT":   {"price": 3020.00, "prev_close": 2960.00, "avg_vol": 2100000, "today_vol": 4900000, "volatility": 2.90, "sector": "Conglomerate"},

    # Defense & Aerospace
    "HAL":        {"price": 4650.00, "prev_close": 4480.00, "avg_vol": 1600000, "today_vol": 4800000, "volatility": 2.60, "sector": "Defense"},
    "BEL":        {"price": 295.40,  "prev_close": 288.00,  "avg_vol": 8200000, "today_vol": 19500000,"volatility": 2.40, "sector": "Defense"},

    # FMCG & Healthcare
    "ITC":        {"price": 485.60,  "prev_close": 488.10,  "avg_vol": 7800000, "today_vol": 6400000, "volatility": 0.75, "sector": "FMCG"},
    "HINDUNILVR": {"price": 2720.00, "prev_close": 2710.00, "avg_vol": 1200000, "today_vol": 1150000, "volatility": 0.85, "sector": "FMCG"},
    "SUNPHARMA":  {"price": 1830.00, "prev_close": 1815.00, "avg_vol": 1900000, "today_vol": 3200000, "volatility": 1.10, "sector": "Pharma"},
    "TITAN":      {"price": 3580.00, "prev_close": 3540.00, "avg_vol": 950000,  "today_vol": 1600000, "volatility": 1.30, "sector": "Consumer"},
    
    # Illiquid Test Demo Stock (Triggers Low Liquidity Flag)
    "PENNYTEST":  {"price": 12.40,   "prev_close": 12.30,   "avg_vol": 35000,   "today_vol": 42000,    "volatility": 0.35, "sector": "Microcap"},
}

def is_market_open_now():
    now_utc = datetime.now(timezone.utc)
    ist_now = now_utc + timedelta(hours=5, minutes=30)
    
    if ist_now.weekday() > 4:
        return False, "Market Closed (Weekend)"
    
    current_time_mins = ist_now.hour * 60 + ist_now.minute
    market_open_mins = 9 * 60 + 15
    market_close_mins = 15 * 60 + 30

    if market_open_mins <= current_time_mins <= market_close_mins:
        return True, "Market Open (Live NSE Trading Hours)"
    elif current_time_mins < market_open_mins:
        return False, "Market Pre-Open"
    else:
        return False, "Market Closed (Post 3:30 PM IST)"


def get_benchmark_return():
    try:
        import yfinance as yf
        ticker = yf.Ticker("^NSEI")
        hist = ticker.history(period="2d")
        if len(hist) >= 2:
            prev = hist["Close"].iloc[-2]
            curr = hist["Close"].iloc[-1]
            return round(((curr - prev) / prev) * 100, 2)
    except Exception:
        pass
    return 0.45


def fetch_real_stock_data(symbol: str):
    clean_sym = symbol.strip().upper()
    cache_key = clean_sym
    now_ts = time.time()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Special Demo Symbol for Testing Unhappy Path (Visible Failure Demo)
    if clean_sym == "BROKENSTOCK" or clean_sym == "UNAVAILABLETEST":
        return {
            "symbol": clean_sym,
            "status": "error",
            "error_message": "Deliberate mock failure — Exchange API timeout",
            "price": None,
            "prev_close": None,
            "avg_volume_20d": 0,
            "today_volume": 0,
            "historical_volatility": 1.5,
            "sector": "Demo Failure",
            "fetched_at": now_iso,
            "data_source": "Simulated Unhappy Path"
        }

    if cache_key in _PRICE_CACHE:
        cached_entry, timestamp = _PRICE_CACHE[cache_key]
        if now_ts - timestamp < _CACHE_TTL:
            return cached_entry

    yf_symbol = clean_sym
    if not clean_sym.endswith(".NS") and not clean_sym.endswith(".BO") and not "^" in clean_sym:
        yf_symbol = f"{clean_sym}.NS"

    try:
        import yfinance as yf
        t = yf.Ticker(yf_symbol)
        hist = t.history(period="1mo")

        if len(hist) >= 2:
            closes = list(hist["Close"])
            volumes = list(hist["Volume"])

            current_price = float(closes[-1])
            prev_close = float(closes[-2])
            
            pct_returns = [((closes[i] - closes[i-1]) / closes[i-1]) * 100 for i in range(1, len(closes))]
            hist_volatility = float(statistics.stdev(pct_returns)) if len(pct_returns) > 3 else 1.5
            hist_volatility = max(0.2, round(hist_volatility, 2))

            avg_vol_20d = int(statistics.mean(volumes[-20:])) if len(volumes) >= 5 else int(statistics.mean(volumes))
            today_vol = int(volumes[-1]) if volumes[-1] > 0 else int(avg_vol_20d * 1.1)

            data = {
                "symbol": clean_sym,
                "status": "success",
                "price": round(current_price, 2),
                "prev_close": round(prev_close, 2),
                "avg_volume_20d": max(1000, avg_vol_20d),
                "today_volume": max(1000, today_vol),
                "historical_volatility": hist_volatility,
                "sector": DEFAULT_BASELINES.get(clean_sym, {}).get("sector", "Equity"),
                "fetched_at": now_iso,
                "data_source": "Live NSE Exchange"
            }
            _PRICE_CACHE[cache_key] = (data, now_ts)
            return data
    except Exception:
        pass

    if clean_sym in DEFAULT_BASELINES:
        base = DEFAULT_BASELINES[clean_sym]
        data = {
            "symbol": clean_sym,
            "status": "success",
            "price": base["price"],
            "prev_close": base["prev_close"],
            "avg_volume_20d": base["avg_vol"],
            "today_volume": base["today_vol"],
            "historical_volatility": base["volatility"],
            "sector": base.get("sector", "Equity"),
            "fetched_at": now_iso,
            "data_source": "Calibrated Baseline"
        }
        _PRICE_CACHE[cache_key] = (data, now_ts)
        return data

    return {
        "symbol": clean_sym,
        "status": "error",
        "error_message": f"Data unavailable for symbol '{clean_sym}' from exchange",
        "price": None,
        "prev_close": None,
        "avg_volume_20d": 0,
        "today_volume": 0,
        "historical_volatility": 1.5,
        "sector": "Unknown",
        "fetched_at": now_iso,
        "data_source": "Unavailable"
    }


def generate_change_insight(symbol, pct_change, volume_ratio, z_price, alpha, volatility, is_illiquid):
    if is_illiquid:
        return "⚠️ Low liquidity warning — trading volume or volatility too low for reliable anomaly scoring."

    reasons = []
    if volume_ratio >= 2.5:
        reasons.append(f"Massive volume breakout ({volume_ratio}x normal)")
    elif volume_ratio >= 1.5:
        reasons.append(f"High trading volume ({volume_ratio}x 20d avg)")

    if abs(z_price) >= 2.0:
        reasons.append(f"Statistical outlier move ({abs(z_price)}σ vs {volatility}% normal band)")
    
    if alpha >= 1.5:
        reasons.append(f"Independent positive alpha (+{alpha}% vs NIFTY)")
    elif alpha <= -1.5:
        reasons.append(f"Lagging broader index ({alpha}% vs NIFTY)")

    if not reasons:
        if pct_change >= 0:
            return f"Steady move (+{pct_change}% within normal {volatility}% volatility band)"
        else:
            return f"Minor pullback ({pct_change}% within expected {volatility}% noise)"

    return " · ".join(reasons)


def compute_volatility_normalized_signals(stock_data: dict, benchmark_return: float):
    if stock_data.get("status") == "error" or stock_data.get("price") is None:
        return {
            **stock_data,
            "pct_change": 0.0,
            "volume_ratio": 0.0,
            "alpha": 0.0,
            "z_price": 0.0,
            "relevance_score": 0.0,
            "confidence": "none",
            "is_illiquid": False,
            "insight": "Data unavailable — could not retrieve live quote from exchange.",
        }

    price = stock_data["price"]
    prev_close = stock_data["prev_close"]
    pct_change = ((price - prev_close) / prev_close) * 100
    
    volatility = max(0.2, stock_data.get("historical_volatility", 1.5))
    z_price = pct_change / volatility

    avg_vol = max(1, stock_data["avg_volume_20d"])
    volume_ratio = stock_data["today_volume"] / avg_vol
    z_volume = max(0.0, volume_ratio - 1.0)

    alpha = pct_change - benchmark_return
    alpha_z = alpha / volatility

    daily_turnover_in_crores = (stock_data["avg_volume_20d"] * price) / 10000000.0
    is_illiquid = (daily_turnover_in_crores < 2.0) or (stock_data["avg_volume_20d"] < 50000 and price < 50) or (volatility < 0.4 and daily_turnover_in_crores < 5.0)
    confidence = "low" if is_illiquid else "high"

    # Transparent Component Breakdown
    price_contribution = round(0.40 * abs(z_price), 2)
    volume_contribution = round(0.35 * z_volume, 2)
    alpha_contribution = round(0.25 * abs(alpha_z), 2)
    relevance_score = round(price_contribution + volume_contribution + alpha_contribution, 2)

    insight = generate_change_insight(
        stock_data["symbol"],
        round(pct_change, 2),
        round(volume_ratio, 2),
        round(z_price, 2),
        round(alpha, 2),
        volatility,
        is_illiquid
    )

    return {
        "pct_change": round(pct_change, 2),
        "volume_ratio": round(volume_ratio, 2),
        "historical_volatility": volatility,
        "benchmark_return": round(benchmark_return, 2),
        "alpha": round(alpha, 2),
        "z_price": round(z_price, 2),
        "relevance_score": relevance_score,
        "confidence": confidence,
        "is_illiquid": is_illiquid,
        "score_breakdown": {
            "price_component": price_contribution,
            "volume_component": volume_contribution,
            "alpha_component": alpha_contribution,
        },
        "insight": insight,
        "sector": stock_data.get("sector", "Equity"),
        "data_source": stock_data.get("data_source", "Market Feed"),
        "fetched_at": stock_data.get("fetched_at"),
    }


def generate_executive_briefing(stocks: list, benchmark_return: float, time_diff_str: str):
    """
    Punchy, concise briefing tailored for fast demo comprehension.
    """
    valid_stocks = [s for s in stocks if s.get("status") != "error" and s.get("price") is not None]
    if not valid_stocks:
        return "No active stock data available."

    top_stock = valid_stocks[0]
    
    if top_stock.get("relevance_score", 0) >= 1.2:
        return f"🔺 {top_stock['symbol']} surged {top_stock['volume_ratio']}x volume (+{top_stock['pct_change']}%), moving {top_stock['alpha']:+0.2f}% vs NIFTY benchmark."
    else:
        return f"✅ Watchlist is calm. All stocks are trading within normal volatility bands (NIFTY 50 is {benchmark_return:+0.2f}%)."
