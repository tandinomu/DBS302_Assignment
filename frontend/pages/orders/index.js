import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SkeletonRow } from "../../components/Skeleton";
import { API, authHeaders, requireAuth, statusColor, formatPrice } from "../../lib/api";

export default function Orders() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!requireAuth(router)) return;
    setReady(true);
    fetch(`${API}/orders`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setOrders(d.data || []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (!ready) return null;

  return (
    <>
      <Head><title>My Orders — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 28 }}>My Orders</h1>

            {error && (
              <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ color: "#E11D48", fontSize: "0.875rem" }}>Failed to load orders. <button onClick={() => window.location.reload()} style={{ color: "#E11D48", fontWeight: 700, cursor: "pointer" }}>Retry</button></p>
              </div>
            )}

            {loading ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24 }}>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            ) : orders.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: "64px 24px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>No orders yet</p>
                <p style={{ color: "#9CA3AF", fontSize: "0.875rem", marginBottom: 24 }}>Start shopping to see your orders here.</p>
                <Link href="/products" className="btn-primary" style={{ display: "inline-flex", padding: "12px 28px" }}>Browse Products</Link>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="table-auto" style={{ minWidth: 560 }}>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order._id} style={{ cursor: "pointer" }} onClick={() => router.push(`/orders/${order._id}`)}>
                          <td><code style={{ fontSize: "0.78rem", color: "#6B7280" }}>{order._id?.slice(-8).toUpperCase()}</code></td>
                          <td style={{ color: "#6B7280" }}>{new Date(order.placedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
                          <td>{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}</td>
                          <td style={{ fontWeight: 700 }}>{formatPrice(order.totalAmount)}</td>
                          <td><span className={`badge ${statusColor(order.status)}`}>{order.status}</span></td>
                          <td>
                            <Link href={`/orders/${order._id}`} style={{ color: "#E11D48", fontSize: "0.8rem", fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>View →</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
