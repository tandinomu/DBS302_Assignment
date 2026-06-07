import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SkeletonBox } from "../../components/Skeleton";
import { API, productImage, getToken, getBadge } from "../../lib/api";

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [product, setProduct] = useState(null);
  const [source, setSource] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [inWishlist, setInWishlist] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = getToken();
    fetch(`${API}/products/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((data) => {
        setProduct(data.data);
        setSource(data.source || "");
        if (data.data?.variants?.length > 0) setSelectedVariant(data.data.variants[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function addToCart() {
    const token = getToken();
    const body = { productId: id, sku: selectedVariant?.sku || product?.variants?.[0]?.sku, quantity };
    const res = await fetch(`${API}/cart/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (typeof window !== "undefined" && window.__toast) {
      window.__toast(res.ok ? "Added to cart!" : "Failed to add", res.ok ? "success" : "error");
    }
  }

  async function toggleWishlist() {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    const method = inWishlist ? "DELETE" : "POST";
    await fetch(`${API}/users/me/wishlist/${id}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    setInWishlist(!inWishlist);
    if (typeof window !== "undefined" && window.__toast) {
      window.__toast(inWishlist ? "Removed from wishlist" : "Added to wishlist", "success");
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ padding: "40px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
            <SkeletonBox height={480} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SkeletonBox height={20} width="40%" />
              <SkeletonBox height={32} width="80%" />
              <SkeletonBox height={32} width="30%" />
              <SkeletonBox height={80} />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <p style={{ fontSize: "1.1rem", color: "#6B7280" }}>Product not found.</p>
          <Link href="/products" style={{ color: "#E11D48", fontWeight: 600 }}>← Back to Products</Link>
        </div>
      </>
    );
  }

  const badge = getBadge(product);
  const images = product.images?.length > 0 ? product.images : [productImage(product), productImage(product, 1), productImage(product, 2), productImage(product, 3)];
  const price = selectedVariant?.price || product.basePrice;
  const rating = product.ratings?.average || 0;
  const reviewCount = product.ratings?.count || 0;
  const sizes = product.variants?.filter((v) => v.size) || [];
  const uniqueSizes = [...new Set(sizes.map((v) => v.size))];
  const colors = product.variants?.filter((v) => v.color) || [];
  const uniqueColors = [...new Set(colors.map((v) => v.color))];

  return (
    <>
      <Head><title>{product.name} — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />

        <div className="container" style={{ paddingTop: 32, paddingBottom: 64, flex: 1 }}>
          {/* Breadcrumb */}
          <nav style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 28, fontSize: "0.8rem", color: "#9CA3AF" }}>
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/products">Products</Link>
            <span>/</span>
            <span style={{ color: "#374151" }}>{product.name}</span>
          </nav>

          <div style={{ display: "grid", gap: 48 }} className="product-layout">
            {/* Left: Images */}
            <div>
              <div style={{ borderRadius: 12, overflow: "hidden", height: 480, background: "#F3F4F6", marginBottom: 12, position: "relative" }}>
                <img
                  src={images[activeImg] || productImage(product)}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => { e.target.src = productImage(product); }}
                />
                {/* Cache badge */}
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  background: source === "cache" ? "#16a34a" : "#6B7280",
                  color: "#fff", padding: "3px 10px", borderRadius: 9999, fontSize: "0.72rem", fontWeight: 700,
                }}>
                  {source === "cache" ? "⚡ CACHED" : "🗄 LIVE"}
                </div>
              </div>
              {/* Thumbnails */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {images.slice(0, 4).map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    style={{ borderRadius: 8, overflow: "hidden", height: 80, border: i === activeImg ? "2px solid #E11D48" : "2px solid transparent", cursor: "pointer", background: "#F3F4F6", padding: 0 }}
                  >
                    <img
                      src={src || productImage(product)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => { e.target.src = productImage(product); }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {badge && <span className={`badge ${badge.cls}`} style={{ width: "fit-content" }}>{badge.label}</span>}
              <div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", lineHeight: 1.2, marginBottom: 6 }}>{product.name}</h1>
                {product.category && <p style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>{product.category.name}</p>}
              </div>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827" }}>${price?.toFixed(2)}</span>
                {product.basePrice && selectedVariant?.price && selectedVariant.price < product.basePrice && (
                  <span style={{ fontSize: "1rem", color: "#9CA3AF", textDecoration: "line-through" }}>${product.basePrice?.toFixed(2)}</span>
                )}
              </div>

              {/* Rating */}
              {reviewCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < Math.round(rating) ? "#F59E0B" : "none"} stroke="#F59E0B" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    ))}
                  </div>
                  <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>{rating.toFixed(1)} out of 5 ({reviewCount} reviews)</span>
                </div>
              )}

              {/* Unique visitors */}
              {product.uniqueVisitors !== undefined && product.uniqueVisitors > 0 && (
                <p style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                  👁 {product.uniqueVisitors} people viewed this today
                </p>
              )}

              {/* Description */}
              <div>
                <p style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: 8 }}>Description</p>
                <p style={{ color: "#4B5563", lineHeight: 1.7, fontSize: "0.9rem" }}>{product.description}</p>
              </div>

              {/* Size selector */}
              {uniqueSizes.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151" }}>Select Size</p>
                    <span style={{ fontSize: "0.8rem", color: "#E11D48", fontWeight: 600, cursor: "pointer" }}>Size Guide</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {uniqueSizes.map((size) => {
                      const v = product.variants.find((vv) => vv.size === size);
                      const outOfStock = v?.stock === 0;
                      const selected = selectedVariant?.size === size;
                      return (
                        <button
                          key={size}
                          onClick={() => !outOfStock && setSelectedVariant(v)}
                          disabled={outOfStock}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 6,
                            border: selected ? "2px solid #111827" : "2px solid #E5E7EB",
                            background: selected ? "#111827" : "#fff",
                            color: outOfStock ? "#D1D5DB" : selected ? "#fff" : "#374151",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: outOfStock ? "not-allowed" : "pointer",
                            opacity: outOfStock ? 0.5 : 1,
                          }}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color selector */}
              {uniqueColors.length > 0 && (
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#374151", marginBottom: 10 }}>Select Color</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {uniqueColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        title={color}
                        style={{
                          width: 28, height: 28,
                          borderRadius: "50%",
                          border: selectedColor === color ? "3px solid #374151" : "2px solid #E5E7EB",
                          background: color.toLowerCase().startsWith("#") ? color : color,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Qty + Add to cart */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: 40, height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", background: "#F9FAFB", color: "#374151" }}>−</button>
                  <span style={{ minWidth: 40, textAlign: "center", fontWeight: 600 }}>{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} style={{ width: 40, height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", background: "#F9FAFB", color: "#374151" }}>+</button>
                </div>
                <button
                  onClick={addToCart}
                  disabled={selectedVariant?.stock === 0}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: "center", padding: "0 24px", height: 48, opacity: selectedVariant?.stock === 0 ? 0.5 : 1 }}
                >
                  {selectedVariant?.stock === 0 ? "Out of Stock" : "Add to Cart"}
                </button>
                <button
                  onClick={toggleWishlist}
                  style={{ width: 48, height: 48, border: "1px solid #E5E7EB", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: inWishlist ? "#E11D48" : "#9CA3AF" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={inWishlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>

              {/* Trust badges */}
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { icon: "🚚", text: "Free Express Shipping" },
                  { icon: "🔒", text: "Secure Checkout" },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "1rem" }}>{icon}</span>
                    <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Sold by */}
              {product.seller?.name && (
                <p style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>Sold by: {product.seller.name}</p>
              )}
            </div>
          </div>

          {/* Reviews section */}
          <div style={{ marginTop: 64 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111827", marginBottom: 4 }}>Customer Reviews</h2>
                {reviewCount > 0 && (
                  <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                    {Array.from({ length: 5 }).map((_, i) => (i < Math.round(rating) ? "★" : "☆")).join("")} {rating.toFixed(1)} out of 5 ({reviewCount} reviews)
                  </p>
                )}
              </div>
              <button className="btn-outline" style={{ fontSize: "0.875rem", padding: "8px 18px" }}>Write a Review</button>
            </div>

            {product.reviews?.length > 0 ? (
              <div className="grid-3">
                {product.reviews.slice(0, 3).map((review, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <span key={j} style={{ color: j < (review.rating || 5) ? "#F59E0B" : "#E5E7EB", fontSize: "0.85rem" }}>★</span>
                          ))}
                        </div>
                        {review.title && <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>{review.title}</p>}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Recently"}</span>
                    </div>
                    <p style={{ color: "#4B5563", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 14 }}>{review.comment || review.body}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E11D48", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                        {(review.user?.name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>{review.user?.name || "Anonymous"}</p>
                        <p style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>Verified Buyer</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px", background: "#F9FAFB", borderRadius: 12 }}>
                <p style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>No reviews yet. Be the first to review this product.</p>
              </div>
            )}

            {product.reviews?.length > 3 && (
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <button className="btn-outline" style={{ fontSize: "0.875rem", padding: "10px 28px" }}>Load More Reviews</button>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .product-layout { grid-template-columns: 1fr 1fr; }
          @media (max-width: 768px) { .product-layout { grid-template-columns: 1fr; } }
        `}</style>

        <Footer />
      </div>
    </>
  );
}
