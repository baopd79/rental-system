interface EmptyStateProps {
  message: string;
  icon?: React.ElementType;
}

export function EmptyState({ message, icon: Icon }: EmptyStateProps) {
  return (
    <div style={{
      padding: "var(--sp-8) var(--sp-6)",
      textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-2)",
    }}>
      {Icon && <Icon size={20} color="var(--vn-text-3)" />}
      <span style={{ fontSize: "var(--text-label)", color: "var(--vn-text-3)" }}>
        {message}
      </span>
    </div>
  );
}
