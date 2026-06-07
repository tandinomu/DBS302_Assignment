import "../styles/globals.css";
import { useState, useEffect, useCallback } from "react";

export default function App({ Component, pageProps }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__toast = addToast;
    }
  }, [addToast]);

  const typeColors = {
    success: "#16a34a",
    error: "#E11D48",
    info: "#2563EB",
    warning: "#D97706",
  };

  return (
    <>
      <Component {...pageProps} />
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in"
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              background: typeColors[t.type] || typeColors.success,
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.875rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              maxWidth: 340,
              pointerEvents: "auto",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
