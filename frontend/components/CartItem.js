export default function CartItem({ item, onUpdate, onRemove }) {
  const imgSrc = item.image || `https://picsum.photos/seed/${(item.productName || "product").replace(/\s+/g, "-").toLowerCase()}/200/200`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ width: 72, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#F3F4F6" }}>
        <img
          src={imgSrc}
          alt={item.productName}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      </div>

      <div>
        <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "#111827", marginBottom: 4 }}>{item.productName}</p>
        <p style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>{item.sku}</p>
        {!item.inStock && <p style={{ fontSize: "0.75rem", color: "#E11D48", marginTop: 2 }}>Low stock</p>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onUpdate(item, item.quantity - 1)}
          style={{ width: 28, height: 28, border: "1px solid #E5E7EB", borderRadius: 4, background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", color: "#374151", cursor: "pointer" }}
        >
          −
        </button>
        <span style={{ fontWeight: 600, minWidth: 24, textAlign: "center", fontSize: "0.9rem" }}>{item.quantity}</span>
        <button
          onClick={() => onUpdate(item, item.quantity + 1)}
          style={{ width: 28, height: 28, border: "1px solid #E5E7EB", borderRadius: 4, background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", color: "#374151", cursor: "pointer" }}
        >
          +
        </button>
      </div>

      <div style={{ textAlign: "right", minWidth: 80 }}>
        <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827", marginBottom: 6 }}>${item.lineTotal?.toFixed(2)}</p>
        <button onClick={() => onRemove(item)} style={{ color: "#9CA3AF", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.85rem", border: "none", background: "none", padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Remove
        </button>
      </div>
    </div>
  );
}
