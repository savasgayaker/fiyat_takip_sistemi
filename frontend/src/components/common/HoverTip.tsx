import { useState, type ReactNode } from "react";

interface Props {
  /** Tooltip body; rendered in a fixed-position card near the cursor. */
  content: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  testid?: string;
}

/**
 * Dependency-free hover tooltip (no Radix). Positions itself at the cursor and
 * flips left when it would overflow the viewport. Keyboard users get the same
 * text via `aria-label` on the wrapper.
 */
export function HoverTip({ content, children, className, style, testid }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className={className}
      style={style}
      data-testid={testid}
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{
            left: Math.min(pos.x + 12, window.innerWidth - 240),
            top: pos.y + 14,
            maxWidth: 228,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
