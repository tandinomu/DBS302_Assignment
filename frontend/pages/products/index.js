import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ProductCard from "../../components/ProductCard";
import { SkeletonCard } from "../../components/Skeleton";
import { API } from "../../lib/api";

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ category: [], sort: "-createdAt", minPrice: 0, maxPrice: 2000 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const didInit = useRef(false);

  // Fetch categories from API
  useEffect(() => {
    fetch(`${API}/categories?parent=true`)
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => {
        // Fallback: extract from products
        fetch(`${API}/products?limit=100`)
          .then((r) => r.json())
          .then((d) => {
            const seen = {};
            (d.data || []).forEach((p) => {
              if (p.category) seen[p.category._id] = p.category;
            });
            setCategories(Object.values(seen));
          })
          .catch(() => {});
      });
  }, []);

  // Sync search from URL on mount
  useEffect(() => {
    if (router.isReady && router.query.q && !didInit.current) {
      didInit.current = true;
      setSearch(router.query.q);
      loadProducts(1, router.query.q);
    } else if (router.isReady && !didInit.current) {
      didInit.current = true;
      loadProducts(1, "");
    }
  }, [router.isReady, router.query.q]);

  useEffect(() => {
    if (didInit.current) loadProducts(1, search);
  }, [filters]);

  async function loadProducts(page = 1, searchOverride) {
    setLoading(true);
    setError(false);
    const q = searchOverride !== undefined ? searchOverride : search;
    try {
      let url;
      if (q && q.trim()) {
        url = `${API}/products/search?q=${encodeURIComponent(q.trim())}&page=${page}&limit=12`;
      } else {
        const params = new URLSearchParams({ page, limit: 12, sort: filters.sort });
        if (filters.category.length === 1) params.set("category", filters.category[0]);
        if (filters.minPrice > 0) params.set("minPrice", filters.minPrice);
        if (filters.maxPrice < 2000) params.set("maxPrice", filters.maxPrice);
        url = `${API}/products?${params}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setProducts(data.data || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: data.data?.length || 0 });
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  function toggleCategory(id) {
    setFilters((f) => ({
      ...f,
      category: f.category.includes(id) ? f.category.filter((c) => c !== id) : [...f.category, id],
    }));
  }

  function clearAll() {
    setFilters({ category: [], sort: "-createdAt", minPrice: 0, maxPrice: 2000 });
    setSearch("");
    loadProducts(1, "");
  }

  const Sidebar = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Category */}
      <div>
        <p style={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280", marginBottom: 12 }}>Category</p>
        {categories.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((c) => (
              <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem", color: "#374151" }}>
                <input type="checkbox" checked={filters.category.includes(c._id)} onChange={() => toggleCategory(c._id)} style={{ accentColor: "#E11D48", width: 14, height: 14 }} />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Price Range */}
      <div>
        <p style={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280", marginBottom: 12 }}>Price Range</p>
        <input type="range" min={0} max={2000} step={50} value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) }))} style={{ width: "100%", accentColor: "#E11D48" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#6B7280", marginTop: 4 }}>
          <span>$0</span>
          <span>{filters.maxPrice >= 2000 ? "$2000+" : `$${filters.maxPrice}`}</span>
        </div>
      </div>

      {/* Clear */}
      <button onClick={clearAll} style={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#E11D48", background: "none", border: "1px solid #FECDD3", borderRadius: 6, padding: "8px 12px", cursor: "pointer" }}>
        Clear All
      </button>
    </div>
  );

  const totalStr = loading ? "Loading…" : error ? "Error loading products" : `Showing ${pagination.total} product${pagination.total !== 1 ? "s" : ""}`;

  return (
    <>
      <Head><title>Products — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1 }}>
          <div className="container" style={{ paddingTop: 28, paddingBottom: 64 }}>
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>{totalStr}</p>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {/* Mobile filter button */}
                <button onClick={() => setFilterOpen(true)} className="show-mobile btn-outline" style={{ display: "none", alignItems: "center", gap: 6, fontSize: "0.875rem", padding: "7px 14px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                  Filters
                </button>
                <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: "0.875rem", background: "#fff", outline: "none" }}>
                  <option value="-createdAt">Featured Arrivals</option>
                  <option value="basePrice">Price: Low → High</option>
                  <option value="-basePrice">Price: High → Low</option>
                  <option value="-ratings.average">Best Rated</option>
                  <option value="-viewCount">Most Viewed</option>
                </select>
              </div>
            </div>

            <div className="products-layout" style={{ display: "grid", alignItems: "start" }}>
              {/* Desktop sidebar */}
              <aside className="hide-mobile" style={{ background: "#fff", borderRadius: 10, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <Sidebar />
              </aside>

              {/* Products grid */}
              <div>
                {error ? (
                  <div style={{ textAlign: "center", padding: "64px 0" }}>
                    <p style={{ color: "#9CA3AF", marginBottom: 12 }}>Failed to load products.</p>
                    <button onClick={() => loadProducts(1)} style={{ color: "#E11D48", fontWeight: 600, cursor: "pointer" }}>Retry</button>
                  </div>
                ) : (
                  <div className="grid-3">
                    {loading ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />) : products.map((p) => <ProductCard key={p._id} product={p} />)}
                  </div>
                )}
                {!loading && !error && products.length === 0 && (
                  <div style={{ textAlign: "center", padding: "64px 0", color: "#9CA3AF" }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No products found</p>
                    <p style={{ fontSize: "0.875rem" }}>Try different filters</p>
                  </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && !loading && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 40, flexWrap: "wrap" }}>
                    <button onClick={() => loadProducts(pagination.page - 1)} disabled={pagination.page === 1} style={{ width: 36, height: 36, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", cursor: pagination.page === 1 ? "default" : "pointer", opacity: pagination.page === 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                    {Array.from({ length: Math.min(pagination.totalPages, 12) }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => loadProducts(p)} style={{ width: 36, height: 36, borderRadius: 6, border: p === pagination.page ? "none" : "1px solid #E5E7EB", background: p === pagination.page ? "#E11D48" : "#fff", color: p === pagination.page ? "#fff" : "#374151", fontWeight: p === pagination.page ? 700 : 400, fontSize: "0.875rem", cursor: "pointer" }}>{p}</button>
                    ))}
                    <button onClick={() => loadProducts(pagination.page + 1)} disabled={pagination.page === pagination.totalPages} style={{ width: 36, height: 36, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", cursor: pagination.page === pagination.totalPages ? "default" : "pointer", opacity: pagination.page === pagination.totalPages ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile filter drawer */}
        {filterOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={() => setFilterOpen(false)} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "16px 16px 0 0", padding: "24px 20px 32px", maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ fontWeight: 700, fontSize: "1rem" }}>Filters</p>
                <button onClick={() => setFilterOpen(false)} style={{ color: "#9CA3AF", fontSize: "1.1rem" }}>✕</button>
              </div>
              <Sidebar />
              <button onClick={() => { setFilterOpen(false); loadProducts(1); }} className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20, padding: "13px" }}>
                Apply Filters
              </button>
            </div>
          </div>
        )}

        <style jsx>{`
          .products-layout { grid-template-columns: 220px 1fr; gap: 24px; }
          .show-mobile { display: none !important; }
          @media (max-width: 768px) {
            .products-layout { grid-template-columns: 1fr; }
            .hide-mobile { display: none !important; }
            .show-mobile { display: flex !important; }
          }
        `}</style>

        <Footer />
      </div>
    </>
  );
}
