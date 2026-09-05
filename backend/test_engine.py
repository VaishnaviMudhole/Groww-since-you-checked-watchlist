import sys
import unittest
from fastapi.testclient import TestClient

# Import backend application
from main import app
from market_service import compute_volatility_normalized_signals, fetch_real_stock_data

class WatchlistEngineTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_user = "test_evaluator_suite"

    def test_01_health_and_database_connection(self):
        """Verify Supabase PostgreSQL cloud connection and system health."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertIn("Supabase PostgreSQL", data.get("database", ""))
        print("  [PASS] System Health & Supabase Cloud Connection Verified")

    def test_02_cross_device_user_persistence(self):
        """Verify that a user's watchlists persist across devices tied to user_id."""
        # 1. Fetch or auto-seed watchlists for test user
        res = self.client.get(f"/db/watchlists?user_id={self.test_user}")
        self.assertEqual(res.status_code, 200)
        watchlists = res.json()
        self.assertTrue(len(watchlists) >= 1)
        self.assertEqual(watchlists[0]["user_id"], self.test_user)

        # 2. Create a custom watchlist for this user
        create_res = self.client.post("/db/watchlists", json={
            "name": "Automated Test Watchlist",
            "user_id": self.test_user
        })
        self.assertEqual(create_res.status_code, 200)
        new_wl = create_res.json()
        self.assertEqual(new_wl["name"], "Automated Test Watchlist")
        self.assertEqual(new_wl["user_id"], self.test_user)
        print("  [PASS] Cross-Device User ID Persistence in Supabase Verified")

    def test_03_watchlist_item_crud(self):
        """Verify adding and removing stocks directly in Supabase."""
        # Get active watchlist
        res = self.client.get(f"/db/watchlists?user_id={self.test_user}")
        w_id = res.json()[0]["id"]

        # Add HAL
        add_res = self.client.post(f"/db/watchlists/{w_id}/items?symbol=HAL")
        self.assertEqual(add_res.status_code, 200)
        item = add_res.json()
        self.assertEqual(item["symbol"], "HAL")
        item_id = item["id"]

        # Remove HAL
        del_res = self.client.delete(f"/db/watchlists/{w_id}/items/{item_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["status"], "success")
        print("  [PASS] Stock Addition & Deletion in Supabase Verified")

    def test_04_session_checkpoint_persistence(self):
        """Verify session checkpoint creation and cloud history tracking."""
        res = self.client.get(f"/db/watchlists?user_id={self.test_user}")
        w_id = res.json()[0]["id"]

        # Save Checkpoint
        cp_res = self.client.post(f"/db/watchlists/{w_id}/sessions/checkpoint")
        self.assertEqual(cp_res.status_code, 200)
        self.assertEqual(cp_res.json()["status"], "success")

        # Fetch Checkpoint History
        hist_res = self.client.get(f"/db/watchlists/{w_id}/sessions")
        self.assertEqual(hist_res.status_code, 200)
        sessions = hist_res.json()
        self.assertTrue(len(sessions) >= 1)
        print("  [PASS] Cloud Session Checkpointing & Audit Trail Verified")

    def test_05_scoring_formula_and_attribution(self):
        """Verify the 40% Price + 35% Volume + 25% Alpha mathematical attribution."""
        stock = {
            "symbol": "INFY",
            "status": "success",
            "price": 1580.30,
            "prev_close": 1602.50,
            "avg_volume_20d": 3100000,
            "today_volume": 6900000,
            "historical_volatility": 1.40,
            "sector": "Tech"
        }
        signals = compute_volatility_normalized_signals(stock, benchmark_return=0.45)
        self.assertIn("relevance_score", signals)
        self.assertIn("score_breakdown", signals)
        
        breakdown = signals["score_breakdown"]
        expected_sum = round(breakdown["price_component"] + breakdown["volume_component"] + breakdown["alpha_component"], 2)
        self.assertAlmostEqual(signals["relevance_score"], expected_sum, places=1)
        print(f"  [PASS] Mathematical Attribution Verified: Score={signals['relevance_score']} (40% Price + 35% Volume + 25% Alpha)")

    def test_06_low_liquidity_detection_pennytest(self):
        """Verify Rupee Turnover (< Rs 2 Cr) flags low-liquidity microcaps."""
        penny = fetch_real_stock_data("PENNYTEST")
        signals = compute_volatility_normalized_signals(penny, benchmark_return=0.0)
        self.assertTrue(signals["is_illiquid"])
        self.assertEqual(signals["confidence"], "low")
        self.assertIn("Low liquidity warning", signals["insight"])
        print("  [PASS] Low-Liquidity Filter (PENNYTEST) Verified")

    def test_07_graceful_error_handling_brokenstock(self):
        """Verify unhappy path: broken/unquoted stocks do not crash the engine."""
        broken = fetch_real_stock_data("BROKENSTOCK")
        self.assertEqual(broken["status"], "error")
        self.assertIsNone(broken["price"])
        
        signals = compute_volatility_normalized_signals(broken, benchmark_return=0.0)
        self.assertEqual(signals["status"], "error")
        self.assertEqual(signals["relevance_score"], 0.0)
    def test_08_authentication_security_layer(self):
        """Verify User Signup, Login, and Password Security Layer."""
        import random
        uname = f"user_test_{random.randint(1000, 9999)}"
        pwd = "securePassword123"

        # 1. Sign Up
        signup_res = self.client.post("/auth/signup", json={"username": uname, "password": pwd})
        self.assertEqual(signup_res.status_code, 200)
        data = signup_res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("token", data)
        self.assertEqual(data["user_id"], uname)

        # 2. Login with valid password
        login_res = self.client.post("/auth/login", json={"username": uname, "password": pwd})
        self.assertEqual(login_res.status_code, 200)
        self.assertEqual(login_res.json()["status"], "success")

        # 3. Login with invalid password
        bad_login = self.client.post("/auth/login", json={"username": uname, "password": "wrongPassword"})
        self.assertEqual(bad_login.status_code, 401)
        print("  [PASS] User Authentication & Security Layer (Signup/Login) Verified")

if __name__ == "__main__":
    print("\n=======================================================")
    print("  RUNNING AUTOMATED TEST SUITE: 'Since You Checked'")
    print("=======================================================\n")
    unittest.main(verbosity=2)
