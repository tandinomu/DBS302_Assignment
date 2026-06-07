import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { API, authHeaders, requireAuth } from "../../../lib/api";

const CATEGORY_ATTRS = {
  Electronics: [["brand","Brand"],["ram","RAM"],["storage","Storage"],["processor","Processor"],["display","Display"],["battery","Battery"]],
  Clothing: [["fabric","Fabric"],["fit","Fit"],["care","Care Instructions"]],
  Books: [["author","Author"],["isbn","ISBN"],["publisher","Publisher"],["pages","Pages"],["language","Language"]],
  Furniture: [["material","Material"],["dimensions","Dimensions"],["weight","Weight (kg)"]],
  Kitchenware: [["material","Material"],["capacity","Capacity"],["dishwasherSafe","Dishwasher Safe"]],
  Textiles: [["fabric","Fabric"],["thread_count","Thread Count"],["care","Care Instructions"]],
};

export default function AddProduct() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", basePrice: "", category: "", tags: "", images: [""] });
  const [attrs, setAttrs] = useState({});
  const [variants, setVariants] = useState([{ sku: "", size: "", color: "", stock: "", price: "" }]);
  const [selectedCatName, setSelectedCatName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!requireAuth(router, ["seller", "admin"])) return;
    setReady(true);
    fetch(`${API}/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => {});
  }, []);

  function updateVariant(i, field, value) {
    setVariants((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.basePrice || !form.category) {
      if (window.__toast) window.__toast("Name, price, and category are required", "error");
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        basePrice: parseFloat(form.basePrice),
        category: form.category,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        images: form.images.filter(Boolean),
        attributes: attrs,
        variants: variants.filter((v) => v.sku).map((v) => ({
          ...v,
          price: parseFloat(v.price) || parseFloat(form.basePrice),
          stock: parseInt(v.stock) || 0,
        })),
      };
      const res = await fetch(`${API}/products`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { if (window.__toast) window.__toast(d.error || "Failed to create", "error"); return; }
      if (window.__toast) window.__toast("Product created!", "success");
      router.push("/seller/dashboard");
    } catch {
      if (window.__toast) window.__toast("Network error", "error");
    } finally { setLoading(false); }
  }

  if (!ready) return null;

  const attrFields = CATEGORY_ATTRS[selectedCatName] || [];

  return (
    <>
      <Head><title>Add Product — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40, maxWidth: 820 }}>
            <Link href="/seller/dashboard" style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 600, display: "inline-flex", gap: 4, marginBottom: 20 }}>← Back</Link>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#111827", marginBottom: 28 }}>Add New Product</h1>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Basic info */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#374151", marginBottom: 16 }}>Basic Information</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Product Name *</label>
                    <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description</label>
                    <textarea className="input-field" rows={3} style={{ resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Base Price *</label>
                      <input type="number" min="0" step="0.01" className="input-field" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Category *</label>
                      <select className="input-field" value={form.category} onChange={(e) => {
                        const cat = categories.find((c) => c._id === e.target.value);
                        setForm({ ...form, category: e.target.value });
                        setSelectedCatName(cat?.name || "");
                      }} required>
                        <option value="">Select category</option>
                        {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Tags <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(comma-separated)</span></label>
                    <input className="input-field" placeholder="new-arrival, sale, featured" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Images */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#374151", marginBottom: 12 }}>Images</p>
                {form.images.map((img, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input className="input-field" placeholder="https://example.com/image.jpg" value={img} onChange={(e) => setForm({ ...form, images: form.images.map((v, j) => j === i ? e.target.value : v) })} />
                    {form.images.length > 1 && <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} style={{ color: "#9CA3AF", padding: "0 8px", flexShrink: 0 }}>✕</button>}
                  </div>
                ))}
                <button type="button" onClick={() => setForm({ ...form, images: [...form.images, ""] })} style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 600 }}>+ Add image URL</button>
              </div>

              {/* Dynamic attributes */}
              {attrFields.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#374151", marginBottom: 16 }}>Attributes — {selectedCatName}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {attrFields.map(([key, label]) => (
                      <div key={key}>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>
                        <input className="input-field" value={attrs[key] || ""} onChange={(e) => setAttrs({ ...attrs, [key]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Variants */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
                <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#374151", marginBottom: 16 }}>Variants</p>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                  <thead>
                    <tr>
                      {["SKU *","Size","Color","Stock","Price",""].map((h) => (
                        <th key={h} style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", padding: "0 8px 10px 0", textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={i}>
                        {[["sku","text"],["size","text"],["color","text"],["stock","number"],["price","number"]].map(([field, type]) => (
                          <td key={field} style={{ paddingRight: 8, paddingBottom: 8 }}>
                            <input type={type} className="input-field" style={{ padding: "8px 10px", fontSize: "0.875rem" }} value={v[field]} onChange={(e) => updateVariant(i, field, e.target.value)} required={field === "sku"} min={type === "number" ? 0 : undefined} step={field === "price" ? "0.01" : undefined} />
                          </td>
                        ))}
                        <td style={{ paddingBottom: 8 }}>
                          {variants.length > 1 && <button type="button" onClick={() => setVariants((p) => p.filter((_, j) => j !== i))} style={{ color: "#9CA3AF", padding: "8px 6px" }}>✕</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={() => setVariants((p) => [...p, { sku: "", size: "", color: "", stock: "", price: "" }])} style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 600, marginTop: 8 }}>
                  + Add Variant
                </button>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "13px 32px" }}>
                  {loading ? "Saving…" : "Save Product"}
                </button>
                <Link href="/seller/dashboard" className="btn-outline" style={{ display: "inline-flex", padding: "13px 24px" }}>Cancel</Link>
              </div>
            </form>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
