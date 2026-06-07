import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SkeletonBox } from "../../components/Skeleton";
import { API, authHeaders, getToken, statusColor } from "../../lib/api";

const PAYMENT_LABELS = {
  cod: "Cash on Delivery",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  upi: "UPI",
  wallet: "Wallet",
};

function formatPayment(method) {
  return PAYMENT_LABELS[method] || (method || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
}

function itemImage(item) {
  if (item.imageSnapshot) return item.imageSnapshot;
  const name = (item.nameSnapshot || "product").replace(/\s+/g, "-").toLowerCase();
  return `https://picsum.photos/seed/${name}/200/200`;
}

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    if (!getToken()) { router.push("/login"); return; }
    fetch(`${API}/orders/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setOrder(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 40 }}>
        <SkeletonBox height={400} style={{ borderRadius: 12 }} />
      </div>
    </>
  );

  if (!order) return (
    <>
      <Navbar />
      <div style={{ textAlign: "center", padding: "80px" }}>
        <p style={{ color: "#9CA3AF" }}>Order not found.</p>
        <Link href="/orders" style={{ color: "#E11D48" }}>← Back to Orders</Link>
      </div>
    </>
  );

  const a = order.shippingAddress || {};

  return (
    <>
      <Head><title>Order #{order._id?.slice(-8).toUpperCase()} — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <Link href="/orders" style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
              ← Back to Orders
            </Link>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827", marginBottom: 6 }}>
                  Order #{order._id?.slice(-8).toUpperCase()}
                </h1>
                <p style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>
                  Placed {new Date(order.placedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <span className={`badge ${statusColor(order.status)}`} style={{ fontSize: "0.8rem", padding: "6px 14px" }}>
                {order.status}
              </span>
            </div>

            <div style={{ display: "grid", gap: 20 }} className="order-layout">
              {/* Items */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 16, color: "#374151" }}>Order Items</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {(order.items || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < order.items.length - 1 ? "1px solid #F3F4F6" : "none", alignItems: "center" }}>
                      <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#F3F4F6" }}>
                        <img
                          src={itemImage(item)}
                          alt={item.nameSnapshot}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          onError={(e) => { e.target.onerror = null; e.target.src = `https://picsum.photos/seed/${Math.round(Math.random() * 1000)}/200/200`; }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>{item.nameSnapshot}</p>
                        <p style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>SKU: {item.sku} · Qty: {item.quantity}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>${item.lineTotal?.toFixed(2)}</p>
                        <p style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>${item.priceSnapshot?.toFixed(2)} each</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Summary */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 14, color: "#374151" }}>Order Total</p>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.875rem" }}>
                    <span style={{ color: "#6B7280" }}>Subtotal</span>
                    <span>${order.totalAmount?.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.875rem" }}>
                    <span style={{ color: "#6B7280" }}>Shipping</span>
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>Free</span>
                  </div>
                  <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800 }}>Total</span>
                    <span style={{ fontWeight: 800 }}>${order.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Shipping address */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 10, color: "#374151" }}>Shipping Address</p>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.8 }}>
                    {a.name && <>{a.name}<br /></>}
                    {a.street}<br />
                    {a.city}{a.zip && `, ${a.zip}`}<br />
                    {a.country}
                  </p>
                </div>

                {/* Payment */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 6, color: "#374151" }}>Payment Method</p>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>{formatPayment(order.paymentMethod)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          .order-layout { grid-template-columns: 1fr 280px; }
          @media (max-width: 768px) { .order-layout { grid-template-columns: 1fr; } }
        `}</style>

        <Footer />
      </div>
    </>
  );
}
