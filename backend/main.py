import traceback
import hashlib
import secrets
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession
from db import get_db, engine
import models
from market_service import (
    fetch_real_stock_data,
    compute_volatility_normalized_signals,
    get_benchmark_return,
    generate_executive_briefing,
    is_market_open_now,
)

# Auto-create tables in Supabase PostgreSQL
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Table creation warning: {e}")

app = FastAPI(title="Since You Checked - Watchlist Relevance Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing utilities
def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = secrets.token_hex(8)
    h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}${h}"

def verify_password(password: str, stored: str) -> bool:
    if not stored or "$" not in stored:
        return False
    salt, h = stored.split("$", 1)
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest() == h


class AuthPayload(BaseModel):
    username: str
    password: str


@app.post("/auth/signup")
def signup(payload: AuthPayload, db: DBSession = Depends(get_db)):
    clean_user = payload.username.strip().lower()
    if not clean_user or len(clean_user) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not payload.password or len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    existing = db.query(models.User).filter(models.User.username == clean_user).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered. Please sign in.")

    pwd_hash = hash_password(payload.password)
    user = models.User(username=clean_user, password_hash=pwd_hash)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = f"groww_tok_{user.id}_{secrets.token_hex(16)}"
    return {
        "status": "success",
        "user_id": clean_user,
        "token": token,
        "message": "Account created successfully"
    }


@app.post("/auth/login")
def login(payload: AuthPayload, db: DBSession = Depends(get_db)):
    clean_user = payload.username.strip().lower()
    user = db.query(models.User).filter(models.User.username == clean_user).first()

    # Legacy demo users auto-provisioning
    if not user and clean_user in ["vaishnavi_groww", "user_vaishnavi_demo", "demo_judge"]:
        pwd_hash = hash_password(payload.password)
        user = models.User(username=clean_user, password_hash=pwd_hash)
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = f"groww_tok_{user.id}_{secrets.token_hex(16)}"
    return {
        "status": "success",
        "user_id": clean_user,
        "token": token,
        "message": "Logged in successfully"
    }


@app.get("/auth/me")
def get_current_user(user_id: str = Query("vaishnavi_groww"), db: DBSession = Depends(get_db)):
    clean_user = user_id.strip().lower()
    user = db.query(models.User).filter(models.User.username == clean_user).first()
    return {
        "authenticated": True,
        "user_id": clean_user,
        "created_at": user.created_at if user else datetime.now(timezone.utc).isoformat()
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "traceback": traceback.format_exc().splitlines()[-3:]
        }
    )

@app.get("/ping")
def ping():
    return {"status": "ok", "message": "backend is alive", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/health")
def health_check(db: DBSession = Depends(get_db)):
    try:
        watchlist_count = db.query(models.Watchlist).count()
        return {
            "status": "healthy",
            "database": "connected (Supabase PostgreSQL)",
            "total_watchlists": watchlist_count,
            "engine": "active"
        }
    except Exception as e:
        return {"status": "degraded", "database_error": str(e)}


# --- Supabase Database-backed Watchlist & Session Endpoints ---

class CreateWatchlistPayload(BaseModel):
    name: str
    user_id: str = "user_vaishnavi_demo"

@app.get("/db/watchlists")
def list_watchlists(user_id: str = Query("user_vaishnavi_demo"), auto_seed: bool = Query(False), db: DBSession = Depends(get_db)):
    """Returns all watchlists stored in Supabase for the specified user_id."""
    clean_user = user_id.strip() or "user_vaishnavi_demo"
    watchlists = (
        db.query(models.Watchlist)
        .filter(models.Watchlist.user_id == clean_user)
        .order_by(models.Watchlist.created_at.asc())
        .all()
    )
    
    # If auto_seed is True (or legacy default), seed starter stocks
    if not watchlists and auto_seed:
        default_wl = models.Watchlist(name="Primary Watchlist", user_id=clean_user)
        db.add(default_wl)
        db.commit()
        db.refresh(default_wl)
        
        starter_symbols = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "TATAMOTORS"]
        for sym in starter_symbols:
            db.add(models.WatchlistItem(watchlist_id=default_wl.id, symbol=sym))
        db.commit()
        watchlists = [default_wl]

    return [{"id": str(w.id), "name": w.name, "user_id": w.user_id, "created_at": w.created_at} for w in watchlists]

@app.post("/db/watchlists")
def create_watchlist(payload: CreateWatchlistPayload, db: DBSession = Depends(get_db)):
    """Create a new watchlist in Supabase tied to a user_id."""
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Watchlist name cannot be empty")
    clean_user = payload.user_id.strip() or "user_vaishnavi_demo"
    new_wl = models.Watchlist(name=clean_name, user_id=clean_user)
    db.add(new_wl)
    db.commit()
    db.refresh(new_wl)
    return {"id": str(new_wl.id), "name": new_wl.name, "user_id": new_wl.user_id, "created_at": new_wl.created_at}

@app.post("/db/watchlists/{watchlist_id}/items")
def add_stock(watchlist_id: str, symbol: str, db: DBSession = Depends(get_db)):
    """Add a stock symbol to a watchlist in Supabase."""
    clean_symbol = symbol.strip().upper()
    existing = db.query(models.WatchlistItem).filter(
        models.WatchlistItem.watchlist_id == watchlist_id,
        models.WatchlistItem.symbol == clean_symbol
    ).first()
    if existing:
        return {"id": str(existing.id), "symbol": existing.symbol, "message": "Already exists"}

    item = models.WatchlistItem(watchlist_id=watchlist_id, symbol=clean_symbol)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": str(item.id), "symbol": item.symbol}

@app.delete("/db/watchlists/{watchlist_id}/items/{item_id}")
def remove_stock(watchlist_id: str, item_id: str, db: DBSession = Depends(get_db)):
    """Remove a stock from a watchlist."""
    item = db.query(models.WatchlistItem).filter(
        models.WatchlistItem.id == item_id,
        models.WatchlistItem.watchlist_id == watchlist_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "success", "message": "Item deleted"}

@app.get("/db/watchlists/{watchlist_id}/sessions")
def get_session_history(watchlist_id: str, db: DBSession = Depends(get_db)):
    """View session checkpoint history from Supabase."""
    sessions = (
        db.query(models.Session)
        .filter(models.Session.watchlist_id == watchlist_id)
        .order_by(models.Session.opened_at.desc())
        .limit(10)
        .all()
    )
    return [{"id": str(s.id), "opened_at": s.opened_at.isoformat()} for s in sessions]

@app.post("/db/watchlists/{watchlist_id}/sessions/checkpoint")
def create_checkpoint(watchlist_id: str, db: DBSession = Depends(get_db)):
    """Creates a new session checkpoint representing the moment user marked watchlist as 'checked'."""
    now = datetime.now(timezone.utc)
    new_session = models.Session(watchlist_id=watchlist_id, opened_at=now)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return {
        "status": "success",
        "checkpoint_id": str(new_session.id),
        "checked_at": new_session.opened_at.isoformat()
    }


# --- Core Scoring & 'Since You Checked' Endpoint ---

@app.get("/watchlist")
def get_watchlist(
    watchlist_id: str = Query(None),
    db: DBSession = Depends(get_db)
):
    stocks_to_process = []
    last_session_time = None
    time_diff_str = "today"

    if watchlist_id:
        items = db.query(models.WatchlistItem).filter(models.WatchlistItem.watchlist_id == watchlist_id).all()
        for item in items:
            market_data = fetch_real_stock_data(item.symbol)
            stocks_to_process.append({
                "item_id": str(item.id),
                "symbol": item.symbol,
                **market_data
            })

        past_sessions = (
            db.query(models.Session)
            .filter(models.Session.watchlist_id == watchlist_id)
            .order_by(models.Session.opened_at.desc())
            .limit(2)
            .all()
        )
        if past_sessions:
            sess_time = past_sessions[0].opened_at
            last_session_time = sess_time.isoformat()
            if sess_time.tzinfo is None:
                sess_time = sess_time.replace(tzinfo=timezone.utc)
            diff_seconds = max(0, (datetime.now(timezone.utc) - sess_time).total_seconds())
            diff_mins = max(1, int(diff_seconds // 60))
            if diff_mins < 60:
                time_diff_str = f"in the last {diff_mins}m"
            else:
                time_diff_str = f"in the last {int(diff_mins//60)}h"

    if not stocks_to_process:
        default_symbols = ["RELIANCE", "TCS", "INFY", "TATAMOTORS", "HDFCBANK", "ICICIBANK", "ITC"]
        for sym in default_symbols:
            market_data = fetch_real_stock_data(sym)
            stocks_to_process.append({
                "item_id": None,
                "symbol": sym,
                **market_data
            })

    benchmark_return = get_benchmark_return()
    is_open, market_status_desc = is_market_open_now()

    results = []
    for stock in stocks_to_process:
        signals = compute_volatility_normalized_signals(stock, benchmark_return)
        results.append({**stock, **signals})

    # Sort descending by relevance score (errors at the very bottom)
    results.sort(key=lambda s: (s.get("status") == "success", s.get("relevance_score", 0)), reverse=True)

    executive_briefing = generate_executive_briefing(results, benchmark_return, time_diff_str)

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "last_checked_at": last_session_time,
        "executive_briefing": executive_briefing,
        "market": {
            "is_open": is_open,
            "status_text": market_status_desc,
        },
        "benchmark": {
            "name": "NIFTY 50",
            "pct_change": benchmark_return,
        },
        "stocks": results,
    }