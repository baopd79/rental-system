interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ElementType;
  accentBg?: string;
  accentFg?: string;
  valueColor?: string;
  loading?: boolean;
}

export function KpiCard({
  label, value, sub, icon: Icon,
  accentBg = "var(--slate-100)", accentFg = "var(--slate-500)",
  valueColor,
  loading,
}: KpiCardProps) {
  return (
    <div style={{
      background: "var(--vn-surface)",
      border: "1px solid var(--vn-border)",
      borderRadius: "var(--r-lg)",
      padding: "var(--sp-4) 18px",
      display: "flex", flexDirection: "column", gap: "var(--sp-3)",
      boxShadow: "var(--sh-xs)",
    }}>
      {Icon && (
        <div style={{
          width: 36, height: 36, borderRadius: "var(--r-md)",
          background: accentBg, display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Icon size={17} color={accentFg} />
        </div>
      )}
      <div>
        <div style={{
          fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--vn-text-3)",
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--sp-1)",
        }}>
          {label}
        </div>
        <div style={{
          fontSize: "var(--text-display)", fontWeight: 700,
          letterSpacing: "-0.03em", lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          color: loading ? "var(--vn-border)" : (valueColor ?? "var(--vn-text)"),
        }}>
          {loading ? "—" : value}
        </div>
        {sub && (
          <div style={{
            fontSize: "var(--text-sm)", color: "var(--vn-text-3)",
            marginTop: "var(--sp-1)",
          }}>
            {loading ? "…" : sub}
          </div>
        )}
      </div>
    </div>
  );
}
