import React, { useState } from "react";
import { loginUser, signupUser } from "../api/client";

export default function AuthModal({ onLoginSuccess, onClose, canClose = false }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const cleanId = identifier.trim().toLowerCase();
    
    if (!cleanId || cleanId.length < 3) {
      setError("Please enter a valid Email ID or 10-digit Mobile Number");
      return;
    }
    if (!pin || pin.length < 4) {
      setError("Groww Security PIN / Password must be at least 4 characters");
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

      localStorage.setItem("groww_user_id", cleanId);
      localStorage.setItem("sw_user_id", cleanId);
      localStorage.setItem("sw_auth_token", res.token || `groww_${Date.now()}`);
      onLoginSuccess(cleanId, isSignUp);
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(3, 7, 18, 0.90)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100000,
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #1f293d",
          borderRadius: "20px",
          padding: "32px 28px",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 208, 156, 0.2)",
          color: "#f8fafc",
          position: "relative",
          animation: "fadeIn 0.25s ease-out",
        }}
      >
        {canClose && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "18px",
            }}
          >
            ✕
          </button>
        )}

        {/* Groww Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(0, 208, 156, 0.1)", padding: "6px 14px", borderRadius: "20px", border: "1px solid rgba(0, 208, 156, 0.3)", marginBottom: "12px" }}>
            <span style={{ fontSize: "16px" }}>⚡</span>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "#00d09c", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Groww Watchlist Identity
            </span>
          </div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "22px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px" }}>
            {isSignUp ? "Create Your Groww Account" : "Sign In to Groww"}
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
            {isSignUp ? "Enter your Email or Mobile to build your personalized watchlist" : "Enter your Email ID or Mobile to view your live watchlist"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", background: "#090d16", padding: "4px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #1e293b" }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); }}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: "8px",
              border: "none",
              background: !isSignUp ? "#1e293b" : "transparent",
              color: !isSignUp ? "#00d09c" : "#94a3b8",
              fontWeight: "800",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(null); }}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: "8px",
              border: "none",
              background: isSignUp ? "#1e293b" : "transparent",
              color: isSignUp ? "#00d09c" : "#94a3b8",
              fontWeight: "800",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", marginBottom: "16px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#cbd5e1", marginBottom: "6px" }}>
              Email ID or 10-Digit Mobile Number
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. 9110679101 or user@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                borderRadius: "10px",
                border: "1px solid #334155",
                backgroundColor: "#090d16",
                color: "#ffffff",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#cbd5e1", marginBottom: "6px" }}>
              Groww Security PIN / Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPin ? "text" : "password"}
                required
                placeholder="Enter 4+ character PIN or password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "11px 40px 11px 14px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  backgroundColor: "#090d16",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {showPin ? "👁️" : "🔒"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "6px",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #00d09c 0%, #059669 100%)",
              color: "#0c1017",
              fontSize: "14px",
              fontWeight: "800",
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(0, 208, 156, 0.3)",
              transition: "transform 0.1s ease",
            }}
          >
            {loading ? "Connecting to Groww..." : isSignUp ? "Create Account & Pick Stocks" : "Sign In to Watchlist"}
          </button>
        </form>
      </div>
    </div>
  );
}
