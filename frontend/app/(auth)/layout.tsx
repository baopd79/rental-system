export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .auth-wrap {
          display: flex;
          min-height: 100vh;
          font-family: var(--font-geist-sans);
          -webkit-font-smoothing: antialiased;
        }
        .auth-brand {
          width: 45%;
          background: linear-gradient(160deg, #1E3A8A 0%, #1D4ED8 45%, #2563EB 100%);
          display: flex;
          flex-direction: column;
          padding: 48px 52px;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }
        .auth-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--vn-bg);
          padding: 48px 32px;
        }
        @media (max-width: 767px) {
          .auth-brand { display: none; }
          .auth-form-panel { padding: 32px 20px; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .auth-brand { width: 36%; padding: 40px 36px; }
          .auth-brand-headline { font-size: 26px !important; }
          .auth-brand-features { display: none; }
        }
      `}</style>

      <div className="auth-wrap">
        {/* Brand panel */}
        <div className="auth-brand">
          {/* Background circles */}
          <div style={{
            position: "absolute", top: -80, right: -80,
            width: 360, height: 360, borderRadius: "50%",
            background: "rgba(255,255,255,.04)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -60, left: -60,
            width: 280, height: 280, borderRadius: "50%",
            background: "rgba(255,255,255,.03)", pointerEvents: "none",
          }} />

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: "auto" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,.15)",
              border: "1px solid rgba(255,255,255,.2)",
              display: "grid", placeItems: "center",
              backdropFilter: "blur(8px)",
            }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z" fill="#fff" />
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
              VnRental
            </span>
          </div>

          {/* Headline */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
            <div>
              <h1 className="auth-brand-headline" style={{
                fontSize: 34, fontWeight: 700, color: "#fff",
                letterSpacing: "-0.025em", lineHeight: 1.15,
                margin: "0 0 16px",
              }}>
                Quản lý nhà trọ<br />thông minh hơn.
              </h1>
              <p style={{ fontSize: 15.5, color: "rgba(255,255,255,.72)", lineHeight: 1.6, margin: 0 }}>
                Tất cả trong một nền tảng — từ phòng, hợp đồng đến hóa đơn điện nước hàng tháng.
              </p>
            </div>

            <div className="auth-brand-features" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { icon: "🏠", text: "Quản lý nhiều nhà, nhiều phòng từ một tài khoản" },
                { icon: "⚡", text: "Tự động tính hóa đơn điện, nước, phụ phí hàng tháng" },
                { icon: "📲", text: "Gửi hóa đơn cho khách thuê qua link, không cần app" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{
                    fontSize: 18, lineHeight: 1,
                    width: 34, height: 34, borderRadius: 8,
                    background: "rgba(255,255,255,.12)",
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}>{icon}</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,.82)", lineHeight: 1.55, paddingTop: 7 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.4)", marginTop: "auto", paddingTop: 32 }}>
            © 2026 VnRental. Dành cho chủ nhà Việt Nam.
          </div>
        </div>

        {/* Form panel */}
        <div className="auth-form-panel">
          {children}
        </div>
      </div>
    </>
  );
}
