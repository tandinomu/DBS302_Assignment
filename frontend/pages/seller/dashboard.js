import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SkeletonRow } from "../../components/Skeleton";
import { API, authHeaders, requireAuth, getTokenPayload, statusColor, formatPrice } from "../../lib/api";

export default function SellerDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requireAuth(router, ["seller", "admin"])) return;
    setReady(true);
    const payload = getTokenPayload();
    const sellerId = payload?.userId;

    Promise.all([
      fetch(`${API}/products?limit=50${sellerId ? `&seller=${sellerId}` : ""}`, { headers: authHeaders() })
        .then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/orders`, { headers: authHeaders() })
        .then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([p, o]) => {
      setProducts(p.data || []);
      setOrders(o.data || []);
      setLoading(false);
    });
  }, []);

  async function deleteProduct(id) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const res = await fetch(`${API}/products/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p._id !== id));
      if (window.__toast) window.__toast("Product deleted", "info");
    } else {
      if (window.__toast) window.__toast("Delete failed", "error");
    }
  }

  if (!ready) return null;

  return (
    <>
      <Head><title>Seller Dashboard — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827" }}>Seller Dashboard</h1>
              <Link href="/seller/products/add" className="btn-primary" style={{ display: "inline-flex", padding: "11px 24px" }}>
                + Add New Product
              </Link>
            </div>

            {/* My Products */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 24, overflowX: "auto" }}>
              <p style={{ fontWeight: 800, fontSize: "1rem", color: "#111827", marginBottom: 16 }}>My Products ({products.length})</p>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              ) : (
                <table className="table-auto" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: "center", color: "#9CA3AF", padding: "40px 0" }}>
                        No products yet.{" "}
                        <Link href="/seller/products/add" style={{ color: "#E11D48", fontWeight: 600 }}>Add your first product →</Link>
                      </td></tr>
                    ) : products.map((p) => (
                      <tr key={p._id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ color: "#6B7280" }}>{p.category?.name || "—"}</td>
                        <td style={{ fontWeight: 600 }}>{formatPrice(p.basePrice)}</td>
                        <td>{p.variants?.reduce((s, v) => s + (v.stock || 0), 0) ?? "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 12 }}>
                            <Link href={`/seller/products/${p._id}`} style={{ color: "#E11D48", fontSize: "0.85rem", fontWeight: 600 }}>Edit</Link>
                            <button onClick={() => deleteProduct(p._id)} style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* My Orders */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
              <p style={{ fontWeight: 800, fontSize: "1rem", color: "#111827", marginBottom: 16 }}>Recent Orders</p>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              ) : (
                <table className="table-auto" style={{ minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: "center", color: "#9CA3AF", padding: "40px 0" }}>No orders yet.</td></tr>
                    ) : orders.slice(0, 15).map((o) => (
                      <tr key={o._id}>
                        <td><code style={{ fontSize: "0.78rem", color: "#6B7280" }}>{o._id?.slice(-8).toUpperCase()}</code></td>
                        <td style={{ color: "#6B7280" }}>{new Date(o.placedAt).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 700 }}>{formatPrice(o.totalAmount)}</td>
                        <td><span className={`badge ${statusColor(o.status)}`}>{o.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
