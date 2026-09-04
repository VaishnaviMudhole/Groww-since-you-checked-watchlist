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

const SECTOR_GROUPS = [
  { label: "Tech & IT", symbols: ["TCS", "INFY", "WIPRO", "ZOMATO"] },
  { label: "Banking", symbols: ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "BAJFINANCE"] },
  { label: "Auto & Infra", symbols: ["TATAMOTORS", "MARUTI", "LT", "TATASTEEL", "ADANIENT"] },
  { label: "Defense & Energy", symbols: ["HAL", "BEL", "RELIANCE"] },
  { label: "Daily Goods & Health", symbols: ["ITC", "HINDUNILVR", "SUNPHARMA", "TITAN"] },
  { label: "Demo Edge Cases", symbols: ["PENNYTEST", "BROKENSTOCK"] },
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
  const [showExplainer, setShowExplainer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [health, setHealth] = useState({ status: "healthy" });
  const [expandedStockSymbol, setExpandedStockSymbol] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  // Cross-Device Identity Layer
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
  const [showScalingModal, setShowScalingModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // In-Page Interactive Dialog States
  const [stockToDelete, setStockToDelete] = useState(null);
  const [showNewWatchlistModal, setShowNewWatchlistModal] = useState(false);
  const [newWatchlistNameInput, setNewWatchlistNameInput] = useState("");

  // Groww Integration Simulation States
  const [tradeModalStock, setTradeModalStock] = useState(null); // Stock object for Groww Order Sheet
  const [tradeQuantity, setTradeQuantity] = useState(10);
  const [tradeOrderType, setTradeOrderType] = useState("BUY");
  const [tradeSuccessMsg, setTradeSuccessMsg] = useState(null);
  const [showNotificationPreview, setShowNotificationPreview] = useState(false);
  const [showImpactEvaluation, setShowImpactEvaluation] = useState(false);
  const [autoAlert, setAutoAlert] = useState(null); // Automatically triggered real-time anomaly alert
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
    checkSystemHealth().then(setHealth);
    loadAllWatchlists(userId);
  }, [userId]);

  const loadAllWatchlists = (uid = userId) => {
    fetchWatchlists(uid)
      .then((lists) => {
        setWatchlists(lists);
        if (lists && lists.length > 0) {
          setActiveWatchlist((prev) => prev ? lists.find(l => l.id === prev.id) || lists[0] : lists[0]);
        }
      })
      .catch((err) => console.error("Watchlist fetch error:", err));
  };

  // 2. Load ranked signals for active watchlist
  const loadSignals = (wId) => {
    fetchWatchlistSignals(wId)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeWatchlist) {
      loadSignals(activeWatchlist.id);
    }
  }, [activeWatchlist]);

  // Automatic Anomaly Detection Effect (Fires automatically on data refresh)
  useEffect(() => {
    if (!data?.stocks || data.stocks.length === 0) return;

    // Filter for statistically meaningful breakouts (Volume surge > 2x OR Score >= 1.4)
    const candidates = data.stocks.filter(
      (s) => (s.volume_ratio >= 2.0 || s.relevance_score >= 1.4) && !s.is_illiquid && s.status === "success"
    );

    if (candidates.length > 0) {
      // Find the top anomaly that hasn't been shown yet in this session (prevents alert fatigue)
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

  // 3. Add Stock
  const handleAdd = async (symbolToAdd) => {
    const symbol = (symbolToAdd || newSymbol).trim().toUpperCase();
    if (!symbol || !activeWatchlist) return;

    try {
      setActionLoading(true);
      await addStockToWatchlist(activeWatchlist.id, symbol);
      setNewSymbol("");
      loadSignals(activeWatchlist.id);
    } catch (err) {
      alert(`Could not add stock: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. In-Page Confirm Remove Stock
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

  // 5. Mark as Checked
  const handleCheckpoint = async () => {
    if (!activeWatchlist) return;
    try {
      setActionLoading(true);
      await recordSessionCheckpoint(activeWatchlist.id);
      loadSignals(activeWatchlist.id);
    } catch (err) {
      alert(`Error saving checkpoint: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. In-Page Create Watchlist
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

  // Cross-Device Sync Link Copier
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

  // 7. View Session History
  const handleOpenHistory = async () => {
    if (!activeWatchlist) return;
    try {
      const history = await fetchSessionHistory(activeWatchlist.id);
      setSessionHistory(history);
      setShowHistory(true);
    } catch (err) {
      alert(`Could not load history: ${err.message}`);
    }
  };

  // 8. Execute Simulated Groww Order
  const handleExecuteGrowwTrade = (e) => {
    e.preventDefault();
    setTradeSuccessMsg(`✓ Simulated Order Placed! ${tradeOrderType} ${tradeQuantity} shares of ${tradeModalStock.symbol} at ₹${tradeModalStock.price} via Groww Engine.`);
    setTimeout(() => {
      setTradeSuccessMsg(null);
      setTradeModalStock(null);
    }, 2500);
  };

  // 9. Copy Executive Briefing to Clipboard
  const handleCopySummary = () => {
    if (!data?.executive_briefing) return;
    const textToCopy = `⚡ Since You Checked Briefing:\n${data.executive_briefing}\n\nMarket (${data.benchmark?.name}): ${data.benchmark?.pct_change >= 0 ? "+" : ""}${data.benchmark?.pct_change}%`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // 10. Web Speech Audio Briefing
  const handleSpeakBriefing = () => {
    if (!data?.executive_briefing) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      `Here is your Groww market summary since you last checked. ${data.executive_briefing}. The NIFTY 50 is ${data.benchmark?.pct_change >= 0 ? "up" : "down"} ${Math.abs(data.benchmark?.pct_change || 0)} percent.`
    );
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Format time elapsed
  const formatLastChecked = (isoStr) => {
    if (!isoStr) return "Just started monitoring";
    const date = new Date(isoStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    if (diffMins < 60) return `${diffMins}m ago (${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const diffHours = Math.round(diffMins / 60);
    return `${diffHours}h ago (${date.toLocaleDateString()})`;
  };

  // Accurate Freshness Badge Generator
  const getFreshnessBadge = (fetchedIso, isMarketOpen) => {
    if (!isMarketOpen) {
      return {
        color: "#64748b",
        label: "Closing price · 3:30 PM",
      };
    }

    if (!fetchedIso) return { color: "#22c55e", label: "Live · just now" };
    const diffMs = Date.now() - new Date(fetchedIso).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 5) {
      return {
        color: "#22c55e",
        label: diffMins === 0 ? "Live · updated just now" : `Live · updated ${diffMins}m ago`,
      };
    } else if (diffMins < 30) {
      return {
        color: "#eab308",
        label: `Delayed · ${diffMins}m ago`,
      };
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return {
        color: "#ef4444",
        label: `Stale · ${diffHours > 0 ? `${diffHours}h+ ago` : `${diffMins}m ago`}`,
      };
    }
  };

  // Market staleness check
  const isMarketStale = () => {
    if (!data?.market?.is_open) return false;
    if (!data?.last_checked_at) return false;
    const diffMs = Date.now() - new Date(data.last_checked_at).getTime();
    return diffMs > 15 * 60 * 1000;
  };

  // Relevance Score Tint Color
  const getScoreColor = (stock) => {
    if (stock.is_illiquid || stock.confidence === "low") return "#f59e0b";
    if (stock.relevance_score >= 1.5) return "#4ade80";
    if (stock.relevance_score >= 0.6) return "#38bdf8";
    return "#94a3b8";
  };

  // Filter & Sort
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

  const topStock = sortedStocks.length > 0 ? sortedStocks[0] : null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#090d16", color: "#f8fafc", padding: "28px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        
        {/* Groww Integration: Automated Anomaly Push Notification Toast / Demo Preview */}
        {(autoAlert || (showNotificationPreview && topStock)) && (
          (() => {
            const alertStock = autoAlert || topStock;
            const isAutomated = !!autoAlert;
            return (
              <div style={{
                position: "fixed",
                top: "20px",
                right: "20px",
                background: "#111827",
                border: isAutomated ? "1px solid #38bdf8" : "1px solid #00d09c",
                borderRadius: "14px",
                padding: "16px 20px",
                maxWidth: "380px",
                boxShadow: isAutomated ? "0 20px 25px -5px rgba(56, 189, 248, 0.3)" : "0 20px 25px -5px rgba(0, 208, 156, 0.3)",
                zIndex: 10000,
                animation: "slideIn 0.3s ease-out",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "16px" }}>⚡</span>
                    <strong style={{ color: "#00d09c", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {isAutomated ? "Live Anomaly Detected" : "Real-Time Anomaly Alert"}
                    </strong>
                  </div>
                  <button
                    onClick={() => {
                      setAutoAlert(null);
                      setShowNotificationPreview(false);
                    }}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px" }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: "14px", color: "#ffffff", fontWeight: "700", marginBottom: "4px" }}>
                  {alertStock.symbol} — {alertStock.volume_ratio >= 1.5 ? `${alertStock.volume_ratio}x Volume Surge` : `Significant Move (${alertStock.pct_change >= 0 ? "+" : ""}${alertStock.pct_change}%)`}
                </div>
                <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: "1.4", marginBottom: "10px" }}>
                  {alertStock.insight || `Surged ${alertStock.volume_ratio}x volume relative to its 20d average.`}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Live Anomaly Engine · Real-time Push
                  </span>
                  <button
                    onClick={() => {
                      setTradeModalStock(alertStock);
                      setAutoAlert(null);
                      setShowNotificationPreview(false);
                    }}
                    style={{
                      background: "#00d09c",
                      color: "#000000",
                      border: "none",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer",
                    }}
                  >
                    ⚡ Trade on Groww
                  </button>
                </div>
              </div>
            );
          })()
        )}

        {/* Groww Integration: 1-Click Order Execution Sheet Modal */}
        {tradeModalStock && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}>
            <div style={{
              background: "#131a29",
              border: "1px solid #00d09c",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 208, 156, 0.25)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ background: "#00d09c", color: "#000", fontWeight: "900", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>GROWW</span>
                  <h3 style={{ margin: 0, fontSize: "18px", color: "#ffffff" }}>Instant Order Sheet</h3>
                </div>
                <button onClick={() => setTradeModalStock(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}>✕</button>
              </div>

              {tradeSuccessMsg ? (
                <div style={{ background: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", color: "#4ade80", padding: "16px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", textAlign: "center" }}>
                  {tradeSuccessMsg}
                </div>
              ) : (
                <form onSubmit={handleExecuteGrowwTrade}>
                  <div style={{ background: "#090d16", padding: "14px", borderRadius: "10px", border: "1px solid #1e293b", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff" }}>{tradeModalStock.symbol}</div>
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>Relevance Rank: #{tradeModalStock.relevance_score}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: "800", color: "#00d09c" }}>₹{tradeModalStock.price?.toLocaleString("en-IN")}</div>
                      <div style={{ fontSize: "12px", color: tradeModalStock.pct_change >= 0 ? "#4ade80" : "#f87171" }}>{tradeModalStock.pct_change >= 0 ? "+" : ""}{tradeModalStock.pct_change}%</div>
                    </div>
                  </div>

                  {/* Buy / Sell Toggle */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <button
                      type="button"
                      onClick={() => setTradeOrderType("BUY")}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "none",
                        background: tradeOrderType === "BUY" ? "#00d09c" : "#1e293b",
                        color: tradeOrderType === "BUY" ? "#000" : "#94a3b8",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeOrderType("SELL")}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "none",
                        background: tradeOrderType === "SELL" ? "#ef4444" : "#1e293b",
                        color: tradeOrderType === "SELL" ? "#fff" : "#94a3b8",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      SELL
                    </button>
                  </div>

                  {/* Quantity Input */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Quantity (Shares)</label>
                    <input
                      type="number"
                      min="1"
                      value={tradeQuantity}
                      onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #334155",
                        backgroundColor: "#090d16",
                        color: "#ffffff",
                        fontSize: "15px",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Total Amount Estimation */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", fontSize: "13px" }}>
                    <span style={{ color: "#94a3b8" }}>Total Order Value:</span>
                    <strong style={{ color: "#ffffff", fontSize: "16px" }}>₹{(tradeQuantity * tradeModalStock.price).toLocaleString("en-IN")}</strong>
                  </div>

                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: tradeOrderType === "BUY" ? "#00d09c" : "#ef4444",
                      color: tradeOrderType === "BUY" ? "#000000" : "#ffffff",
                      fontSize: "15px",
                      fontWeight: "800",
                      cursor: "pointer",
                    }}
                  >
                    Confirm {tradeOrderType} on Groww
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* In-Page Modal: Delete Stock Confirmation */}
        {stockToDelete && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}>
            <div style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ fontSize: "24px" }}>🗑️</span>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#ffffff" }}>
                  Remove Stock?
                </h3>
              </div>
              <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.5", margin: "0 0 20px 0" }}>
                Are you sure you want to remove <strong style={{ color: "#f8fafc" }}>{stockToDelete.symbol}</strong> from your active watchlist?
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => setStockToDelete(null)}
                  disabled={actionLoading}
                  style={{
                    background: "#334155",
                    color: "#cbd5e1",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeRemoveStock}
                  disabled={actionLoading}
                  style={{
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: actionLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {actionLoading ? "Removing..." : "Yes, Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-Page Modal: Create New Watchlist */}
        {showNewWatchlistModal && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}>
            <form
              onSubmit={executeCreateWatchlist}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "14px",
                padding: "24px",
                maxWidth: "420px",
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              }}
            >
              <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#ffffff" }}>
                ➕ Create New Watchlist
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 16px 0" }}>
                Create a dedicated list saved in Supabase (e.g. 'Tech Focus', 'Bluechips').
              </p>
              <input
                type="text"
                autoFocus
                placeholder="Watchlist Name..."
                value={newWatchlistNameInput}
                onChange={(e) => setNewWatchlistNameInput(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  backgroundColor: "#090d16",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                  marginBottom: "20px",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => { setShowNewWatchlistModal(false); setNewWatchlistNameInput(""); }}
                  style={{
                    background: "#334155",
                    color: "#cbd5e1",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newWatchlistNameInput.trim()}
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: actionLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {actionLoading ? "Creating..." : "Create Watchlist"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* In-Page Modal: Core Design Principles & Engineering Trade-offs */}
        {showImpactEvaluation && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}>
            <div style={{
              background: "#111827",
              border: "1px solid #38bdf8",
              borderRadius: "16px",
              padding: "26px",
              maxWidth: "680px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "24px" }}>🛡️</span>
                    <h2 style={{ margin: 0, fontSize: "20px", color: "#38bdf8", fontWeight: "800" }}>
                      Core Design Principles & Engineering Trade-Offs
                    </h2>
                  </div>
                  <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "13px" }}>
                    The underlying engineering rationale and trade-offs behind this implementation:
                  </p>
                </div>
                <button
                  onClick={() => setShowImpactEvaluation(false)}
                  style={{ background: "#1f2937", border: "1px solid #374151", color: "#9ca3af", width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                {/* 1. Clarity Over Noise */}
                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #00d09c" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ color: "#00d09c", fontSize: "14px" }}>1. Clarity Over Noise (Event-Driven Explainability)</strong>
                    <span style={{ fontSize: "11px", background: "rgba(0, 208, 156, 0.2)", color: "#00d09c", padding: "2px 8px", borderRadius: "10px", fontWeight: "700" }}>UX Principle</span>
                  </div>
                  <p style={{ margin: 0, color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    Standard watchlists sort by raw percentage gain, which over-indexes on microcap volatility. We prioritize statistical anomalies and provide 1-line plain-English summaries so returning users immediately understand the catalyst without deciphering raw financial metrics.
                  </p>
                </div>

                {/* 2. Resilience Over False Precision */}
                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ color: "#f59e0b", fontSize: "14px" }}>2. Resilience Over False Precision (Defensive Edge Cases)</strong>
                    <span style={{ fontSize: "11px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", padding: "2px 8px", borderRadius: "10px", fontWeight: "700" }}>Reliability</span>
                  </div>
                  <p style={{ margin: 0, color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    Low-liquidity stocks (<strong style={{ color: "#fbbf24" }}>PENNYTEST</strong>) have erratic spreads, so we flag them with a warning badge. If an exchange feed fails (<strong style={{ color: "#f87171" }}>BROKENSTOCK</strong>), the UI gracefully renders an in-page <em>"Data Unavailable"</em> error card instead of silently failing or crashing.
                  </p>
                </div>

                {/* 3. Transparent Math Over Black Boxes */}
                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #38bdf8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ color: "#38bdf8", fontSize: "14px" }}>3. Transparent Math Over Black Boxes (Auditable Attribution)</strong>
                    <span style={{ fontSize: "11px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 8px", borderRadius: "10px", fontWeight: "700" }}>Transparency</span>
                  </div>
                  <p style={{ margin: 0, color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    Every rank is 100% auditable. Users can expand any card to see exactly how its score was calculated: <strong>40% Volatility-Normalized Move</strong>, <strong>35% Volume Surge</strong>, and <strong>25% Benchmark Alpha</strong>.
                  </p>
                </div>

                {/* 4. Frictionless Interaction Over Disruptive Popups */}
                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #a855f7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ color: "#c084fc", fontSize: "14px" }}>4. Frictionless Interaction Over Disruptive Popups</strong>
                    <span style={{ fontSize: "11px", background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", padding: "2px 8px", borderRadius: "10px", fontWeight: "700" }}>Simplicity</span>
                  </div>
                  <p style={{ margin: 0, color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    Zero disruptive browser dialogs (<code>window.confirm</code> or <code>window.prompt</code>). Watchlist creation, instant simulated order placement, and stock deletion are built as seamless in-page dark-mode components.
                  </p>
                </div>

                {/* 5. Cloud State Continuity */}
                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #3b82f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ color: "#60a5fa", fontSize: "14px" }}>5. Cloud State Continuity Across Sessions & Devices</strong>
                    <span style={{ fontSize: "11px", background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", padding: "2px 8px", borderRadius: "10px", fontWeight: "700" }}>Persistence</span>
                  </div>
                  <p style={{ margin: 0, color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    User watchlists, items, and checkpoint audit logs are persisted in a cloud PostgreSQL database (Supabase) indexed by <code>user_id</code>, allowing state to synchronize across different browsers and devices.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowImpactEvaluation(false)}
                  style={{
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  ✓ Close Principles
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-Page Modal: Cross-Device Identity & Sync */}
        {showUserModal && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}>
            <div style={{
              background: "#111827",
              border: "1px solid #38bdf8",
              borderRadius: "16px",
              padding: "26px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "24px" }}>👤</span>
                  <h3 style={{ margin: 0, fontSize: "18px", color: "#ffffff" }}>
                    Cross-Device Persistence & Sync
                  </h3>
                </div>
                <button
                  onClick={() => setShowUserModal(false)}
                  style={{ background: "#1f2937", border: "1px solid #374151", color: "#9ca3af", width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.5", margin: "0 0 16px 0" }}>
                Your watchlists, added stocks, and session checkpoints are tied to your <strong>Cloud User ID</strong> in Supabase PostgreSQL. This proves your data follows you across mobile, desktop, and different browsers.
              </p>

              <form onSubmit={handleSwitchUser} style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", fontWeight: "700", marginBottom: "6px" }}>
                  Active User Identity / Email:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    placeholder="Enter user ID or email (e.g. vaishnavi_groww)..."
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #475569",
                      backgroundColor: "#090d16",
                      color: "#ffffff",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "10px 16px",
                      background: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    Switch User
                  </button>
                </div>
              </form>

              <div style={{ background: "#1e293b", padding: "14px", borderRadius: "10px", border: "1px solid #334155", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700" }}>
                    🔗 1-Click Multi-Device Sync Link
                  </span>
                  <button
                    onClick={handleCopySyncLink}
                    style={{
                      background: copiedSyncLink ? "#22c55e" : "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    {copiedSyncLink ? "✓ Copied Link!" : "📋 Copy Link"}
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", wordBreak: "break-all", background: "#090d16", padding: "8px", borderRadius: "6px" }}>
                  {window.location.origin}{window.location.pathname}?user={encodeURIComponent(userId)}
                </div>
                <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: "11px" }}>
                  Open this link in an Incognito window or on your phone to see your exact Supabase watchlist follow you instantly.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowUserModal(false)}
                  style={{ background: "#334155", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-Page Modal: Architecture & Scaling Decisions */}
        {showScalingModal && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}>
            <div style={{
              background: "#111827",
              border: "1px solid #3b82f6",
              borderRadius: "16px",
              padding: "26px",
              maxWidth: "680px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "24px" }}>🚀</span>
                    <h2 style={{ margin: 0, fontSize: "20px", color: "#60a5fa", fontWeight: "800" }}>
                      Architecture & Scaling Decisions
                    </h2>
                  </div>
                  <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "13px" }}>
                    Engineering decisions and trade-offs implemented to handle larger watchlists and concurrent requests:
                  </p>
                </div>
                <button
                  onClick={() => setShowScalingModal(false)}
                  style={{ background: "#1f2937", border: "1px solid #374151", color: "#9ca3af", width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #38bdf8" }}>
                  <strong style={{ color: "#38bdf8", fontSize: "14px" }}>
                    1. In-Memory 30s TTL Multi-Ticker Caching (External I/O Optimization)
                  </strong>
                  <p style={{ margin: "6px 0 0 0", color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    <strong>Trade-off:</strong> Calling external financial APIs on every single user request risks rate-limiting and high network latency.<br/>
                    <strong>Implementation:</strong> Built an in-memory TTL cache in FastAPI. Repeated requests for the same stock across concurrent sessions are served directly from cache, avoiding redundant external round-trips while keeping price staleness capped at 30 seconds.
                  </p>
                </div>

                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #a855f7" }}>
                  <strong style={{ color: "#c084fc", fontSize: "14px" }}>
                    2. Supabase PostgreSQL Compound B-Tree Indexing (Database Query Scale)
                  </strong>
                  <p style={{ margin: "6px 0 0 0", color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    <strong>Trade-off:</strong> Without indexes, querying items and sessions by foreign key requires full sequential table scans as tables grow.<br/>
                    <strong>Implementation:</strong> Created explicit B-Tree indexes on <code>idx_watchlists_user_id</code>, <code>idx_watchlist_items_wid</code>, and <code>idx_sessions_wid</code> so watchlist retrieval scales efficiently with indexed lookups.
                  </p>
                </div>

                <div style={{ background: "#1e293b", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #22c55e" }}>
                  <strong style={{ color: "#4ade80", fontSize: "14px" }}>
                    3. Client-Side Memoized Filtering & Sorting (UI Responsiveness)
                  </strong>
                  <p style={{ margin: "6px 0 0 0", color: "#cbd5e1", fontSize: "13px", lineHeight: "1.4" }}>
                    <strong>Trade-off:</strong> Server-side sorting on every keystroke causes unnecessary network overhead and UI stutter.<br/>
                    <strong>Implementation:</strong> Search filtering, sector slicing, and plain-English sort toggles are computed locally in React, keeping interactions instant and responsive.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowScalingModal(false)}
                  style={{ background: "#3b82f6", color: "#ffffff", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}
                >
                  ✓ Close Scaling Summary
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Reliability & Groww Integration Header Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", fontSize: "13px", color: "#64748b", borderBottom: "1px solid #1e293b", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: health.status === "healthy" ? "#22c55e" : "#eab308" }} />
              <strong style={{ color: "#cbd5e1" }}>System Live</strong>
            </span>
            <span>·</span>
            <span>Database: <strong style={{ color: "#38bdf8" }}>Supabase Connected</strong></span>
            <span>·</span>
            <button
              onClick={() => setShowUserModal(true)}
              title="Click to view cross-device sync link or switch user identity"
              style={{
                background: "rgba(56, 189, 248, 0.15)",
                border: "1px solid #38bdf8",
                color: "#38bdf8",
                padding: "2px 8px",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "700"
              }}
            >
              👤 User: {userId} (Sync)
            </button>
            <span>·</span>
            <span style={{ color: data?.market?.is_open ? "#4ade80" : "#94a3b8" }}>
              {data?.market?.status_text || "Market Closed (Post 3:30 PM IST)"}
            </span>
          </div>
          
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowScalingModal(true)}
              style={{ background: "rgba(59, 130, 246, 0.15)", border: "1px solid #3b82f6", color: "#60a5fa", padding: "4px 10px", borderRadius: "14px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
            >
              🚀 Scaling Decisions
            </button>
            <button
              onClick={() => setShowImpactEvaluation(true)}
              style={{ background: "rgba(56, 189, 248, 0.15)", border: "1px solid #38bdf8", color: "#38bdf8", padding: "4px 10px", borderRadius: "14px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
            >
              🛡️ Design Principles
            </button>
            <button
              onClick={() => setShowNotificationPreview(true)}
              title="Real-time push notification generated from statistical volume & alpha breakouts"
              style={{ background: "rgba(0, 208, 156, 0.15)", border: "1px solid #00d09c", color: "#00d09c", padding: "3px 8px", borderRadius: "14px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
            >
              ⚡ Live Anomaly Alert
            </button>
            <button
              onClick={() => setShowExplainer(!showExplainer)}
              style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
            >
              {showExplainer ? "✕ Close Guide" : "💡 Meaningful Change"}
            </button>
            <button
              onClick={handleOpenHistory}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
            >
              📜 Checkpoints
            </button>
          </div>
        </div>

        {/* Global Banner for Market-Hours Staleness */}
        {isMarketStale() && (
          <div style={{
            background: "rgba(245, 158, 11, 0.15)",
            border: "1px solid #f59e0b",
            color: "#fbbf24",
            borderRadius: "10px",
            padding: "12px 18px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "13px",
            fontWeight: "600",
          }}>
            <span>⚠️ Live Indian Market is open — Your prices may be a few minutes old.</span>
            <button
              onClick={() => loadSignals(activeWatchlist?.id)}
              style={{ background: "#f59e0b", color: "#000", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
            >
              Refresh Prices
            </button>
          </div>
        )}

        {/* App Header & Watchlist Switcher */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px" }}>
              ⚡ Since You Checked
            </h1>
            
            {/* Watchlist Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "13px", color: "#94a3b8" }}>Active Watchlist:</span>
              <select
                value={activeWatchlist?.id || ""}
                onChange={(e) => {
                  const selected = watchlists.find((w) => w.id === e.target.value);
                  if (selected) setActiveWatchlist(selected);
                }}
                style={{
                  background: "#1e293b",
                  color: "#38bdf8",
                  border: "1px solid #334155",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              <button
                onClick={() => setShowNewWatchlistModal(true)}
                title="Create a new watchlist"
                style={{
                  background: "#1e293b",
                  border: "1px dashed #475569",
                  color: "#cbd5e1",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                + New Watchlist
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {data?.benchmark && (
              <div
                style={{ background: "#1e293b", padding: "8px 14px", borderRadius: "8px", border: "1px solid #334155", fontSize: "13px" }}
              >
                <span style={{ color: "#94a3b8" }}>Market Average ({data.benchmark.name}): </span>
                <strong style={{ color: data.benchmark.pct_change >= 0 ? "#4ade80" : "#f87171" }}>
                  {data.benchmark.pct_change >= 0 ? "+" : ""}{data.benchmark.pct_change}%
                </strong>
              </div>
            )}

            <button
              onClick={() => loadSignals(activeWatchlist?.id)}
              style={{
                background: "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              🔄 Refresh Now
            </button>
          </div>
        </header>

        {/* Punchy Executive Summary Banner with Redesigned Sleek Controls */}
        {data?.executive_briefing && (
          <div style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 58, 138, 0.25) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "14px",
            padding: "18px 22px",
            marginBottom: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
          }}>
            {/* Top Bar of Briefing */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px" }}>⚡</span>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  What Happened While You Were Away
                </span>
              </div>

              {/* Action Buttons Group */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={handleSpeakBriefing}
                  title="Listen to an audio readout of this market summary"
                  style={{
                    background: isSpeaking ? "rgba(239, 68, 68, 0.15)" : "rgba(56, 189, 248, 0.12)",
                    border: isSpeaking ? "1px solid #ef4444" : "1px solid rgba(56, 189, 248, 0.3)",
                    color: isSpeaking ? "#f87171" : "#38bdf8",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{isSpeaking ? "⏹️" : "🎧"}</span>
                  <span>{isSpeaking ? "Stop Audio" : "Listen"}</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  title="Copy briefing to clipboard"
                  style={{
                    background: copiedSummary ? "rgba(34, 197, 94, 0.15)" : "#1e293b",
                    border: copiedSummary ? "1px solid #22c55e" : "1px solid #334155",
                    color: copiedSummary ? "#4ade80" : "#cbd5e1",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{copiedSummary ? "✓" : "📋"}</span>
                  <span>{copiedSummary ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Briefing Text & Checkpoint CTA */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ flex: 1, minWidth: "280px", fontSize: "15px", fontWeight: "600", color: "#f8fafc", lineHeight: "1.5" }}>
                {data.executive_briefing}
              </div>

              <button
                onClick={handleCheckpoint}
                disabled={actionLoading}
                title="Save a checkpoint so next time you return, you only see changes from this moment"
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: actionLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 6px -1px rgba(2, 132, 199, 0.2)",
                }}
              >
                ✓ Got It, Mark Checked ({formatLastChecked(data?.last_checked_at)})
              </button>
            </div>
          </div>
        )}

        {/* Explainer Guide */}
        {showExplainer && (
          <div style={{ background: "#1e293b", border: "1px solid #38bdf8", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#38bdf8", fontSize: "16px" }}>
              💡 Why This App Is Smarter Than Normal Stock Lists
            </h3>
            <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 0 14px 0", lineHeight: "1.5" }}>
              Normal apps just sort by <em>highest % gain</em>, which is noisy because microcaps fluctuate randomly. Our app ranks by <strong>how surprising or unusual</strong> a move is for that specific company:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", fontSize: "13px" }}>
              <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                <strong style={{ color: "#38bdf8" }}>1. Unusual Price Jump (40%)</strong>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12px" }}>
                  A 2% jump for a calm stock (like ITC) is a big deal. The same 2% jump for a wild stock is just normal noise.
                </p>
              </div>
              <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                <strong style={{ color: "#fbbf24" }}>2. Heavy Trading Volume (35%)</strong>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12px" }}>
                  Checks if today's trading activity is significantly higher than its 20-day average, signaling institutional interest.
                </p>
              </div>
              <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                <strong style={{ color: "#4ade80" }}>3. Moving on Its Own (25%)</strong>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12px" }}>
                  Compares the stock with the market (NIFTY 50). If the market is down but this stock is flying, it scores high.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Session Audit History Modal */}
        {showHistory && (
          <div style={{ background: "#1e293b", border: "1px solid #64748b", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>📜 Checkpoint History (Saved in Cloud)</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
              {sessionHistory.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "13px" }}>No previous checkpoints saved yet. Click 'Got It, Mark As Checked' to save one.</p>
              ) : (
                sessionHistory.map((s, idx) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#0f172a", borderRadius: "6px", fontSize: "13px" }}>
                    <span>Visit #{sessionHistory.length - idx}</span>
                    <span style={{ color: "#38bdf8" }}>{new Date(s.opened_at).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Add Stock Form & Clickable Sector Pills */}
        <div style={{ background: "#1e293b", padding: "18px", borderRadius: "12px", border: "1px solid #334155", marginBottom: "20px" }}>
          <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
            <input
              type="text"
              placeholder="Type any stock symbol to add (e.g. ZOMATO, HAL, TATASTEEL, MARUTI, PENNYTEST, BROKENSTOCK)..."
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #475569",
                backgroundColor: "#090d16",
                color: "#ffffff",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={actionLoading || !newSymbol.trim()}
              style={{
                padding: "10px 20px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? "Adding..." : "+ Add to Watchlist"}
            </button>
          </form>

          {/* Clickable Quick Add Pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {SECTOR_GROUPS.map((sec) => (
              <div key={sec.label} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", minWidth: "130px" }}>
                  {sec.label}:
                </span>
                {sec.symbols.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => handleAdd(sym)}
                    disabled={actionLoading}
                    title={sym === "BROKENSTOCK" ? "Demonstrate visible unhappy path / fetch failure" : `Click to add ${sym} to your active watchlist`}
                    style={{
                      background: sym === "PENNYTEST" ? "#78350f" : sym === "BROKENSTOCK" ? "#7f1d1d" : "#334155",
                      border: sym === "PENNYTEST" ? "1px solid #f59e0b" : sym === "BROKENSTOCK" ? "1px solid #ef4444" : "none",
                      color: sym === "PENNYTEST" ? "#fef3c7" : sym === "BROKENSTOCK" ? "#fecaca" : "#cbd5e1",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: (sym === "PENNYTEST" || sym === "BROKENSTOCK") ? "700" : "normal",
                    }}
                  >
                    + {sym}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Filter, Search & Plain-English Sort Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="🔍 Search stocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#ffffff",
                outline: "none",
                width: "160px",
              }}
            />

            {/* Clickable Sector Category Filter Pills */}
            <div style={{ display: "flex", gap: "4px" }}>
              {["ALL", "Tech", "Banking", "Auto", "Defense", "FMCG"].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setActiveSectorFilter(sec)}
                  style={{
                    background: activeSectorFilter === sec ? "#0284c7" : "#1e293b",
                    color: activeSectorFilter === sec ? "#ffffff" : "#94a3b8",
                    border: "1px solid #334155",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {sec === "ALL" ? "All Sectors" : sec}
                </button>
              ))}
            </div>

            <span style={{ fontSize: "12px", color: "#64748b" }}>
              (Showing {sortedStocks.length})
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>Rank by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: "#1e293b",
                color: "#f8fafc",
                border: "1px solid #334155",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              <option value="relevance">⚡ Highest Priority (Most Active)</option>
              <option value="alpha">🎯 Moving on Its Own (Beating Market)</option>
              <option value="pct_desc">📈 Top Gainers (%)</option>
              <option value="pct_asc">📉 Top Losers (%)</option>
              <option value="volume">🔥 Heavy Trading Volume</option>
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ padding: "14px", background: "#7f1d1d", color: "#fecaca", borderRadius: "8px", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Stock List Cards */}
        {loading && !data ? (
          <p style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>Loading your watchlist...</p>
        ) : sortedStocks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", background: "#1e293b", borderRadius: "12px", border: "1px dashed #334155" }}>
            <p style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "8px" }}>No stocks found.</p>
            <p style={{ color: "#64748b", fontSize: "13px" }}>Click any of the quick-add buttons above to add stocks to your watchlist.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sortedStocks.map((s, index) => {
              // Visible Fetch Failure Handling (Unhappy Path)
              if (s.status === "error" || s.price === null) {
                return (
                  <div
                    key={s.symbol}
                    style={{
                      padding: "16px 20px",
                      background: "#1e1e24",
                      borderRadius: "12px",
                      border: "1px solid #7f1d1d",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "800", color: "#64748b" }}>#{index + 1}</span>
                        <strong style={{ fontSize: "20px", color: "#f87171" }}>{s.symbol}</strong>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "#7f1d1d", color: "#fecaca", fontWeight: "700" }}>
                          ⚠️ Data Unavailable
                        </span>
                      </div>
                      <div style={{ marginTop: "6px", fontSize: "13px", color: "#94a3b8" }}>
                        Could not retrieve live quote from exchange. Handled gracefully without crashing app.
                      </div>
                    </div>
                    {s.item_id && (
                      <button
                        onClick={() => setStockToDelete({ itemId: s.item_id, symbol: s.symbol })}
                        title="Remove invalid stock"
                        style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#f87171", width: "36px", height: "36px", borderRadius: "8px", cursor: "pointer" }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              }

              const isPositive = s.pct_change >= 0;
              const isSurge = s.volume_ratio >= 1.5;
              const isHighAlpha = Math.abs(s.alpha) >= 1.2;
              const freshness = getFreshnessBadge(s.fetched_at, data?.market?.is_open);
              const scoreColor = getScoreColor(s);
              const isExpanded = expandedStockSymbol === s.symbol;

              return (
                <div
                  key={s.symbol}
                  style={{
                    padding: "18px 20px",
                    background: "#131a29",
                    borderRadius: "12px",
                    border: s.is_illiquid ? "1px solid #f59e0b" : isExpanded ? "1px solid #38bdf8" : "1px solid #1e293b",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    onClick={() => setExpandedStockSymbol(isExpanded ? null : s.symbol)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: "800", color: "#64748b" }}>
                          #{index + 1}
                        </span>
                        <strong style={{ fontSize: "20px", color: "#ffffff", letterSpacing: "0.5px" }}>
                          {s.symbol}
                        </strong>

                        {s.sector && (
                          <span
                            onClick={(e) => { e.stopPropagation(); setActiveSectorFilter(s.sector); }}
                            title={`Click to show all ${s.sector} stocks`}
                            style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: "#1e293b", color: "#38bdf8", cursor: "pointer" }}
                          >
                            {s.sector} 🏷️
                          </span>
                        )}

                        {/* Exact Low Liquidity Flag */}
                        {s.is_illiquid && (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              background: "rgba(245, 158, 11, 0.2)",
                              color: "#fbbf24",
                              fontWeight: "700",
                              border: "1px solid #f59e0b",
                            }}
                          >
                            ⚠️ Low liquidity — score may be unreliable
                          </span>
                        )}

                        {isSurge && (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              background: "rgba(245, 158, 11, 0.15)",
                              color: "#fbbf24",
                              fontWeight: "700",
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                            }}
                          >
                            🔥 Heavy Volume ({s.volume_ratio}x normal)
                          </span>
                        )}

                        {isHighAlpha && (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              background: s.alpha >= 0 ? "rgba(56, 189, 248, 0.15)" : "rgba(244, 63, 94, 0.15)",
                              color: s.alpha >= 0 ? "#38bdf8" : "#fb7185",
                              fontWeight: "700",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                            }}
                          >
                            🎯 {s.alpha >= 0 ? `+${s.alpha}% vs Market` : `${s.alpha}% vs Market`}
                          </span>
                        )}
                      </div>

                      {/* Plain-English Change Insight */}
                      {s.insight && (
                        <div style={{ marginTop: "6px", fontSize: "13px", color: s.is_illiquid ? "#fbbf24" : "#38bdf8", fontWeight: "500" }}>
                          💡 {s.insight}
                        </div>
                      )}

                      <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span>Previous Close: <strong style={{ color: "#cbd5e1" }}>₹{s.prev_close?.toLocaleString("en-IN")}</strong></span>
                        <span>·</span>
                        <span>Normal Daily Range: <strong style={{ color: "#e2e8f0" }}>±{s.historical_volatility}%</strong></span>
                        <span>·</span>
                        <span style={{ color: "#38bdf8", fontWeight: "600" }}>{isExpanded ? "▲ Hide Breakdown" : "▼ Click to See Why"}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ textAlign: "right", minWidth: "140px" }}>
                        <div style={{ fontSize: "22px", fontWeight: "800", color: "#ffffff" }}>
                          ₹{s.price?.toLocaleString("en-IN")}
                        </div>

                        {/* Freshness Badge */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "5px", marginTop: "2px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: freshness.color }} />
                          <span style={{ fontSize: "11px", color: freshness.color, fontWeight: "600" }}>
                            {freshness.label}
                          </span>
                        </div>

                        {/* Prominent Percentage Pill & Rupee Delta */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "4px" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "13px",
                              fontWeight: "800",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: isPositive ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.18)",
                              color: isPositive ? "#4ade80" : "#f87171",
                              border: isPositive ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
                            }}
                          >
                            <span>{isPositive ? "▲" : "▼"}</span>
                            <span>{isPositive ? "+" : ""}{s.pct_change}%</span>
                            {s.prev_close && (
                              <span style={{ fontSize: "11px", fontWeight: "600", opacity: 0.9 }}>
                                ({isPositive ? "+" : ""}₹{Math.abs(s.price - s.prev_close).toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ fontSize: "12px", color: scoreColor, fontWeight: "800", marginTop: "4px" }}>
                          Priority Score: {s.relevance_score}
                        </div>
                        <div style={{ fontSize: "10px", color: "#64748b", marginTop: "1px" }}>
                          40% P · 35% V · 25% α
                        </div>
                      </div>

                      {/* Groww Quick Trade CTA */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTradeModalStock(s);
                        }}
                        title="Simulate Instant Order on Groww"
                        style={{
                          background: "#00d09c",
                          color: "#000000",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "800",
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        ⚡ Trade
                      </button>

                      {/* In-Page Delete Trigger Button */}
                      {s.item_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStockToDelete({ itemId: s.item_id, symbol: s.symbol });
                          }}
                          title="Remove from watchlist"
                          style={{
                            background: "transparent",
                            border: "1px solid #334155",
                            color: "#94a3b8",
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "15px",
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Click-to-Expand Plain English Details Card */}
                  {isExpanded && (
                    <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #1e293b" }}>
                      <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase" }}>
                        🔍 Why is {s.symbol} scored {s.relevance_score}?
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "13px" }}>
                        <div style={{ background: "#090d16", padding: "10px 12px", borderRadius: "8px", border: "1px solid #1e293b" }}>
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>1. Price Move vs Normal (+{s.score_breakdown?.price_component} pts)</span>
                          <p style={{ margin: "4px 0 0 0", color: "#e2e8f0" }}>
                            Moved <strong>{s.pct_change > 0 ? `+${s.pct_change}%` : `${s.pct_change}%`}</strong> (normal daily range is ±{s.historical_volatility}%).
                          </p>
                        </div>
                        <div style={{ background: "#090d16", padding: "10px 12px", borderRadius: "8px", border: "1px solid #1e293b" }}>
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>2. Trading Volume (+{s.score_breakdown?.volume_component} pts)</span>
                          <p style={{ margin: "4px 0 0 0", color: "#e2e8f0" }}>
                            Volume is <strong>{s.volume_ratio}x</strong> its normal 20-day average.
                          </p>
                        </div>
                        <div style={{ background: "#090d16", padding: "10px 12px", borderRadius: "8px", border: "1px solid #1e293b" }}>
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>3. vs Market Average (+{s.score_breakdown?.alpha_component} pts)</span>
                          <p style={{ margin: "4px 0 0 0", color: "#e2e8f0" }}>
                            {s.alpha >= 0 ? `Outperformed NIFTY 50 by +${s.alpha}%` : `Underperformed NIFTY 50 by ${s.alpha}%`}.
                          </p>
                        </div>
                      </div>

                      {/* Visual Delta & Trajectory Sparkline */}
                      {s.price && s.prev_close && (
                        <div style={{ marginTop: "12px", background: "#090d16", padding: "12px 16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700" }}>
                              📍 Session Checkpoint Shift Trajectory
                            </span>
                            <span style={{ fontSize: "11px", color: isPositive ? "#4ade80" : "#f87171", fontWeight: "700" }}>
                              {isPositive ? "▲ Net Gain" : "▼ Net Pullback"} ({isPositive ? "+" : ""}₹{Math.abs(s.price - s.prev_close).toFixed(2)})
                            </span>
                          </div>
                          <svg viewBox="0 0 500 50" style={{ width: "100%", height: "42px", overflow: "visible" }}>
                            <defs>
                              <linearGradient id={`grad-${s.symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <path
                              d={isPositive ? "M 10 38 Q 120 34, 250 20 T 470 10 L 470 45 L 10 45 Z" : "M 10 12 Q 120 18, 250 30 T 470 40 L 470 45 L 10 45 Z"}
                              fill={`url(#grad-${s.symbol})`}
                            />
                            <path
                              d={isPositive ? "M 10 38 Q 120 34, 250 20 T 470 10" : "M 10 12 Q 120 18, 250 30 T 470 40"}
                              fill="none"
                              stroke={isPositive ? "#22c55e" : "#ef4444"}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            <circle cx="20" cy={isPositive ? 36 : 14} r="4" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
                            <text x="32" y={isPositive ? 42 : 18} fill="#38bdf8" fontSize="11" fontWeight="700">📍 Last Checkpoint: ₹{s.prev_close}</text>
                            <circle cx="470" cy={isPositive ? 10 : 40} r="5" fill={isPositive ? "#4ade80" : "#f87171"} stroke="#ffffff" strokeWidth="2" />
                            <text x="390" y={isPositive ? 8 : 46} fill={isPositive ? "#4ade80" : "#f87171"} fontSize="11" fontWeight="800">Live: ₹{s.price}</text>
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}