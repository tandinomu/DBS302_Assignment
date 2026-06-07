import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { SkeletonCard } from "../components/Skeleton";
import { API, authHeaders, getToken, productImage, formatPrice, getBadge } from "../lib/api";

export default function Wishlist() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    fetch(`${API}/users/me/wishlist`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setItems(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function removeFromWishlist(productId) {
    await fetch(`${API}/users/me/wishlist/${productId}`, { method: "DELETE", headers: authHeaders() });
    setItems((prev) => prev.filter((p) => p._id !== productId));
    if (window.__toast) window.__toast("Removed from wishlist", "info");
  }

  async function addToCart(product) {
    try {
      let sku = product.variants?.[0]?.sku;

      if (!sku) {
        const res = await fetch(`${API}/products/${product._id}`);
        const data = await res.json();
        const fullProduct = data.data;
        sku = fullProduct?.variants?.[0]?.sku;
      }

      if (!sku) sku = "default";

      const body = {
        productId: product._id,
        sku,
        quantity: 1,
      };

      const res = await fetch(`${API}/cart/add`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        if (window.__toast) window.__toast("Added to cart!", "success");
      } else {
        console.error("Add to cart failed:", data);
        if (window.__toast) window.__toast(data.error || "Failed to add to cart", "error");
      }
    } catch (err) {
      console.error("Add to cart error:", err);
      if (window.__toast) window.__toast("Failed to add to cart", "error");
    }
  }

  return (
    <>
      <Head><title>My Wishlist — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827" }}>My Wishlist</h1>
              <p style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>{items.length} item{items.length !== 1 ? "s" : ""}</p>
            </div>

            {loading ? (
              <div className="grid-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : items.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: "64px 24px", textAlign: "center" }}>
                <p style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>Your wishlist is empty</p>
                <p style={{ color: "#9CA3AF", fontSize: "0.875rem", marginBottom: 24 }}>Save products you love to come back to later.</p>
                <Link href="/products" className="btn-primary" style={{ display: "inline-flex", padding: "12px 28px" }}>Browse Products</Link>
              </div>
            ) : (
              <div className="grid-4">
                {items.map((product) => {
                  const badge = getBadge(product);
                  const src = productImage(product);
                  return (
                    <div key={product._id} style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <div style={{ position: "relative", height: 220, background: "#F3F4F6" }}>
                        <Link href={`/products/${product._id}`} style={{ display: "block", height: "100%" }}>
                          <img
                            src={src}
                            alt={product.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={(e) => { e.target.onerror = null; e.target.src = `https://picsum.photos/seed/${product._id}/600/600`; }}
                          />
                        </Link>
                        {badge && <span className={`badge ${badge.cls}`} style={{ position: "absolute", top: 10, left: 10 }}>{badge.label}</span>}
                        <button
                          onClick={() => removeFromWishlist(product._id)}
                          style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#E11D48", cursor: "pointer" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "#E11D48", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                          {product.category?.name || ""}
                        </p>
                        <Link href={`/products/${product._id}`}>
                          <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827", marginBottom: 8, lineHeight: 1.35 }}>{product.name}</p>
                        </Link>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <p style={{ fontWeight: 700, color: "#E11D48" }}>{formatPrice(product.basePrice)}</p>
                          <button onClick={() => addToCart(product)} className="btn-primary" style={{ fontSize: "0.78rem", padding: "6px 14px" }}>
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
