import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { API, authHeaders, getToken } from "../lib/api";

export default function Checkout() {
  const router = useRouter();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [address, setAddress] = useState({ name: "", street: "", city: "", country: "", zip: "" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/login?redirect=/checkout"); return; }
    fetch(`${API}/cart`, { headers: authHeaders() }).then((r) => r.json()).then(setCart).catch(() => {});
    // Pre-fill address from profile
    fetch(`${API}/users/me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const u = d.data;
        if (u?.addresses?.[0]) {
          const a = u.addresses[0];
          setAddress({ name: u.name || "", street: a.street || "", city: a.city || "", country: a.country || "", zip: a.zip || "" });
        } else if (u?.name) {
          setAddress((prev) => ({ ...prev, name: u.name }));
        }
      })
      .catch(() => {});
  }, []);

  async function placeOrder() {
    if (!address.street || !address.city || !address.country || !address.zip) {
      setError("Please fill in all address fields"); return;
    }
    const items = (Array.isArray(cart.items) ? cart.items : []).map((item) => ({
      productId: item.productId, sku: item.sku, quantity: item.quantity,
    }));
    if (items.length === 0) { setError("Cart is empty"); return; }

    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ items, shippingAddress: address, paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Order failed"); return; }
      setSuccess(data.data);
      if (typeof window !== "undefined" && window.__toast) window.__toast("Order placed successfully!", "success");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  if (success) {
    return (
      <>
        <Head><title>Order Confirmed — ShopNest</title></Head>
        <Navbar />
        <div style={{ minHeight: "80vh", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "48px 40px", maxWidth: 520, width: "100%", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#111827", marginBottom: 8 }}>Order Placed!</h1>
            <p style={{ color: "#6B7280", fontSize: "0.875rem", marginBottom: 20 }}>
              Order ID: <code style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 4, fontSize: "0.8rem" }}>{success._id}</code>
            </p>
            <p style={{ fontWeight: 800, fontSize: "1.5rem", color: "#111827", marginBottom: 20 }}>
              Total: ${success.totalAmount?.toFixed(2)}
            </p>
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "14px 16px", marginBottom: 28, textAlign: "left" }}>
              <p style={{ color: "#15803D", fontSize: "0.82rem", lineHeight: 1.6 }}>
                ✅ ACID Transaction committed — inventory decremented atomically in MongoDB.<br />
                Redis cart cleared, leaderboards updated.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/orders" className="btn-primary" style={{ display: "inline-flex", padding: "11px 24px" }}>View My Orders</Link>
              <Link href="/" className="btn-outline" style={{ display: "inline-flex", padding: "11px 24px" }}>Continue Shopping</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const items = Array.isArray(cart.items) ? cart.items : [];

  return (
    <>
      <Head><title>Checkout — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 32 }}>Checkout</h1>
            <div style={{ display: "grid", gap: 32 }} className="checkout-layout">
              {/* Shipping + Payment */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", marginBottom: 20 }}>Shipping Address</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Full Name</label>
                      <input className="input-field" placeholder="John Doe" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Street Address</label>
                      <input className="input-field" placeholder="123 Main St" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>City</label>
                      <input className="input-field" placeholder="New York" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>ZIP / Postal Code</label>
                      <input className="input-field" placeholder="10001" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Country</label>
                      <input className="input-field" placeholder="United States" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", marginBottom: 16 }}>Payment Method</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[["cod", "Cash on Delivery"], ["credit_card", "Credit Card"], ["debit_card", "Debit Card"]].map(([val, label]) => (
                      <label key={val} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 8, border: paymentMethod === val ? "2px solid #E11D48" : "2px solid #E5E7EB", cursor: "pointer", background: paymentMethod === val ? "#FFF1F2" : "#fff" }}>
                        <input type="radio" name="payment" value={val} checked={paymentMethod === val} onChange={() => setPaymentMethod(val)} style={{ accentColor: "#E11D48" }} />
                        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: paymentMethod === val ? "#E11D48" : "#374151" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "12px 16px" }}>
                    <p style={{ color: "#E11D48", fontSize: "0.875rem" }}>{error}</p>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", height: "fit-content" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "#111827", marginBottom: 16 }}>Order Summary</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                      <span style={{ color: "#6B7280" }}>{item.productName} × {item.quantity}</span>
                      <span style={{ fontWeight: 600 }}>${item.lineTotal?.toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#6B7280", fontSize: "0.875rem" }}>Shipping</span>
                    <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.875rem" }}>Free</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800 }}>Total</span>
                    <span style={{ fontWeight: 800 }}>${cart.total?.toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={placeOrder} disabled={loading || items.length === 0} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "14px", opacity: loading || items.length === 0 ? 0.7 : 1 }}>
                  {loading ? "Placing order..." : "Place Order"}
                </button>
                <p style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: 12, lineHeight: 1.5, textAlign: "center" }}>
                  🔒 Processed in a MongoDB ACID transaction with write concern majority.
                </p>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          .checkout-layout { grid-template-columns: 1fr 360px; }
          @media (max-width: 768px) { .checkout-layout { grid-template-columns: 1fr; } }
        `}</style>

        <Footer />
      </div>
    </>
  );
}
