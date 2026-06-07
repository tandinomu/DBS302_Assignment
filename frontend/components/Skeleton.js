export function SkeletonBox({ width = "100%", height = 16, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 4, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div className="skeleton" style={{ height: 220, width: "100%" }} />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonBox height={12} width="40%" />
        <SkeletonBox height={16} width="80%" />
        <SkeletonBox height={14} width="30%" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} height={14} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
      <SkeletonBox width={40} height={40} style={{ borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <SkeletonBox height={14} width="50%" />
        <SkeletonBox height={12} width="30%" />
      </div>
      <SkeletonBox height={14} width={60} />
    </div>
  );
}
