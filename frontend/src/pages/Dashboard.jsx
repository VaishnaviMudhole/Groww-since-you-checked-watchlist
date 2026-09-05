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

// Company Metadata & Authentic Groww Brand Icons
const COMPANY_META = {
  "TATAMOTORS": { name: "Tata Motors Ltd.", color: "#1e3a8a", iconBg: "#dbeafe", iconText: "T", sector: "Auto", low52: 640, high52: 1179 },
  "TATASTEEL":  { name: "Tata Steel Ltd.", color: "#1e3a8a", iconBg: "#dbeafe", iconText: "T", sector: "Metals", low52: 114, high52: 184 },
  "RELIANCE":   { name: "Reliance Industries", color: "#b45309", iconBg: "#fef3c7", iconText: "R", sector: "Energy", low52: 2220, high52: 3217 },
  "HDFCBANK":   { name: "HDFC Bank Ltd.", color: "#1d4ed8", iconBg: "#eff6ff", iconText: "H", sector: "Banking", low52: 1363, high52: 1794 },
  "ICICIBANK":  { name: "ICICI Bank Ltd.", color: "#c2410c", iconBg: "#ffedd5", iconText: "I", sector: "Banking", low52: 910, high52: 1330 },
  "INFY":       { name: "Infosys Ltd.", color: "#0284c7", iconBg: "#e0f2fe", iconText: "INFY", sector: "Tech", low52: 1358, high52: 1990 },
  "TCS":        { name: "Tata Consultancy Services", color: "#1e293b", iconBg: "#f1f5f9", iconText: "TCS", sector: "Tech", low52: 3313, high52: 4585 },
  "WIPRO":      { name: "Wipro Ltd.", color: "#7c3aed", iconBg: "#f3e8ff", iconText: "W", sector: "Tech", low52: 375, high52: 580 },
  "ZOMATO":     { name: "Eternal (Zomato Ltd.)", color: "#dc2626", iconBg: "#fee2e2", iconText: "Z", sector: "Consumer", low52: 98, high52: 298 },
  "SBIN":       { name: "State Bank of India", color: "#0369a1", iconBg: "#e0f2fe", iconText: "SBI", sector: "Banking", low52: 555, high52: 912 },
  "ITC":        { name: "ITC Ltd.", color: "#b91c1c", iconBg: "#fee2e2", iconText: "ITC", sector: "FMCG", low52: 399, high52: 528 },
  "HINDUNILVR": { name: "Hindustan Unilever", color: "#1e40af", iconBg: "#dbeafe", iconText: "HUL", sector: "FMCG", low52: 2172, high52: 3034 },
  "HAL":        { name: "Hindustan Aeronautics", color: "#047857", iconBg: "#d1fae5", iconText: "HAL", sector: "Defense", low52: 2350, high52: 5675 },
  "BEL":        { name: "Bharat Electronics", color: "#047857", iconBg: "#d1fae5", iconText: "BEL", sector: "Defense", low52: 125, high52: 340 },
  "MARUTI":     { name: "Maruti Suzuki India", color: "#1d4ed8", iconBg: "#dbeafe", iconText: "MS", sector: "Auto", low52: 9600, high52: 13680 },
  "LT":         { name: "Larsen & Toubro", color: "#b45309", iconBg: "#fef3c7", iconText: "LT", sector: "Infra", low52: 2850, high52: 3948 },
  "PENNYTEST":  { name: "Penny Test Microcap", color: "#b45309", iconBg: "#fef3c7", iconText: "PT", sector: "Microcap", low52: 5, high52: 25 },
  "BROKENSTOCK":{ name: "Exchange Error Demo", color: "#dc2626", iconBg: "#fee2e2", iconText: "ERR", sector: "Failure", low52: 0, high52: 0 },
};

const POPULAR_SUGGESTIONS = [
  { sector: "Tech", symbols: ["TCS", "INFY", "WIPRO", "ZOMATO"] },
  { sector: "Banking", symbols: ["HDFCBANK", "ICICIBANK", "SBIN"] },
  { sector: "Auto & Energy", symbols: ["TATAMOTORS", "MARUTI", "RELIANCE", "HAL"] },
  { sector: "FMCG", symbols: ["ITC", "HINDUNILVR"] },
  { sector: "Edge Cases", symbols: ["PENNYTEST", "BROKENSTOCK"] },
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
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [checkpointSaved, setCheckpointSaved] = useState(false);
  
  // Theme Mode: Groww Clean White vs Groww Dark Pro
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("groww_theme") === "dark");

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem("groww_theme", next ? "dark" : "light");
  };

  // Auth State
  const getInitialUserId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get("user");
    if (fromUrl) {
      localStorage.setItem("groww_user_id", fromUrl.trim());
      localStorage.setItem("sw_user_id", fromUrl.trim());
      return fromUrl.trim();
    }
    return localStorage.getItem("groww_user_id") || localStorage.getItem("sw_user_id") || "";
  };

  const [userId, setUserId] = useState(getInitialUserId);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("sw_auth_token"));
  
  const [showAuthModal, setShowAuthModal] = useState(() => {
    const savedUser = localStorage.getItem("groww_user_id") || localStorage.getItem("sw_user_id");
    const savedToken = localStorage.getItem("sw_auth_token");
    return !savedUser || !savedToken;
  });

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userIdInput, setUserIdInput] = useState(userId || "9110679101");
  const [copiedSyncLink, setCopiedSyncLink] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoTab, setInfoTab] = useState("principles");
  const [sessionHistory, setSessionHistory] = useState([]);
  const [stockToDelete, setStockToDelete] = useState(null);
  const [showNewWatchlistModal, setShowNewWatchlistModal] = useState(false);
  const [newWatchlistNameInput, setNewWatchlistNameInput] = useState("");

  // Trade Sheet
  const [tradeModalStock, setTradeModalStock] = useState(null);
  const [tradeQuantity, setTradeQuantity] = useState(10);
  const [tradeOrderType, setTradeOrderType] = useState("BUY");
  const [tradeSuccessMsg, setTradeSuccessMsg] = useState(null);

  // Anomaly Toast
  const [autoAlert, setAutoAlert] = useState(null);
  const [seenAnomalies, setSeenAnomalies] = useState(() => {
    try {
      const stored = sessionStorage.getItem("seen_anomaly_alerts");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setLoading(true);
    checkSystemHealth().then(setHealth);
    if (userId) {
      loadAllWatchlists(userId);
    } else {
      loadSignals(null);
    }
  }, [userId]);

  const loadAllWatchlists = (uid = userId, attempt = 0) => {
    const targetUid = uid || "9110679101";
    fetchWatchlists(targetUid)
      .then((lists) => {
        setWatchlists(lists || []);
        if (lists && lists.length > 0) {
          const defaultList = lists[0];
          setActiveWatchlist((prev) => (prev ? lists.find((l) => l.id === prev.id) || defaultList : defaultList));
          loadSignals(defaultList.id);
        } else {
          loadSignals(null);
        }
      })
      .catch((err) => {
        console.warn("Watchlist fetch error (Render waking up):", err);
        if (attempt < 4) {
          setTimeout(() => loadAllWatchlists(targetUid, attempt + 1), (attempt + 1) * 2500);
        }
      });
  };

  const loadSignals = (wId) => {
    setLoading(true);
    fetchWatchlistSignals(wId)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        console.error("Signal fetch error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeWatchlist) {
      loadSignals(activeWatchlist.id);
    }
  }, [activeWatchlist]);

  // Anomaly alert trigger
  useEffect(() => {
    if (!data?.stocks || data.stocks.length === 0) return;
    const candidates = data.stocks.filter(
      (s) => (s.volume_ratio >= 2.0 || s.relevance_score >= 1.4) && !s.is_illiquid && s.status === "success"
    );
    if (candidates.length > 0) {
      const freshAnomaly = candidates.find((s) => !seenAnomalies.includes(s.symbol));
      if (freshAnomaly) {
        setAutoAlert(freshAnomaly);
        const updatedSeen = [...seenAnomalies, freshAnomaly.symbol];
        setSeenAnomalies(updatedSeen);
        try {
          sessionStorage.setItem("seen_anomaly_alerts", JSON.stringify(updatedSeen));
        } catch (e) {}

        const timer = setTimeout(() => {
          setAutoAlert((curr) => (curr?.symbol === freshAnomaly.symbol ? null : curr));
        }, 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [data]);

  const handleAdd = async (symbolToAdd) => {
    const symbol = (symbolToAdd || newSymbol).trim().toUpperCase();
    if (!symbol) return;

    try {
      setActionLoading(true);
      let targetWatchlist = activeWatchlist;

      if (!targetWatchlist) {
        const currentUid = userId || "9110679101";
        targetWatchlist = await createWatchlist("My Watchlist", currentUid);
        setActiveWatchlist(targetWatchlist);
        await loadAllWatchlists(currentUid);
      }

      await addStockToWatchlist(targetWatchlist.id, symbol);
      setNewSymbol("");
      setShowAddModal(false);
      loadSignals(targetWatchlist.id);
    } catch (err) {
      alert(`Could not add stock: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const executeRemoveStock = async () => {
    if (!activeWatchlist || !stockToDelete) return;
    try {
      setActionLoading(true);
      await removeStockFromWatchlist(activeWatchlist.id, stockToDelete.itemId);
      setStockToDelete(null);
      loadSignals(activeWatchlist.id);
    } catch (err) {
      alert(`Could not remove stock: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckpoint = async () => {
    if (!activeWatchlist) return;
    try {
      setActionLoading(true);
      await recordSessionCheckpoint(activeWatchlist.id);
      setCheckpointSaved(true);
      setTimeout(() => setCheckpointSaved(false), 2500);
      loadSignals(activeWatchlist.id);
    } catch (err) {
      alert(`Error saving checkpoint: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const executeCreateWatchlist = async (e) => {
    e.preventDefault();
    const name = newWatchlistNameInput.trim();
    if (!name) return;
    try {
      setActionLoading(true);
      const currentUid = userId || "9110679101";
      const created = await createWatchlist(name, currentUid);
      setNewWatchlistNameInput("");
      setShowNewWatchlistModal(false);
      await loadAllWatchlists(currentUid);
      setActiveWatchlist(created);
    } catch (err) {
      alert(`Could not create watchlist: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopySyncLink = () => {
    const syncUrl = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(userId || "9110679101")}`;
    navigator.clipboard.writeText(syncUrl);
    setCopiedSyncLink(true);
    setTimeout(() => setCopiedSyncLink(false), 2500);
  };

  const handleSwitchUser = (e) => {
    e.preventDefault();
    const clean = userIdInput.trim();
    if (!clean) return;
    setUserId(clean);
    localStorage.setItem("groww_user_id", clean);
    localStorage.setItem("sw_user_id", clean);
    setShowUserModal(false);
    window.history.replaceState(null, "", `?user=${encodeURIComponent(clean)}`);
  };

  const handleSignOut = () => {
    localStorage.removeItem("groww_user_id");
    localStorage.removeItem("sw_user_id");
    localStorage.removeItem("sw_auth_token");
    setUserId("");
    setAuthToken(null);
    setShowUserModal(false);
    setShowAuthModal(true);
  };

  const handleOpenInfoModal = async (tab = "principles") => {
    setInfoTab(tab);
    setShowInfoModal(true);
    if (tab === "history" && activeWatchlist) {
      try {
        const history = await fetchSessionHistory(activeWatchlist.id);
        setSessionHistory(history || []);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleExecuteGrowwTrade = (e) => {
    e.preventDefault();
    setTradeSuccessMsg(`✓ Simulated Order Placed! ${tradeOrderType} ${tradeQuantity} shares of ${tradeModalStock.symbol} at ₹${tradeModalStock.price} via Groww.`);
    setTimeout(() => {
      setTradeSuccessMsg(null);
      setTradeModalStock(null);
    }, 2200);
  };

  const handleCopySummary = () => {
    if (!data?.executive_briefing) return;
    const textToCopy = `⚡ Since You Checked Briefing:
${data.executive_briefing}

Market (${data.benchmark?.name}): ${data.benchmark?.pct_change >= 0 ? "+" : ""}${data.benchmark?.pct_change}%`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleSpeakBriefing = () => {
    if (!data?.executive_briefing) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      `Here is what happened since you last checked. ${data.executive_briefing}. The NIFTY 50 is ${data.benchmark?.pct_change >= 0 ? "up" : "down"} ${Math.abs(data.benchmark?.pct_change || 0)} percent.`
    );
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const formatLastChecked = (isoStr) => {
    if (!isoStr) return "Just started";
    const date = new Date(isoStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const filteredStocks = data?.stocks
    ? data.stocks
        .filter((s) => s.symbol.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        .filter((s) => activeSectorFilter === "ALL" || s.sector === activeSectorFilter)
    : [];

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (sortBy === "relevance") return b.relevance_score - a.relevance_score;
    if (sortBy === "pct_desc") return b.pct_change - a.pct_change;
    if (sortBy === "pct_asc") return a.pct_change - b.pct_change;
    if (sortBy === "alpha") return b.alpha - a.alpha;
    if (sortBy === "volume") return b.volume_ratio - a.volume_ratio;
    return 0;
  });

  // Dynamic Theme Palette
  const theme = isDarkMode
    ? {
        bg: "#0B0F17",
        cardBg: "#121824",
        innerBg: "#0C111C",
        border: "#1E2738",
        borderLight: "#26344B",
        text: "#FFFFFF",
        textMuted: "#94A3B8",
        textDim: "#64748B",
        growwGreen: "#00D09C",
        growwRed: "#EB5B3C",
        rowHover: "#161E2E",
        tagBg: "#1E293B",
      }
    : {
        bg: "#F4F6F8",
        cardBg: "#FFFFFF",
        innerBg: "#F8FAFC",
        border: "#E2E8F0",
        borderLight: "#CBD5E1",
        text: "#0F172A",
        textMuted: "#475569",
        textDim: "#94A3B8",
        growwGreen: "#00D09C",
        growwRed: "#EB5B3C",
        rowHover: "#F8FAFC",
        tagBg: "#F1F5F9",
      };

  if (showOnboarding) {
    return (
      <OnboardingWizard
        userId={userId || "9110679101"}
        onComplete={(newWl) => {
          setShowOnboarding(false);
          setActiveWatchlist(newWl);
          loadAllWatchlists(userId);
          loadSignals(newWl.id);
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: theme.bg, color: theme.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        
        .groww-row:hover { background-color: ${theme.rowHover} !important; }
        
        @media (max-width: 768px) {
          .indices-strip { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
          .main-nav { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
          .briefing-card { flex-direction: column !important; align-items: stretch !important; }
          .stock-table-header { display: none !important; }
          .stock-row-content { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .stock-right-group { width: 100% !important; justify-content: space-between !important; }
          .filter-bar { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>

      {/* 1. Top Live Indian Indices Header Strip (Matching Groww App) */}
      <div className="indices-strip" style={{ backgroundColor: theme.cardBg, borderBottom: `1px solid ${theme.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", fontSize: "12px", fontWeight: "600", color: theme.textMuted }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", overflowX: "auto", whiteSpace: "nowrap" }}>
          <div>
            <span>NIFTY </span>
            <strong style={{ color: theme.text }}>23,897.70</strong>
            <span style={{ color: theme.growwGreen, marginLeft: "4px" }}>+24.25 (0.10%)</span>
          </div>
          <div>
            <span>SENSEX </span>
            <strong style={{ color: theme.text }}>76,515.43</strong>
            <span style={{ color: theme.growwGreen, marginLeft: "4px" }}>+362.57 (0.48%)</span>
          </div>
          <div>
            <span>BANKNIFTY </span>
            <strong style={{ color: theme.text }}>57,369.65</strong>
            <span style={{ color: theme.growwRed, marginLeft: "4px" }}>-10.95 (0.02%)</span>
          </div>
          <div>
            <span>MIDCPNIFTY </span>
            <strong style={{ color: theme.text }}>14,713.65</strong>
            <span style={{ color: theme.growwRed, marginLeft: "4px" }}>-46.35 (0.31%)</span>
          </div>
          <div>
            <span>FINNIFTY </span>
            <strong style={{ color: theme.text }}>26,051.00</strong>
            <span style={{ color: theme.growwGreen, marginLeft: "4px" }}>+38.10 (0.15%)</span>
          </div>
        </div>

        {/* Theme Toggle & Global Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", whiteSpace: "nowrap" }}>
          <button
            onClick={toggleTheme}
            title="Toggle between Groww Clean White and Dark Theme"
            style={{
              background: theme.innerBg,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>{isDarkMode ? "☀️ Clean Light" : "🌙 Dark Pro"}</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 16px" }}>

        {/* 2. Main Groww Brand Header & Actions */}
        <div className="main-nav" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
          
          {/* Left Watchlist Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: theme.growwGreen, width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: "900", fontSize: "16px" }}>
                ⚡
              </div>
              <span style={{ fontSize: "20px", fontWeight: "800", color: theme.text, letterSpacing: "-0.4px" }}>
                Since You Checked
              </span>
            </div>

            {/* Watchlist selector */}
            <div style={{ display: "flex", alignItems: "center", background: theme.cardBg, borderRadius: "8px", border: `1px solid ${theme.border}`, padding: "2px 8px" }}>
              <select
                value={activeWatchlist?.id || ""}
                onChange={(e) => {
                  const selected = watchlists.find((w) => w.id === e.target.value);
                  if (selected) setActiveWatchlist(selected);
                }}
                style={{
                  background: "transparent",
                  color: "#0284c7",
                  border: "none",
                  padding: "6px 4px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id} style={{ background: theme.cardBg, color: theme.text }}>{w.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowNewWatchlistModal(true)}
                title="Create New Watchlist"
                style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", padding: "4px 8px", fontSize: "14px", fontWeight: "800" }}
              >
                +
              </button>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: theme.growwGreen,
                color: "#0c1017",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "800",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(0, 208, 156, 0.25)",
              }}
            >
              <span>+</span>
              <span>Add Stock</span>
            </button>

            <button
              onClick={() => setShowUserModal(true)}
              title="Groww Account Profile & Multi-Device Sync"
              style={{
                background: theme.cardBg,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>👤</span>
              <span>{userId || "Groww User"}</span>
            </button>

            <button
              onClick={() => handleOpenInfoModal("principles")}
              title="Principles, Scaling, History & Math"
              style={{
                background: theme.cardBg,
                border: `1px solid ${theme.border}`,
                color: theme.textMuted,
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              ⚙️ Info
            </button>
          </div>
        </div>

        {/* 3. Executive Market Synopsis Banner with 1-Click Checkpoint */}
        {data?.executive_briefing && (
          <div className="briefing-card" style={{
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderLeft: `4px solid ${theme.growwGreen}`,
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            boxShadow: isDarkMode ? "0 4px 20px rgba(0, 0, 0, 0.3)" : "0 4px 20px rgba(0, 0, 0, 0.05)",
            animation: "fadeIn 0.2s ease-out",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: theme.growwGreen, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  ⚡ Market Briefing Since Last Visit
                </span>
                {data?.benchmark && (
                  <span style={{ fontSize: "11px", background: theme.innerBg, padding: "2px 8px", borderRadius: "6px", color: data.benchmark.pct_change >= 0 ? theme.growwGreen : theme.growwRed, fontWeight: "700" }}>
                    NIFTY 50: {data.benchmark.pct_change >= 0 ? "+" : ""}{data.benchmark.pct_change}%
                  </span>
                )}
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: theme.text, lineHeight: "1.4" }}>
                {data.executive_briefing}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={handleSpeakBriefing}
                  style={{
                    background: isSpeaking ? "rgba(239, 68, 68, 0.15)" : theme.innerBg,
                    border: `1px solid ${theme.border}`,
                    color: isSpeaking ? "#f87171" : theme.textMuted,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{isSpeaking ? "⏹️ Stop" : "🎧 Audio Readout"}</span>
                </button>
                <button
                  onClick={handleCopySummary}
                  style={{
                    background: theme.innerBg,
                    border: `1px solid ${theme.border}`,
                    color: copiedSummary ? theme.growwGreen : theme.textMuted,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {copiedSummary ? "✓ Copied!" : "📋 Copy"}
                </button>
              </div>
            </div>

            {/* Checkpoint CTA */}
            <button
              onClick={handleCheckpoint}
              disabled={actionLoading}
              title="Click to mark updates as checked so next visit shows fresh changes"
              style={{
                background: checkpointSaved ? theme.growwGreen : "#0284c7",
                color: checkpointSaved ? "#0c1017" : "#ffffff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "800",
                cursor: actionLoading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.15)",
                transition: "all 0.15s ease",
              }}
            >
              {checkpointSaved ? "✓ Checkpoint Saved!" : `✓ Mark as Checked (${formatLastChecked(data?.last_checked_at)})`}
            </button>
          </div>
        )}

        {/* 4. Filter, Search & Sector Category Bar */}
        <div className="filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 Search company or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: theme.cardBg,
                border: `1px solid ${theme.border}`,
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                color: theme.text,
                outline: "none",
                width: "200px",
              }}
            />

            {/* Sector Tabs */}
            <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
              {["ALL", "Tech", "Banking", "Auto", "Defense", "FMCG"].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setActiveSectorFilter(sec)}
                  style={{
                    background: activeSectorFilter === sec ? theme.growwGreen : theme.cardBg,
                    color: activeSectorFilter === sec ? "#0c1017" : theme.textMuted,
                    border: `1px solid ${theme.border}`,
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                  }}
                >
                  {sec === "ALL" ? "All Stocks" : sec}
                </button>
              ))}
            </div>

            <span style={{ fontSize: "12px", color: theme.textDim }}>
              ({sortedStocks.length} stocks)
            </span>
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: theme.textMuted }}>Rank by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: theme.cardBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                padding: "6px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="relevance">⚡ Highest Anomaly (Most Surprising)</option>
              <option value="pct_desc">📈 Top Gainers (%)</option>
              <option value="pct_asc">📉 Top Losers (%)</option>
              <option value="volume">🔥 Heavy Volume Surge</option>
              <option value="alpha">🎯 Independent Alpha (vs NIFTY)</option>
            </select>

            <button
              onClick={() => {
                checkSystemHealth().then(setHealth);
                if (activeWatchlist) loadSignals(activeWatchlist.id);
              }}
              disabled={loading}
              title="Refresh live prices"
              style={{
                background: theme.cardBg,
                border: `1px solid ${theme.border}`,
                color: "#0284c7",
                padding: "6px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "⏳" : "🔄"}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* 5. Groww Watchlist Table (Clean, Professional Layout Matching Actual Groww App) */}
        <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden", boxShadow: isDarkMode ? "0 10px 30px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.04)" }}>
          
          {/* Table Header Bar */}
          <div className="stock-table-header" style={{ display: "grid", gridTemplateColumns: "2.4fr 1.3fr 1.6fr 1.2fr 1.2fr 1fr", padding: "12px 20px", borderBottom: `1px solid ${theme.border}`, fontSize: "11px", fontWeight: "700", color: theme.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <div>Company & Anomaly Catalyst</div>
            <div>Trend Since Checkpoint</div>
            <div style={{ textAlign: "right" }}>Checkpoint ➔ Live Price</div>
            <div style={{ textAlign: "right" }}>1D Change</div>
            <div style={{ textAlign: "center" }}>52W Perf</div>
            <div style={{ textAlign: "right" }}>Action</div>
          </div>

          {/* Table Body / Rows */}
          {loading && !data ? (
            <div style={{ textAlign: "center", padding: "50px 20px" }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>⚡</div>
              <h3 style={{ color: theme.text, fontSize: "16px", margin: "0 0 4px 0" }}>Connecting to Groww Engine</h3>
              <p style={{ color: theme.textMuted, fontSize: "13px", margin: 0 }}>Syncing with Supabase & calculating real-time rankings...</p>
            </div>
          ) : sortedStocks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <p style={{ color: theme.textMuted, fontSize: "15px", marginBottom: "12px" }}>No stocks in this view.</p>
              <button
                onClick={() => setShowAddModal(true)}
                style={{ background: theme.growwGreen, color: "#0c1017", border: "none", padding: "8px 18px", borderRadius: "8px", fontWeight: "800", fontSize: "13px", cursor: "pointer" }}
              >
                + Add Stocks to Watchlist
              </button>
            </div>
          ) : (
            <div>
              {sortedStocks.map((s, index) => {
                if (s.status === "error" || s.price === null) {
                  return (
                    <div
                      key={s.symbol}
                      className="groww-row"
                      style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: theme.textDim }}>#{index + 1}</span>
                        <strong style={{ fontSize: "15px", color: theme.growwRed }}>{s.symbol}</strong>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", color: theme.growwRed, fontWeight: "700" }}>
                          ⚠️ Data Unavailable
                        </span>
                      </div>
                      <button
                        onClick={() => setStockToDelete({ symbol: s.symbol, itemId: s.watchlist_item_id })}
                        style={{ background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: "14px" }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                }

                const isPositive = s.pct_change >= 0;
                const isExpanded = expandedStockSymbol === s.symbol;
                const meta = COMPANY_META[s.symbol] || {
                  name: s.symbol,
                  iconBg: "#e2e8f0",
                  color: "#1e293b",
                  iconText: s.symbol.slice(0, 2),
                  sector: s.sector || "Equity",
                  low52: (s.price || 100) * 0.7,
                  high52: (s.price || 100) * 1.3,
                };
                
                const zigzag = generateZigzagPath(s.symbol, isPositive);
                const candleData = generateCandleData(s);
                
                // 52-week slider ratio (0 to 1)
                const rangeDiff = Math.max(1, meta.high52 - meta.low52);
                const sliderRatio = Math.min(1, Math.max(0, (s.price - meta.low52) / rangeDiff));
                const dotPercent = Math.round(sliderRatio * 100);

                // Checkpoint price and net diff
                const checkpointPrice = s.prev_close || s.price;
                const netPriceDiff = (s.price - checkpointPrice).toFixed(2);

                return (
                  <div
                    key={s.symbol}
                    className="groww-row"
                    style={{
                      borderBottom: `1px solid ${theme.border}`,
                      backgroundColor: isExpanded ? theme.innerBg : "transparent",
                      transition: "background-color 0.15s ease",
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedStockSymbol(isExpanded ? null : s.symbol)}
                  >
                    {/* Main Row */}
                    <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "2.4fr 1.3fr 1.6fr 1.2fr 1.2fr 1fr", alignItems: "center", gap: "10px" }} className="stock-row-content">
                      
                      {/* 1. Company Icon, Name, Ticker & Catalyst */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          backgroundColor: meta.iconBg,
                          color: meta.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "900",
                          fontSize: meta.iconText.length > 2 ? "10px" : "14px",
                          flexShrink: 0,
                          border: `1px solid ${theme.borderLight}`,
                        }}>
                          {meta.iconText}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ fontSize: "14px", color: theme.text }}>{meta.name}</strong>
                            <span style={{ fontSize: "10px", background: theme.tagBg, color: theme.textMuted, padding: "1px 5px", borderRadius: "4px", fontWeight: "700" }}>
                              {s.symbol}
                            </span>
                            {s.is_illiquid && (
                              <span style={{ fontSize: "10px", background: "#fef3c7", color: "#b45309", padding: "1px 5px", borderRadius: "4px", fontWeight: "700" }}>
                                Low Liq
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: theme.textMuted, marginTop: "2px", lineHeight: "1.3" }}>
                            {s.insight || `Traded at ${s.volume_ratio}x normal 20d volume`}
                          </div>
                        </div>
                      </div>

                      {/* 2. Trend Sparkline (with dotted baseline) */}
                      <div style={{ width: "120px", height: "34px", position: "relative" }}>
                        <svg viewBox="0 0 120 34" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                          {/* Dotted Baseline representing previous checkpoint */}
                          <line x1="0" y1={isPositive ? 24 : 10} x2="120" y2={isPositive ? 24 : 10} stroke={theme.textDim} strokeDasharray="3,3" strokeWidth="1" />
                          
                          {/* Shaded Area */}
                          <polygon
                            points={zigzag.areaPoints}
                            fill={isPositive ? "rgba(0, 208, 156, 0.15)" : "rgba(235, 91, 60, 0.15)"}
                          />

                          {/* Crisp Trend Line */}
                          <polyline
                            points={zigzag.linePoints}
                            fill="none"
                            stroke={isPositive ? theme.growwGreen : theme.growwRed}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Endpoint Dot */}
                          <circle cx={zigzag.lastX} cy={zigzag.lastY} r="3" fill={isPositive ? theme.growwGreen : theme.growwRed} />
                        </svg>
                      </div>

                      {/* 3. PROMINENT CHECKPOINT BASELINE & LIVE PRICE (Visible directly on card!) */}
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "15px", fontWeight: "800", color: theme.text }}>
                          ₹{s.price?.toLocaleString("en-IN")}
                        </div>
                        <div style={{ fontSize: "11px", color: theme.textMuted, marginTop: "2px", fontWeight: "600" }}>
                          <span style={{ color: theme.textDim }}>📍 Checkpoint: </span>
                          <strong style={{ color: theme.text }}>₹{checkpointPrice}</strong>
                        </div>
                      </div>

                      {/* 4. 1D / Net Change Since Checkpoint */}
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          display: "inline-block",
                          fontSize: "12px",
                          fontWeight: "800",
                          color: isPositive ? theme.growwGreen : theme.growwRed,
                        }}>
                          {isPositive ? "+" : ""}₹{Math.abs(netPriceDiff)}
                        </div>
                        <div style={{ fontSize: "11px", color: isPositive ? theme.growwGreen : theme.growwRed, fontWeight: "700" }}>
                          ({isPositive ? "+" : ""}{s.pct_change}%)
                        </div>
                      </div>

                      {/* 5. 52-Week Range Slider (Matching Groww Screenshot) */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "10px", color: theme.textDim }}>
                        <span>L</span>
                        <div style={{ position: "relative", width: "50px", height: "3px", backgroundColor: theme.borderLight, borderRadius: "2px" }}>
                          <div
                            style={{
                              position: "absolute",
                              left: `${dotPercent}%`,
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              backgroundColor: theme.text,
                            }}
                          />
                        </div>
                        <span>H</span>
                      </div>

                      {/* 6. Quick Actions */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTradeModalStock(s);
                          }}
                          style={{
                            background: theme.growwGreen,
                            color: "#0c1017",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          Trade
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStockToDelete({ symbol: s.symbol, itemId: s.watchlist_item_id });
                          }}
                          style={{ background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: "14px" }}
                        >
                          ✕
                        </button>
                      </div>

                    </div>

                    {/* Expanded Interactive Trajectory / Candle View */}
                    {isExpanded && (
                      <div style={{ padding: "0 20px 16px 20px", animation: "fadeIn 0.15s ease-out" }}>
                        <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "16px" }}>
                          
                          {/* Expanded Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: theme.text }}>
                              📈 Visual Trajectory (Checkpoint ₹{checkpointPrice} ➔ Live ₹{s.price})
                            </div>
                            <div style={{ display: "flex", background: theme.innerBg, padding: "2px", borderRadius: "6px", border: `1px solid ${theme.border}` }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setChartViewMode("zigzag"); }}
                                style={{
                                  background: chartViewMode === "zigzag" ? theme.cardBg : "transparent",
                                  color: chartViewMode === "zigzag" ? theme.growwGreen : theme.textMuted,
                                  border: "none", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer"
                                }}
                              >
                                📈 ZigZag Trajectory
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setChartViewMode("candles"); }}
                                style={{
                                  background: chartViewMode === "candles" ? theme.cardBg : "transparent",
                                  color: chartViewMode === "candles" ? theme.growwGreen : theme.textMuted,
                                  border: "none", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer"
                                }}
                              >
                                🕯️ Mini Candles
                              </button>
                            </div>
                          </div>

                          {/* Chart Container */}
                          <div style={{ backgroundColor: theme.innerBg, padding: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, marginBottom: "12px" }}>
                            {chartViewMode === "zigzag" ? (
                              <svg viewBox="0 0 500 70" style={{ width: "100%", height: "65px", overflow: "visible" }}>
                                <polygon
                                  points={isPositive
                                    ? "10,70 10,50 110,56 220,28 340,36 440,14 490,12 490,70"
                                    : "10,70 10,16 110,12 220,44 340,36 440,58 490,60 490,70"}
                                  fill={isPositive ? "rgba(0, 208, 156, 0.18)" : "rgba(235, 91, 60, 0.18)"}
                                />
                                <polyline
                                  points={isPositive
                                    ? "10,50 110,56 220,28 340,36 440,14 490,12"
                                    : "10,16 110,12 220,44 340,36 440,58 490,60"}
                                  fill="none"
                                  stroke={isPositive ? theme.growwGreen : theme.growwRed}
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle cx="10" cy={isPositive ? 50 : 16} r="4.5" fill="#0284c7" />
                                <text x="18" y={isPositive ? 64 : 14} fill="#0284c7" fontSize="11" fontWeight="700">📍 Checkpoint: ₹{checkpointPrice}</text>
                                <circle cx="490" cy={isPositive ? 12 : 60} r="5" fill={isPositive ? theme.growwGreen : theme.growwRed} />
                                <text x="390" y={isPositive ? 10 : 66} fill={isPositive ? theme.growwGreen : theme.growwRed} fontSize="12" fontWeight="800">Live: ₹{s.price}</text>
                              </svg>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", height: "65px", padding: "0 20px" }}>
                                {candleData.map((c, i) => (
                                  <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <span style={{ fontSize: "10px", color: theme.textDim, marginBottom: "2px" }}>Phase {i + 1}</span>
                                    <div style={{ position: "relative", width: "16px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <div style={{ position: "absolute", width: "1.5px", height: "100%", background: c.green ? theme.growwGreen : theme.growwRed }} />
                                      <div style={{ width: "12px", height: "22px", background: c.green ? theme.growwGreen : theme.growwRed, borderRadius: "2px", zIndex: 2 }} />
                                    </div>
                                  </div>
                                ))}
                                <div style={{ textAlign: "right", fontSize: "11px" }}>
                                  <div style={{ color: theme.textMuted }}>Checkpoint Open: <strong style={{ color: "#0284c7" }}>₹{checkpointPrice}</strong></div>
                                  <div style={{ color: theme.textMuted }}>Current Close: <strong style={{ color: isPositive ? theme.growwGreen : theme.growwRed }}>₹{s.price}</strong></div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 4 Attribution Metrics Grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "12px" }}>
                            <div style={{ background: theme.innerBg, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${theme.border}` }}>
                              <div style={{ color: theme.textMuted }}>Volatility-Normalized Move:</div>
                              <strong style={{ color: isPositive ? theme.growwGreen : theme.growwRed }}>{s.z_price}σ ({s.pct_change}%) · 40% Wt</strong>
                            </div>
                            <div style={{ background: theme.innerBg, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${theme.border}` }}>
                              <div style={{ color: theme.textMuted }}>Volume vs 20d Average:</div>
                              <strong style={{ color: "#0284c7" }}>{s.volume_ratio}x normal volume · 35% Wt</strong>
                            </div>
                            <div style={{ background: theme.innerBg, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${theme.border}` }}>
                              <div style={{ color: theme.textMuted }}>Alpha over Benchmark:</div>
                              <strong style={{ color: s.alpha >= 0 ? theme.growwGreen : theme.growwRed }}>{s.alpha >= 0 ? "+" : ""}{s.alpha}% vs NIFTY · 25% Wt</strong>
                            </div>
                            <div style={{ background: theme.innerBg, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${theme.border}` }}>
                              <div style={{ color: theme.textMuted }}>Composite Score:</div>
                              <strong style={{ color: theme.growwGreen }}>{s.relevance_score} (Rank #{index + 1})</strong>
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
        </div>

        {/* 6. Modal: Add Stock */}
        {showAddModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px" }}>
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "24px", maxWidth: "460px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)", animation: "fadeIn 0.2s ease-out" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "17px", color: theme.text, fontWeight: "800" }}>
                  + Add Stock to Watchlist
                </h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter NSE symbol (e.g. RELIANCE, ZOMATO)..."
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: `1px solid ${theme.borderLight}`, backgroundColor: theme.innerBg, color: theme.text, fontSize: "14px", outline: "none" }}
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || !newSymbol.trim()}
                    style={{ padding: "10px 18px", background: theme.growwGreen, color: "#0c1017", border: "none", borderRadius: "8px", fontWeight: "800", fontSize: "13px", cursor: actionLoading ? "not-allowed" : "pointer" }}
                  >
                    {actionLoading ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>

              <div style={{ fontSize: "12px", color: theme.textMuted, marginBottom: "8px", fontWeight: "700" }}>
                Quick 1-Tap Suggestions:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {POPULAR_SUGGESTIONS.map((grp) => (
                  <div key={grp.sector} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: theme.textDim, width: "90px" }}>{grp.sector}:</span>
                    {grp.symbols.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleAdd(sym)}
                        style={{
                          background: sym === "PENNYTEST" ? "#fef3c7" : sym === "BROKENSTOCK" ? "#fee2e2" : theme.innerBg,
                          border: `1px solid ${theme.border}`,
                          color: sym === "PENNYTEST" ? "#b45309" : sym === "BROKENSTOCK" ? "#b91c1c" : theme.text,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        + {sym}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7. Modal: System Info */}
        {showInfoModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px" }}>
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "24px", maxWidth: "640px", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", color: theme.text, fontWeight: "800" }}>
                  ⚙️ System Details & Principles
                </h3>
                <button onClick={() => setShowInfoModal(false)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              <div style={{ display: "flex", background: theme.innerBg, padding: "4px", borderRadius: "8px", marginBottom: "16px", gap: "4px" }}>
                {[
                  { id: "principles", label: "🛡️ Principles" },
                  { id: "scaling", label: "🚀 Scaling & DB" },
                  { id: "history", label: "📜 History Logs" },
                  { id: "math", label: "💡 Scoring Math" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleOpenInfoModal(t.id)}
                    style={{
                      flex: 1, padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: infoTab === t.id ? theme.cardBg : "transparent",
                      color: infoTab === t.id ? theme.growwGreen : theme.textMuted,
                      fontWeight: "700", fontSize: "12px", cursor: "pointer"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {infoTab === "principles" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div style={{ background: theme.innerBg, padding: "12px", borderRadius: "8px", borderLeft: `3px solid ${theme.growwGreen}` }}>
                    <strong style={{ color: theme.growwGreen }}>1. Clarity Over Noise (Event-Driven Explainability)</strong>
                    <p style={{ margin: "4px 0 0 0", color: theme.textMuted }}>Standard watchlists sort by % gain. We prioritize statistical anomalies and supply 1-line plain-English catalysts.</p>
                  </div>
                  <div style={{ background: theme.innerBg, padding: "12px", borderRadius: "8px", borderLeft: "3px solid #f59e0b" }}>
                    <strong style={{ color: "#f59e0b" }}>2. Resilience (Defensive Edge Cases)</strong>
                    <p style={{ margin: "4px 0 0 0", color: theme.textMuted }}>Low liquidity microcaps (PENNYTEST) are flagged. Broken exchange feeds (BROKENSTOCK) render in-page error cards without crashing.</p>
                  </div>
                  <div style={{ background: theme.innerBg, padding: "12px", borderRadius: "8px", borderLeft: "3px solid #0284c7" }}>
                    <strong style={{ color: "#0284c7" }}>3. Transparent Attribution Math</strong>
                    <p style={{ margin: "4px 0 0 0", color: theme.textMuted }}>Every score is auditable: 40% Volatility Move + 35% Volume Surge + 25% Benchmark Alpha.</p>
                  </div>
                </div>
              )}

              {infoTab === "scaling" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div style={{ background: theme.innerBg, padding: "12px", borderRadius: "8px", borderLeft: "3px solid #0284c7" }}>
                    <strong style={{ color: "#0284c7" }}>1. In-Memory 30s TTL Caching</strong>
                    <p style={{ margin: "4px 0 0 0", color: theme.textMuted }}>Concurrent queries for identical tickers are served from cache, preventing external API rate limits while keeping data fresh.</p>
                  </div>
                  <div style={{ background: theme.innerBg, padding: "12px", borderRadius: "8px", borderLeft: "3px solid #a855f7" }}>
                    <strong style={{ color: "#a855f7" }}>2. PostgreSQL Compound B-Tree Indexing</strong>
                    <p style={{ margin: "4px 0 0 0", color: theme.textMuted }}>Supabase tables have explicit indexes on user_id, watchlist_id, and timestamps for sub-millisecond query retrieval.</p>
                  </div>
                </div>
              )}

              {infoTab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                  {sessionHistory.length === 0 ? (
                    <p style={{ color: theme.textMuted, fontSize: "13px" }}>No checkpoints saved yet. Click 'Mark as Checked' to record one.</p>
                  ) : (
                    sessionHistory.map((s, idx) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: theme.innerBg, borderRadius: "6px", fontSize: "12px" }}>
                        <span>Checkpoint #{sessionHistory.length - idx}</span>
                        <span style={{ color: theme.growwGreen }}>{new Date(s.opened_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {infoTab === "math" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div style={{ background: theme.innerBg, padding: "10px", borderRadius: "6px" }}>
                    <strong style={{ color: "#0284c7" }}>1. Unusual Price Move (40% Weight)</strong>
                    <p style={{ margin: "2px 0 0 0", color: theme.textMuted, fontSize: "12px" }}>Normalized against the stock's 20-day standard deviation.</p>
                  </div>
                  <div style={{ background: theme.innerBg, padding: "10px", borderRadius: "6px" }}>
                    <strong style={{ color: "#f59e0b" }}>2. Volume Surge (35% Weight)</strong>
                    <p style={{ margin: "2px 0 0 0", color: theme.textMuted, fontSize: "12px" }}>Today's turnover vs 20-day average volume.</p>
                  </div>
                  <div style={{ background: theme.innerBg, padding: "10px", borderRadius: "6px" }}>
                    <strong style={{ color: theme.growwGreen }}>3. Benchmark Alpha (25% Weight)</strong>
                    <p style={{ margin: "2px 0 0 0", color: theme.textMuted, fontSize: "12px" }}>Excess return over the benchmark (NIFTY 50).</p>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button
                  onClick={() => setShowInfoModal(false)}
                  style={{ background: theme.innerBg, color: theme.text, border: `1px solid ${theme.border}`, padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. Modal: Groww Instant Order Simulation Sheet */}
        {tradeModalStock && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px" }}>
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.growwGreen}`, borderRadius: "16px", padding: "24px", maxWidth: "380px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0, 208, 156, 0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ background: theme.growwGreen, color: "#0c1017", fontWeight: "900", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>GROWW</span>
                  <h3 style={{ margin: 0, fontSize: "16px", color: theme.text }}>Instant Order Sheet</h3>
                </div>
                <button onClick={() => setTradeModalStock(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              {tradeSuccessMsg ? (
                <div style={{ background: "rgba(0, 208, 156, 0.15)", border: `1px solid ${theme.growwGreen}`, color: theme.growwGreen, padding: "14px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", textAlign: "center" }}>
                  {tradeSuccessMsg}
                </div>
              ) : (
                <form onSubmit={handleExecuteGrowwTrade}>
                  <div style={{ background: theme.innerBg, padding: "12px", borderRadius: "8px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "800", color: theme.text }}>{tradeModalStock.symbol}</div>
                      <div style={{ fontSize: "11px", color: theme.textMuted }}>Anomaly Score: #{tradeModalStock.relevance_score}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "16px", fontWeight: "800", color: theme.growwGreen }}>₹{tradeModalStock.price?.toLocaleString("en-IN")}</div>
                      <div style={{ fontSize: "11px", color: tradeModalStock.pct_change >= 0 ? theme.growwGreen : theme.growwRed }}>{tradeModalStock.pct_change >= 0 ? "+" : ""}{tradeModalStock.pct_change}%</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    <button
                      type="button"
                      onClick={() => setTradeOrderType("BUY")}
                      style={{
                        flex: 1, padding: "8px", borderRadius: "6px", border: "none",
                        background: tradeOrderType === "BUY" ? theme.growwGreen : theme.innerBg,
                        color: tradeOrderType === "BUY" ? "#0c1017" : theme.textMuted,
                        fontWeight: "800", cursor: "pointer"
                      }}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeOrderType("SELL")}
                      style={{
                        flex: 1, padding: "8px", borderRadius: "6px", border: "none",
                        background: tradeOrderType === "SELL" ? theme.growwRed : theme.innerBg,
                        color: tradeOrderType === "SELL" ? "#ffffff" : theme.textMuted,
                        fontWeight: "800", cursor: "pointer"
                      }}
                    >
                      SELL
                    </button>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ display: "block", fontSize: "11px", color: theme.textMuted, marginBottom: "4px" }}>Quantity (Shares)</label>
                    <input
                      type="number"
                      min="1"
                      value={tradeQuantity}
                      onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: "6px", border: `1px solid ${theme.border}`, backgroundColor: theme.innerBg, color: theme.text, fontSize: "14px", outline: "none" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", fontSize: "12px" }}>
                    <span style={{ color: theme.textMuted }}>Total Order Value:</span>
                    <strong style={{ color: theme.text, fontSize: "15px" }}>₹{(tradeQuantity * tradeModalStock.price).toLocaleString("en-IN")}</strong>
                  </div>

                  <button
                    type="submit"
                    style={{
                      width: "100%", padding: "10px", borderRadius: "8px", border: "none",
                      background: tradeOrderType === "BUY" ? theme.growwGreen : theme.growwRed,
                      color: tradeOrderType === "BUY" ? "#0c1017" : "#ffffff",
                      fontSize: "14px", fontWeight: "800", cursor: "pointer"
                    }}
                  >
                    Confirm {tradeOrderType} on Groww
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 9. Modal: User Profile & Multi-Device Sync */}
        {showUserModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px" }}>
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "24px", maxWidth: "460px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "18px" }}>👤</span>
                  <h3 style={{ margin: 0, fontSize: "17px", color: theme.text, fontWeight: "800" }}>
                    Groww Profile & Sync
                  </h3>
                </div>
                <button onClick={() => setShowUserModal(false)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              <div style={{ background: theme.innerBg, padding: "12px 14px", borderRadius: "10px", border: `1px solid ${theme.border}`, marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: theme.textMuted }}>Active Groww Account:</div>
                <div style={{ fontSize: "15px", fontWeight: "800", color: theme.growwGreen, marginTop: "2px" }}>
                  {userId || "Not Signed In"}
                </div>
              </div>

              <form onSubmit={handleSwitchUser} style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: theme.textMuted, fontWeight: "700", marginBottom: "6px" }}>
                  Switch Account (Email / Mobile):
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    placeholder="Enter email or mobile..."
                    style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: `1px solid ${theme.border}`, backgroundColor: theme.innerBg, color: theme.text, fontSize: "13px", outline: "none" }}
                  />
                  <button
                    type="submit"
                    style={{ padding: "9px 14px", background: "#0284c7", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Switch
                  </button>
                </div>
              </form>

              <div style={{ background: theme.innerBg, padding: "12px", borderRadius: "8px", border: `1px solid ${theme.border}`, marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: "700" }}>
                    🔗 1-Click Multi-Device Sync Link
                  </span>
                  <button
                    onClick={handleCopySyncLink}
                    style={{ background: copiedSyncLink ? theme.growwGreen : theme.cardBg, color: copiedSyncLink ? "#0c1017" : theme.text, border: `1px solid ${theme.border}`, padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                  >
                    {copiedSyncLink ? "✓ Copied!" : "📋 Copy Link"}
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: theme.textMuted, wordBreak: "break-all" }}>
                  {window.location.origin}{window.location.pathname}?user={encodeURIComponent(userId || "9110679101")}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={handleSignOut}
                  style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                >
                  🚪 Sign Out
                </button>
                <button
                  onClick={() => setShowUserModal(false)}
                  style={{ background: theme.innerBg, color: theme.text, border: `1px solid ${theme.border}`, padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 10. Modal: Remove Stock Confirmation */}
        {stockToDelete && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px" }}>
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "20px", maxWidth: "380px", width: "100%" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: theme.text }}>
                Remove {stockToDelete.symbol}?
              </h3>
              <p style={{ color: theme.textMuted, fontSize: "13px", margin: "0 0 16px 0" }}>
                Remove this stock from your active watchlist?
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  onClick={() => setStockToDelete(null)}
                  style={{ background: theme.innerBg, color: theme.text, border: `1px solid ${theme.border}`, padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeRemoveStock}
                  disabled={actionLoading}
                  style={{ background: "#ef4444", color: "#fff", border: "none", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                >
                  {actionLoading ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 11. Modal: Create Watchlist */}
        {showNewWatchlistModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px" }}>
            <form onSubmit={executeCreateWatchlist} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "20px", maxWidth: "380px", width: "100%" }}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: theme.text }}>
                ➕ Create Watchlist
              </h3>
              <input
                type="text"
                autoFocus
                placeholder="e.g. My Bluechips, Tech Focus..."
                value={newWatchlistNameInput}
                onChange={(e) => setNewWatchlistNameInput(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "6px", border: `1px solid ${theme.border}`, backgroundColor: theme.innerBg, color: theme.text, fontSize: "13px", outline: "none", marginBottom: "16px" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowNewWatchlistModal(false)}
                  style={{ background: theme.innerBg, color: theme.text, border: `1px solid ${theme.border}`, padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newWatchlistNameInput.trim()}
                  style={{ background: theme.growwGreen, color: "#0c1017", border: "none", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                >
                  {actionLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 12. Auth Gate Modal */}
        {showAuthModal && (
          <AuthModal
            onLoginSuccess={(newUid, isNewSignUp) => {
              setUserId(newUid);
              setUserIdInput(newUid);
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

      </div>
    </div>
  );
}
