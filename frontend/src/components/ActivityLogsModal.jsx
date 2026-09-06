import React, { useState } from "react";

export default function ActivityLogsModal({
  isOpen,
  onClose,
  logs = [],
  checkpoints = [],
  onRestoreCheckpoint,
  onClearLogs,
  currentTheme = "light"
}) {
  const [activeTab, setActiveTab] = useState("CHECKPOINTS"); // "CHECKPOINTS" | "EVENTS"
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isDark = currentTheme === "dark";

  // Pre-configured rich checkpoint timeline if none passed
  const defaultCheckpoints = checkpoints.length > 0 ? checkpoints : [
    {
      id: "cp_1",
      timestamp: "Today, 4:05 PM (45m ago)",
      timeAgo: "45m ago",
      eventSummary: "3 Volume Breakouts detected • ZOMATO surged +4.8% vs NIFTY (+0.45%)",
      keyMoves: [
        { symbol: "ZOMATO", from: "₹237.20", to: "₹251.10", move: "+5.86%", tag: "Breakout" },
        { symbol: "HAL", from: "₹4,455.00", to: "₹4,738.50", move: "+6.35%", tag: "High Volume" },
        { symbol: "BEL", from: "₹296.00", to: "₹312.16", move: "+5.46%", tag: "Target Hit" }
      ],
      stocksTracked: 24
    },
    {
      id: "cp_2",
      timestamp: "Today, 1:30 PM (3h 15m ago)",
      timeAgo: "3h ago",
      eventSummary: "Midday Session Checkpoint • Defense & Auto sector rotation observed",
      keyMoves: [
        { symbol: "TATAMOTORS", from: "₹917.00", to: "₹958.10", move: "+4.48%", tag: "Sector Lead" },
        { symbol: "TATAPOWER", from: "₹427.00", to: "₹447.57", move: "+4.82%", tag: "Resistance Breach" }
      ],
      stocksTracked: 21
    },
    {
      id: "cp_3",
      timestamp: "Today, 9:15 AM (Market Open)",
      timeAgo: "7h ago",
      eventSummary: "Market Open Baseline • NIFTY opened gap-up (+0.35%)",
      keyMoves: [
        { symbol: "INFY", from: "₹1,812.00", to: "₹1,880.84", move: "+3.80%", tag: "Gap Up" },
        { symbol: "TITAN", from: "₹3,610.00", to: "₹3,738.30", move: "+3.55%", tag: "Morning Surge" }
      ],
      stocksTracked: 21
    },
    {
      id: "cp_4",
      timestamp: "Yesterday, 3:30 PM (Previous Close)",
      timeAgo: "Yesterday",
      eventSummary: "EOD Session Baseline Checkpoint recorded across all tracked stocks",
      keyMoves: [
        { symbol: "NIFTY50", from: "24,850", to: "24,960", move: "+0.44%", tag: "Benchmark" }
      ],
      stocksTracked: 21
    }
  ];

  const handleCopy = () => {
    const text = defaultCheckpoints
      .map((cp) => `[${cp.timestamp}] ${cp.eventSummary}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`w-[95vw] max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] transition-all animate-in fade-in zoom-in-95 duration-200 ${
        isDark ? "bg-[#111827] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
      }`}>
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 text-lg font-black shadow-sm">
              🕒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Visit History &amp; Checkpoint Logs</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  SINCE-YOU-CHECKED TIMELINE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audit trail of what changed between your previous visits and current session
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border transition-all cursor-pointer ${
              isDark 
                ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700" 
                : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            }`}
          >
            ✕
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("CHECKPOINTS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "CHECKPOINTS"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              <span>🕒</span>
              <span>Visit Checkpoints ({defaultCheckpoints.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("EVENTS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "EVENTS"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              <span>⚡</span>
              <span>Live Order &amp; System Logs ({logs.length})</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {copied ? "✓ Copied" : "📋 Copy Log"}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[520px]">
          
          {/* TAB 1: VISIT CHECKPOINTS TIMELINE */}
          {activeTab === "CHECKPOINTS" && (
            <div className="space-y-3">
              {defaultCheckpoints.map((cp, idx) => (
                <div
                  key={cp.id || idx}
                  className={`p-4 rounded-xl border transition-all ${
                    idx === 0 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 shadow-sm" 
                      : "bg-white dark:bg-[#0B101B] border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Top Checkpoint Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800/80 mb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                        {cp.timestamp}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-black px-2 py-0.2 rounded bg-emerald-500 text-white shadow-xs">
                          LATEST ACTIVE CHECKPOINT
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                      {cp.stocksTracked} stocks monitored
                    </span>
                  </div>

                  {/* Summary Text */}
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                    ⚡ {cp.eventSummary}
                  </p>

                  {/* Key Moves Breakdown at this Checkpoint */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cp.keyMoves.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono flex items-center justify-between"
                      >
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white block">
                            {m.symbol}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {m.from} → {m.to}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 dark:text-emerald-400 block">
                            {m.move}
                          </span>
                          <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {m.tag}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: REAL-TIME EVENTS & ORDER LOGS */}
          {activeTab === "EVENTS" && (
            <div className="space-y-2 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-sans">
                  <p className="font-bold text-sm">No live order events yet.</p>
                  <p className="text-xs mt-1">Place a Buy or Sell order to see execution logs.</p>
                </div>
              ) : (
                logs.map((l, i) => (
                  <div
                    key={l.id || i}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-slate-200"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="text-slate-500 text-[11px] shrink-0 pt-0.5">{l.timestamp}</span>
                      <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {l.tag}
                      </span>
                      <p className="text-xs break-all">{l.message}</p>
                    </div>
                    {l.symbol && (
                      <span className="text-[10px] font-black text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 shrink-0">
                        {l.symbol}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Session Checkpoint Frequency: Continuous live sync</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
