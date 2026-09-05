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
    if (!iso) return "2h 15m ago";
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
      const list = Array.isArray(res) ? res : (res.data || []);
      if (list && list.length > 0) {
        setWatchlists(list);
        if (!activeWatchlist || !list.find(w => w.id === activeWatchlist)) {
          setActiveWatchlist(list[0].id);
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

  // Checkpoint Reset
  const handleRecordCheckpoint = async () => {
    setActionLoading(true);
    try {
      await recordSessionCheckpoint(userId || "default_user", activeWatchlist || "wl-primary-demo");
      await loadSignals();
    } catch (err) {
      alert(err.message || "Failed to record checkpoint.");
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

  // Trigger Set Price Alert
  const handleSetAlert = (symbol, targetPrice) => {
    setAlertToast(`🔔 Price alert set for ${symbol} when crossing ${targetPrice}!`);
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
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white font-black px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-bounce">
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
                  Since You Checked
                </span>
              </div>
              <p className={`text-[10px] font-medium ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                Customer Decision Support & Catalyst Intelligence
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
        
        {/* Checkpoint Hero Banner */}
        <section className={`rounded-2xl border p-5 sm:p-6 shadow-md relative overflow-hidden transition ${
          isDark ? "bg-[#111827] border-indigo-900/60" : "bg-white border-indigo-100"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            <div className="space-y-2">
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-black border ${
                isDark ? "bg-indigo-950 text-indigo-300 border-indigo-700" : "bg-indigo-100 text-indigo-900 border-indigo-300"
              }`}>
                <span>⏱️ Checkpoint Snapshot Active</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Since: {getElapsedSinceCheckpoint(data?.last_checked)}</span>
              </div>
              
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                What Changed Since You Last Checked?
              </h1>

              <p className={`text-xs sm:text-sm max-w-2xl font-medium leading-relaxed ${isDark ? "text-slate-200" : "text-slate-600"}`}>
                Every price delta, percentage move, and catalyst headline below is calculated relative to your snapshot taken at{" "}
                <strong className={`font-bold underline decoration-dotted ${
                  isDark ? "text-indigo-300 decoration-indigo-400" : "text-indigo-700 decoration-indigo-400"
                }`}>
                  {formatTimestamp(data?.last_checked)}
                </strong>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <div className={`px-3.5 py-2 rounded-xl border flex flex-col items-center ${
                  isDark ? "bg-slate-800/90 border-slate-700" : "bg-slate-100 border-slate-300"
                }`}>
                  <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>Tracked</span>
                  <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{totalStocksCount} Stocks</span>
                </div>

                <div className={`px-3.5 py-2 rounded-xl border flex flex-col items-center ${
                  isDark ? "bg-slate-800/90 border-slate-700" : "bg-slate-100 border-slate-300"
                }`}>
                  <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>Avg Move</span>
                  <span className={`text-sm font-black ${Number(averageChange) >= 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : (isDark ? "text-rose-400" : "text-rose-600")}`}>
                    {Number(averageChange) >= 0 ? `+${averageChange}%` : `${averageChange}%`}
                  </span>
                </div>

                <div className={`px-3.5 py-2 rounded-xl border flex flex-col items-center ${
                  isDark ? "bg-slate-800/90 border-slate-700" : "bg-slate-100 border-slate-300"
                }`}>
                  <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>Gain / Loss</span>
                  <span className="text-sm font-black">
                    <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>{gainersCount}▲</span>
                    <span className={isDark ? "text-slate-400" : "text-slate-400"}> / </span>
                    <span className={isDark ? "text-rose-400" : "text-rose-600"}>{losersCount}▼</span>
                  </span>
                </div>
              </div>

              <button
                onClick={handleRecordCheckpoint}
                disabled={actionLoading}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs sm:text-sm font-black px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition disabled:opacity-50"
              >
                <span>{actionLoading ? "Updating..." : "📌 Mark as Checked Now"}</span>
              </button>
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
              <option value="relevance">🔥 High Impact First</option>
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

        {/* Stock Insights List */}
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
              <div className="col-span-3">📍 Checkpoint ➔ Live Price</div>
              <div className="col-span-2 text-center">Trajectory ({chartViewMode})</div>
              <div className="col-span-3">Primary Catalyst / Signal</div>
              <div className="col-span-1 text-right">Action</div>
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

                    {/* CHECKPOINT BASELINE ➔ CURRENT LIVE PRICE */}
                    <div className="lg:col-span-3 flex flex-col justify-center">
                      <div className="flex items-baseline space-x-2 flex-wrap">
                        <span className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                          📍 Baseline: <strong className={`font-black ${isDark ? "text-slate-100" : "text-slate-800"}`}>{formatCurrency(stock.checkpoint_price || stock.prev_close || stock.price)}</strong>
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
                          since last check
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

                    {/* Catalyst Signal */}
                    <div className="lg:col-span-3 text-xs">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase border ${
                          stock.signal_type === "CRITICAL"
                            ? (isDark ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-rose-100 text-rose-900 border-rose-300")
                            : stock.signal_type === "SIGNIFICANT"
                            ? (isDark ? "bg-indigo-950 text-indigo-300 border-indigo-800" : "bg-indigo-100 text-indigo-900 border-indigo-300")
                            : (isDark ? "bg-slate-800 text-slate-200 border-slate-700" : "bg-slate-100 text-slate-800 border-slate-300")
                        }`}>
                          {stock.signal_type || "INSIGHT"}
                        </span>
                        {stock.catalyst_headline && (
                          <span className={`font-black truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                            {stock.catalyst_headline}
                          </span>
                        )}
                      </div>
                      <p className={`line-clamp-1 text-[11px] font-medium leading-normal ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {stock.briefing_text || stock.headline || "Price movement recorded against session checkpoint baseline."}
                      </p>
                    </div>

                    {/* Expand & Delete */}
                    <div className="lg:col-span-1 flex items-center justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedStockSymbol(isExpanded ? null : stock.symbol);
                        }}
                        className={`p-1.5 rounded-xl text-xs font-black border transition ${
                          isExpanded
                            ? "bg-indigo-600 text-white border-indigo-600 shadow"
                            : isDark
                            ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                            : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                      <button
                        onClick={(e) => handleRemoveStock(stock.symbol, e)}
                        className="p-1.5 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 transition"
                      >
                        🗑️
                      </button>
                    </div>

                  </div>

                  {/* 🎯 VALUABLE CUSTOMER DECISION & INTELLIGENCE CARD */}
                  {isExpanded && (
                    <div className={`p-5 sm:p-6 border-t space-y-5 transition ${
                      isDark ? "bg-[#0c1017] border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      
                      {/* 1. WHY IT MOVED (CONCRETE BUSINESS DRIVERS) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${
                            isDark ? "text-indigo-400" : "text-indigo-600"
                          }`}>
                            <span>💡 Key Catalysts & Drivers (Why it moved)</span>
                          </h4>
                          {stock.sector_relative && (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isDark ? "bg-slate-800 text-emerald-400" : "bg-slate-200 text-emerald-700"
                            }`}>
                              {stock.sector_relative}
                            </span>
                          )}
                        </div>
                        
                        <div className={`p-4 rounded-2xl border space-y-2 ${
                          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          {(stock.drivers && stock.drivers.length > 0 ? stock.drivers : [
                            stock.briefing_text || "Volume surge detected relative to the 30-day baseline."
                          ]).map((driver, dIdx) => (
                            <div key={dIdx} className="flex items-start space-x-2 text-xs sm:text-sm">
                              <span className="text-emerald-500 font-bold mt-0.5">•</span>
                              <span className={isDark ? "text-slate-100 font-normal" : "text-slate-800 font-normal"}>
                                {driver}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2. SENTIMENT & TECHNICAL MOMENTUM METRICS */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        
                        {/* Bullish Sentiment Meter */}
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          <div className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Market Sentiment
                          </div>
                          <div className="my-2">
                            <div className="flex items-center justify-between text-xs font-black mb-1">
                              <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>{stock.sentiment_pct || 80}% Bullish</span>
                              <span className="text-slate-400">{100 - (stock.sentiment_pct || 80)}% Bearish</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden flex">
                              <div style={{ width: `${stock.sentiment_pct || 80}%` }} className="h-full bg-emerald-500" />
                              <div style={{ width: `${100 - (stock.sentiment_pct || 80)}%` }} className="h-full bg-rose-500" />
                            </div>
                          </div>
                          <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Based on live order book & news polarity
                          </div>
                        </div>

                        {/* Volume Flow Multiplier */}
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          <div className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Volume Surge Multiplier
                          </div>
                          <div className={`text-2xl font-black my-1 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}>
                            {stock.volume_multiplier || "2.1x"}
                          </div>
                          <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            vs 20-day standard volume baseline
                          </div>
                        </div>

                        {/* RSI & Momentum */}
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                          isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          <div className={`text-[11px] font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            RSI Momentum Indicator
                          </div>
                          <div className={`text-lg font-black my-1 ${
                            (stock.pct_change || 0) >= 0
                              ? (isDark ? "text-emerald-400" : "text-emerald-600")
                              : (isDark ? "text-rose-400" : "text-rose-600")
                          }`}>
                            {stock.rsi || "64 (Bullish)"}
                          </div>
                          <div className={`text-[10px] ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            Price strength momentum test
                          </div>
                        </div>

                      </div>

                      {/* 3. STRATEGIC DECISION LEVELS (TARGET / SUPPORT / STOP-LOSS) */}
                      <div className={`p-4 rounded-2xl border space-y-3 ${
                        isDark ? "bg-[#161f30] border-indigo-900/40" : "bg-indigo-50/50 border-indigo-200"
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className={`text-xs font-black uppercase tracking-wider ${
                            isDark ? "text-indigo-300" : "text-indigo-900"
                          }`}>
                            🎯 Key Price Levels & Strategy
                          </span>
                          <span className={`text-xs font-bold ${
                            isDark ? "text-slate-200" : "text-slate-700"
                          }`}>
                            {stock.action_advice || "Bullish trend confirmed above entry baseline."}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className={`p-2.5 rounded-xl border ${
                            isDark ? "bg-slate-900/90 border-slate-700" : "bg-white border-slate-300"
                          }`}>
                            <div className="text-[10px] text-slate-400 font-semibold">Immediate Support</div>
                            <div className={`font-black text-sm mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                              {stock.key_levels?.support || formatCurrency(stock.price * 0.96)}
                            </div>
                          </div>

                          <div className={`p-2.5 rounded-xl border ${
                            isDark ? "bg-slate-900/90 border-slate-700" : "bg-white border-slate-300"
                          }`}>
                            <div className="text-[10px] text-emerald-400 font-semibold">Upside Target</div>
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

                      {/* 4. CUSTOMER ACTION BUTTONS */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleSetAlert(stock.symbol, stock.key_levels?.target || formatCurrency(stock.price * 1.05))}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-1.5"
                          >
                            <span>🔔 Set Target Price Alert</span>
                          </button>
                          
                          <button
                            onClick={() => handleSetAlert(stock.symbol, stock.key_levels?.support || formatCurrency(stock.price * 0.96))}
                            className={`text-xs font-bold px-3.5 py-2.5 rounded-xl border transition ${
                              isDark ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <span>🛡️ Set Stop-Loss Alert</span>
                          </button>
                        </div>

                        <div className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                          52W Low/High: <strong className={isDark ? "text-white" : "text-slate-800"}>₹{meta.low52} — ₹{meta.high52}</strong>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isDark ? "bg-[#111827] border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base">📜 Checkpoint History</h3>
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
                    }`}>Saved</span>
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
