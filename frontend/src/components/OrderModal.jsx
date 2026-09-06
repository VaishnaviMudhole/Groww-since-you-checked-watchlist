import React, { useState } from "react";

export default function OrderModal({ isOpen, onClose, stock, type = "BUY", onOrderExecute, availableBalance = 125000 }) {
  if (!isOpen || !stock) return null;

  const isBuy = type === "BUY";
  const [orderType, setOrderType] = useState("DELIVERY");
  const [quantity, setQuantity] = useState(isBuy ? 10 : Math.min(stock.shares || 10, 10));
  const [priceType, setPriceType] = useState("MARKET");
  const [customPrice, setCustomPrice] = useState(stock.price);
  const [isProcessing, setIsProcessing] = useState(false);

  const effectivePrice = priceType === "MARKET" ? stock.price : Number(customPrice) || stock.price;
  const totalAmount = Number((quantity * effectivePrice).toFixed(2));

  const handleQtyChange = (delta) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleExecute = (e) => {
    e.preventDefault();
    if (quantity <= 0) return;
    if (isBuy && totalAmount > availableBalance) {
      alert("Insufficient available balance for this order.");
      return;
    }
    if (!isBuy && stock.shares && quantity > stock.shares) {
      alert(`You only hold ${stock.shares} shares of ${stock.symbol}.`);
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      onOrderExecute({
        symbol: stock.symbol,
        type: isBuy ? "BUY" : "SELL",
        orderType,
        quantity,
        price: effectivePrice,
        totalAmount,
      });
      setIsProcessing(false);
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl w-[94vw] max-w-md p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm ${
              isBuy ? "bg-emerald-600" : "bg-rose-600"
            }`}>
              {isBuy ? "BUY" : "SELL"}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                {isBuy ? "Buy" : "Sell"} {stock.symbol}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                NSE • ₹{stock.price.toFixed(2)} ({stock.pct_change >= 0 ? `+${stock.pct_change}%` : `${stock.pct_change}%`})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:hover:text-white font-bold flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Product Type (Delivery / Intraday) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setOrderType("DELIVERY")}
            className={`py-1.5 text-xs font-bold rounded-lg transition ${
              orderType === "DELIVERY"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-extrabold"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Delivery (CNC)
          </button>
          <button
            type="button"
            onClick={() => setOrderType("INTRADAY")}
            className={`py-1.5 text-xs font-bold rounded-lg transition ${
              orderType === "INTRADAY"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-extrabold"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Intraday (MIS 5x)
          </button>
        </div>

        {/* Quantity Controls */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Quantity (Shares)</span>
            {!isBuy && stock.shares ? (
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                Available: {stock.shares} sh
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleQtyChange(-5)}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              -5
            </button>
            <button
              type="button"
              onClick={() => handleQtyChange(-1)}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              -1
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 h-10 text-center text-sm font-black font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => handleQtyChange(1)}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => handleQtyChange(5)}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              +5
            </button>
          </div>
        </div>

        {/* Order Price (Market / Limit) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Price</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPriceType("MARKET")}
                className={`text-[11px] px-2 py-0.5 rounded font-bold transition ${
                  priceType === "MARKET"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Market (LTP)
              </button>
              <button
                type="button"
                onClick={() => setPriceType("LIMIT")}
                className={`text-[11px] px-2 py-0.5 rounded font-bold transition ${
                  priceType === "LIMIT"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Limit
              </button>
            </div>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
            <input
              type="number"
              step="0.05"
              disabled={priceType === "MARKET"}
              value={priceType === "MARKET" ? stock.price.toFixed(2) : customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              className={`w-full pl-7 pr-3 py-2 text-sm font-black font-mono rounded-xl border ${
                priceType === "MARKET"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
              }`}
            />
          </div>
        </div>

        {/* Summary Breakdown */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>Approx. Required Margin:</span>
            <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
              ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500 text-[11px]">
            <span>Available Balance:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              ₹{availableBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleExecute}
          disabled={isProcessing}
          className={`w-full py-3 rounded-xl font-black text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
            isBuy
              ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
              : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
          } ${isProcessing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {isProcessing ? "Executing Order..." : `${isBuy ? "BUY" : "SELL"} ${quantity} SHARES OF ${stock.symbol}`}
        </button>

      </div>
    </div>
  );
}
