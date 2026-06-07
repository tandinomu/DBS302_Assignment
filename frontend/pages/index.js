import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import { SkeletonCard } from "../components/Skeleton";
import { API, productImage } from "../lib/api";

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      // Try featured=true first, fall back to regular products
      fetch(`${API}/products?featured=true&limit=8`)
        .then((r) => r.json())
        .then((d) => {
          const items = d.data || [];
          if (items.length > 0) return items;
          // Fallback: fetch any products
          return fetch(`${API}/products?limit=8`).then((r) => r.json()).then((d2) => d2.data || []);
        }),
      fetch(`${API}/analytics/trending?limit=6`).then((r) => r.json()),
    ])
      .then(([featuredData, trendingData]) => {
        setFeatured(featuredData || []);
        setTrending(trendingData.data || []);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const heroProduct = trending[0];
  const trendSmall = trending.slice(1, 3);

  return (
    <>
      <Head><title>ShopNest — Elevated Living</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />

        {/* Hero */}
        <section style={{ position: "relative", height: "clamp(420px, 55vw, 580px)", overflow: "hidden", background: "#111" }}>
          <img
            src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920&q=80"
            alt="Elevated Living — ShopNest Hero"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.48 }}
            onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
            <div className="container">
              <p style={{ color: "#E11D48", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 14 }}>
                New Collection 2024
              </p>
              <h1 style={{ fontSize: "clamp(1.8rem, 4.5vw, 3.25rem)", fontWeight: 800, color: "#fff", lineHeight: 1.08, maxWidth: 540, marginBottom: 16 }}>
                Elevated Living,<br />Purposely Designed.
              </h1>
              <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "clamp(0.875rem, 1.5vw, 1rem)", maxWidth: 420, marginBottom: 32, lineHeight: 1.65 }}>
                Discover a curated selection of premium home essentials that blend architectural precision with everyday comfort.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/products" style={{ background: "#E11D48", color: "#fff", padding: "12px 28px", borderRadius: 6, fontWeight: 600, fontSize: "0.95rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Shop Now
                </Link>
                <Link href="/products" style={{ background: "transparent", color: "#fff", padding: "12px 28px", borderRadius: 6, fontWeight: 600, fontSize: "0.95rem", border: "1.5px solid rgba(255,255,255,0.55)" }}>
                  View Lookbook
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Collection */}
        <section style={{ padding: "64px 0", background: "#fff" }}>
          <div className="container">
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#111827", marginBottom: 6 }}>Featured Collection</h2>
                <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>The season's most-wanted architectural pieces.</p>
              </div>
              <Link href="/products" style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 600, whiteSpace: "nowrap" }}>See all products →</Link>
            </div>

            {error ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF" }}>
                <p>Failed to load products.</p>
                <button onClick={() => window.location.reload()} style={{ color: "#E11D48", marginTop: 8, cursor: "pointer" }}>Retry</button>
              </div>
            ) : (
              <div className="grid-4">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                  : featured.slice(0, 4).map((p) => <ProductCard key={p._id} product={p} />)
                }
              </div>
            )}
          </div>
        </section>

        {/* Trending Now */}
        <section style={{ padding: "64px 0", background: "#EEF2FF" }}>
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 8 }}>Trending Now</h2>
              <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>The curated list of high-performance essentials.</p>
            </div>

            <div className="trending-grid" style={{ display: "grid", gap: 16, alignItems: "start" }}>
              {/* Featured large card */}
              <div style={{ borderRadius: 12, overflow: "hidden", position: "relative", height: 400, background: "#1F2937" }}>
                {heroProduct && (
                  /* plain <img> avoids Next.js Image fill quirks for overlaid images */
                  <img
                    src={productImage(heroProduct)}
                    alt={heroProduct.name || "Trending"}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "24px 28px", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)" }}>
                  {heroProduct ? (
                    <>
                      <h3 style={{ color: "#fff", fontWeight: 800, fontSize: "1.35rem", marginBottom: 4 }}>{heroProduct.name}</h3>
                      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", marginBottom: 16 }}>${heroProduct.basePrice?.toFixed(2)}</p>
                    </>
                  ) : (
                    <>
                      <h3 style={{ color: "#fff", fontWeight: 800, fontSize: "1.35rem", marginBottom: 6 }}>The Emerald Series</h3>
                      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem", marginBottom: 16 }}>Our signature forest green velvet collection.</p>
                    </>
                  )}
                  <Link href="/products" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "8px 18px", borderRadius: 6, fontSize: "0.85rem", fontWeight: 600, backdropFilter: "blur(4px)", width: "fit-content" }}>
                    Explore Series
                  </Link>
                </div>
              </div>

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {trendSmall.map((item) => (
                  <Link key={item.productId} href={`/products/${item.productId}`} style={{ display: "flex", gap: 12, background: "#fff", borderRadius: 10, padding: "12px 14px", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                    <div style={{ width: 50, height: 50, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#F3F4F6" }}>
                      <img
                        src={productImage(item)}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                      <p style={{ color: "#E11D48", fontWeight: 700, fontSize: "0.85rem" }}>${item.basePrice?.toFixed(2)}</p>
                    </div>
                  </Link>
                ))}

                <div style={{ background: "#111827", borderRadius: 10, padding: "20px 18px" }}>
                  <p style={{ color: "#fff", fontWeight: 800, fontSize: "1rem", marginBottom: 6 }}>Join the Club</p>
                  <p style={{ color: "#9CA3AF", fontSize: "0.8rem", marginBottom: 14, lineHeight: 1.5 }}>Get early access to drops.</p>
                  <Link href="/register" style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Sign up now →
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <style jsx>{`
            .trending-grid { grid-template-columns: 1fr 300px; }
            @media (max-width: 768px) { .trending-grid { grid-template-columns: 1fr; } }
          `}</style>
        </section>

        <Footer />
      </div>
    </>
  );
}
