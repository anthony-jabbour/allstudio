import type { BoardDocumentV1, BoardNode, BoardPage } from "@allstudio/project";
import type { CSSProperties, ReactNode } from "react";

/**
 * Board nodes render as plain absolutely positioned DOM with inline styles.
 * Text is always a React text child (never HTML), and images are restricted
 * to validated inline data URLs by the schema, so rendering an imported board
 * cannot run script or reach the network.
 */

export function nodeBackground(node: BoardNode): string | undefined {
  if (node.type === "text" || node.type === "image") {
    return node.fill ?? undefined;
  }
  if (node.gradient) {
    const [angle, from, to] = node.gradient;
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  return node.fill ?? undefined;
}

export function nodeStyle(node: BoardNode): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    opacity: node.opacity ?? 1,
    background: nodeBackground(node),
    borderRadius: node.type === "ellipse" ? "50%" : (node.radius ?? 0),
    boxSizing: "border-box",
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    display: node.hidden ? "none" : undefined,
  };
  if (node.stroke && node.stroke.width > 0) {
    style.boxShadow = `inset 0 0 0 ${node.stroke.width}px ${node.stroke.color}`;
  }
  if (node.shadow) {
    const { x, y, blur, color } = node.shadow;
    const drop = `${x}px ${y}px ${blur}px ${color}`;
    style.boxShadow = style.boxShadow ? `${style.boxShadow}, ${drop}` : drop;
  }
  if (node.type === "frame" && node.clip !== false) style.overflow = "hidden";
  if (node.type === "text") {
    Object.assign(style, {
      color: node.color,
      fontFamily: node.fontFamily,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      lineHeight: node.lineHeight,
      letterSpacing: `${node.letterSpacing}px`,
      textAlign: node.textAlign,
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
    } satisfies CSSProperties);
  }
  return style;
}

export interface BoardNodeViewProps {
  node: BoardNode;
  /** Lets the editor wrap/decorate a node (data attributes, editing). */
  renderText?: (node: Extract<BoardNode, { type: "text" }>) => ReactNode;
  attributes?: (node: BoardNode) => Record<string, string | undefined>;
}

export function BoardNodeView({
  node,
  renderText,
  attributes,
}: BoardNodeViewProps) {
  const attrs = attributes?.(node) ?? {};
  const style = nodeStyle(node);
  switch (node.type) {
    case "frame":
      return (
        <div style={style} {...attrs}>
          {node.children.map((child) => (
            <BoardNodeView
              key={child.id}
              node={child}
              renderText={renderText}
              attributes={attributes}
            />
          ))}
        </div>
      );
    case "text":
      return (
        <div style={style} {...attrs}>
          {renderText ? renderText(node) : node.text}
        </div>
      );
    case "image":
      return (
        <div style={style} {...attrs}>
          {/* biome-ignore lint/performance/noImgElement: validated inline data URL, not a Next.js page */}
          <img
            src={node.src}
            alt={node.name}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: node.fit,
              display: "block",
              borderRadius: "inherit",
              pointerEvents: "none",
            }}
          />
        </div>
      );
    default:
      return <div style={style} {...attrs} />;
  }
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of a page's visible top-level nodes, or null when empty. */
export function pageBounds(page: BoardPage): Bounds | null {
  const visible = page.nodes.filter((node) => !node.hidden);
  if (visible.length === 0) return null;
  const left = Math.min(...visible.map((n) => n.x));
  const top = Math.min(...visible.map((n) => n.y));
  const right = Math.max(...visible.map((n) => n.x + n.width));
  const bottom = Math.max(...visible.map((n) => n.y + n.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export interface BoardThumbnailProps {
  document: BoardDocumentV1;
  /** Rendered box size in CSS pixels. */
  width: number;
  height: number;
  padding?: number;
  className?: string;
}

/**
 * Real, scaled render of the first page — the dashboard never shows an
 * invented preview. Empty boards render an honest empty state.
 */
export function BoardThumbnail({
  document,
  width,
  height,
  padding = 16,
  className,
}: BoardThumbnailProps) {
  const page = document.pages[0];
  const bounds = page ? pageBounds(page) : null;
  if (!page || !bounds) {
    return (
      <div
        className={className}
        data-empty="true"
        style={{ width, height, position: "relative" }}
        role="img"
        aria-label="Empty board"
      />
    );
  }
  const scale = Math.min(
    (width - padding * 2) / Math.max(bounds.width, 1),
    (height - padding * 2) / Math.max(bounds.height, 1),
    1,
  );
  const offsetX = (width - bounds.width * scale) / 2 - bounds.x * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.y * scale;
  return (
    <div
      className={className}
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: page.background,
      }}
      role="img"
      aria-label={`Preview of ${document.name}`}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          pointerEvents: "none",
        }}
      >
        {page.nodes.map((node) => (
          <BoardNodeView key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
