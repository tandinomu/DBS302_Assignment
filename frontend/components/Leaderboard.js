export default function Leaderboard({ title, entries, dark = false }) {
  if (!entries || entries.length === 0) {
    return (
      <div style={{ background: dark ? "#1F2937" : "#fff", borderRadius: 12, padding: 24, textAlign: "center" }}>
        <p style={{ color: dark ? "#9CA3AF" : "#6B7280", fontSize: "0.875rem" }}>No data available</p>
      </div>
    );
  }

  const bg = dark ? "#1F2937" : "#fff";
  const textPrimary = dark ? "#F9FAFB" : "#111827";
  const textMuted = dark ? "#9CA3AF" : "#6B7280";
  const rowBg = dark ? "#374151" : "#F9FAFB";

  return (
    <div style={{ background: bg, borderRadius: 12, padding: 20, boxShadow: dark ? "none" : "0 2px 8px rgba(0,0,0,0.06)" }}>
      {title && <p style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: textMuted, marginBottom: 16 }}>{title}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.slice(0, 5).map((entry, idx) => {
          const score = parseFloat(entry.score || 0);
          const maxScore = parseFloat(entries[0]?.score || 1);
          const pct = Math.round((score / maxScore) * 100);
          return (
            <div key={entry.userId || idx} style={{ background: rowBg, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: idx === 0 ? "#E11D48" : textMuted, minWidth: 20 }}>
                  #{idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem", color: textPrimary, marginBottom: 1 }}>{entry.name || "Unknown"}</p>
                  {entry.email && <p style={{ fontSize: "0.75rem", color: textMuted }}>{entry.email}</p>}
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#E11D48" }}>
                  ${score.toFixed(0)}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 3, background: dark ? "#4B5563" : "#E5E7EB", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#E11D48", borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
