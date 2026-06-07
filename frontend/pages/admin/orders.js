import Head from "next/head";
import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SkeletonRow } from "../../components/Skeleton";
import { API, authHeaders, requireAuth, statusColor, formatPrice } from "../../lib/api";

const STATUSES = ["placed", "confirmed", "shipped", "delivered", "cancelled", "returned"];

export default function AdminOrders() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    if (!requireAuth(router, ["admin"])) return;
    setReady(true);
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`${API}/orders/all`, { headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load orders");
      setOrders(d.data || []);
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  async function updateStatus(orderId, status) {
    setUpdating(orderId);
    try {
      const res = await fetch(`${API}/orders/${orderId}/status`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Update failed");
      await loadOrders();
      if (window.__toast) window.__toast(`Order marked ${status}`, "success");
    } catch {
      if (window.__toast) window.__toast("Update failed", "error");
    }
    setUpdating(null);
  }

  if (!ready) return null;

  const filtered = filterStatus ? orders.filter((o) => o.status === filterStatus) : orders;

  return (
    <>
      <Head><title>Order Management — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827" }}>Order Management</h1>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "9px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: "0.875rem", outline: "none" }}>
                  <option value="">All Statuses</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={loadOrders} className="btn-outline" style={{ fontSize: "0.875rem", padding: "9px 16px" }}>↺ Refresh</button>
              </div>
            </div>

            {error && (
              <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ color: "#E11D48", fontSize: "0.875rem" }}>Failed to load orders. <button onClick={loadOrders} style={{ color: "#E11D48", fontWeight: 700, cursor: "pointer" }}>Retry</button></p>
              </div>
            )}

            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: 24 }}>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table-auto" style={{ minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((order) => (
                        <Fragment key={order._id}>
                          <tr key={order._id} style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === order._id ? null : order._id)}>
                            <td><code style={{ fontSize: "0.78rem", color: "#6B7280" }}>{order._id?.slice(-8).toUpperCase()}</code></td>
                            <td style={{ fontWeight: 600 }}>
                              <div>{order.user?.name || "—"}</div>
                              <div style={{ fontSize: "0.82rem", color: "#6B7280" }}>{order.user?.email || ""}</div>
                            </td>
                            <td style={{ color: "#6B7280", fontSize: "0.85rem" }}>{new Date(order.placedAt).toLocaleString()}</td>
                            <td>{order.items?.length || 0}</td>
                            <td style={{ fontWeight: 700 }}>{formatPrice(order.totalAmount)}</td>
                            <td><span className={`badge ${statusColor(order.status)}`}>{order.status}</span></td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <select value={order.status} onChange={(e) => updateStatus(order._id, e.target.value)} disabled={updating === order._id} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #E5E7EB", fontSize: "0.8rem", outline: "none" }}>
                                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                          </tr>
                          {expanded === order._id && (
                            <tr key={`${order._id}-exp`}>
                              <td colSpan={7} style={{ background: "#F9FAFB", padding: "16px 20px" }}>
                                <div className="grid-2" style={{ gap: 20 }}>
                                  <div>
                                    <p style={{ fontWeight: 700, fontSize: "0.8rem", marginBottom: 8, color: "#374151" }}>Items</p>
                                    {(order.items || []).map((item, i) => (
                                      <p key={i} style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: 4 }}>
                                        {item.nameSnapshot} × {item.quantity} — {formatPrice(item.priceSnapshot * item.quantity)}
                                      </p>
                                    ))}
                                  </div>
                                  <div>
                                    <p style={{ fontWeight: 700, fontSize: "0.8rem", marginBottom: 8, color: "#374151" }}>Shipping</p>
                                    <p style={{ fontSize: "0.8rem", color: "#6B7280", lineHeight: 1.8 }}>
                                      {order.shippingAddress?.name && <>{order.shippingAddress.name}<br /></>}
                                      {order.shippingAddress?.street}<br />
                                      {order.shippingAddress?.city}, {order.shippingAddress?.country}
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                      {filtered.length === 0 && !loading && (
                        <tr><td colSpan={7} style={{ textAlign: "center", color: "#9CA3AF", padding: "48px 0" }}>No orders found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
