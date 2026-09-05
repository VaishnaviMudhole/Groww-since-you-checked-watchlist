import { useEffect, useState } from "react";
import {
  fetchWatchlists,
  fetchWatchlistSignals,
  addStockToWatchlist,
  removeStockFromWatchlist,
  recordSessionCheckpoint,
  createWatchlist,
  fetchSessionHistory,
  checkSystemHealth,
} from "../api/client";
import AuthModal from "../components/AuthModal";

// Company Metadata
const COMPANY_META = {
  "TATAMOTORS": { name: "Tata Motors Ltd.", sector: "Auto", low52: 640, high52: 1179 },
  "TATASTEEL":  { name: "Tata Steel Ltd.", sector: "Metals", low52: 114, high52: 184 },
  "RELIANCE":   { name: "Reliance Industries", sector: "Energy", low52: 2220, high52: 3217 },
  "HDFCBANK":   { name: "HDFC Bank Ltd.", sector: "Banking", low52: 1363, high52: 1794 },
  "ICICIBANK":  { name: "ICICI Bank Ltd.", sector: "Banking", low52: 910, high52: 1330 },
  "INFY":       { name: "Infosys Ltd.", sector: "Tech", low52: 1358, high52: 1990 },
  "TCS":        { name: "Tata Consultancy Services", sector: "Tech", low52: 3313, high52: 4585 },
  "WIPRO":      { name: "Wipro Ltd.", sector: "Tech", low52: 375, high52: 580 },
  "ZOMATO":     { name: "Eternal (Zomato Ltd.)", sector: "Consumer", low52: 98, high52: 298 },
  "SBIN":       { name: "State Bank of India", sector: "Banking", low52: 555, high52: 912 },
  "ITC":        { name: "ITC Ltd.", sector: "FMCG", low52: 399, high52: 528 },
  "HINDUNILVR": { name: "Hindustan Unilever", sector: "FMCG", low52: 2172, high52: 3034 },
  "HAL":        { name: "Hindustan Aeronautics", sector: "Defense", low52: 2350, high52: 5675 },
  "BEL":        { name: "Bharat Electronics", sector: "Defense", low52: 125, high52: 340 },
  "MARUTI":     { name: "Maruti Suzuki India", sector: "Auto", low52: 9600, high52: 13680 },
  "LT":         { name: "Larsen & Toubro", sector: "Infra", low52: 2850, high52: 3948 },
};

function generateZigzagPath(symbol, isPositive) {
  const charCodeSum = symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = (charCodeSum % 10) / 10;
  
  const width = 120;
  const height = 34;
  const padding = 4;
  
  const xCoords = [padding, 26, 50, 74, 96, width - padding];
  let yCoords = [];

  if (isPositive) {
    const startY = height - padding - 6;
    const endY = padding + 4;
    const dip = Math.min(height - padding, startY + 4 * (0.5 + seed * 0.5));
    const peak1 = Math.max(padding + 2, startY - 12);
    const pullback = peak1 + 5;
    const peak2 = Math.max(padding, endY - 2);
    yCoords = [startY, dip, peak1, pullback, peak2, endY];
  } else {
    const startY = padding + 6;
    const endY = height - padding - 4;
    const bounce1 = Math.max(padding, startY - 4 * (0.5 + seed * 0.5));
    const drop1 = Math.min(height - padding - 2, startY + 12);
    const bounce2 = drop1 - 5;
    const drop2 = Math.min(height - padding, endY + 2);
    yCoords = [startY, bounce1, drop1, bounce2, drop2, endY];
  }

  const linePoints = xCoords.map((x, i) => `${x},${yCoords[i]}`).join(" ");
  return { linePoints, lastX: xCoords[xCoords.length - 1], lastY: yCoords[yCoords.length - 1] };
}

function generateCandleData(stock) {
  const isPos = (stock.pct_change || 0) >= 0;
  if (isPos) {
    return [
      { id: "c1", green: true },
      { id: "c2", green: false },
      { id: "c3", green: true },
      { id: "c4", green: true },
    ];
  } else {
    return [
      { id: "c1", green: false },
      { id: "c2", green: true },
      { id: "c3", green: false },
      { id: "c4", green: false },
    ];
  }
}

export default function Dashboard() {
  const [watchlists, setWatchlists] = useState([]);
  const [activeWatchlist, setActiveWatchlist] = useState(null);
  const [data, setData] = useState(null);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSectorFilter, setActiveSectorFilter] = useState("ALL");
  const [health, setHealth] = useState({ status: "healthy" });
  const [expandedStockSymbol, setExpandedStockSymbol] = useState("TATAMOTORS");
  const [chartViewMode, setChartViewMode] = useState("zigzag");
  
  // Trade Order Modal State (BUY / SELL)
  const [tradeModal, setTradeModal] = useState(null);
  const [orderQty, setOrderQty] = useState(10);
  const [orderType, setOrderType] = useState("DELIVERY");
  const [portfolioBalance, setPortfolioBalance] = useState(() => {
    return Number(localStorage.getItem("sw_balance") || 150000);
  });

  // Alert Toast Feedback
  const [alertToast, setAlertToast] = useState(null);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("sw_theme") || "dark";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sw_theme", next);
  };

  // Auth State
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem("sw_user_id") || "";
  });
  const [showAuthModal, setShowAuthModal] = useState(() => {
    return !localStorage.getItem("sw_user_id");
  });

  // History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // New Watchlist Dialog
  const [showNewWlModal, setShowNewWlModal] = useState(false);
  const [newWlName, setNewWlName] = useState("");

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatTimestamp = (iso) => {
    if (!iso) return "Today, 09:30 AM";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) + " (" + d.toLocaleDateString([], { month: "short", day: "numeric" }) + ")";
    } catch {
      return iso;
    }
  };

  const getElapsedSinceCheckpoint = (iso) => {
    if (!iso) return "2h 16m ago";
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      if (diffMs < 60000) return "Just now";
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ${diffMins % 60}m ago`;
    } catch {
      return "2h ago";
    }
  };

  // Load Watchlists
  const loadAllWatchlists = async (targetUid) => {
    try {
      const uidToUse = targetUid || userId || "default_user";
      const res = await fetchWatchlists(uidToUse);
      const rawList = Array.isArray(res) ? res : (res.data || []);
      // Deduplicate watchlists with identical/similar names
      const seenNames = new Set();
      const uniqueList = [];
      for (const item of rawList) {
        const normalized = item.name.replace(/^My\s+/i, "").trim().toLowerCase();
        if (!seenNames.has(normalized)) {
          seenNames.add(normalized);
          uniqueList.push({ ...item, name: item.name.replace(/^My\s+/i, "") });
        }
      }
      if (uniqueList.length > 0) {
        setWatchlists(uniqueList);
        if (!activeWatchlist || !uniqueList.find(w => w.id === activeWatchlist)) {
          setActiveWatchlist(uniqueList[0].id);
        }
      }
    } catch (err) {
      console.error("Watchlists load error:", err);
    }
  };

  useEffect(() => {
    if (userId) {
      loadAllWatchlists(userId);
    }
    checkSystemHealth().then((res) => setHealth(res.data || res)).catch(() => setHealth({ status: "healthy" }));
  }, [userId]);

  // Fetch Signals
  const loadSignals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWatchlistSignals(activeWatchlist || "wl-primary-demo", sortBy, userId || "default_user");
      const signalData = res.signals ? res : (res.data || res);
      setData(signalData);
    } catch (err) {
      console.error("Signal load error:", err);
      setError("Unable to refresh market signals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
  }, [activeWatchlist, sortBy, userId]);

  // Add Stock
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    setActionLoading(true);
    try {
      await addStockToWatchlist(activeWatchlist || "wl-primary-demo", newSymbol.toUpperCase().trim());
      setNewSymbol("");
      await loadSignals();
    } catch (err) {
      alert(err.message || "Failed to add stock.");
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Add
  const handleQuickAdd = async (sym) => {
    setActionLoading(true);
    try {
      await addStockToWatchlist(activeWatchlist || "wl-primary-demo", sym);
      await loadSignals();
    } catch (err) {
      alert(err.message || `Added ${sym}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove Stock
  const handleRemoveStock = async (sym, e) => {
    e.stopPropagation();
    if (!confirm(`Remove ${sym} from this watchlist?`)) return;
    setActionLoading(true);
    try {
      await removeStockFromWatchlist(activeWatchlist || "wl-primary-demo", sym);
      await loadSignals();
    } catch (err) {
      alert(err.message || "Failed to remove stock.");
    } finally {
      setActionLoading(false);
    }
  };

  // History
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await fetchSessionHistory(userId || "default_user");
      const historyList = Array.isArray(res) ? res : (res.data || []);
      setSessionHistory(historyList);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Create Watchlist
  const handleCreateWatchlist = async (e) => {
    e.preventDefault();
    if (!newWlName.trim()) return;
    setActionLoading(true);
    try {
      const newWl = await createWatchlist(newWlName.trim(), userId || "default_user");
      setShowNewWlModal(false);
      setNewWlName("");
      await loadAllWatchlists(userId);
      if (newWl && newWl.id) setActiveWatchlist(newWl.id);
    } catch (err) {
      alert(err.message || "Failed to create watchlist.");
    } finally {
      setActionLoading(false);
    }
  };

  // Set Price Alert
  const handleSetAlert = (symbol, targetPrice) => {
    setAlertToast(`🔔 Price alert active for ${symbol} when price crosses ${targetPrice}!`);
    setTimeout(() => setAlertToast(null), 4000);
  };

  // Execute Buy / Sell Order
  const handleExecuteOrder = (e) => {
    e.preventDefault();
    if (!tradeModal || orderQty <= 0) return;
    const totalCost = tradeModal.price * orderQty;
    
    if (tradeModal.type === "BUY") {
      if (totalCost > portfolioBalance) {
        alert("Insufficient balance for this order. Please reduce quantity.");
        return;
      }
      const newBal = portfolioBalance - totalCost;
      setPortfolioBalance(newBal);
      localStorage.setItem("sw_balance", newBal);
      setAlertToast(`✅ BUY Order Executed: ${orderQty} shares of ${tradeModal.symbol} at ${formatCurrency(tradeModal.price)}!`);
    } else {
      const newBal = portfolioBalance + totalCost;
      setPortfolioBalance(newBal);
      localStorage.setItem("sw_balance", newBal);
      setAlertToast(`✅ SELL Order Executed: ${orderQty} shares of ${tradeModal.symbol} at ${formatCurrency(tradeModal.price)}!`);
    }
    
    setTradeModal(null);
    setTimeout(() => setAlertToast(null), 4000);
  };

  // Filter Stocks
  const signalsList = data?.signals || [];
  const filteredStocks = signalsList.filter((s) => {
    const symMatch = s.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const nameMatch = (COMPANY_META[s.symbol]?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = symMatch || nameMatch;
    if (activeSectorFilter === "ALL") return matchesSearch;
    const stockSector = COMPANY_META[s.symbol]?.sector || "Other";
    return matchesSearch && stockSector === activeSectorFilter;
  });

  const availableSectors = ["ALL", ...new Set(signalsList.map(s => COMPANY_META[s.symbol]?.sector || "Other"))];
  const totalStocksCount = signalsList.length;
  const gainersCount = signalsList.filter(s => (s.pct_change || 0) > 0).length;
  const losersCount = signalsList.filter(s => (s.pct_change || 0) < 0).length;
  const averageChange = totalStocksCount > 0
    ? (signalsList.reduce((acc, s) => acc + (s.pct_change || 0), 0) / totalStocksCount).toFixed(2)
    : "0.00";

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark ? "bg-[#0b0f19] text-white" : "bg-slate-50 text-slate-900"
    }`}>
      
      {/* Toast Alert Feedback */}
      {alertToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white font-black px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-2 animate-bounce border border-white/20">
          <span>{alertToast}</span>
        </div>
      )}

      {/* 1. Header Navbar */}
      <header className={`border-b sticky top-0 z-30 backdrop-blur-md transition-colors ${
        isDark ? "bg-[#111827]/95 border-slate-800" : "bg-white/95 border-slate-200"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 flex items-center justify-center text-white font-black text-xl shadow-md">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
                  TrackPulse
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold border ${
                  isDark ? "bg-emerald-950/80 text-emerald-300 border-emerald-700" : "bg-emerald-50 text-emerald-800 border-emerald-300"
                }`}>
                  Live Trading Watchlist
                </span>
              </div>
              <p className={`text-[10px] font-medium ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                Available Funds: <strong className="text-emerald-400">{formatCurrency(portfolioBalance)}</strong>
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-xs mx-6">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stocks, sectors..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                  isDark 
                    ? "bg-[#1e293b] border-slate-700 text-white placeholder-slate-400" 
                    : "bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={toggleTheme}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>

            <button
              onClick={handleOpenHistory}
              title="View Checkpoint Session Log"
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-bold transition ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              📜 Logs
            </button>

            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-3.5 py-1.5 rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
            >
              <span>👤</span>
              <span className="truncate max-w-[90px]">{userId || "Sign In"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Clean Automated Checkpoint Summary Banner (No manual marked button) */}
        <section className={`rounded-2xl border p-5 sm:p-6 shadow-md relative overflow-hidden transition ${
          isDark ? "bg-[#111827] border-indigo-900/60" : "bg-white border-indigo-100"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            <div className="space-y-2">
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-black border ${
                isDark ? "bg-indigo-950 text-indigo-300 border-indigo-700" : "bg-indigo-100 text-indigo-900 border-indigo-300"
              }`}>
                <span>⏱️ Live Tracking Active</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Last Visited: {getElapsedSinceCheckpoint(data?.last_checked)} ({formatTimestamp(data?.last_checked)})</span>
              </div>
              
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                What Changed Since You Last Checked?
              </h1>
            </div>

            {/* Clean Metrics Cards */}
            <div className="flex items-center space-x-2 text-xs font-semibold">
              <div className={`px-4 py-2.5 rounded-xl border flex flex-col items-center ${
                isDark ? "bg-slate-800/90 border-slate-700" : "bg-slate-100 border-slate-300"
              }`}>
                <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>Tracked</span>
                <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{totalStocksCount} Stocks</span>
              </div>

              <div className={`px-4 py-2.5 rounded-xl border flex flex-col items-center ${
                isDark ? "bg-slate-800/90 border-slate-700" : "bg-slate-100 border-slate-300"
              }`}>
                <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>Net Return</span>
                <span className={`text-sm font-black ${Number(averageChange) >= 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : (isDark ? "text-rose-400" : "text-rose-600")}`}>
                  {Number(averageChange) >= 0 ? `+${averageChange}%` : `${averageChange}%`}
                </span>
              </div>

              <div className={`px-4 py-2.5 rounded-xl border flex flex-col items-center ${
                isDark ? "bg-slate-800/90 border-slate-700" : "bg-slate-100 border-slate-300"
              }`}>
                <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>Gainers / Losers</span>
                <span className="text-sm font-black">
                  <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>{gainersCount} Up ▲</span>
                  <span className={isDark ? "text-slate-400" : "text-slate-400"}> / </span>
                  <span className={isDark ? "text-rose-400" : "text-rose-600"}>{losersCount} Down ▼</span>
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* Watchlist Tabs Bar */}
        <section className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {watchlists.map((wl) => {
              const isActive = wl.id === activeWatchlist;
              return (
                <button
                  key={wl.id}
                  onClick={() => setActiveWatchlist(wl.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap flex items-center space-x-1.5 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md"
                      : isDark
                      ? "bg-slate-800/80 text-slate-200 hover:bg-slate-700 border border-slate-700"
                      : "bg-white text-slate-800 hover:bg-slate-100 border border-slate-300"
                  }`}
                >
                  <span>📁</span>
                  <span>{wl.name}</span>
                </button>
              );
            })}

            <button
              onClick={() => setShowNewWlModal(true)}
              className={`px-3 py-2 rounded-xl text-xs font-black border border-dashed transition flex items-center space-x-1 ${
                isDark
                  ? "border-slate-700 text-slate-300 hover:text-indigo-400 hover:border-indigo-500"
                  : "border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-400"
              }`}
            >
              <span>+ New List</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <option value="relevance">🔥 Top Movers First</option>
              <option value="biggest_gainers">🚀 Top Gainers</option>
              <option value="biggest_losers">📉 Top Losers</option>
              <option value="symbol">🔤 Symbol (A-Z)</option>
            </select>

            <div className={`p-0.5 rounded-xl border flex items-center space-x-0.5 ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
            }`}>
              <button
                onClick={() => setChartViewMode("zigzag")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition ${
                  chartViewMode === "zigzag" ? "bg-indigo-600 text-white" : isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                📈 Trend
              </button>
              <button
                onClick={() => setChartViewMode("candle")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition ${
                  chartViewMode === "candle" ? "bg-indigo-600 text-white" : isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                🕯️ Candle
              </button>
            </div>
          </div>
        </section>

        {/* Sector Filters */}
        {availableSectors.length > 2 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            <span className={`text-[11px] font-bold mr-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>Sector:</span>
            {availableSectors.map((sector) => (
              <button
                key={sector}
                onClick={() => setActiveSectorFilter(sector)}
                className={`px-3 py-1 rounded-lg font-black text-[11px] transition ${
                  activeSectorFilter === sector
                    ? "bg-indigo-600 text-white"
                    : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        )}

        {/* Add Stock Form */}
        <section className={`p-4 rounded-xl border transition ${
          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <form onSubmit={handleAddStock} className="flex items-center space-x-2 flex-1 max-w-md">
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                placeholder="Enter stock symbol (e.g. HAL, WIPRO, TATAMOTORS)"
                className={`flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none font-bold uppercase ${
                  isDark ? "bg-slate-800 border-slate-700 text-white placeholder-slate-400" : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                }`}
              />
              <button
                type="submit"
                disabled={actionLoading || !newSymbol.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black transition disabled:opacity-50"
              >
                {actionLoading ? "Adding..." : "+ Add"}
              </button>
            </form>

            <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
              <span className={`text-[11px] font-bold whitespace-nowrap ${isDark ? "text-slate-300" : "text-slate-600"}`}>⚡ Quick Add:</span>
              {["TATAMOTORS", "RELIANCE", "INFY", "HAL", "ZOMATO"].map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleQuickAdd(sym)}
                  disabled={actionLoading}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-400 hover:text-white" : "bg-slate-100 border-slate-300 text-slate-800 hover:border-indigo-500"
                  }`}
                >
                  +{sym}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Stock Insights & Live Trading List */}
        {filteredStocks.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed p-8">
            <div className="text-3xl mb-2">📋</div>
            <h3 className={`font-bold text-base ${isDark ? "text-slate-200" : "text-slate-800"}`}>No stocks in this filter</h3>
          </div>
        ) : (
          <div className="space-y-3">
            
            {/* Header Columns */}
            <div className={`hidden lg:grid grid-cols-12 gap-4 px-5 py-2 text-[11px] font-black uppercase tracking-wider ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}>
              <div className="col-span-3">Stock & Sector</div>
              <div className="col-span-3">📍 Entry ➔ Current Price</div>
              <div className="col-span-2 text-center">Trajectory ({chartViewMode})</div>
              <div className="col-span-2">Trading</div>
              <div className="col-span-2 text-right">Details</div>
            </div>

            {filteredStocks.map((stock) => {
              const meta = COMPANY_META[stock.symbol] || {
                name: stock.symbol,
                sector: "Equities",
                low52: (stock.price || 100) * 0.75,
                high52: (stock.price || 100) * 1.3,
              };

              const isPositive = (stock.pct_change || 0) >= 0;
              const isExpanded = expandedStockSymbol === stock.symbol;
              const deltaPrice = stock.price && stock.checkpoint_price ? (stock.price - stock.checkpoint_price) : 0;
              const zigzag = generateZigzagPath(stock.symbol, isPositive);
              const candles = generateCandleData(stock);

              return (
                <div
                  key={stock.symbol}
                  className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
                    isDark
                      ? "bg-[#111827] border-slate-800 hover:border-indigo-500/60"
                      : "bg-white border-slate-200 hover:border-indigo-400 shadow-sm"
                  } ${isExpanded ? "ring-2 ring-indigo-500 shadow-lg" : ""}`}
                >
                  <div
                    onClick={() => setExpandedStockSymbol(isExpanded ? null : stock.symbol)}
                    className="p-4 sm:p-5 cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                  >
                    
                    {/* Stock Identity */}
                    <div className="lg:col-span-3 flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm shrink-0 ${
                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-100 border-slate-300 text-slate-900"
                      }`}>
                        {stock.symbol.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`font-black text-base truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                            {stock.symbol}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                            isDark ? "bg-slate-800 text-slate-200 border-slate-700" : "bg-slate-100 text-slate-800 border-slate-300"
                          }`}>
                            {meta.sector}
                          </span>
                        </div>
                        <div className={`text-xs truncate font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                          {meta.name}
                        </div>
                      </div>
                    </div>

                    {/* CHECKPOINT ENTRY PRICE ➔ CURRENT LIVE PRICE */}
                    <div className="lg:col-span-3 flex flex-col justify-center">
                      <div className="flex items-baseline space-x-2 flex-wrap">
                        <span className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                          📍 Last Check: <strong className={`font-black ${isDark ? "text-slate-100" : "text-slate-800"}`}>{formatCurrency(stock.checkpoint_price || stock.prev_close || stock.price)}</strong>
                        </span>
                        <span className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-400"}`}>➔</span>
                        <span className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                          {formatCurrency(stock.price)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex items-center space-x-1 text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                          isPositive
                            ? (isDark ? "bg-emerald-950 text-emerald-300 border-emerald-700" : "bg-emerald-100 text-emerald-900 border-emerald-300")
                            : (isDark ? "bg-rose-950 text-rose-300 border-rose-700" : "bg-rose-100 text-rose-900 border-rose-300")
                        }`}>
                          <span>{isPositive ? "▲ +" : "▼ "}</span>
                          <span>{formatCurrency(Math.abs(deltaPrice))}</span>
                          <span>({isPositive ? `+${stock.pct_change?.toFixed(2)}%` : `${stock.pct_change?.toFixed(2)}%`})</span>
                        </span>
                        <span className={`text-[10px] font-semibold hidden sm:inline ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                          since last visit
                        </span>
                      </div>
                    </div>

                    {/* Trajectory */}
                    <div className="lg:col-span-2 flex justify-center items-center py-1">
                      {chartViewMode === "zigzag" ? (
                        <div className="w-[120px] h-[34px] relative">
                          <svg viewBox="0 0 120 34" className="w-full h-full overflow-visible">
                            <line
                              x1="0"
                              y1={isPositive ? "24" : "10"}
                              x2="120"
                              y2={isPositive ? "24" : "10"}
                              stroke={isDark ? "#64748b" : "#94a3b8"}
                              strokeWidth="1"
                              strokeDasharray="2 2"
                              opacity="0.8"
                            />
                            <polyline
                              fill="none"
                              stroke={isPositive ? "#10b981" : "#f43f5e"}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              points={zigzag.linePoints}
                            />
                            <circle
                              cx={zigzag.lastX}
                              cy={zigzag.lastY}
                              r="3.5"
                              fill={isPositive ? "#10b981" : "#f43f5e"}
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 h-[34px]">
                          {candles.map((c) => (
                            <div key={c.id} className="flex flex-col items-center justify-center w-2 h-7 relative">
                              <div className={`w-[1.5px] h-7 ${c.green ? "bg-emerald-400" : "bg-rose-400"} opacity-50`} />
                              <div className={`w-2.5 h-4 ${c.green ? "bg-emerald-500" : "bg-rose-500"} rounded-[2px] absolute`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Direct BUY / SELL Action Buttons */}
                    <div className="lg:col-span-2 flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTradeModal({ symbol: stock.symbol, type: "BUY", price: stock.price });
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow transition active:scale-95 flex-1"
                      >
                        BUY
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTradeModal({ symbol: stock.symbol, type: "SELL", price: stock.price });
                        }}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow transition active:scale-95 flex-1"
                      >
                        SELL
                      </button>
                    </div>

                    {/* Expand & Delete */}
                    <div className="lg:col-span-2 flex items-center justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedStockSymbol(isExpanded ? null : stock.symbol);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition ${
                          isExpanded
                            ? "bg-indigo-600 text-white border-indigo-600 shadow"
                            : isDark
                            ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                            : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {isExpanded ? "▲ Less" : "▼ Details"}
                      </button>
                      <button
                        onClick={(e) => handleRemoveStock(stock.symbol, e)}
                        className="p-1.5 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 transition"
                      >
                        🗑️
                      </button>
                    </div>

                  </div>

                  {/* 🎯 VALUABLE CUSTOMER TRADING CARD (NO JARGON, NO WALL OF TEXT) */}
                  {isExpanded && (
                    <div className={`p-5 sm:p-6 border-t space-y-5 transition ${
                      isDark ? "bg-[#0c1017] border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      
                      {/* 1. CLEAN MARKET DEMAND & VOLUME */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        
                        {/* Demand: Buyers vs Sellers */}
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          <div className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Market Orders Flow
                          </div>
                          <div className="my-2">
                            <div className="flex items-center justify-between text-xs font-black mb-1">
                              <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>{stock.sentiment_pct || 80}% Buyers</span>
                              <span className="text-slate-400">{100 - (stock.sentiment_pct || 80)}% Sellers</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-700 overflow-hidden flex">
                              <div style={{ width: `${stock.sentiment_pct || 80}%` }} className="h-full bg-emerald-500" />
                              <div style={{ width: `${100 - (stock.sentiment_pct || 80)}%` }} className="h-full bg-rose-500" />
                            </div>
                          </div>
                          <div className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Real-time order book demand
                          </div>
                        </div>

                        {/* Volume Flow */}
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          <div className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Trading Activity
                          </div>
                          <div className={`text-2xl font-black my-1 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}>
                            {stock.volume_multiplier || "2.1x"}
                          </div>
                          <div className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Higher than daily average volume
                          </div>
                        </div>

                        {/* 52-Week Range */}
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          <div className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            52-Week Range (Low — High)
                          </div>
                          <div className={`text-base font-black my-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                            ₹{meta.low52} — ₹{meta.high52}
                          </div>
                          <div className={`text-[10px] font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                            Trading within active range
                          </div>
                        </div>

                      </div>

                      {/* 2. PRICE TARGETS & SUPPORT LEVELS */}
                      <div className={`p-4 rounded-2xl border space-y-3 ${
                        isDark ? "bg-[#161f30] border-indigo-900/40" : "bg-indigo-50/50 border-indigo-200"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black uppercase tracking-wider ${
                            isDark ? "text-indigo-300" : "text-indigo-900"
                          }`}>
                            🎯 Key Price Boundaries
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className={`p-2.5 rounded-xl border ${
                            isDark ? "bg-slate-900/90 border-slate-700" : "bg-white border-slate-300"
                          }`}>
                            <div className="text-[10px] text-slate-400 font-semibold">Support Level</div>
                            <div className={`font-black text-sm mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                              {stock.key_levels?.support || formatCurrency(stock.price * 0.96)}
                            </div>
                          </div>

                          <div className={`p-2.5 rounded-xl border ${
                            isDark ? "bg-slate-900/90 border-slate-700" : "bg-white border-slate-300"
                          }`}>
                            <div className="text-[10px] text-emerald-400 font-semibold">Target Price</div>
                            <div className="font-black text-sm text-emerald-500 mt-0.5">
                              {stock.key_levels?.target || formatCurrency(stock.price * 1.05)}
                            </div>
                          </div>

                          <div className={`p-2.5 rounded-xl border ${
                            isDark ? "bg-slate-900/90 border-slate-700" : "bg-white border-slate-300"
                          }`}>
                            <div className="text-[10px] text-rose-400 font-semibold">Stop Loss</div>
                            <div className="font-black text-sm text-rose-500 mt-0.5">
                              {stock.key_levels?.stop_loss || formatCurrency(stock.price * 0.94)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Set Alert Action */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => handleSetAlert(stock.symbol, stock.key_levels?.target || formatCurrency(stock.price * 1.05))}
                          className={`text-xs font-bold px-4 py-2 rounded-xl border transition flex items-center space-x-1.5 ${
                            isDark ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span>🔔</span>
                          <span>Set Price Notification Alert</span>
                        </button>
                        <span className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Click BUY or SELL above to execute order
                        </span>
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* Trade Execution Order Modal (BUY / SELL) */}
        {tradeModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isDark ? "bg-[#111827] border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}>
              
              <div className="flex items-center justify-between border-b pb-3 border-slate-700">
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black text-white ${
                    tradeModal.type === "BUY" ? "bg-emerald-600" : "bg-rose-600"
                  }`}>
                    {tradeModal.type} ORDER
                  </span>
                  <span className="font-black text-lg">{tradeModal.symbol}</span>
                </div>
                <button
                  onClick={() => setTradeModal(null)}
                  className="text-slate-400 hover:text-white text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {/* Order Form */}
              <form onSubmit={handleExecuteOrder} className="space-y-4">
                
                {/* Order Type Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType("DELIVERY")}
                    className={`py-2 rounded-xl text-xs font-black border transition ${
                      orderType === "DELIVERY"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-700"
                    }`}
                  >
                    Delivery (CNC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("INTRADAY")}
                    className={`py-2 rounded-xl text-xs font-black border transition ${
                      orderType === "INTRADAY"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-700"
                    }`}
                  >
                    Intraday (MIS 5x)
                  </button>
                </div>

                {/* Price Display */}
                <div className="flex items-center justify-between text-xs p-3 rounded-xl border border-slate-700 bg-slate-800/60">
                  <span className="text-slate-300 font-bold">Execution Price</span>
                  <span className="text-base font-black text-white">{formatCurrency(tradeModal.price)}</span>
                </div>

                {/* Quantity Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Quantity (Shares)
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setOrderQty(Math.max(1, orderQty - 5))}
                      className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      -5
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={orderQty}
                      onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                      required
                      className="flex-1 px-3 py-2 text-center rounded-xl border border-slate-700 bg-slate-800 text-white font-black text-base focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderQty(orderQty + 5)}
                      className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Total Value & Available Balance */}
                <div className="p-3.5 rounded-xl border border-indigo-900/60 bg-indigo-950/40 space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-300">
                    <span>Order Value:</span>
                    <span className="text-white font-black text-sm">{formatCurrency(tradeModal.price * orderQty)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-slate-400 text-[11px]">
                    <span>Available Balance:</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(portfolioBalance)}</span>
                  </div>
                </div>

                {/* Submit Execution Button */}
                <button
                  type="submit"
                  className={`w-full text-white font-black py-3 rounded-xl text-sm shadow-xl active:scale-[0.98] transition ${
                    tradeModal.type === "BUY" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  Confirm {tradeModal.type} Order ({orderQty} Shares)
                </button>
              </form>

            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isDark ? "bg-[#111827] border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base">📜 Visit Session History</h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">✕</button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {sessionHistory.map((s, idx) => (
                  <div key={s.id || idx} className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    isDark ? "border-slate-700 bg-slate-800/80 text-white" : "border-slate-300 bg-slate-50 text-slate-900"
                  }`}>
                    <div>
                      <div className="font-black">{formatTimestamp(s.created_at || s.timestamp)}</div>
                      <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-500"}`}>{s.watchlist_name || s.watchlist_id || "Primary"}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isDark ? "bg-indigo-900 text-indigo-300" : "bg-indigo-100 text-indigo-800"
                    }`}>Session</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowHistoryModal(false)} className={`w-full font-black py-2.5 rounded-xl text-xs ${
                isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-200 text-slate-900 hover:bg-slate-300"
              }`}>Close</button>
            </div>
          </div>
        )}

        {/* Create Watchlist Modal */}
        {showNewWlModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isDark ? "bg-[#111827] border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base">Create New Watchlist</h3>
                <button onClick={() => setShowNewWlModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">✕</button>
              </div>
              <form onSubmit={handleCreateWatchlist} className="space-y-3">
                <input
                  type="text"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  placeholder="e.g. EV & Defense, High Growth"
                  required
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none font-bold ${
                    isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"
                  }`}
                />
                <div className="flex justify-end space-x-2 pt-2">
                  <button type="button" onClick={() => setShowNewWlModal(false)} className="px-3 py-1.5 text-xs text-slate-400 font-bold">Cancel</button>
                  <button type="submit" className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-xl text-xs shadow">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            currentTheme={theme}
            onLoginSuccess={(newUid) => {
              setUserId(newUid);
              setShowAuthModal(false);
              loadAllWatchlists(newUid);
            }}
            onClose={() => {
              if (userId) setShowAuthModal(false);
            }}
            canClose={Boolean(userId)}
          />
        )}

      </main>
    </div>
  );
}
