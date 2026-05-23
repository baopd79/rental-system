import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lp {
          font-family: var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif);
          -webkit-font-smoothing: antialiased;
          background: #fafaf9;
          color: #0c0a09;
          min-height: 100vh;
        }
        .lp-nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(250,250,249,0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid #e5e7eb;
        }
        .lp-nav-inner {
          max-width: 1120px; margin: 0 auto;
          padding: 0 32px;
          height: 56px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-logo {
          display: flex; align-items: center; gap: 9;
          text-decoration: none;
        }
        .lp-logo-mark {
          width: 30px; height: 30px; border-radius: 8px;
          background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%);
          display: grid; place-items: center;
          box-shadow: 0 2px 6px rgba(37,99,235,.40);
          flex-shrink: 0;
        }
        .lp-logo-text {
          font-size: 16px; font-weight: 600; letter-spacing: -0.02em; color: #0c0a09;
        }
        .lp-logo-text span { color: #3ba6f1; }
        .lp-nav-links { display: flex; align-items: center; gap: 4; }
        .lp-btn-ghost {
          display: inline-flex; align-items: center; height: 34px;
          padding: 0 16px; border-radius: 9999px;
          font-size: 13.5px; font-weight: 500; color: #78716c;
          background: transparent; border: 1px solid transparent;
          text-decoration: none; cursor: pointer;
          transition: background .15s, color .15s, border-color .15s;
        }
        .lp-btn-ghost:hover { background: #fff; color: #0c0a09; border-color: #e5e7eb; }
        .lp-btn-primary {
          display: inline-flex; align-items: center; height: 34px;
          padding: 0 18px; border-radius: 9999px;
          font-size: 13.5px; font-weight: 600; color: #fff;
          background: #3ba6f1; border: none;
          text-decoration: none; cursor: pointer;
          box-shadow: 0 1px 3px rgba(59,166,241,.4);
          transition: background .15s, box-shadow .15s;
        }
        .lp-btn-primary:hover { background: #2d94e0; box-shadow: 0 2px 8px rgba(59,166,241,.5); }

        /* Hero */
        .lp-hero {
          max-width: 1120px; margin: 0 auto;
          padding: 96px 32px 80px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .lp-hero-tag {
          display: inline-flex; align-items: center; gap: 6;
          padding: 4px 14px; border-radius: 9999px;
          background: #fff; border: 1px solid #e5e7eb;
          font-size: 12px; font-weight: 500; color: #78716c;
          margin-bottom: 32px;
          box-shadow: rgba(0,0,0,0.05) 0px 1px 2px;
        }
        .lp-hero-tag-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #3ba6f1;
        }
        .lp-hero-h1 {
          font-size: 56px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.08;
          color: #0c0a09; margin-bottom: 20px; max-width: 660px;
        }
        .lp-hero-h1 em { font-style: normal; color: #3ba6f1; }
        .lp-hero-sub {
          font-size: 17px; color: #78716c; line-height: 1.65;
          max-width: 520px; margin-bottom: 40px;
        }
        .lp-hero-actions {
          display: flex; align-items: center; gap: 12; flex-wrap: wrap; justify-content: center;
          margin-bottom: 72px;
        }
        .lp-hero-cta {
          display: inline-flex; align-items: center; gap: 8; height: 44px;
          padding: 0 28px; border-radius: 9999px;
          font-size: 14.5px; font-weight: 600; color: #fff;
          background: #3ba6f1; text-decoration: none;
          box-shadow: 0 2px 8px rgba(59,166,241,.45);
          transition: background .15s, box-shadow .15s, transform .1s;
        }
        .lp-hero-cta:hover { background: #2d94e0; box-shadow: 0 4px 14px rgba(59,166,241,.5); transform: translateY(-1px); }
        .lp-hero-cta-ghost {
          display: inline-flex; align-items: center; gap: 6; height: 44px;
          padding: 0 24px; border-radius: 9999px;
          font-size: 14.5px; font-weight: 500; color: #0c0a09;
          background: #fff; border: 1px solid #e5e7eb;
          text-decoration: none;
          box-shadow: rgba(0,0,0,0.05) 0px 1px 2px;
          transition: border-color .15s, box-shadow .15s;
        }
        .lp-hero-cta-ghost:hover { border-color: #d6d3d1; box-shadow: rgba(0,0,0,0.08) 0px 2px 8px; }

        /* Dashboard preview */
        .lp-preview {
          width: 100%; max-width: 900px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: rgba(17,12,46,0.12) 0px 12px 45px 0px;
          overflow: hidden;
        }
        .lp-preview-bar {
          height: 38px; background: #f5f4f3; border-bottom: 1px solid #e5e7eb;
          display: flex; align-items: center; gap: 7; padding: 0 16px;
        }
        .lp-preview-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-preview-body { display: flex; }
        .lp-preview-sidebar {
          width: 200px; flex-shrink: 0;
          background: #fff; border-right: 1px solid #e5e7eb;
          padding: 16px 12px;
        }
        .lp-preview-logo-row {
          display: flex; align-items: center; gap: 8; margin-bottom: 20px;
        }
        .lp-preview-logo-mark {
          width: 22px; height: 22px; border-radius: 5px;
          background: linear-gradient(135deg, #2563EB, #1E40AF);
        }
        .lp-preview-logo-text { font-size: 12px; font-weight: 600; color: #0c0a09; }
        .lp-preview-nav-section { margin-bottom: 12px; }
        .lp-preview-nav-label {
          font-size: 9px; font-weight: 600; color: #a8a29e;
          text-transform: uppercase; letter-spacing: 0.08em;
          padding: 0 8px; margin-bottom: 4px;
        }
        .lp-preview-nav-item {
          display: flex; align-items: center; gap: 7;
          height: 26px; padding: 0 8px; border-radius: 5px;
          font-size: 11px; margin-bottom: 2px;
        }
        .lp-preview-nav-item.active {
          background: #eff6ff; color: #1d4ed8; font-weight: 600;
          border-left: 2px solid #2563eb;
        }
        .lp-preview-nav-item:not(.active) { color: #78716c; }
        .lp-preview-nav-dot {
          width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0;
        }
        .lp-preview-main { flex: 1; padding: 20px; background: #fafaf9; }
        .lp-preview-kpi-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;
        }
        .lp-preview-kpi {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 9px; padding: 12px 14px;
        }
        .lp-preview-kpi-label { font-size: 9px; color: #a8a29e; margin-bottom: 4px; }
        .lp-preview-kpi-val { font-size: 18px; font-weight: 700; color: #0c0a09; }
        .lp-preview-kpi-sub { font-size: 8px; color: #a8a29e; margin-top: 2px; }
        .lp-preview-chart {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 9px; padding: 14px;
          margin-bottom: 16px;
        }
        .lp-preview-chart-label { font-size: 10px; font-weight: 600; color: #0c0a09; margin-bottom: 12px; }
        .lp-preview-bars { display: flex; align-items: flex-end; gap: 4; height: 56px; }
        .lp-preview-bar-col { flex: 1; border-radius: 3px 3px 0 0; }
        .lp-preview-row-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lp-preview-list {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 9px; overflow: hidden;
        }
        .lp-preview-list-header {
          padding: 10px 14px; border-bottom: 1px solid #e5e7eb;
          font-size: 10px; font-weight: 700; color: #0c0a09;
        }
        .lp-preview-list-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 14px; border-bottom: 1px solid #f5f4f3;
          font-size: 9px;
        }
        .lp-preview-list-name { font-weight: 600; color: #0c0a09; }
        .lp-preview-list-sub { color: #a8a29e; margin-top: 1px; }
        .lp-preview-badge {
          font-size: 8px; font-weight: 600; padding: 2px 7px; border-radius: 99px;
        }

        /* Features */
        .lp-features {
          background: #fff; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;
        }
        .lp-features-inner {
          max-width: 1120px; margin: 0 auto; padding: 80px 32px;
        }
        .lp-section-label {
          font-size: 12px; font-weight: 600; color: #3ba6f1;
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: 12px;
        }
        .lp-section-h2 {
          font-size: 36px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15;
          color: #0c0a09; margin-bottom: 48px; max-width: 560px;
        }
        .lp-feat-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
        }
        .lp-feat-card {
          background: #fafaf9; border: 1px solid #e5e7eb; border-radius: 12px;
          padding: 28px 24px;
          transition: box-shadow .2s, transform .2s;
        }
        .lp-feat-card:hover {
          box-shadow: rgba(0,0,0,0.08) 0px 8px 24px;
          transform: translateY(-2px);
        }
        .lp-feat-icon {
          width: 40px; height: 40px; border-radius: 10px; margin-bottom: 18px;
          display: grid; place-items: center;
        }
        .lp-feat-title {
          font-size: 15px; font-weight: 600; color: #0c0a09; margin-bottom: 8px;
          letter-spacing: -0.01em;
        }
        .lp-feat-desc { font-size: 13.5px; color: #78716c; line-height: 1.6; }

        /* Stats */
        .lp-stats {
          max-width: 1120px; margin: 0 auto; padding: 64px 32px;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
          background: #e5e7eb; border: 1px solid #e5e7eb; border-radius: 16px;
          overflow: hidden;
        }
        .lp-stat {
          background: #fff; padding: 36px 40px; text-align: center;
        }
        .lp-stat-num { font-size: 40px; font-weight: 700; color: #3ba6f1; letter-spacing: -0.025em; }
        .lp-stat-label { font-size: 13.5px; color: #78716c; margin-top: 6px; }

        /* CTA section */
        .lp-cta-section {
          max-width: 1120px; margin: 0 auto; padding: 40px 32px 96px;
        }
        .lp-cta-card {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
          border-radius: 20px; padding: 60px 40px;
          text-align: center;
          position: relative; overflow: hidden;
        }
        .lp-cta-card::before {
          content: '';
          position: absolute; top: -80px; right: -80px;
          width: 300px; height: 300px; border-radius: 50%;
          background: rgba(255,255,255,.05);
          pointer-events: none;
        }
        .lp-cta-card::after {
          content: '';
          position: absolute; bottom: -60px; left: -60px;
          width: 240px; height: 240px; border-radius: 50%;
          background: rgba(255,255,255,.04);
          pointer-events: none;
        }
        .lp-cta-h2 {
          font-size: 36px; font-weight: 600; color: #fff;
          letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 14px;
        }
        .lp-cta-sub { font-size: 16px; color: rgba(255,255,255,.72); margin-bottom: 36px; }
        .lp-cta-actions { display: flex; align-items: center; gap: 12; justify-content: center; }
        .lp-cta-btn {
          display: inline-flex; align-items: center; height: 44px;
          padding: 0 28px; border-radius: 9999px;
          font-size: 14.5px; font-weight: 600;
          text-decoration: none; transition: all .15s;
        }
        .lp-cta-btn-white {
          background: #fff; color: #1d4ed8;
          box-shadow: 0 2px 8px rgba(0,0,0,.15);
        }
        .lp-cta-btn-white:hover { background: #f8fafc; transform: translateY(-1px); }
        .lp-cta-btn-outline {
          background: rgba(255,255,255,.12); color: #fff;
          border: 1px solid rgba(255,255,255,.25);
        }
        .lp-cta-btn-outline:hover { background: rgba(255,255,255,.2); }

        /* Footer */
        .lp-footer {
          border-top: 1px solid #e5e7eb;
        }
        .lp-footer-inner {
          max-width: 1120px; margin: 0 auto; padding: 24px 32px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-footer-copy { font-size: 12.5px; color: #a8a29e; }
        .lp-footer-links { display: flex; gap: 20px; }
        .lp-footer-link { font-size: 12.5px; color: #a8a29e; text-decoration: none; transition: color .15s; }
        .lp-footer-link:hover { color: #0c0a09; }

        /* ── Responsive ──────────────────────────────────────── */
        @media (max-width: 767px) {
          .lp-nav-inner { padding: 0 16px; }
          .lp-btn-ghost { display: none; }

          .lp-hero { padding: 56px 20px 48px; }
          .lp-hero-h1 { font-size: 34px; }
          .lp-hero-sub { font-size: 15px; }
          .lp-hero-actions { gap: 10px; }
          .lp-hero-cta, .lp-hero-cta-ghost { height: 40px; font-size: 13.5px; padding: 0 20px; }

          .lp-preview-sidebar { display: none; }
          .lp-preview-main { padding: 14px; }
          .lp-preview-kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .lp-preview-row-grid { grid-template-columns: 1fr; }
          .lp-preview-list:last-child { display: none; }

          .lp-features-inner { padding: 48px 20px; }
          .lp-section-h2 { font-size: 26px; margin-bottom: 32px; }
          .lp-feat-grid { grid-template-columns: 1fr; gap: 16px; }

          .lp-stats { grid-template-columns: 1fr; margin: 32px auto; }
          .lp-stat { padding: 24px 20px; }
          .lp-stat-num { font-size: 32px; }

          .lp-cta-section { padding: 20px 20px 64px; }
          .lp-cta-card { padding: 40px 24px; }
          .lp-cta-h2 { font-size: 26px; }
          .lp-cta-sub { font-size: 14px; }
          .lp-cta-actions { flex-direction: column; gap: 10px; }
          .lp-cta-btn { width: 100%; justify-content: center; }

          .lp-footer-inner { flex-direction: column; gap: 12px; text-align: center; padding: 20px 16px; }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .lp-hero { padding: 72px 32px 64px; }
          .lp-hero-h1 { font-size: 44px; }
          .lp-feat-grid { grid-template-columns: repeat(2, 1fr); }
          .lp-stats { grid-template-columns: repeat(3, 1fr); }
          .lp-preview-sidebar { width: 160px; }
        }
      `}</style>

      <div className="lp">
        {/* Nav */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <Link href="/" className="lp-logo">
              <div className="lp-logo-mark">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z" fill="#fff" />
                </svg>
              </div>
              <span className="lp-logo-text">Vn<span>Rental</span></span>
            </Link>
            <div className="lp-nav-links">
              <Link href="/sign-in" className="lp-btn-ghost">Đăng nhập</Link>
              <Link href="/sign-up" className="lp-btn-primary">Bắt đầu miễn phí</Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-hero-tag">
            <div className="lp-hero-tag-dot" />
            Hệ thống quản lý nhà trọ cho chủ nhà Việt Nam
          </div>

          <h1 className="lp-hero-h1">
            Quản lý nhà trọ<br />
            <em>thông minh hơn.</em>
          </h1>

          <p className="lp-hero-sub">
            Một nền tảng để quản lý phòng, hợp đồng, ghi chỉ số điện nước và tạo hóa đơn hàng tháng — nhanh, rõ ràng, không cần Excel.
          </p>

          <div className="lp-hero-actions">
            <Link href="/sign-up" className="lp-hero-cta">
              Bắt đầu miễn phí
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <Link href="/sign-in" className="lp-hero-cta-ghost">
              Đăng nhập
            </Link>
          </div>

          {/* Dashboard preview mockup */}
          <div className="lp-preview">
            <div className="lp-preview-bar">
              <div className="lp-preview-dot" style={{ background: "#ff5f57" }} />
              <div className="lp-preview-dot" style={{ background: "#febc2e" }} />
              <div className="lp-preview-dot" style={{ background: "#28c840" }} />
            </div>
            <div className="lp-preview-body">
              {/* Sidebar */}
              <div className="lp-preview-sidebar">
                <div className="lp-preview-logo-row">
                  <div className="lp-preview-logo-mark" />
                  <span className="lp-preview-logo-text">VnRental</span>
                </div>
                {[
                  { label: "Tổng quan", items: [{ name: "Dashboard", active: true, color: "#3ba6f1" }] },
                  { label: "Quản lý", items: [
                    { name: "Nhà trọ", active: false, color: "#94a3b8" },
                    { name: "Phòng", active: false, color: "#94a3b8" },
                    { name: "Khách thuê", active: false, color: "#94a3b8" },
                  ]},
                  { label: "Tài chính", items: [
                    { name: "Chỉ số Đ/N", active: false, color: "#f59e0b" },
                    { name: "Hóa đơn", active: false, color: "#94a3b8" },
                  ]},
                ].map(group => (
                  <div key={group.label} className="lp-preview-nav-section">
                    <div className="lp-preview-nav-label">{group.label}</div>
                    {group.items.map(item => (
                      <div key={item.name} className={`lp-preview-nav-item${item.active ? " active" : ""}`}>
                        <div className="lp-preview-nav-dot" style={{ background: item.active ? "#3ba6f1" : "#e2e8f0" }} />
                        {item.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="lp-preview-main">
                {/* KPIs */}
                <div className="lp-preview-kpi-grid">
                  {[
                    { label: "Phòng cho thuê", val: "12 / 15", sub: "80% lấp đầy" },
                    { label: "Doanh thu tháng", val: "42.5tr", sub: "Cả năm: 380tr" },
                    { label: "Hóa đơn chưa TT", val: "3", sub: "Tổng: 8.4tr" },
                    { label: "HĐ sắp hết hạn", val: "2", sub: "Trong 30 ngày" },
                  ].map(kpi => (
                    <div key={kpi.label} className="lp-preview-kpi">
                      <div className="lp-preview-kpi-label">{kpi.label}</div>
                      <div className="lp-preview-kpi-val">{kpi.val}</div>
                      <div className="lp-preview-kpi-sub">{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="lp-preview-chart">
                  <div className="lp-preview-chart-label">Doanh thu theo tháng · 2026</div>
                  <div className="lp-preview-bars">
                    {[28, 35, 40, 38, 42, 45, 50, 55, 60, 52, 48, 0].map((h, i) => (
                      <div
                        key={i}
                        className="lp-preview-bar-col"
                        style={{
                          height: h ? `${h}%` : "4%",
                          background: i === 4 ? "#3ba6f1" : h > 0 ? "#c1e1f7" : "#f0f0ef",
                          minHeight: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Lists */}
                <div className="lp-preview-row-grid">
                  <div className="lp-preview-list">
                    <div className="lp-preview-list-header">HĐ sắp hết hạn</div>
                    {[
                      { name: "Nguyễn Văn A", room: "Phòng 101", days: "3 ngày", urgent: true },
                      { name: "Trần Thị B", room: "Phòng 205", days: "12 ngày", urgent: false },
                    ].map(r => (
                      <div key={r.name} className="lp-preview-list-item">
                        <div>
                          <div className="lp-preview-list-name">{r.name}</div>
                          <div className="lp-preview-list-sub">{r.room}</div>
                        </div>
                        <div className="lp-preview-badge" style={{
                          background: r.urgent ? "#fef2f2" : "#fffbeb",
                          color: r.urgent ? "#dc2626" : "#b45309",
                        }}>{r.days}</div>
                      </div>
                    ))}
                  </div>
                  <div className="lp-preview-list">
                    <div className="lp-preview-list-header">Hóa đơn chưa TT</div>
                    {[
                      { name: "Lê Văn C", room: "Phòng 301 · T5/26", amount: "2.8tr" },
                      { name: "Phạm Thị D", room: "Phòng 102 · T5/26", amount: "3.1tr" },
                    ].map(r => (
                      <div key={r.name} className="lp-preview-list-item">
                        <div>
                          <div className="lp-preview-list-name">{r.name}</div>
                          <div className="lp-preview-list-sub">{r.room}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 9, color: "#0c0a09" }}>{r.amount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="lp-features">
          <div className="lp-features-inner">
            <div className="lp-section-label">Tính năng</div>
            <h2 className="lp-section-h2">
              Mọi thứ một chủ nhà cần, trong một chỗ.
            </h2>
            <div className="lp-feat-grid">
              {[
                {
                  icon: (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3ba6f1" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z"/>
                    </svg>
                  ),
                  iconBg: "#eff6ff",
                  title: "Phòng & Hợp đồng",
                  desc: "Quản lý toàn bộ phòng trọ, theo dõi tình trạng, khách thuê và hợp đồng với timeline sự kiện rõ ràng.",
                },
                {
                  icon: (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  ),
                  iconBg: "#fffbeb",
                  title: "Ghi chỉ số Điện/Nước",
                  desc: "Ghi chỉ số công tơ hàng tháng, tự động điền số đầu kỳ từ kỳ trước. Hỗ trợ đồng hồ chung và riêng.",
                },
                {
                  icon: (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/>
                    </svg>
                  ),
                  iconBg: "#ecfdf5",
                  title: "Hóa đơn tự động",
                  desc: "Tạo hóa đơn điện nước, tiền phòng và phụ phí mỗi tháng chỉ với vài click. Gửi link cho khách không cần cài app.",
                },
                {
                  icon: (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                    </svg>
                  ),
                  iconBg: "#f5f3ff",
                  title: "Dashboard tổng quan",
                  desc: "Nhìn ngay doanh thu theo tháng, phòng trống, hợp đồng sắp hết hạn và hóa đơn chưa thanh toán trên một màn hình.",
                },
                {
                  icon: (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  ),
                  iconBg: "#fdf2f8",
                  title: "Bảo mật & Cách ly dữ liệu",
                  desc: "Mỗi tài khoản chỉ thấy dữ liệu của mình. Xác thực qua Clerk, không lưu mật khẩu trực tiếp.",
                },
                {
                  icon: (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.25 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.55 5.55l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  ),
                  iconBg: "#ecfeff",
                  title: "Khách thuê tự xem hóa đơn",
                  desc: "Mỗi hóa đơn có link công khai riêng. Khách xem chi tiết, báo đã chuyển khoản — không cần tài khoản.",
                },
              ].map(feat => (
                <div key={feat.title} className="lp-feat-card">
                  <div className="lp-feat-icon" style={{ background: feat.iconBg }}>
                    {feat.icon}
                  </div>
                  <div className="lp-feat-title">{feat.title}</div>
                  <div className="lp-feat-desc">{feat.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <div style={{ padding: "0 32px" }}>
          <div className="lp-stats" style={{ margin: "64px auto" }}>
            {[
              { num: "∞", label: "Số nhà trọ có thể quản lý" },
              { num: "100%", label: "Cách ly dữ liệu giữa các tài khoản" },
              { num: "0", label: "Phần mềm cần cài đặt thêm" },
            ].map(s => (
              <div key={s.label} className="lp-stat">
                <div className="lp-stat-num">{s.num}</div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="lp-cta-section">
          <div className="lp-cta-card">
            <h2 className="lp-cta-h2">Sẵn sàng bắt đầu?</h2>
            <p className="lp-cta-sub">Tạo tài khoản miễn phí và thêm nhà trọ đầu tiên trong vài phút.</p>
            <div className="lp-cta-actions">
              <Link href="/sign-up" className="lp-cta-btn lp-cta-btn-white">
                Tạo tài khoản miễn phí
              </Link>
              <Link href="/sign-in" className="lp-cta-btn lp-cta-btn-outline">
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <span className="lp-footer-copy">© 2026 VnRental. Dành cho chủ nhà Việt Nam.</span>
            <div className="lp-footer-links">
              <Link href="/sign-in" className="lp-footer-link">Đăng nhập</Link>
              <Link href="/sign-up" className="lp-footer-link">Đăng ký</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
