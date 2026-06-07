import Link from "next/link";
import { getBadge, productImage, formatPrice } from "../lib/api";

export default function ProductCard({ product, onAddToCart }) {
  const badge = getBadge(product);
  const imgSrc = productImage(product);
  const fallback = `https://picsum.photos/seed/${(product.name || product._id || "product").replace(/\s+/g, "-").toLowerCase()}/600/600`;

  async function handleAdd(e) {
    e.preventDefault();
    if (onAddToCart) { onAddToCart(product); return; }
    const token = typeof window !== "undefined" ? localStorage.getItem("shopnest_token") : null;
    const variant = product.variants?.[0];
    const body = { productId: product._id, sku: variant?.sku || product._id, quantity: 1 };
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"}/cart/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (typeof window !== "undefined" && window.__toast) {
      window.__toast(res.ok ? "Added to cart!" : "Failed to add", res.ok ? "success" : "error");
    }
  }

  return (
    <div
      style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <Link href={`/products/${product._id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ position: "relative", overflow: "hidden", height: 220, background: "#F3F4F6" }}>
          <img
            src={imgSrc}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => {
              if (e.target.src !== fallback) e.target.src = fallback;
            }}
          />
          {badge && (
            <span className={`badge ${badge.cls}`} style={{ position: "absolute", top: 10, left: 10 }}>
              {badge.label}
            </span>
          )}
        </div>
        <div style={{ padding: "12px 14px 14px" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "#E11D48", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            {product.category?.name || ""}
          </p>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111827", marginBottom: 4, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.name}
          </h3>
          {product.description && (
            <p style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
              {product.description}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <p style={{ fontSize: "1.05rem", fontWeight: 700, color: "#E11D48" }}>
              {formatPrice(product.basePrice)}
            </p>
            <button
              onClick={handleAdd}
              style={{ width: 30, height: 30, borderRadius: "50%", background: "#E11D48", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", lineHeight: 1, flexShrink: 0 }}
            >
              +
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}
