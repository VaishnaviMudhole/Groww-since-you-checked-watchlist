const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://groww-since-you-checked-watchlist.onrender.com";

// --- Authentication API ---
export async function signupUser(username, password) {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Signup failed");
  return data;
}

export async function loginUser(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Invalid credentials");
  return data;
}

// Fetch watchlists from Supabase
export async function fetchWatchlists(userId = "user_vaishnavi_demo") {
  const res = await fetch(`${BASE_URL}/db/watchlists?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`Failed to fetch watchlists: ${res.status}`);
  return res.json();
}

// Create a new watchlist in Supabase
export async function createWatchlist(name, userId = "user_vaishnavi_demo") {
  const res = await fetch(`${BASE_URL}/db/watchlists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, user_id: userId }),
  });
  if (!res.ok) throw new Error(`Failed to create watchlist: ${res.status}`);
  return res.json();
}

// Add a stock symbol to Supabase
export async function addStockToWatchlist(watchlistId, symbol) {
  const res = await fetch(`${BASE_URL}/db/watchlists/${watchlistId}/items?symbol=${encodeURIComponent(symbol)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to add stock: ${res.status}`);
  return res.json();
}

// Remove a stock item from Supabase
export async function removeStockFromWatchlist(watchlistId, itemId) {
  const res = await fetch(`${BASE_URL}/db/watchlists/${watchlistId}/items/${itemId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete stock: ${res.status}`);
  return res.json();
}

// Record a session checkpoint ("Mark Checked")
export async function recordSessionCheckpoint(watchlistId) {
  const res = await fetch(`${BASE_URL}/db/watchlists/${watchlistId}/sessions/checkpoint`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to record session checkpoint: ${res.status}`);
  return res.json();
}

// Fetch session checkpoints history
export async function fetchSessionHistory(watchlistId) {
  const res = await fetch(`${BASE_URL}/db/watchlists/${watchlistId}/sessions`);
  if (!res.ok) throw new Error(`Failed to fetch session history: ${res.status}`);
  return res.json();
}

// Health check
export async function checkSystemHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return await res.json();
  } catch (err) {
    return { status: "offline", error: err.message };
  }
}

// Fetch ranked watchlist with computed signals
export async function fetchWatchlistSignals(watchlistId) {
  const url = `${BASE_URL}/watchlist${watchlistId ? `?watchlist_id=${watchlistId}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch signals: ${res.status}`);
  return res.json();
}