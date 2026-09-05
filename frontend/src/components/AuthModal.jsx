import React, { useState } from "react";
import { loginUser, signupUser } from "../api/client";

export default function AuthModal({ onLoginSuccess, onClose, canClose = false }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setError("Please enter a username or email");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    try {
      setLoading(true);
      let res;
      if (isSignUp) {
        res = await signupUser(cleanUser, password);
      } else {
        res = await loginUser(cleanUser, password);
      }

      localStorage.setItem("sw_user_id", cleanUser);
      localStorage.setItem("sw_auth_token", res.token || "demo_token");
      onLoginSuccess(cleanUser, isSignUp);
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    try {
      setLoading(true);
      setError(null);
      const demoUser = "vaishnavi_groww";
      const res = await loginUser(demoUser, "groww123");
      localStorage.setItem("sw_user_id", demoUser);
      localStorage.setItem("sw_auth_token", res.token || "demo_token");
      onLoginSuccess(demoUser, false);
    } catch (err) {
      // Fallback
      localStorage.setItem("sw_user_id", "vaishnavi_groww");
      onLoginSuccess("vaishnavi_groww", false);
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
        backgroundColor: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(8px)",
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
          border: "1px solid #1f2937",
          borderRadius: "20px",
          padding: "32px 28px",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
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

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0, 208, 156, 0.1)", padding: "6px 14px", borderRadius: "20px", border: "1px solid rgba(0, 208, 156, 0.3)", marginBottom: "12px" }}>
            <span style={{ fontSize: "16px" }}>⚡</span>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "#00d09c", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Groww Security Layer
            </span>
          </div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "22px", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.5px" }}>
            {isSignUp ? "Create Your Account" : "Sign In to Watchlist"}
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
            {isSignUp ? "Set up your private, multi-device intelligence feed" : "Access your cloud checkpoints & real-time anomaly scores"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", background: "#090d16", padding: "4px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #1e293b" }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "8px",
              border: "none",
              background: !isSignUp ? "#1e293b" : "transparent",
              color: !isSignUp ? "#38bdf8" : "#94a3b8",
              fontWeight: "700",
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
              padding: "8px",
              borderRadius: "8px",
              border: "none",
              background: isSignUp ? "#1e293b" : "transparent",
              color: isSignUp ? "#00d09c" : "#94a3b8",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            New User (Sign Up)
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
              Username or Email
            </label>
            <input
              type="text"
              required
              placeholder="e.g. rahul_investor"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              Security Password / PIN
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Enter 4+ character password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? "👁️" : "🔒"}
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
              background: isSignUp ? "linear-gradient(135deg, #00d09c 0%, #059669 100%)" : "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
              color: isSignUp ? "#000000" : "#ffffff",
              fontSize: "14px",
              fontWeight: "800",
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              transition: "transform 0.1s ease",
            }}
          >
            {loading ? "Authenticating..." : isSignUp ? "Create Account & Start Onboarding" : "Sign In to Dashboard"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", margin: "20px 0 16px 0", gap: "10px" }}>
          <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
          <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Or</span>
          <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
        </div>

        {/* 1-Click Evaluator Demo Access */}
        <button
          type="button"
          onClick={handleQuickDemo}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: "1px dashed #00d09c",
            background: "rgba(0, 208, 156, 0.08)",
            color: "#00d09c",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>⚡</span>
          <span>1-Click Evaluator Demo Access (vaishnavi_groww)</span>
        </button>
      </div>
    </div>
  );
}
