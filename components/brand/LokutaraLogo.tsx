"use client";

export function LokutaraMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1d4a38 0%, #2e7d5b 60%, #d9a441 130%)",
        color: "#fdf8ec",
        fontFamily: "var(--font-display, Georgia, serif)",
        fontWeight: 700,
        fontSize: size * 0.52,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      L
    </span>
  );
}

export function LokutaraLogo({
  size = 36,
  subtitle,
  dark = false,
}: {
  size?: number;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LokutaraMark size={size} />
      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span
          style={{
            fontFamily: "var(--font-display, Georgia, serif)",
            fontWeight: 700,
            fontSize: size * 0.5,
            letterSpacing: "-0.01em",
            color: dark ? "#fdf8ec" : "var(--forest, #1d4a38)",
          }}
        >
          Lokutara
        </span>
        {subtitle ? (
          <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted, #6b7280)" }}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
