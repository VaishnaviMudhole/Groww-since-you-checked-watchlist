import React, { useState } from "react";
import { createWatchlist, addStockToWatchlist } from "../api/client";

const SECTOR_OPTIONS = [
  {
    name: "Tech & Growth",
    icon: "💻",
    stocks: [
      { sym: "ZOMATO", name: "Zomato Ltd" },
      { sym: "TCS", name: "Tata Consultancy Services" },
      { sym: "INFY", name: "Infosys Ltd" },
      { sym: "WIPRO", name: "Wipro Ltd" },
    ],
  },
  {
    name: "Banking & Financials",
    icon: "🏦",
    stocks: [
      { sym: "HDFCBANK", name: "HDFC Bank" },
      { sym: "ICICIBANK", name: "ICICI Bank" },
      { sym: "SBIN", name: "State Bank of India" },
      { sym: "KOTAKBANK", name: "Kotak Mahindra Bank" },
    ],
  },
  {
    name: "Auto & Manufacturing",
    icon: "🚗",
    stocks: [
      { sym: "TATAMOTORS", name: "Tata Motors" },
      { sym: "MARUTI", name: "Maruti Suzuki" },
      { sym: "TATASTEEL", name: "Tata Steel" },
      { sym: "LT", name: "Larsen & Toubro" },
    ],
  },
  {
    name: "Defense, Energy & FMCG",
    icon: "⚡",
    stocks: [
      { sym: "RELIANCE", name: "Reliance Industries" },
      { sym: "HAL", name: "Hindustan Aeronautics" },
      { sym: "ITC", name: "ITC Ltd" },
      { sym: "SUNPHARMA", name: "Sun Pharma" },
    ],
  },
];

export default function OnboardingWizard({ userId, onComplete }) {
  const [selectedStocks, setSelectedStocks] = useState(["RELIANCE", "TATAMOTORS", "ZOMATO", "HDFCBANK"]);
  const [watchlistName, setWatchlistName] = useState("My Primary Watchlist");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleStock = (sym) => {
    setSelectedStocks((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSelectAllLeaders = () => {
    setSelectedStocks(["RELIANCE", "TCS", "HDFCBANK", "TATAMOTORS", "ZOMATO", "INFY", "ITC"]);
  };

  const handleFinish = async () => {
    if (selectedStocks.length === 0) {
      alert("Please select at least 1 stock to launch your intelligence feed.");
      return;
    }

    try {
      setIsSubmitting(true);
      // 1. Create custom watchlist in Supabase
      const newWl = await createWatchlist(watchlistName.trim() || "My Primary Watchlist", userId);
      
      // 2. Add all selected stocks in parallel
      await Promise.all(
        selectedStocks.map((sym) => addStockToWatchlist(newWl.id, sym).catch(() => null))
      );

      onComplete(newWl);
    } catch (err) {
      alert(`Could not complete setup: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#090d16",
        color: "#f8fafc",
        padding: "32px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "680px",
          width: "100%",
          backgroundColor: "#111827",
          border: "1px solid #1e293b",
          borderRadius: "20px",
          padding: "32px 28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(56, 189, 248, 0.12)",
              color: "#38bdf8",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            <span>✨</span>
            <span>Welcome, {userId}!</span>
          </div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px" }}>
            Build Your First "Since You Checked" Feed
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px", lineHeight: "1.5" }}>
            Select the stocks and sectors you care about. Our statistical engine will monitor volatility breakouts, volume surges, and alpha shifts specifically for your picks.
          </p>
        </div>

        {/* Watchlist Name Input */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#cbd5e1", marginBottom: "6px" }}>
            Watchlist Name:
          </label>
          <input
            type="text"
            value={watchlistName}
            onChange={(e) => setWatchlistName(e.target.value)}
            placeholder="e.g. My Core Portfolio / Growth Picks"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #334155",
              backgroundColor: "#090d16",
              color: "#ffffff",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Quick Select Preset */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#cbd5e1" }}>
            Choose Stocks to Monitor ({selectedStocks.length} Selected):
          </span>
          <button
            type="button"
            onClick={handleSelectAllLeaders}
            style={{
              background: "none",
              border: "none",
              color: "#38bdf8",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            🌟 Select NIFTY Market Leaders
          </button>
        </div>

        {/* Sector Groups Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
          {SECTOR_OPTIONS.map((sec) => (
            <div key={sec.name} style={{ background: "#090d16", padding: "14px 16px", borderRadius: "12px", border: "1px solid #1e293b" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>{sec.icon}</span>
                <span>{sec.name}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {sec.stocks.map((stock) => {
                  const isSelected = selectedStocks.includes(stock.sym);
                  return (
                    <button
                      key={stock.sym}
                      type="button"
                      onClick={() => toggleStock(stock.sym)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: isSelected ? "1px solid #00d09c" : "1px solid #334155",
                        background: isSelected ? "rgba(0, 208, 156, 0.15)" : "#1e293b",
                        color: isSelected ? "#4ade80" : "#cbd5e1",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>{stock.sym}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Launch CTA */}
        <button
          type="button"
          onClick={handleFinish}
          disabled={isSubmitting || selectedStocks.length === 0}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "linear-gradient(135deg, #00d09c 0%, #059669 100%)",
            color: "#000000",
            fontSize: "15px",
            fontWeight: "900",
            cursor: isSubmitting ? "wait" : "pointer",
            boxShadow: "0 4px 14px rgba(0, 208, 156, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>🚀</span>
          <span>{isSubmitting ? "Setting up your Supabase feed..." : `Launch Intelligence Feed (${selectedStocks.length} Stocks)`}</span>
        </button>
      </div>
    </div>
  );
}
