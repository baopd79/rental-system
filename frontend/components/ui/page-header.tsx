interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      marginBottom: "var(--sp-5)",
    }}>
      <div>
        <h1 style={{
          fontSize: "var(--text-display)", fontWeight: 700,
          letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0, lineHeight: 1.2,
        }}>
          {title}
        </h1>
        {description && (
          <p style={{
            fontSize: "var(--text-label)", color: "var(--vn-text-3)",
            marginTop: "var(--sp-1)", marginBottom: 0,
          }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
