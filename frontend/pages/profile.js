import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { API, authHeaders, requireAuth, productImage } from "../lib/api";

export default function Profile() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [newAddress, setNewAddress] = useState({ street: "", city: "", country: "", zip: "" });
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingAddr, setAddingAddr] = useState(false);
  const [showAddrForm, setShowAddrForm] = useState(false);

  useEffect(() => {
    if (!requireAuth(router)) return;
    setReady(true);
    Promise.all([
      fetch(`${API}/users/me`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${API}/users/me/wishlist`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([u, w]) => {
      const ud = u.data;
      setUser(ud);
      setForm({ name: ud?.name || "", email: ud?.email || "" });
      setWishlist(w.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setSaving(true);
    const res = await fetch(`${API}/users/me`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(form) });
    const d = await res.json();
    if (res.ok) {
      setUser(d.data);
      const stored = JSON.parse(localStorage.getItem("shopnest_user") || "{}");
      localStorage.setItem("shopnest_user", JSON.stringify({ ...stored, name: form.name }));
      if (window.__toast) window.__toast("Profile updated!", "success");
    } else {
      if (window.__toast) window.__toast(d.error || "Failed to save", "error");
    }
    setSaving(false);
  }

  async function addAddress() {
    if (!newAddress.street || !newAddress.city || !newAddress.country) { if (window.__toast) window.__toast("Fill required fields", "error"); return; }
    setAddingAddr(true);
    const res = await fetch(`${API}/users/me/addresses`, { method: "POST", headers: authHeaders(), body: JSON.stringify(newAddress) });
    if (res.ok) {
      setShowAddrForm(false);
      setNewAddress({ street: "", city: "", country: "", zip: "" });
      const u = await fetch(`${API}/users/me`, { headers: authHeaders() }).then((r) => r.json());
      setUser(u.data);
      if (window.__toast) window.__toast("Address added!", "success");
    }
    setAddingAddr(false);
  }

  if (!ready) return null;

  return (
    <>
      <Head><title>My Profile — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 32 }}>My Profile</h1>
            {loading ? (
              <p style={{ color: "#9CA3AF" }}>Loading…</p>
            ) : (
              <div className="profile-layout" style={{ display: "grid", alignItems: "start", gap: 24 }}>
                {/* Left: forms */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Personal info */}
                  <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <p style={{ fontWeight: 700, fontSize: "1rem", color: "#111827", marginBottom: 20 }}>Personal Information</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Full Name</label>
                        <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
                        <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Role</label>
                        <span className={`badge badge-${user?.role}`} style={{ padding: "5px 12px" }}>{user?.role}</span>
                      </div>
                      <button onClick={saveProfile} disabled={saving} className="btn-primary" style={{ width: "fit-content", padding: "11px 28px" }}>
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <p style={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>Saved Addresses</p>
                      <button onClick={() => setShowAddrForm(!showAddrForm)} className="btn-outline" style={{ fontSize: "0.8rem", padding: "7px 14px" }}>+ Add</button>
                    </div>
                    {(user?.addresses || []).length === 0 && !showAddrForm && <p style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>No saved addresses.</p>}
                    {(user?.addresses || []).map((a, i) => (
                      <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
                        <p style={{ fontSize: "0.875rem", color: "#374151", lineHeight: 1.7 }}>{a.street}<br />{a.city}{a.zip ? `, ${a.zip}` : ""}<br />{a.country}</p>
                      </div>
                    ))}
                    {showAddrForm && (
                      <div style={{ border: "1px dashed #E11D48", borderRadius: 8, padding: 16, marginTop: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                          {[["street","Street *"],["city","City *"],["country","Country *"],["zip","ZIP"]].map(([k, label]) => (
                            <div key={k}>
                              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>{label}</label>
                              <input className="input-field" style={{ fontSize: "0.875rem", padding: "8px 12px" }} value={newAddress[k]} onChange={(e) => setNewAddress({ ...newAddress, [k]: e.target.value })} />
                            </div>
                          ))}
                        </div>
                        <button onClick={addAddress} disabled={addingAddr} className="btn-primary" style={{ fontSize: "0.875rem", padding: "9px 20px" }}>
                          {addingAddr ? "Adding…" : "Add Address"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: wishlist preview */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <p style={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>Wishlist</p>
                    <Link href="/wishlist" style={{ color: "#E11D48", fontSize: "0.8rem", fontWeight: 600 }}>View All →</Link>
                  </div>
                  {wishlist.length === 0 ? (
                    <p style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>No items in wishlist.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {wishlist.slice(0, 4).map((p) => {
                        const src = productImage(p);
                        return (
                          <Link key={p._id} href={`/products/${p._id}`} style={{ borderRadius: 8, overflow: "hidden", display: "block", height: 100, background: "#F3F4F6" }}>
                            <img
                              src={src}
                              alt={p.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              onError={(e) => { e.target.onerror = null; e.target.src = `https://picsum.photos/seed/${p._id}/200/200`; }}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .profile-layout { grid-template-columns: 1fr 280px; }
          @media (max-width: 768px) { .profile-layout { grid-template-columns: 1fr; } }
        `}</style>

        <Footer />
      </div>
    </>
  );
}
