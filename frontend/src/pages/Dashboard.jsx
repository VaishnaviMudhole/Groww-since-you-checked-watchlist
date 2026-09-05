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
import OnboardingWizard from "../components/OnboardingWizard";

// Company Metadata & Visual Color Badges
const COMPANY_META = {
  "TATAMOTORS": { name: "Tata Motors Ltd.", sector: "Auto", low52: 640, high52: 1179, tagColor: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300" },
  "TATASTEEL":  { name: "Tata Steel Ltd.", sector: "Metals", low52: 114, high52: 184, tagColor: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300" },
  "RELIANCE":   { name: "Reliance Industries", sector: "Energy", low52: 2220, high52: 3217, tagColor: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300" },
  "HDFCBANK":   { name: "HDFC Bank Ltd.", sector: "Banking", low52: 1363, high52: 1794, tagColor: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300" },
  "ICICIBANK":  { name: "ICICI Bank Ltd.", sector: "Banking", low52: 910, high52: 1330, tagColor: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300" },
  "INFY":       { name: "Infosys Ltd.", sector: "Tech", low52: 1358, high52: 1990, tagColor: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300" },
  "TCS":        { name: "Tata Consultancy Services", sector: "Tech", low52: 3313, high52: 4585, tagColor: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300" },
  "WIPRO":      { name: "Wipro Ltd.", sector: "Tech", low52: 375, high52: 580, tagColor: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300" },
  "ZOMATO":     { name: "Eternal (Zomato Ltd.)", sector: "Consumer", low52: 98, high52: 298, tagColor: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300" },
  "SBIN":       { name: "State Bank of India", sector: "Banking", low52: 555, high52: 912, tagColor: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300" },
  "ITC":        { name: "ITC Ltd.", sector: "FMCG", low52: 399, high52: 528, tagColor: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300" },
  "HINDUNILVR": { name: "Hindustan Unilever", sector: "FMCG", low52: 2172, high52: 3034, tagColor: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300" },
  "HAL":        { name: "Hindustan Aeronautics", sector: "Defense", low52: 2350, high52: 5675, tagColor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300" },
  "BEL":        { name: "Bharat Electronics", sector: "Defense", low52: 125, high52: 340, tagColor: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300" },
  "MARUTI":     { name: "Maruti Suzuki India", sector: "Auto", low52: 9600, high52: 13680, tagColor: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300" },
  "LT":         { name: "Larsen & Toubro", sector: "Infra", low52: 2850, high52: 3948, tagColor: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300" },
  "PENNYTEST":  { name: "Penny Test Microcap", sector: "Microcap", low52: 5, high52: 25, tagColor: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300" },
  "BROKENSTOCK":{ name: "Exchange Error Demo", sector: "Failure", low52: 0, high52: 0, tagColor: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300" },
};

const POPULAR_SUGGESTIONS = [
  { sector: "Tech", symbols: ["TCS", "INFY", "WIPRO", "ZOMATO"] },
  { sector: "Banking", symbols: ["HDFCBANK", "ICICIBANK", "SBIN"] },
  { sector: "Auto & Defense", symbols: ["TATAMOTORS", "MARUTI", "HAL", "BEL"] },
  { sector: "FMCG & Energy", symbols: ["RELIANCE", "ITC", "HINDUNILVR", "LT"] },
];

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
  const areaPoints = `${xCoords[0]},${height} ${linePoints} ${xCoords[xCoords.length - 1]},${height}`;
  const lastX = xCoords[xCoords.length - 1];
  const lastY = yCoords[yCoords.length - 1];

  return { linePoints, areaPoints, lastX, lastY };
}

function generateCandleData(stock) {
  const isPos = stock.pct_change >= 0;
  const open = stock.prev_close || stock.price * 0.98;
  const close = stock.price || open * 1.02;
  const spread = Math.abs(close - open);
  const high = Math.max(open, close) + spread * 0.4;
  const low = Math.min(open, close) - spread * 0.3;

  if (isPos) {
    return [
      { id: "c1", o: open, c: open + spread * 0.3, h: open + spread * 0.4, l: open - spread * 0.1, green: true },
      { id: "c2", o: open + spread * 0.28, c: open + spread * 0.2, h: open + spread * 0.45, l: open + spread * 0.1, green: false },
      { id: "c3", o: open + spread * 0.22, c: open + spread * 0.7, h: open + spread * 0.8, l: open + spread * 0.18, green: true },
      { id: "c4", o: open + spread * 0.68, c: close, h: high, l: open + spread * 0.6, green: true },
    ];
  } else {
    return [
      { id: "c1", o: open, c: open - spread * 0.3, h: open + spread * 0.1, l: open - spread * 0.4, green: false },
      { id: "c2", o: open - spread * 0.28, c: open - spread * 0.2, h: open - spread * 0.1, l: open - spread * 0.45, green: true },
      { id: "c3", o: open - spread * 0.22, c: open - spread * 0.7, h: open - spread * 0.18, l: open - spread * 0.8, green: false },
      { id: "c4", o: open - spread * 0.68, c: close, h: open - spread * 0.6, l: low, green: false },
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
  const [expandedStockSymbol, setExpandedStockSymbol] = useState(null);
  const [chartViewMode, setChartViewMode] = useState("zigzag");
  
  // Theme state: "light" (Fresh Clean Studio) vs "dark" (Slate Pro Dark)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("sw_theme") || "light";
  });

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("sw_theme", next);
  };

  // Auth State
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem("sw_user_id") || "";
  });
  const [authToken, setAuthToken] = useState(() => {
    return localStorage.getItem("sw_auth_token") || "";
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Checkpoint Session History Modal
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
    if (!iso) return "First Visit (New Session)";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) + " (" + d.toLocaleDateString([], { month: "short", day: "numeric" }) + ")";
    } catch {
      return iso;
    }
  };

  // Calculate elapsed time from checkpoint
  const getElapsedSinceCheckpoint = (iso) => {
    if (!iso) return "Just now";
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      if (diffMs < 60000) return "Just now";
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ${diffMins % 60}m ago`;
    } catch {
      return "Recently";
    }
  };

  // Load Watchlists
  const loadAllWatchlists = async (targetUid) => {
    try {
      const uidToUse = targetUid || userId;
      if (!uidToUse) return;
      const res = await fetchWatchlists(uidToUse);
      if (res.data && res.data.length > 0) {
        setWatchlists(res.data);
        const currentActiveStillExists = res.data.find(w => w.id === activeWatchlist);
        if (!currentActiveStillExists) {
          setActiveWatchlist(res.data[0].id);
        }
      } else {
        setWatchlists([]);
        setActiveWatchlist(null);
      }
    } catch (err) {
      console.error("Watchlists load error:", err);
    }
  };

  // Initial Auth Check
  useEffect(() => {
    if (!userId) {
      setShowAuthModal(true);
      setLoading(false);
    } else {
      loadAllWatchlists(userId);
    }
    checkSystemHealth().then((res) => setHealth(res.data)).catch(() => setHealth({ status: "offline" }));
  }, [userId]);

  // Fetch Watchlist Signals
  const loadSignals = async () => {
    if (!activeWatchlist || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWatchlistSignals(activeWatchlist, sortBy, userId);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load watchlist insights. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeWatchlist && userId) {
      loadSignals();
    }
  }, [activeWatchlist, sortBy, userId]);

  // Add Stock
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!newSymbol.trim() || !activeWatchlist) return;
    setActionLoading(true);
    try {
      await addStockToWatchlist(activeWatchlist, newSymbol.toUpperCase().trim());
      setNewSymbol("");
      await loadSignals();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to add stock symbol.");
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Add from Chips
  const handleQuickAdd = async (sym) => {
    if (!activeWatchlist) return;
    setActionLoading(true);
    try {
      await addStockToWatchlist(activeWatchlist, sym);
      await loadSignals();
    } catch (err) {
      alert(err.response?.data?.detail || `Stock ${sym} is already in this watchlist.`);
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
      await removeStockFromWatchlist(activeWatchlist, sym);
      await loadSignals();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to remove stock.");
    } finally {
      setActionLoading(false);
    }
  };

  // Checkpoint Session Reset
  const handleRecordCheckpoint = async () => {
    setActionLoading(true);
    try {
      await recordSessionCheckpoint(userId, activeWatchlist);
      await loadSignals();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to record checkpoint.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Checkpoint History
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await fetchSessionHistory(userId);
      setSessionHistory(res.data || []);
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
      const res = await createWatchlist(newWlName.trim(), userId);
      setShowNewWlModal(false);
      setNewWlName("");
      await loadAllWatchlists(userId);
      setActiveWatchlist(res.data.id);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create watchlist.");
    } finally {
      setActionLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("sw_user_id");
    localStorage.removeItem("sw_auth_token");
    setUserId("");
    setAuthToken("");
    setData(null);
    setWatchlists([]);
    setActiveWatchlist(null);
    setShowAuthModal(true);
  };

  // Filter Stocks
  const filteredStocks = (data?.signals || []).filter((s) => {
    const symMatch = s.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const nameMatch = (COMPANY_META[s.symbol]?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = symMatch || nameMatch;
    
    if (activeSectorFilter === "ALL") return matchesSearch;
    const stockSector = COMPANY_META[s.symbol]?.sector || "Other";
    return matchesSearch && stockSector === activeSectorFilter;
  });

  // Unique sectors in current watchlist
  const availableSectors = ["ALL", ...new Set((data?.signals || []).map(s => COMPANY_META[s.symbol]?.sector || "Other"))];

  // Quick Portfolio / Watchlist Aggregate Metrics
  const totalStocksCount = data?.signals?.length || 0;
  const gainersCount = (data?.signals || []).filter(s => (s.pct_change || 0) > 0).length;
  const losersCount = (data?.signals || []).filter(s => (s.pct_change || 0) < 0).length;
  const averageChange = totalStocksCount > 0
    ? ((data?.signals || []).reduce((acc, s) => acc + (s.pct_change || 0), 0) / totalStocksCount).toFixed(2)
    : 0;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${theme === "dark" ? "bg-slate-950 text-slate-100 dark" : "bg-slate-50 text-slate-900"}`}>
      
      {/* 1. Modern Header / Brand Bar */}
      <header className={`border-b sticky top-0 z-30 backdrop-blur-md transition-colors ${
        theme === "dark" ? "bg-slate-900/90 border-slate-800" : "bg-white/95 border-slate-200"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Student Innovation Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-emerald-400">
                  TrackPulse
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Since You Checked
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Intelligent Checkpoint Signals & Delta Intelligence
              </p>
            </div>
          </div>

          {/* Quick Search in Navbar */}
          <div className="hidden md:flex items-center flex-1 max-w-xs mx-6">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stocks, sectors..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                  theme === "dark" 
                    ? "bg-slate-800/80 border-slate-700 text-slate-200 placeholder-slate-500" 
                    : "bg-slate-100 border-slate-200 text-slate-800 placeholder-slate-400"
                }`}
              />
            </div>
          </div>

          {/* Action Bar (Theme, Health, User Profile) */}
          <div className="flex items-center space-x-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{theme === "light" ? "🌙 Dark" : "☀️ Light"}</span>
            </button>

            {/* Health Indicator */}
            <div className={`hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              health.status === "healthy"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
            }`}>
              <span className={`w-2 h-2 rounded-full ${health.status === "healthy" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span>{health.status === "healthy" ? "Live Engine" : "Degraded"}</span>
            </div>

            {/* User Account / Logout */}
            {userId ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleOpenHistory}
                  title="View Checkpoint Session Log"
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                    theme === "dark"
                      ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  📜 Logs
                </button>
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                    {userId}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Verified User
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-transparent hover:border-rose-200 transition font-bold"
                >
                  🚪
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs shadow transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* 3. Hero Feature Card: The Checkpoint Timeline */}
        <section className={`rounded-2xl border p-5 sm:p-6 shadow-sm relative overflow-hidden transition-all ${
          theme === "dark"
            ? "bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border-indigo-900/40"
            : "bg-gradient-to-br from-white via-indigo-50/40 to-emerald-50/20 border-indigo-100"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Left: What is happening since last checked */}
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                <span>⏱️ Checkpoint Engine Active</span>
                <span className="w-1 h-1 rounded-full bg-indigo-400" />
                <span>Since: {getElapsedSinceCheckpoint(data?.last_checked)}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                What Changed Since You Last Checked?
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                Every price delta, catalyst, and signal below is computed relative to your personal snapshot at{" "}
                <strong className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 decoration-dotted">
                  {formatTimestamp(data?.last_checked)}
                </strong>
                .
              </p>
            </div>

            {/* Right: Quick Checkpoint Stats & Reset Button */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Aggregate Snapshot Mini-Pills */}
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <div className={`px-3 py-2 rounded-xl border flex flex-col items-center ${
                  theme === "dark" ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <span className="text-[10px] text-slate-400 font-medium">Tracked</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{totalStocksCount} Stocks</span>
                </div>
                <div className={`px-3 py-2 rounded-xl border flex flex-col items-center ${
                  theme === "dark" ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <span className="text-[10px] text-slate-400 font-medium">Avg Move</span>
                  <span className={`text-sm font-bold ${averageChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {averageChange >= 0 ? `+${averageChange}%` : `${averageChange}%`}
                  </span>
                </div>
                <div className={`px-3 py-2 rounded-xl border flex flex-col items-center ${
                  theme === "dark" ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
                }`}>
                  <span className="text-[10px] text-slate-400 font-medium">Gain / Loss</span>
                  <span className="text-sm font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">{gainersCount}▲</span> / <span className="text-rose-600 dark:text-rose-400">{losersCount}▼</span>
                  </span>
                </div>
              </div>

              {/* Reset Checkpoint Action */}
              <button
                onClick={handleRecordCheckpoint}
                disabled={actionLoading || !userId}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition disabled:opacity-50"
              >
                <span>{actionLoading ? "Updating..." : "📌 Mark as Checked Now"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 4. Multi-Watchlist Tabs & Management Bar */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          
          {/* Watchlist Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
            {watchlists.map((wl) => {
              const isActive = wl.id === activeWatchlist;
              return (
                <button
                  key={wl.id}
                  onClick={() => setActiveWatchlist(wl.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : theme === "dark"
                      ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>📁</span>
                  <span>{wl.name}</span>
                </button>
              );
            })}

            {/* Add Watchlist Button */}
            <button
              onClick={() => setShowNewWlModal(true)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border border-dashed transition flex items-center space-x-1 ${
                theme === "dark"
                  ? "border-slate-700 text-slate-400 hover:text-indigo-400 hover:border-indigo-500"
                  : "border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-400"
              }`}
            >
              <span>+ New List</span>
            </button>
          </div>

          {/* Controls: Sorting & Chart View Selector */}
          <div className="flex items-center space-x-2 text-xs">
            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                  theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <option value="relevance">🔥 High Impact First</option>
                <option value="biggest_gainers">🚀 Top Gainers</option>
                <option value="biggest_losers">📉 Top Losers</option>
                <option value="symbol">🔤 Symbol (A-Z)</option>
              </select>
            </div>

            {/* Chart Mode (Zigzag Polyline vs Candlestick) */}
            <div className={`p-0.5 rounded-lg border flex items-center space-x-0.5 ${
              theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"
            }`}>
              <button
                onClick={() => setChartViewMode("zigzag")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                  chartViewMode === "zigzag"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                📈 Trend
              </button>
              <button
                onClick={() => setChartViewMode("candle")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                  chartViewMode === "candle"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                🕯️ Candle
              </button>
            </div>
          </div>
        </section>

        {/* 5. Sector Filter Pills */}
        {availableSectors.length > 2 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Sector:</span>
            {availableSectors.map((sector) => (
              <button
                key={sector}
                onClick={() => setActiveSectorFilter(sector)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                  activeSectorFilter === sector
                    ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                    : theme === "dark"
                    ? "bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        )}

        {/* 6. Add Stock Input & Quick Suggestions Bar */}
        <section className={`p-4 rounded-xl border transition ${
          theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Add Form */}
            <form onSubmit={handleAddStock} className="flex items-center space-x-2 flex-1 max-w-md">
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                placeholder="Enter stock symbol (e.g. HAL, WIPRO, TATAMOTORS)"
                className={`flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium uppercase ${
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />
              <button
                type="submit"
                disabled={actionLoading || !newSymbol.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {actionLoading ? "Adding..." : "+ Add"}
              </button>
            </form>

            {/* Quick Popular Add Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">⚡ Quick Add:</span>
              {["TATAMOTORS", "RELIANCE", "INFY", "HAL", "ZOMATO"].map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleQuickAdd(sym)}
                  disabled={actionLoading}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold border transition ${
                    theme === "dark"
                      ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-indigo-400"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-400"
                  }`}
                >
                  +{sym}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Stock Insights Cards Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Calculating Checkpoint Differences & News Catalysts...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-center space-y-3">
            <p className="font-bold text-sm">⚠️ {error}</p>
            <button
              onClick={loadSignals}
              className="bg-rose-600 text-white font-bold px-4 py-1.5 rounded-lg text-xs"
            >
              Retry
            </button>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className={`py-16 text-center rounded-2xl border border-dashed p-8 ${
            theme === "dark" ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50"
          }`}>
            <div className="text-3xl mb-2">📋</div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">No stocks found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Add stocks from the quick suggestions above or search for NSE/BSE symbols to track checkpoint movement.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            
            {/* Header info explaining the columns */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <div className="col-span-3">Stock & Sector</div>
              <div className="col-span-3">📍 Checkpoint ➔ Current Live</div>
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
                tagColor: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
              };

              const isPositive = (stock.pct_change || 0) >= 0;
              const isZero = (stock.pct_change || 0) === 0;
              const isExpanded = expandedStockSymbol === stock.symbol;
              const deltaPrice = stock.price && stock.checkpoint_price ? (stock.price - stock.checkpoint_price) : 0;
              const zigzag = generateZigzagPath(stock.symbol, isPositive);
              const candles = generateCandleData(stock);

              return (
                <div
                  key={stock.symbol}
                  className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
                    theme === "dark"
                      ? "bg-slate-900/90 border-slate-800 hover:border-indigo-500/60"
                      : "bg-white border-slate-200 hover:border-indigo-300 shadow-sm"
                  } ${isExpanded ? "ring-2 ring-indigo-500" : ""}`}
                >
                  {/* Stock Row Main Surface */}
                  <div
                    onClick={() => setExpandedStockSymbol(isExpanded ? null : stock.symbol)}
                    className="p-4 sm:p-5 cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                  >
                    
                    {/* Col 1: Symbol, Company Name & Sector Badge */}
                    <div className="lg:col-span-3 flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-sm text-slate-800 dark:text-slate-200 shrink-0">
                        {stock.symbol.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                            {stock.symbol}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${meta.tagColor}`}>
                            {meta.sector}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {meta.name}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Checkpoint Price ➔ Live Price (PROMINENT BEFORE CLICKING) */}
                    <div className="lg:col-span-3 flex flex-col justify-center">
                      {/* Explicit Before-Click Checkpoint Baseline Display */}
                      <div className="flex items-baseline space-x-2 flex-wrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                          📍 Baseline: <strong className="text-slate-700 dark:text-slate-300">{formatCurrency(stock.checkpoint_price || stock.prev_close || stock.price)}</strong>
                        </span>
                        <span className="text-xs text-slate-400">➔</span>
                        <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          {formatCurrency(stock.price)}
                        </span>
                      </div>

                      {/* Delta Rupee & Percentage Pill */}
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className={`inline-flex items-center space-x-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}>
                          <span>{isPositive ? "▲ +" : "▼ "}</span>
                          <span>{formatCurrency(Math.abs(deltaPrice))}</span>
                          <span>({isPositive ? `+${stock.pct_change?.toFixed(2)}%` : `${stock.pct_change?.toFixed(2)}%`})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          since last check
                        </span>
                      </div>
                    </div>

                    {/* Col 3: Mini Chart Trajectory */}
                    <div className="lg:col-span-2 flex justify-center items-center py-1">
                      {chartViewMode === "zigzag" ? (
                        <div className="w-[120px] h-[34px] relative">
                          <svg viewBox="0 0 120 34" className="w-full h-full overflow-visible">
                            {/* Dotted Checkpoint Reference Baseline */}
                            <line
                              x1="0"
                              y1={isPositive ? "24" : "10"}
                              x2="120"
                              y2={isPositive ? "24" : "10"}
                              stroke="#94a3b8"
                              strokeWidth="1"
                              strokeDasharray="2 2"
                              opacity="0.5"
                            />
                            <polyline
                              fill="none"
                              stroke={isPositive ? "#10b981" : "#f43f5e"}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={zigzag.linePoints}
                            />
                            <circle
                              cx={zigzag.lastX}
                              cy={zigzag.lastY}
                              r="3"
                              fill={isPositive ? "#10b981" : "#f43f5e"}
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 h-[34px]">
                          {candles.map((c) => {
                            const candleColor = c.green ? "bg-emerald-500" : "bg-rose-500";
                            return (
                              <div key={c.id} className="flex flex-col items-center justify-center w-2 h-7 relative">
                                <div className={`w-[1.5px] h-7 ${candleColor} opacity-40`} />
                                <div className={`w-2 h-4 ${candleColor} rounded-[1px] absolute`} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Col 4: Catalyst / Summary Headline */}
                    <div className="lg:col-span-3 text-xs">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          stock.signal_type === "CRITICAL"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : stock.signal_type === "SIGNIFICANT"
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {stock.signal_type || "INSIGHT"}
                        </span>
                        {stock.catalyst_headline && (
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {stock.catalyst_headline}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-1 text-[11px]">
                        {stock.briefing_text || stock.headline || "Price activity monitored since baseline snapshot."}
                      </p>
                    </div>

                    {/* Col 5: Actions (Expand Briefing & Delete) */}
                    <div className="lg:col-span-1 flex items-center justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedStockSymbol(isExpanded ? null : stock.symbol);
                        }}
                        className={`p-1.5 rounded-lg text-xs font-bold border transition ${
                          isExpanded
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : theme === "dark"
                            ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                            : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                        }`}
                        title="Expand Briefing"
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                      <button
                        onClick={(e) => handleRemoveStock(stock.symbol, e)}
                        className="p-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Remove from watchlist"
                      >
                        🗑️
                      </button>
                    </div>

                  </div>

                  {/* Expanded Detail / "Why It Moved" Briefing Drawer */}
                  {isExpanded && (
                    <div className={`p-5 border-t space-y-4 transition ${
                      theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50/80 border-slate-200"
                    }`}>
                      
                      {/* Checkpoint Recap Bar inside Briefing */}
                      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">📍</span>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Snapshot Comparison:
                            </span>{" "}
                            <span className="text-slate-600 dark:text-slate-400">
                              When you last visited ({formatTimestamp(data?.last_checked)}), {stock.symbol} was trading at{" "}
                              <strong>{formatCurrency(stock.checkpoint_price || stock.prev_close || stock.price)}</strong>. It is now at{" "}
                              <strong>{formatCurrency(stock.price)}</strong>.
                            </span>
                          </div>
                        </div>
                        <div className="font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          Delta: {formatCurrency(deltaPrice)} ({stock.pct_change?.toFixed(2)}%)
                        </div>
                      </div>

                      {/* Full AI / Rule-based Briefing Narrative */}
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                          🎯 Why It Moved (Catalyst Breakdown)
                        </h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          {stock.briefing_text || stock.headline || "No sudden anomalous event detected. Trading within standard daily volatility band."}
                        </p>
                      </div>

                      {/* Metrics: 52-Week Range & Technical Stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs">
                          <div className="text-[10px] text-slate-400 font-medium">52-Week Range</div>
                          <div className="font-bold mt-1 text-slate-800 dark:text-slate-200">
                            ₹{meta.low52} — ₹{meta.high52}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs">
                          <div className="text-[10px] text-slate-400 font-medium">Signal Confidence</div>
                          <div className="font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                            High (Real-time Market Feed)
                          </div>
                        </div>
                        <div className="p-3 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs">
                          <div className="text-[10px] text-slate-400 font-medium">Session Status</div>
                          <div className="font-bold mt-1 text-slate-800 dark:text-slate-200">
                            Monitored 24/7
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* 8. Session History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
              theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center space-x-2">
                  <span>📜</span>
                  <span>Checkpoint Session History</span>
                </h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log of snapshots recorded for user <strong className="text-indigo-500">{userId}</strong>:
              </p>
              {historyLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading history...</div>
              ) : sessionHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No previous checkpoints recorded.</div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {sessionHistory.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        theme === "dark" ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {formatTimestamp(s.created_at || s.timestamp)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Watchlist: {s.watchlist_name || s.watchlist_id || "Active"}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Saved
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-bold py-2 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* 9. Create Watchlist Modal */}
        {showNewWlModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl space-y-4 ${
              theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Create New Watchlist</h3>
                <button
                  onClick={() => setShowNewWlModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateWatchlist} className="space-y-3">
                <input
                  type="text"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  placeholder="e.g. High Growth, Dividend, EV Tech"
                  required
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewWlModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !newWlName.trim()}
                    className="bg-indigo-600 text-white font-bold px-4 py-1.5 rounded-xl text-xs disabled:opacity-50"
                  >
                    {actionLoading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 10. Auth Modal */}
        {showAuthModal && (
          <AuthModal
            onLoginSuccess={(newUid, isNewSignUp) => {
              setUserId(newUid);
              setShowAuthModal(false);
              setAuthToken(localStorage.getItem("sw_auth_token"));
              if (isNewSignUp) {
                setShowOnboarding(true);
              } else {
                loadAllWatchlists(newUid);
              }
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
