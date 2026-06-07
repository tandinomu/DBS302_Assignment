import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CartItem from "../components/CartItem";
import { SkeletonRow } from "../components/Skeleton";
import { API, authHeaders } from "../lib/api";

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  async function loadCart() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/cart`, { headers: authHeaders() });
      if (res.ok) setCart(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadCart(); }, []);

  async function handleUpdate(item, newQty) {
    if (newQty < 1) { handleRemove(item); return; }
    await fetch(`${API}/cart/update`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ productId: item.productId, sku: item.sku, quantity: newQty }),
    });
    loadCart();
  }

  async function handleRemove(item) {
    await fetch(`${API}/cart/item`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ productId: item.productId, sku: item.sku }),
    });
    loadCart();
    if (typeof window !== "undefined" && window.__toast) window.__toast("Item removed", "info");
  }

  async function handleClear() {
    await fetch(`${API}/cart`, { method: "DELETE", headers: authHeaders() });
    setCart({ items: [], total: 0 });
  }

  const items = Array.isArray(cart.items) ? cart.items : [];
  const subtotal = cart.total || 0;

  return (
    <>
      <Head><title>Shopping Cart — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />

        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container">
            <div style={{ paddingTop: 40, marginBottom: 24 }}>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 6 }}>Your Shopping Cart</h1>
              {!loading && <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                {items.length === 0 ? "Your cart is empty." : `You have ${items.length} item${items.length !== 1 ? "s" : ""} in your basket.`}
              </p>}
            </div>

            {loading ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24 }}>
                {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : items.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: "64px 24px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" style={{ margin: "0 auto 16px" }}>
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#374151", marginBottom: 6 }}>Your cart is empty</p>
                <p style={{ color: "#9CA3AF", fontSize: "0.875rem", marginBottom: 24 }}>Add some products to get started.</p>
                <Link href="/products" className="btn-primary" style={{ display: "inline-flex", justifyContent: "center", padding: "12px 28px" }}>
                  Continue Shopping
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 24 }} className="cart-layout">
                {/* Items */}
                <div style={{ background: "#fff", borderRadius: 12, padding: "8px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 16, padding: "10px 0", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
                    <span /><span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF" }}>Product</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF" }}>Quantity</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", textAlign: "right" }}>Price</span>
                  </div>
                  {items.map((item, i) => (
                    <CartItem key={i} item={item} onUpdate={handleUpdate} onRemove={handleRemove} />
                  ))}
                  <div style={{ padding: "12px 0" }}>
                    <button onClick={handleClear} style={{ color: "#9CA3AF", fontSize: "0.8rem", textDecoration: "underline" }}>Clear cart</button>
                  </div>
                </div>

                {/* Order Summary */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", height: "fit-content" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "#111827", marginBottom: 20 }}>Order Summary</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#6B7280" }}>
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                      <span style={{ color: "#6B7280" }}>Shipping</span>
                      <span style={{ color: "#16a34a", fontWeight: 600 }}>Free</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#6B7280" }}>
                      <span>Estimated Tax</span>
                      <span>$0.00</span>
                    </div>
                    <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 800, fontSize: "1rem" }}>Total</span>
                      <span style={{ fontWeight: 800, fontSize: "1rem" }}>${subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <button onClick={() => router.push("/checkout")} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "14px 24px" }}>
                    Proceed to Checkout
                  </button>
                  <div style={{ marginTop: 16, textAlign: "center" }}>
                    <p style={{ fontSize: "0.75rem", color: "#9CA3AF", marginBottom: 8 }}>Secure Payment Guaranteed</p>
                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                      {["VISA", "MC", "AMEX"].map((c) => (
                        <span key={c} style={{ background: "#F3F4F6", padding: "3px 8px", borderRadius: 4, fontSize: "0.65rem", fontWeight: 700, color: "#6B7280" }}>{c}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid #F3F4F6", marginTop: 14, paddingTop: 14, textAlign: "center" }}>
                    <span style={{ color: "#E11D48", fontSize: "0.8rem", cursor: "pointer" }}>Add a discount code at checkout</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .cart-layout { grid-template-columns: 1fr 340px; }
          @media (max-width: 768px) { .cart-layout { grid-template-columns: 1fr; } }
        `}</style>

        <Footer />
      </div>
    </>
  );
}
