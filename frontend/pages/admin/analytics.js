import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Leaderboard from "../../components/Leaderboard";
import { SkeletonBox } from "../../components/Skeleton";
import { API, authHeaders, requireAuth } from "../../lib/api";

const TABS = ["Sales Report","Top Products","Low Stock","Views vs Purchases","Trending","Leaderboard","Unique Visitors","Cache Stats"];

export default function Analytics() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visitorProductId, setVisitorProductId] = useState("");
  const [visitorCount, setVisitorCount] = useState(null);
  const [visitorLoading, setVisitorLoading] = useState(false);

  useEffect(() => {
    if (!requireAuth(router, ["admin"])) return;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (tab === 6) return; // Unique visitors: manual trigger
    loadTab();
  }, [tab, ready]);

  async function loadTab() {
    setLoading(true); setData(null);
    const h = authHeaders();
    try {
      const fetches = [
        () => fetch(`${API}/analytics/sales?period=monthly`, { headers: h }).then((r) => r.json()),
        () => fetch(`${API}/analytics/top-products?n=20`, { headers: h }).then((r) => r.json()),
        () => fetch(`${API}/analytics/low-stock?threshold=15`, { headers: h }).then((r) => r.json()),
        () => fetch(`${API}/analytics/views-vs-purchases`, { headers: h }).then((r) => r.json()),
        () => fetch(`${API}/analytics/trending?limit=20`).then((r) => r.json()),
        () => Promise.all([
          fetch(`${API}/analytics/leaderboard/sellers`, { headers: h }).then((r) => r.json()),
          fetch(`${API}/analytics/leaderboard/buyers`, { headers: h }).then((r) => r.json()),
        ]),
        () => Promise.resolve(null),
        () => fetch(`${API}/analytics/cache-stats`, { headers: h }).then((r) => r.json()),
      ];
      setData(await fetches[tab]());
    } catch {}
    setLoading(false);
  }

  async function lookupVisitors() {
    if (!visitorProductId.trim()) return;
    setVisitorLoading(true); setVisitorCount(null);
    try {
      const res = await fetch(`${API}/analytics/unique-visitors/${visitorProductId.trim()}`, { headers: authHeaders() });
      const d = await res.json();
      setVisitorCount(d.data?.uniqueVisitors ?? d.data ?? "N/A");
    } catch { setVisitorCount("Error"); }
    setVisitorLoading(false);
  }

  if (!ready) return null;

  const tableStyle = { overflowX: "auto" };

  return (
    <>
      <Head><title>Analytics — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 6 }}>Analytics</h1>
            <p style={{ color: "#9CA3AF", fontSize: "0.875rem", marginBottom: 28 }}>MongoDB Aggregation Pipelines + Redis Real-time Data</p>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, flexWrap: "wrap", borderBottom: "1px solid #E5E7EB", marginBottom: 24 }}>
              {TABS.map((t, i) => (
                <button key={t} onClick={() => setTab(i)} style={{ padding: "10px 14px", fontSize: "0.83rem", fontWeight: i === tab ? 700 : 500, color: i === tab ? "#E11D48" : "#6B7280", borderBottom: i === tab ? "2px solid #E11D48" : "2px solid transparent", background: "none", border: "none", borderBottom: i === tab ? "2px solid #E11D48" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {t}
                </button>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 280 }}>
              {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{Array.from({ length: 5 }).map((_, i) => <SkeletonBox key={i} height={36} />)}</div>}

              {/* Sales Report */}
              {!loading && tab === 0 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 16, color: "#374151" }}>Monthly Sales Report (MongoDB $group aggregation)</p>
                  <div style={tableStyle}>
                    <table className="table-auto">
                      <thead><tr>{["Period","Orders","Revenue","Avg Order","Min","Max"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {(data?.data || []).length === 0 ? (
                          <tr><td colSpan={6} style={{ textAlign: "center", color: "#9CA3AF", padding: "32px 0" }}>No orders yet</td></tr>
                        ) : (data?.data || []).map((row) => (
                          <tr key={row.period}>
                            <td style={{ fontWeight: 600 }}>{row.period}</td>
                            <td>{row.orderCount}</td>
                            <td style={{ fontWeight: 700, color: "#E11D48" }}>${row.totalRevenue?.toFixed(2)}</td>
                            <td>${row.averageOrderValue?.toFixed(2)}</td>
                            <td>${row.minOrderValue?.toFixed(2)}</td>
                            <td>${row.maxOrderValue?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Products */}
              {!loading && tab === 1 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 16, color: "#374151" }}>Top Products by Revenue (MongoDB $unwind + $group)</p>
                  <div style={tableStyle}>
                    <table className="table-auto">
                      <thead><tr>{["Rank","Product","Revenue","Units Sold","Orders"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {(data?.data || []).length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: "center", color: "#9CA3AF", padding: "32px 0" }}>No orders yet</td></tr>
                        ) : (data?.data || []).map((p, i) => (
                          <tr key={p.productId || i}>
                            <td style={{ fontWeight: 700, color: i < 3 ? "#E11D48" : "#6B7280" }}>#{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{p.productName}</td>
                            <td style={{ fontWeight: 700, color: "#E11D48" }}>${p.totalRevenue?.toFixed(2)}</td>
                            <td>{p.totalQuantitySold}</td>
                            <td>{p.orderCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Low Stock */}
              {!loading && tab === 2 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 16, color: "#374151" }}>Low Stock Alert (MongoDB $lookup + $match, threshold: 15)</p>
                  {(data?.data || []).length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <p style={{ color: "#16a34a", fontWeight: 600 }}>✓ All products well-stocked</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(data?.data || []).map((item, i) => {
                        const isOut = item.urgency === "OUT_OF_STOCK";
                        const isCrit = item.urgency === "CRITICAL";
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 8, background: isOut ? "#FFF1F2" : isCrit ? "#FFF7ED" : "#FFFBEB", border: `1px solid ${isOut ? "#FECDD3" : isCrit ? "#FED7AA" : "#FDE68A"}` }}>
                            <div>
                              <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.productName}</p>
                              <p style={{ fontSize: "0.78rem", color: "#6B7280" }}>SKU: {item.variant} · {item.warehouse}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>{item.quantityAvailable}</p>
                              <span className={`badge ${isOut ? "badge-cancelled" : "badge-confirmed"}`}>{item.urgency}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Views vs Purchases */}
              {!loading && tab === 3 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 16, color: "#374151" }}>Views vs Purchases Conversion Rate</p>
                  <div style={tableStyle}>
                    <table className="table-auto">
                      <thead><tr>{["Product","Views","Purchases","Conversion"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {(data?.data || []).length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: "center", color: "#9CA3AF", padding: "32px 0" }}>No data available</td></tr>
                        ) : (data?.data || []).map((item, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{item.productName}</td>
                            <td>{(item.views || 0).toLocaleString()}</td>
                            <td>{(item.purchases || 0).toLocaleString()}</td>
                            <td><span style={{ fontWeight: 700, color: (item.conversionRate || 0) > 5 ? "#16a34a" : "#E11D48" }}>{(item.conversionRate || 0).toFixed(2)}%</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Trending */}
              {!loading && tab === 4 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 16, color: "#374151" }}>Trending Products (Redis ZREVRANGE — views × 1 + purchases × 5)</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(data?.data || []).map((item) => (
                      <div key={item.productId} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 8, background: "#F9FAFB" }}>
                        <span style={{ fontWeight: 800, color: "#E11D48", minWidth: 32, fontSize: "0.95rem" }}>#{item.rank}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600 }}>{item.name}</p>
                          <p style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>${item.basePrice?.toFixed(2)}</p>
                        </div>
                        <span style={{ background: "#FFF1F2", color: "#E11D48", padding: "4px 12px", borderRadius: 9999, fontSize: "0.8rem", fontWeight: 700 }}>{item.score?.toFixed(0)} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              {!loading && tab === 5 && Array.isArray(data) && (
                <div className="grid-2">
                  <Leaderboard title="Top Sellers This Month" entries={data[0]?.data || []} />
                  <Leaderboard title="Top Buyers This Month" entries={data[1]?.data || []} />
                </div>
              )}

              {/* Unique Visitors */}
              {tab === 6 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 6, color: "#374151" }}>Unique Visitors (HyperLogLog PFCOUNT)</p>
                  <p style={{ fontSize: "0.8rem", color: "#9CA3AF", marginBottom: 20 }}>Enter a Product ID to look up its unique visitor count from Redis.</p>
                  <div style={{ display: "flex", gap: 10, maxWidth: 500, flexWrap: "wrap" }}>
                    <input className="input-field" style={{ flex: 1 }} placeholder="Paste a Product ID…" value={visitorProductId} onChange={(e) => setVisitorProductId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupVisitors()} />
                    <button onClick={lookupVisitors} disabled={visitorLoading} className="btn-primary" style={{ padding: "10px 20px", whiteSpace: "nowrap" }}>
                      {visitorLoading ? "…" : "Look up"}
                    </button>
                  </div>
                  {visitorCount !== null && (
                    <div style={{ marginTop: 24, background: "#F9FAFB", borderRadius: 10, padding: "24px 28px", display: "inline-block" }}>
                      <p style={{ fontSize: "0.8rem", color: "#9CA3AF", marginBottom: 6 }}>Unique visitors (HyperLogLog)</p>
                      <p style={{ fontSize: "2.5rem", fontWeight: 800, color: "#E11D48" }}>{String(visitorCount)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Cache Stats */}
              {!loading && tab === 7 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 20, color: "#374151" }}>Redis Cache Statistics</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
                    {Object.entries(data?.data || {}).map(([key, val]) => (
                      <div key={key} style={{ background: "#F9FAFB", borderRadius: 10, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
                        <p style={{ fontSize: "0.72rem", color: "#9CA3AF", fontWeight: 600, textTransform: "capitalize", marginBottom: 6 }}>{key.replace(/([A-Z])/g, " $1")}</p>
                        <p style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>{String(val)}</p>
                      </div>
                    ))}
                    {Object.keys(data?.data || {}).length === 0 && <p style={{ color: "#9CA3AF" }}>No cache stats available</p>}
                  </div>
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
