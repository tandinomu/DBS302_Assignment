import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SkeletonRow } from "../../components/Skeleton";
import { API, authHeaders, requireAuth } from "../../lib/api";

export default function AdminUsers() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!requireAuth(router, ["admin"])) return;
    setReady(true);
    fetch(`${API}/users`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.data && Array.isArray(d.data)) {
          setUsers(d.data);
        } else {
          setNotice("The /users list endpoint is not available for this role. Showing profile only.");
        }
        setLoading(false);
      })
      .catch(() => { setNotice("Could not load user list."); setLoading(false); });
  }, []);

  if (!ready) return null;

  const roleClass = (r) => r === "admin" ? "badge-admin" : r === "seller" ? "badge-seller" : "badge-customer";
  const initials = (name) => (name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      <Head><title>User Management — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ background: "#F9FAFB", flex: 1, paddingBottom: 64 }}>
          <div className="container" style={{ paddingTop: 40 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#111827", marginBottom: 28 }}>User Management</h1>

            {notice && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ color: "#D97706", fontSize: "0.875rem" }}>{notice}</p>
              </div>
            )}

            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: 24 }}>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : users.length === 0 && !notice ? (
                <div style={{ padding: "48px 24px", textAlign: "center" }}>
                  <p style={{ color: "#9CA3AF" }}>No users found.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table-auto">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u._id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#E11D48", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", color: "#fff", flexShrink: 0 }}>
                                {initials(u.name)}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ color: "#6B7280", fontSize: "0.875rem" }}>{u.email}</td>
                          <td><span className={`badge ${roleClass(u.role)}`}>{u.role}</span></td>
                          <td style={{ color: "#6B7280", fontSize: "0.85rem" }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
