import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #F3F4F6", background: "#fff", marginTop: "auto" }}>
      <div className="container">
        <div style={{ padding: "56px 0 40px", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 32 }} className="footer-grid">
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0A0A0A", marginBottom: 12 }}>ShopNest</div>
            <p style={{ color: "#6B7280", fontSize: "0.875rem", lineHeight: 1.7, maxWidth: 260 }}>
              Elevating the everyday through curated design and exceptional craftsmanship.
            </p>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", marginBottom: 16 }}>Collection</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["New Arrivals", "/products"], ["Furniture", "/products"], ["Lighting", "/products"], ["Textiles", "/products"]].map(([label, href]) => (
                <Link key={label} href={href} style={{ color: "#6B7280", fontSize: "0.875rem" }}>{label}</Link>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", marginBottom: 16 }}>Company</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Our Story", "/"], ["Sustainability", "/"], ["Contact", "/"]].map(([label, href]) => (
                <Link key={label} href={href} style={{ color: "#6B7280", fontSize: "0.875rem" }}>{label}</Link>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", marginBottom: 16 }}>Support</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Shipping", "/"], ["Returns", "/"], ["FAQ", "/"]].map(([label, href]) => (
                <Link key={label} href={href} style={{ color: "#6B7280", fontSize: "0.875rem" }}>{label}</Link>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111", marginBottom: 16 }}>Social</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Instagram", "/"], ["Pinterest", "/"], ["Journal", "/"]].map(([label, href]) => (
                <Link key={label} href={href} style={{ color: "#6B7280", fontSize: "0.875rem" }}>{label}</Link>
              ))}
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #F3F4F6", padding: "20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>
            ShopNest — DBS302 Final Project | Built with MongoDB + Redis + Next.js
          </p>
          <div style={{ display: "flex", gap: 20 }}>
            {[["Privacy Policy", "/"], ["Terms of Service", "/"], ["Security Policy", "/"]].map(([label, href]) => (
              <Link key={label} href={href} style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>{label}</Link>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        .footer-grid { grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr; }
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </footer>
  );
}
