import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Leaderboard from "../components/Leaderboard";
import { SkeletonBox } from "../components/Skeleton";
import { API, authHeaders, requireAuth, productImage, formatPrice } from "../lib/api";

function StatCard({ title, value, sub, sub2, trend, icon }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9CA3AF" }}>{title}</p>
        <span>{icon}</span>
      </div>
      <p style={{ fontSize: "1.8rem", fontWeight: 800, color: "#111827", marginBottom: 4 }}>{value}</p>
      {trend && <p style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 600 }}>{trend}</p>}
      {sub && <p style={{ fontSize: "0.8rem", color: "#9CA3AF", marginTop: 4 }}>{sub}</p>}
      {sub2 && <p style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>{sub2}</p>}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requireAuth(router, ["admin", "seller"])) return;
    setReady(true);

    const h = authHeaders();
    Promise.all([
      fetch(`${API}/analytics/sales?period=monthly`, { headers: h }).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/analytics/top-products?n=5`, { headers: h }).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/analytics/leaderboard/sellers`, { headers: h }).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/analytics/leaderboard/buyers`, { headers: h }).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/analytics/cache-stats`, { headers: h }).then((r) => r.json()).catch(() => ({ data: {} })),
    ]).then(([sales, top, sell, buy, cache]) => {
      setSalesData(sales.data || []);
      setTopProducts(top.data || []);
      setSellers(sell.data || []);
      setBuyers(buy.data || []);
      setCacheStats(cache.data || {});
      setLoading(false);
    });
  }, []);

  if (!ready) return null;

  const totalRevenue = salesData.reduce((s, r) => s + (r.totalRevenue || 0), 0);
  const totalOrders = salesData.reduce((s, r) => s + (r.orderCount || 0), 0);

  return (
    <>
      <Head><title>Admin Dashboard — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F9FAFB" }}>
        <Navbar />
        <div className="container" style={{ paddingTop: 40, paddingBottom: 64, flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#E11D48", marginBottom: 6 }}>Dashboard Overview</p>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 4 }}>Welcome Admin</h1>
              <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>Monitor your store's performance and manage your growth.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/admin/analytics" className="btn-outline" style={{ display: "inline-flex", fontSize: "0.875rem", padding: "9px 20px" }}>Download Report</Link>
              <Link href="/admin/analytics" className="btn-primary" style={{ display: "inline-flex", fontSize: "0.875rem", padding: "9px 20px" }}>Live View</Link>
            </div>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="grid-3" style={{ marginBottom: 28 }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} height={140} style={{ borderRadius: 12 }} />)}
            </div>
          ) : (
            <div className="grid-3" style={{ marginBottom: 28 }}>
              <StatCard title="Total Sales" value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} trend="↑ From all orders" icon="📈" />
              <StatCard title="Total Orders" value={totalOrders.toLocaleString()} sub="Active processing" icon="📦" />
              <StatCard title="Top Sellers" value={sellers.length > 0 ? sellers[0]?.name?.split(" ")[0] || "—" : "—"} sub={sellers.length > 0 ? `$${parseFloat(sellers[0]?.score || 0).toFixed(0)} revenue` : "No data"} icon="🏆" />
            </div>
          )}

          {/* Main content */}
          <div className="dash-bottom" style={{ display: "grid", alignItems: "start", gap: 24 }}>
            {/* Top Products table */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ fontWeight: 800, fontSize: "1rem", color: "#111827" }}>Top Products</p>
                <Link href="/admin/analytics" style={{ color: "#E11D48", fontSize: "0.8rem", fontWeight: 600 }}>View All</Link>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} height={44} />)}
                </div>
              ) : (
                <table className="table-auto">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Sales</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: "center", color: "#9CA3AF", padding: "32px 0" }}>No data yet — place some orders first</td></tr>
                    ) : topProducts.map((p, i) => (
                      <tr key={p.productId || i}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 6, overflow: "hidden", position: "relative", flexShrink: 0, background: "#F3F4F6" }}>
                              <img
                                src={`https://picsum.photos/seed/${(p.productName || "product").replace(/\s+/g, "-").toLowerCase()}/80/80`}
                                alt={p.productName || "product"}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                onError={(e) => { e.target.onerror = null; e.target.src = "https://picsum.photos/seed/fallback/80/80"; }}
                              />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{p.productName}</span>
                          </div>
                        </td>
                        <td style={{ color: "#6B7280", fontSize: "0.875rem" }}>{p.category || "—"}</td>
                        <td>
                          <span style={{ background: "#FFF1F2", color: "#E11D48", padding: "2px 8px", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 700 }}>
                            {p.totalQuantitySold} sold
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>${p.totalRevenue?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right: leaderboards + cache */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!loading && <Leaderboard title="Top Sellers" entries={sellers} dark />}
              {!loading && <Leaderboard title="Top Buyers" entries={buyers} dark />}
              {cacheStats && Object.keys(cacheStats).length > 0 && (
                <div style={{ background: "#1F2937", borderRadius: 12, padding: 18 }}>
                  <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", marginBottom: 12 }}>Cache Stats</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {Object.entries(cacheStats).slice(0, 4).map(([k, v]) => (
                      <div key={k} style={{ background: "#374151", borderRadius: 8, padding: "10px 12px" }}>
                        <p style={{ fontSize: "0.68rem", color: "#9CA3AF", marginBottom: 3, textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</p>
                        <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#F9FAFB" }}>{String(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin nav shortcuts */}
          <div style={{ marginTop: 28, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["Full Analytics", "/admin/analytics"], ["All Orders", "/admin/orders"], ["Users", "/admin/users"]].map(([label, href]) => (
              <Link key={href} href={href} className="btn-outline" style={{ fontSize: "0.875rem", padding: "9px 20px", display: "inline-flex" }}>{label}</Link>
            ))}
          </div>
        </div>

        <style jsx>{`
          .dash-bottom { grid-template-columns: 1fr 300px; }
          @media (max-width: 1024px) { .dash-bottom { grid-template-columns: 1fr; } }
        `}</style>
        <Footer />
      </div>
    </>
  );
}
