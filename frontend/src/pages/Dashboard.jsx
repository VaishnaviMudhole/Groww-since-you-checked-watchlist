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

const POPULAR_SUGGESTIONS = [
  { sector: "Tech", symbols: ["TCS", "INFY", "WIPRO", "ZOMATO"] },
  { sector: "Banking", symbols: ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK"] },
  { sector: "Auto & Energy", symbols: ["TATAMOTORS", "MARUTI", "RELIANCE", "HAL"] },
  { sector: "FMCG", symbols: ["ITC", "HINDUNILVR", "SUNPHARMA", "TITAN"] },
  { sector: "Demo Edge Cases", symbols: ["PENNYTEST", "BROKENSTOCK"] },
];

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
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [checkpointSaved, setCheckpointSaved] = useState(false);

  // Security & Auth
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("sw_auth_token"));

  // Cross-Device Identity
  const getInitialUserId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get("user");
    if (fromUrl) {
      localStorage.setItem("sw_user_id", fromUrl.trim());
      return fromUrl.trim();
    }
    return localStorage.getItem("sw_user_id") || "vaishnavi_groww";
  };

  const [userId, setUserId] = useState(getInitialUserId);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userIdInput, setUserIdInput] = useState(userId);
  const [copiedSyncLink, setCopiedSyncLink] = useState(false);

  // Modals & Navigation
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoTab, setInfoTab] = useState("principles");
  const [sessionHistory, setSessionHistory] = useState([]);
  const [stockToDelete, setStockToDelete] = useState(null);
  const [showNewWatchlistModal, setShowNewWatchlistModal] = useState(false);
  const [newWatchlistNameInput, setNewWatchlistNameInput] = useState("");

  // Simulated Groww Order Sheet
  const [tradeModalStock, setTradeModalStock] = useState(null);
  const [tradeQuantity, setTradeQuantity] = useState(10);
  const [tradeOrderType, setTradeOrderType] = useState("BUY");
  const [tradeSuccessMsg, setTradeSuccessMsg] = useState(null);

  // Real-time Anomaly Toast
  const [autoAlert, setAutoAlert] = useState(null);
  const [seenAnomalies, setSeenAnomalies] = useState(() => {
    try {
      const stored = sessionStorage.getItem("seen_anomaly_alerts");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // 1. Initial load
  useEffect(() => {
    setLoading(true);
    checkSystemHealth().then(setHealth);
    loadAllWatchlists(userId);
    loadSignals(null);
  }, [userId]);

  const loadAllWatchlists = (uid = userId, attempt = 0) => {
    fetchWatchlists(uid)
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
          setTimeout(() => loadAllWatchlists(uid, attempt + 1), (attempt + 1) * 2500);
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

  // Stock CRUD
  const handleAdd = async (symbolToAdd) => {
    const symbol = (symbolToAdd || newSymbol).trim().toUpperCase();
    if (!symbol || !activeWatchlist) return;

    try {
      setActionLoading(true);
      await addStockToWatchlist(activeWatchlist.id, symbol);
      setNewSymbol("");
      setShowAddModal(false);
      loadSignals(activeWatchlist.id);
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
      const created = await createWatchlist(name, userId);
      setNewWatchlistNameInput("");
      setShowNewWatchlistModal(false);
      await loadAllWatchlists(userId);
      setActiveWatchlist(created);
    } catch (err) {
      alert(`Could not create watchlist: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopySyncLink = () => {
    const syncUrl = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(userId)}`;
    navigator.clipboard.writeText(syncUrl);
    setCopiedSyncLink(true);
    setTimeout(() => setCopiedSyncLink(false), 2500);
  };

  const handleSwitchUser = (e) => {
    e.preventDefault();
    const clean = userIdInput.trim();
    if (!clean) return;
    setUserId(clean);
    localStorage.setItem("sw_user_id", clean);
    setShowUserModal(false);
    window.history.replaceState(null, "", `?user=${encodeURIComponent(clean)}`);
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
    setTradeSuccessMsg(`✓ Simulated Order Placed! ${tradeOrderType} ${tradeQuantity} shares of ${tradeModalStock.symbol} at ₹${tradeModalStock.price} via Groww Engine.`);
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

  if (showOnboarding) {
    return (
      <OnboardingWizard
        userId={userId}
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
    <div style={{ minHeight: "100vh", backgroundColor: "#0c1017", color: "#f1f5f9", padding: "20px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        .stock-row:hover { background-color: #171f30 !important; border-color: #2d3b55 !important; }
        
        @media (max-width: 768px) {
          .nav-bar { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .nav-actions { justify-content: space-between !important; overflow-x: auto !important; }
          .briefing-hero { flex-direction: column !important; align-items: stretch !important; }
          .stock-row-main { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .stock-price-block { width: 100% !important; justify-content: space-between !important; }
          .filter-bar { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>

      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        
        {/* Real-Time Breakout Toast */}
        {autoAlert && (
          <div style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#131823",
            border: "1px solid #00d09c",
            borderRadius: "14px",
            padding: "14px 18px",
            maxWidth: "360px",
            boxShadow: "0 20px 25px -5px rgba(0, 208, 156, 0.25)",
            zIndex: 10000,
            animation: "slideIn 0.3s ease-out",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px" }}>⚡</span>
                <strong style={{ color: "#00d09c", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Live Anomaly Alert
                </strong>
              </div>
              <button onClick={() => setAutoAlert(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
            <div style={{ fontSize: "14px", color: "#ffffff", fontWeight: "700", marginBottom: "4px" }}>
              {autoAlert.symbol} — {autoAlert.volume_ratio >= 1.5 ? `${autoAlert.volume_ratio}x Volume Surge` : `Significant Move (${autoAlert.pct_change >= 0 ? "+" : ""}${autoAlert.pct_change}%)`}
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.4", marginBottom: "10px" }}>
              {autoAlert.insight || `Surged ${autoAlert.volume_ratio}x volume relative to its 20d average.`}
            </div>
            <button
              onClick={() => { setTradeModalStock(autoAlert); setAutoAlert(null); }}
              style={{
                width: "100%",
                background: "#00d09c",
                color: "#0c1017",
                border: "none",
                padding: "7px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "800",
                cursor: "pointer",
              }}
            >
              ⚡ Instant Trade on Groww
            </button>
          </div>
        )}

        {/* 1. Sleek Modern Top Navigation Bar */}
        <nav className="nav-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #1a2233", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "linear-gradient(135deg, #00d09c 0%, #0284c7 100%)", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c1017", fontWeight: "900", fontSize: "16px" }}>
                ⚡
              </div>
              <span style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.3px" }}>
                Since You Checked
              </span>
            </div>

            {/* Watchlist selector */}
            <div style={{ display: "flex", alignItems: "center", background: "#131823", borderRadius: "8px", border: "1px solid #202b3d", padding: "2px 6px" }}>
              <select
                value={activeWatchlist?.id || ""}
                onChange={(e) => {
                  const selected = watchlists.find((w) => w.id === e.target.value);
                  if (selected) setActiveWatchlist(selected);
                }}
                style={{
                  background: "transparent",
                  color: "#38bdf8",
                  border: "none",
                  padding: "6px 8px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id} style={{ background: "#131823", color: "#fff" }}>{w.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowNewWatchlistModal(true)}
                title="Create New Watchlist"
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px 8px", fontSize: "14px", fontWeight: "700" }}
              >
                +
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Market Status Pill */}
            <div style={{ background: "#131823", border: "1px solid #1e293b", padding: "6px 10px", borderRadius: "20px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: data?.market?.is_open ? "#00d09c" : "#64748b" }} />
              <span style={{ color: "#94a3b8", fontWeight: "600" }}>{data?.market?.is_open ? "Live Market" : "Market Closed"}</span>
            </div>

            {/* Add Stock Button */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: "#00d09c",
                color: "#0c1017",
                border: "none",
                padding: "7px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>+</span>
              <span>Add Stock</span>
            </button>

            {/* User & PIN Auth */}
            <button
              onClick={() => setShowUserModal(true)}
              title="Switch User / Sync across devices"
              style={{
                background: "#131823",
                border: "1px solid #202b3d",
                color: "#38bdf8",
                padding: "7px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>👤</span>
              <span>{userId}</span>
            </button>

            <button
              onClick={() => setShowAuthModal(true)}
              title="Sign In or Change PIN Security"
              style={{
                background: "#131823",
                border: "1px solid #202b3d",
                color: "#94a3b8",
                padding: "7px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              🔐 Auth
            </button>

            {/* System Info / Details Modal */}
            <button
              onClick={() => handleOpenInfoModal("principles")}
              title="Engineering Principles, System Scaling & History"
              style={{
                background: "#131823",
                border: "1px solid #202b3d",
                color: "#94a3b8",
                padding: "7px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              ⚙️ Info
            </button>
          </div>
        </nav>

        {/* 2. Hero: Executive Briefing & Checkpoint */}
        {data?.executive_briefing && (
          <div className="briefing-hero" style={{
            background: "linear-gradient(135deg, #131823 0%, #172336 100%)",
            border: "1px solid #223147",
            borderRadius: "14px",
            padding: "18px 20px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
            animation: "fadeIn 0.2s ease-out",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#00d09c", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  ⚡ Market Briefing
                </span>
                {data?.benchmark && (
                  <span style={{ fontSize: "11px", background: "#0c1017", padding: "2px 8px", borderRadius: "6px", color: data.benchmark.pct_change >= 0 ? "#00d09c" : "#f87171", fontWeight: "700" }}>
                    NIFTY 50: {data.benchmark.pct_change >= 0 ? "+" : ""}{data.benchmark.pct_change}%
                  </span>
                )}
              </div>
              <p style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "500", color: "#ffffff", lineHeight: "1.5" }}>
                {data.executive_briefing}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={handleSpeakBriefing}
                  style={{
                    background: isSpeaking ? "rgba(239, 68, 68, 0.15)" : "#0c1017",
                    border: isSpeaking ? "1px solid #ef4444" : "1px solid #202b3d",
                    color: isSpeaking ? "#f87171" : "#94a3b8",
                    padding: "4px 10px",
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
                    background: copiedSummary ? "rgba(0, 208, 156, 0.15)" : "#0c1017",
                    border: copiedSummary ? "1px solid #00d09c" : "1px solid #202b3d",
                    color: copiedSummary ? "#00d09c" : "#94a3b8",
                    padding: "4px 10px",
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
              title="Click to mark all updates as checked so your next visit tracks fresh changes"
              style={{
                background: checkpointSaved ? "#00d09c" : "#0284c7",
                color: checkpointSaved ? "#0c1017" : "#ffffff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "800",
                cursor: actionLoading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                transition: "all 0.15s ease",
              }}
            >
              {checkpointSaved ? "✓ Checkpoint Saved!" : `✓ Mark as Checked (${formatLastChecked(data?.last_checked_at)})`}
            </button>
          </div>
        )}

        {/* 3. Streamlined Search, Sector Filter & Sort Bar */}
        <div className="filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: 1 }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="🔍 Search stocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "#131823",
                border: "1px solid #202b3d",
                padding: "7px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#ffffff",
                outline: "none",
                width: "150px",
              }}
            />

            {/* Sector Tabs */}
            <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
              {["ALL", "Tech", "Banking", "Auto", "Defense", "FMCG"].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setActiveSectorFilter(sec)}
                  style={{
                    background: activeSectorFilter === sec ? "#00d09c" : "#131823",
                    color: activeSectorFilter === sec ? "#0c1017" : "#94a3b8",
                    border: "1px solid #202b3d",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                  }}
                >
                  {sec === "ALL" ? "All Sectors" : sec}
                </button>
              ))}
            </div>

            <span style={{ fontSize: "12px", color: "#64748b" }}>
              ({sortedStocks.length})
            </span>
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: "#131823",
                color: "#ffffff",
                border: "1px solid #202b3d",
                padding: "6px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="relevance">⚡ Most Active (Anomaly Score)</option>
              <option value="pct_desc">📈 Top Gainers (%)</option>
              <option value="pct_asc">📉 Top Losers (%)</option>
              <option value="volume">🔥 Volume Surge</option>
              <option value="alpha">🎯 Alpha (Beating Market)</option>
            </select>

            <button
              onClick={() => {
                checkSystemHealth().then(setHealth);
                if (activeWatchlist) loadSignals(activeWatchlist.id);
              }}
              disabled={loading}
              title="Refresh live data"
              style={{
                background: "#131823",
                border: "1px solid #202b3d",
                color: "#38bdf8",
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

        {/* 4. Stock List Cards (Clean, Minimalist Groww Style) */}
        {loading && !data ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "#131823", borderRadius: "12px", border: "1px solid #202b3d", margin: "20px 0" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚡</div>
            <h3 style={{ color: "#ffffff", fontSize: "15px", margin: "0 0 4px 0" }}>Connecting to Anomaly Engine</h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>Syncing with Supabase & calculating real-time rankings...</p>
          </div>
        ) : sortedStocks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", background: "#131823", borderRadius: "12px", border: "1px dashed #202b3d" }}>
            <p style={{ color: "#94a3b8", fontSize: "15px", marginBottom: "12px" }}>No stocks in this view.</p>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: "#00d09c",
                color: "#0c1017",
                border: "none",
                padding: "8px 18px",
                borderRadius: "8px",
                fontWeight: "800",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              + Add Stocks to Watchlist
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {sortedStocks.map((s, index) => {
              // Unhappy path / Data unavailable
              if (s.status === "error" || s.price === null) {
                return (
                  <div
                    key={s.symbol}
                    className="stock-row"
                    style={{
                      padding: "14px 18px",
                      background: "#131823",
                      borderRadius: "12px",
                      border: "1px solid #7f1d1d",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b" }}>#{index + 1}</span>
                      <strong style={{ fontSize: "16px", color: "#f87171" }}>{s.symbol}</strong>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", fontWeight: "700" }}>
                        ⚠️ Data Unavailable
                      </span>
                    </div>
                    <button
                      onClick={() => setStockToDelete({ symbol: s.symbol, itemId: s.watchlist_item_id })}
                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px" }}
                    >
                      ✕
                    </button>
                  </div>
                );
              }

              const isPositive = s.pct_change >= 0;
              const isExpanded = expandedStockSymbol === s.symbol;

              return (
                <div
                  key={s.symbol}
                  className="stock-row"
                  style={{
                    background: "#131823",
                    borderRadius: "12px",
                    border: "1px solid #202b3d",
                    padding: "14px 18px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    animation: "fadeIn 0.15s ease-out",
                  }}
                  onClick={() => setExpandedStockSymbol(isExpanded ? null : s.symbol)}
                >
                  <div className="stock-row-main" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    
                    {/* Left: Rank, Symbol, Sector & Plain-English Reason */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", width: "20px" }}>
                        #{index + 1}
                      </span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                          <span style={{ fontSize: "16px", fontWeight: "800", color: "#ffffff" }}>{s.symbol}</span>
                          <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "4px", background: "#0c1017", color: "#94a3b8", fontWeight: "600" }}>
                            {s.sector || "Equity"}
                          </span>
                          {s.is_illiquid && (
                            <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "#78350f", color: "#fef3c7", fontWeight: "700" }}>
                              Low Liquidity
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.3" }}>
                          {s.insight || `Traded at ${s.volume_ratio}x typical 20d volume`}
                        </div>
                      </div>
                    </div>

                    {/* Right: Sparkline, Price, Change Badge, Trade Button */}
                    <div className="stock-price-block" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      
                      {/* Micro Sparkline */}
                      <div style={{ width: "70px", height: "24px" }}>
                        <svg viewBox="0 0 100 30" style={{ width: "100%", height: "100%" }}>
                          <path
                            d={isPositive ? "M 5 24 Q 45 18, 95 6" : "M 5 6 Q 45 14, 95 24"}
                            fill="none"
                            stroke={isPositive ? "#00d09c" : "#EB5B3C"}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      {/* Price & Change Badge */}
                      <div style={{ textAlign: "right", minWidth: "90px" }}>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#ffffff" }}>
                          ₹{s.price?.toLocaleString("en-IN")}
                        </div>
                        <div style={{
                          display: "inline-block",
                          fontSize: "11px",
                          fontWeight: "800",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: isPositive ? "rgba(0, 208, 156, 0.15)" : "rgba(235, 91, 60, 0.15)",
                          color: isPositive ? "#00d09c" : "#EB5B3C",
                        }}>
                          {isPositive ? "+" : ""}{s.pct_change}%
                        </div>
                      </div>

                      {/* Groww Instant Trade Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTradeModalStock(s);
                        }}
                        style={{
                          background: "#00d09c",
                          color: "#0c1017",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "800",
                          cursor: "pointer",
                        }}
                      >
                        Trade
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStockToDelete({ symbol: s.symbol, itemId: s.watchlist_item_id });
                        }}
                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Expanded Transparent Attribution Math Details */}
                  {isExpanded && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #202b3d", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "12px", animation: "fadeIn 0.15s ease-out" }}>
                      <div style={{ background: "#0c1017", padding: "8px 10px", borderRadius: "6px" }}>
                        <div style={{ color: "#94a3b8" }}>Price vs Previous Checkpoint:</div>
                        <strong style={{ color: isPositive ? "#00d09c" : "#EB5B3C" }}>₹{s.prev_close} → ₹{s.price} ({isPositive ? "+" : ""}{s.pct_change}%)</strong>
                      </div>
                      <div style={{ background: "#0c1017", padding: "8px 10px", borderRadius: "6px" }}>
                        <div style={{ color: "#94a3b8" }}>Volume Activity:</div>
                        <strong style={{ color: "#38bdf8" }}>{s.volume_ratio}x 20-day average</strong>
                      </div>
                      <div style={{ background: "#0c1017", padding: "8px 10px", borderRadius: "6px" }}>
                        <div style={{ color: "#94a3b8" }}>Alpha (vs Market):</div>
                        <strong style={{ color: s.alpha >= 0 ? "#00d09c" : "#f87171" }}>{s.alpha >= 0 ? "+" : ""}{s.alpha}%</strong>
                      </div>
                      <div style={{ background: "#0c1017", padding: "8px 10px", borderRadius: "6px" }}>
                        <div style={{ color: "#94a3b8" }}>Composite Anomaly Score:</div>
                        <strong style={{ color: "#00d09c" }}>{s.relevance_score} (40% Vol + 35% VolSurge + 25% Alpha)</strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Clean Modal: Add Stock */}
        {showAddModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "16px"
          }}>
            <div style={{
              background: "#131823", border: "1px solid #202b3d", borderRadius: "16px",
              padding: "24px", maxWidth: "460px", width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)", animation: "fadeIn 0.2s ease-out"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#ffffff", fontWeight: "800" }}>
                  + Add Stock to Watchlist
                </h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter NSE symbol (e.g. RELIANCE, ZOMATO)..."
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: "8px",
                      border: "1px solid #334155", backgroundColor: "#0c1017",
                      color: "#ffffff", fontSize: "14px", outline: "none"
                    }}
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || !newSymbol.trim()}
                    style={{
                      padding: "10px 18px", background: "#00d09c", color: "#0c1017",
                      border: "none", borderRadius: "8px", fontWeight: "800",
                      fontSize: "13px", cursor: actionLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    {actionLoading ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>

              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", fontWeight: "700" }}>
                Quick 1-Tap Suggestions:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {POPULAR_SUGGESTIONS.map((grp) => (
                  <div key={grp.sector} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", width: "90px" }}>{grp.sector}:</span>
                    {grp.symbols.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleAdd(sym)}
                        style={{
                          background: sym === "PENNYTEST" ? "#78350f" : sym === "BROKENSTOCK" ? "#7f1d1d" : "#0c1017",
                          border: "1px solid #202b3d",
                          color: sym === "PENNYTEST" ? "#fef3c7" : sym === "BROKENSTOCK" ? "#fecaca" : "#cbd5e1",
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

        {/* 6. Clean Modal: System & Info (Tabbed Principles, Scaling, History, Scoring) */}
        {showInfoModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "16px"
          }}>
            <div style={{
              background: "#131823", border: "1px solid #202b3d", borderRadius: "16px",
              padding: "24px", maxWidth: "640px", width: "100%", maxHeight: "85vh",
              overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#ffffff", fontWeight: "800" }}>
                  ⚙️ System Details & Principles
                </h3>
                <button onClick={() => setShowInfoModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", background: "#0c1017", padding: "4px", borderRadius: "8px", marginBottom: "16px", gap: "4px" }}>
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
                      background: infoTab === t.id ? "#1e293b" : "transparent",
                      color: infoTab === t.id ? "#00d09c" : "#94a3b8",
                      fontWeight: "700", fontSize: "12px", cursor: "pointer"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              {infoTab === "principles" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div style={{ background: "#0c1017", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #00d09c" }}>
                    <strong style={{ color: "#00d09c" }}>1. Clarity Over Noise (Event-Driven Explainability)</strong>
                    <p style={{ margin: "4px 0 0 0", color: "#cbd5e1" }}>Standard watchlists sort by % gain. We prioritize statistical anomalies and supply 1-line plain-English catalysts.</p>
                  </div>
                  <div style={{ background: "#0c1017", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #f59e0b" }}>
                    <strong style={{ color: "#f59e0b" }}>2. Resilience (Defensive Edge Cases)</strong>
                    <p style={{ margin: "4px 0 0 0", color: "#cbd5e1" }}>Low liquidity microcaps (PENNYTEST) are flagged. Broken exchange feeds (BROKENSTOCK) render in-page error cards without crashing.</p>
                  </div>
                  <div style={{ background: "#0c1017", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #38bdf8" }}>
                    <strong style={{ color: "#38bdf8" }}>3. Transparent Attribution Math</strong>
                    <p style={{ margin: "4px 0 0 0", color: "#cbd5e1" }}>Every score is auditable: 40% Volatility Move + 35% Volume Surge + 25% Benchmark Alpha.</p>
                  </div>
                </div>
              )}

              {infoTab === "scaling" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div style={{ background: "#0c1017", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #38bdf8" }}>
                    <strong style={{ color: "#38bdf8" }}>1. In-Memory 30s TTL Caching</strong>
                    <p style={{ margin: "4px 0 0 0", color: "#cbd5e1" }}>Concurrent queries for identical tickers are served from cache, preventing external API rate limits while keeping data fresh.</p>
                  </div>
                  <div style={{ background: "#0c1017", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #a855f7" }}>
                    <strong style={{ color: "#c084fc" }}>2. PostgreSQL Compound B-Tree Indexing</strong>
                    <p style={{ margin: "4px 0 0 0", color: "#cbd5e1" }}>Supabase tables have explicit indexes on user_id, watchlist_id, and timestamps for sub-millisecond query retrieval.</p>
                  </div>
                </div>
              )}

              {infoTab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                  {sessionHistory.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: "13px" }}>No checkpoints saved yet. Click 'Mark as Checked' to record one.</p>
                  ) : (
                    sessionHistory.map((s, idx) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#0c1017", borderRadius: "6px", fontSize: "12px" }}>
                        <span>Checkpoint #{sessionHistory.length - idx}</span>
                        <span style={{ color: "#00d09c" }}>{new Date(s.opened_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {infoTab === "math" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div style={{ background: "#0c1017", padding: "10px", borderRadius: "6px" }}>
                    <strong style={{ color: "#38bdf8" }}>1. Unusual Price Move (40% Weight)</strong>
                    <p style={{ margin: "2px 0 0 0", color: "#cbd5e1", fontSize: "12px" }}>Normalized against the stock's 20-day standard deviation.</p>
                  </div>
                  <div style={{ background: "#0c1017", padding: "10px", borderRadius: "6px" }}>
                    <strong style={{ color: "#fbbf24" }}>2. Volume Surge (35% Weight)</strong>
                    <p style={{ margin: "2px 0 0 0", color: "#cbd5e1", fontSize: "12px" }}>Today's turnover vs 20-day average volume.</p>
                  </div>
                  <div style={{ background: "#0c1017", padding: "10px", borderRadius: "6px" }}>
                    <strong style={{ color: "#00d09c" }}>3. Benchmark Alpha (25% Weight)</strong>
                    <p style={{ margin: "2px 0 0 0", color: "#cbd5e1", fontSize: "12px" }}>Excess return over the benchmark (NIFTY 50).</p>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button
                  onClick={() => setShowInfoModal(false)}
                  style={{ background: "#1e293b", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. Modal: Groww Instant Order Simulation Sheet */}
        {tradeModalStock && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "16px"
          }}>
            <div style={{
              background: "#131823", border: "1px solid #00d09c", borderRadius: "16px",
              padding: "24px", maxWidth: "380px", width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 208, 156, 0.2)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ background: "#00d09c", color: "#0c1017", fontWeight: "900", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>GROWW</span>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#ffffff" }}>Instant Order Sheet</h3>
                </div>
                <button onClick={() => setTradeModalStock(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              {tradeSuccessMsg ? (
                <div style={{ background: "rgba(0, 208, 156, 0.15)", border: "1px solid #00d09c", color: "#00d09c", padding: "14px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", textAlign: "center" }}>
                  {tradeSuccessMsg}
                </div>
              ) : (
                <form onSubmit={handleExecuteGrowwTrade}>
                  <div style={{ background: "#0c1017", padding: "12px", borderRadius: "8px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "800", color: "#ffffff" }}>{tradeModalStock.symbol}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>Score: #{tradeModalStock.relevance_score}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "16px", fontWeight: "800", color: "#00d09c" }}>₹{tradeModalStock.price?.toLocaleString("en-IN")}</div>
                      <div style={{ fontSize: "11px", color: tradeModalStock.pct_change >= 0 ? "#00d09c" : "#f87171" }}>{tradeModalStock.pct_change >= 0 ? "+" : ""}{tradeModalStock.pct_change}%</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    <button
                      type="button"
                      onClick={() => setTradeOrderType("BUY")}
                      style={{
                        flex: 1, padding: "8px", borderRadius: "6px", border: "none",
                        background: tradeOrderType === "BUY" ? "#00d09c" : "#1e293b",
                        color: tradeOrderType === "BUY" ? "#0c1017" : "#94a3b8",
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
                        background: tradeOrderType === "SELL" ? "#ef4444" : "#1e293b",
                        color: tradeOrderType === "SELL" ? "#ffffff" : "#94a3b8",
                        fontWeight: "800", cursor: "pointer"
                      }}
                    >
                      SELL
                    </button>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>Quantity (Shares)</label>
                    <input
                      type="number"
                      min="1"
                      value={tradeQuantity}
                      onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: "100%", boxSizing: "border-box", padding: "8px 12px",
                        borderRadius: "6px", border: "1px solid #334155",
                        backgroundColor: "#0c1017", color: "#ffffff", fontSize: "14px", outline: "none"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", fontSize: "12px" }}>
                    <span style={{ color: "#94a3b8" }}>Total Order Value:</span>
                    <strong style={{ color: "#ffffff", fontSize: "15px" }}>₹{(tradeQuantity * tradeModalStock.price).toLocaleString("en-IN")}</strong>
                  </div>

                  <button
                    type="submit"
                    style={{
                      width: "100%", padding: "10px", borderRadius: "8px", border: "none",
                      background: tradeOrderType === "BUY" ? "#00d09c" : "#ef4444",
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

        {/* 8. Modal: User / Cross-Device Sync */}
        {showUserModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "16px"
          }}>
            <div style={{
              background: "#131823", border: "1px solid #202b3d", borderRadius: "16px",
              padding: "24px", maxWidth: "460px", width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "18px" }}>👤</span>
                  <h3 style={{ margin: 0, fontSize: "17px", color: "#ffffff", fontWeight: "800" }}>
                    User Profile & Multi-Device Sync
                  </h3>
                </div>
                <button onClick={() => setShowUserModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>

              <form onSubmit={handleSwitchUser} style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", fontWeight: "700", marginBottom: "6px" }}>
                  Active User Identity:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    placeholder="Enter user ID (e.g. vaishnavi_groww)..."
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: "8px",
                      border: "1px solid #334155", backgroundColor: "#0c1017",
                      color: "#ffffff", fontSize: "13px", outline: "none"
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "9px 14px", background: "#0284c7", color: "#ffffff",
                      border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer"
                    }}
                  >
                    Switch
                  </button>
                </div>
              </form>

              <div style={{ background: "#0c1017", padding: "12px", borderRadius: "8px", border: "1px solid #202b3d", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700" }}>
                    🔗 1-Click Multi-Device Sync Link
                  </span>
                  <button
                    onClick={handleCopySyncLink}
                    style={{
                      background: copiedSyncLink ? "#00d09c" : "#1e293b",
                      color: copiedSyncLink ? "#0c1017" : "#ffffff",
                      border: "none", padding: "3px 8px", borderRadius: "4px",
                      fontSize: "11px", fontWeight: "700", cursor: "pointer"
                    }}
                  >
                    {copiedSyncLink ? "✓ Copied!" : "📋 Copy Link"}
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", wordBreak: "break-all" }}>
                  {window.location.origin}{window.location.pathname}?user={encodeURIComponent(userId)}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowUserModal(false)}
                  style={{ background: "#1e293b", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 9. Modal: Remove Stock Confirmation */}
        {stockToDelete && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "16px"
          }}>
            <div style={{
              background: "#131823", border: "1px solid #202b3d", borderRadius: "14px",
              padding: "20px", maxWidth: "380px", width: "100%"
            }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#ffffff" }}>
                Remove {stockToDelete.symbol}?
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 16px 0" }}>
                Remove this stock from your active watchlist?
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  onClick={() => setStockToDelete(null)}
                  style={{ background: "#1e293b", color: "#cbd5e1", border: "none", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
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

        {/* 10. Modal: Create Watchlist */}
        {showNewWatchlistModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "16px"
          }}>
            <form
              onSubmit={executeCreateWatchlist}
              style={{
                background: "#131823", border: "1px solid #202b3d", borderRadius: "14px",
                padding: "20px", maxWidth: "380px", width: "100%"
              }}
            >
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#ffffff" }}>
                ➕ Create Watchlist
              </h3>
              <input
                type="text"
                autoFocus
                placeholder="e.g. My Bluechips, Tech Growth..."
                value={newWatchlistNameInput}
                onChange={(e) => setNewWatchlistNameInput(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box", padding: "9px 12px",
                  borderRadius: "6px", border: "1px solid #334155", backgroundColor: "#0c1017",
                  color: "#ffffff", fontSize: "13px", outline: "none", marginBottom: "16px"
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowNewWatchlistModal(false)}
                  style={{ background: "#1e293b", color: "#cbd5e1", border: "none", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newWatchlistNameInput.trim()}
                  style={{ background: "#00d09c", color: "#0c1017", border: "none", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                >
                  {actionLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 11. Security Auth Modal */}
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
            onClose={() => setShowAuthModal(false)}
            canClose={true}
          />
        )}

      </div>
    </div>
  );
}
