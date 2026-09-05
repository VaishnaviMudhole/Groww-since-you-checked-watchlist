import React, { useState } from "react";
import { loginUser, signupUser } from "../api/client";

export default function AuthModal({ onLoginSuccess, onClose, canClose = false, currentTheme = "dark" }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isDark = currentTheme === "dark";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const cleanId = identifier.trim().toLowerCase();
    
    if (!cleanId || cleanId.length < 3) {
      setError("Please enter a valid Email ID or 10-digit Mobile Number");
      return;
    }
    if (!pin || pin.length < 4) {
      setError("Security PIN / Password must be at least 4 characters");
      return;
    }

    try {
      setLoading(true);
      let res;
      if (isSignUp) {
        res = await signupUser(cleanId, pin);
      } else {
        res = await loginUser(cleanId, pin);
      }

      localStorage.setItem("sw_user_id", cleanId);
      localStorage.setItem("sw_auth_token", res.token || `tok_${Date.now()}`);
      onLoginSuccess(cleanId, isSignUp);
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestId = "9110679101";
    localStorage.setItem("sw_user_id", guestId);
    localStorage.setItem("sw_auth_token", `guest_${Date.now()}`);
    onLoginSuccess(guestId, false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 sm:p-8 relative transition-colors ${
        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
      }`}>
        
        {canClose && (
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 text-sm font-bold p-1.5 rounded-lg transition ${
              isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            ✕
          </button>
        )}

        {/* Brand Logo & Heading */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-extrabold tracking-wider uppercase">
            <span>⚡ TrackPulse</span>
            <span className="text-slate-500">•</span>
            <span>Since You Checked</span>
          </div>
          <h2 className={`text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            {isSignUp ? "Create Your Account" : "Welcome Back"}
          </h2>
          <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            Track your stock checkpoint prices and catalyst briefings in real-time
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-bold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Email ID or Mobile Number
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 9110679101 or user@example.com"
              required
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                  : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1.5 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Security PIN / Password
            </label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN or password"
                required
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                    : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-200 font-bold"
              >
                {showPin ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black py-3 rounded-xl text-sm shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? "Authenticating..." : isSignUp ? "Sign Up & Start Tracking" : "Sign In to Watchlist"}
          </button>
        </form>

        {/* Toggle Login / SignUp */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className={`text-xs font-bold transition ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Demo Fast Track */}
        <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
          <button
            type="button"
            onClick={handleGuestLogin}
            className={`text-xs font-bold py-2 px-4 rounded-xl border transition ${
              isDark
                ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            🚀 Continue with Demo Account (9110679101)
          </button>
        </div>

      </div>
    </div>
  );
}
