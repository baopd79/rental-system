interface StatusBadgeProps {
  bg: string;
  fg: string;
  dot?: string;
  label: string;
}

export function StatusBadge({ bg, fg, dot, label }: StatusBadgeProps) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "var(--sp-1)",
      height: 22, padding: "0 var(--sp-2)",
      borderRadius: 999,
      fontSize: "var(--text-xs)", fontWeight: 500,
      background: bg, color: fg,
      whiteSpace: "nowrap",
    }}>
      {dot && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      )}
      {label}
    </span>
  );
}
