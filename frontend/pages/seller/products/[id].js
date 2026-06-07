import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { API, authHeaders, getUser } from "../../../lib/api";

export default function EditProduct() {
  const router = useRouter();
  const { id } = router.query;
  const [form, setForm] = useState({ name: "", description: "", basePrice: "", tags: "", images: [""] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || (u.role !== "seller" && u.role !== "admin")) { router.push("/login"); return; }
    if (!id) return;
    fetch(`${API}/products/${id}`).then((r) => r.json()).then((d) => {
      const p = d.data;
      if (!p) { router.push("/seller/dashboard"); return; }
      setForm({
        name: p.name || "",
        description: p.description || "",
        basePrice: p.basePrice || "",
        tags: (p.tags || []).join(", "),
        images: p.images?.length ? p.images : [""],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        basePrice: parseFloat(form.basePrice),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        images: form.images.filter(Boolean),
      };
      const res = await fetch(`${API}/products/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { if (window.__toast) window.__toast(d.error || "Failed", "error"); return; }
      if (window.__toast) window.__toast("Product updated!", "success");
      router.push("/seller/dashboard");
    } catch {
      if (window.__toast) window.__toast("Network error", "error");
    } finally { setSaving(false); }
  }

  if (loading) return (
    <>
      <Navbar />
      <div style={{ textAlign: "center", padding: "80px", color: "#9CA3AF" }}>Loading...</div>
    </>
  );

  return (
    <>
      <Head><title>Edit Product — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40, maxWidth: 700 }}>
            <Link href="/seller/dashboard" style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 600, display: "inline-flex", gap: 4, marginBottom: 20 }}>
              ← Back to Dashboard
            </Link>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#111827", marginBottom: 28 }}>Edit Product</h1>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[["name", "Product Name", "text"], ["basePrice", "Base Price", "number"], ["tags", "Tags (comma-separated)", "text"]].map(([key, label, type]) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>
                      <input type={type} className="input-field" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key !== "tags"} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description</label>
                    <textarea className="input-field" rows={4} style={{ resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>Images</label>
                    {form.images.map((img, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input className="input-field" placeholder="https://..." value={img} onChange={(e) => setForm({ ...form, images: form.images.map((v, j) => j === i ? e.target.value : v) })} />
                        {form.images.length > 1 && <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} style={{ color: "#9CA3AF" }}>✕</button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm({ ...form, images: [...form.images, ""] })} style={{ color: "#E11D48", fontSize: "0.875rem", fontWeight: 600 }}>+ Add image</button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: "13px 32px" }}>
                  {saving ? "Saving..." : "Save Changes"}
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
