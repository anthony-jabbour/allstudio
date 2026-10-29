/* biome-ignore-all lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA treeview uses a ul with interactive treeitem descendants. */
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PreviewElementSnapshot,
  PreviewLayerNode,
  PreviewLayersSnapshot,
} from "../preview-bridge/protocol.ts";

interface LayerTreeProps {
  layers: PreviewLayersSnapshot | null;
  selected: PreviewElementSnapshot | null;
  selectionVersion: number;
  sourceLabel?: string;
  onSelect(id: string): void;
}

export function LayerTree({
  layers,
  selected,
  selectionVersion,
  sourceLabel,
  onSelect,
}: LayerTreeProps) {
  const tree = useRef<HTMLUListElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focused, setFocused] = useState<string | null>(null);
  const selectedId = selected?.nodeId;
  const lastSelection = useRef<{ id: string | undefined; version: number }>({
    id: undefined,
    version: -1,
  });
  const { byId, children } = useMemo(() => {
    const byId = new Map<string, PreviewLayerNode>();
    const children = new Map<string | null, PreviewLayerNode[]>();
    for (const node of layers?.nodes ?? []) {
      byId.set(node.id, node);
      const siblings = children.get(node.parentId) ?? [];
      siblings.push(node);
      children.set(node.parentId, siblings);
    }
    return { byId, children };
  }, [layers]);
  useEffect(() => {
    const reveal =
      lastSelection.current.id !== selectedId ||
      lastSelection.current.version !== selectionVersion;
    lastSelection.current = { id: selectedId, version: selectionVersion };
    setCollapsed((previous) => {
      const next = new Set([...previous].filter((id) => byId.has(id)));
      let parent = reveal && selectedId ? byId.get(selectedId)?.parentId : null;
      while (parent) {
        next.delete(parent);
        parent = byId.get(parent)?.parentId;
      }
      return next.size === previous.size &&
        [...next].every((id) => previous.has(id))
        ? previous
        : next;
    });
  }, [byId, selectedId, selectionVersion]);
  const visible = useMemo(() => {
    const hidden = new Set<string>();
    return (layers?.nodes ?? []).filter((node) => {
      if (
        node.parentId &&
        (hidden.has(node.parentId) || collapsed.has(node.parentId))
      ) {
        hidden.add(node.id);
        return false;
      }
      return true;
    });
  }, [layers, collapsed]);
  const tabStop =
    visible.find((node) => node.id === focused)?.id ?? visible[0]?.id;
  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const focus = (id: string | undefined) => {
    if (!id) return;
    setFocused(id);
    tree.current
      ?.querySelector<HTMLElement>(`[data-layer-id="${id}"]`)
      ?.focus();
  };
  const keyDown = (
    event: KeyboardEvent<HTMLLIElement>,
    node: PreviewLayerNode,
  ) => {
    if (
      event.target !== event.currentTarget ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    )
      return;
    const branch = children.get(node.id) ?? [];
    const index = visible.findIndex((item) => item.id === node.id);
    switch (event.key) {
      case "ArrowDown":
        focus(visible[Math.min(index + 1, visible.length - 1)]?.id);
        break;
      case "ArrowUp":
        focus(visible[Math.max(index - 1, 0)]?.id);
        break;
      case "Home":
        focus(visible[0]?.id);
        break;
      case "End":
        focus(visible.at(-1)?.id);
        break;
      case "ArrowRight":
        if (branch.length) {
          if (collapsed.has(node.id)) toggle(node.id);
          else focus(branch[0]?.id);
        }
        break;
      case "ArrowLeft":
        if (branch.length && !collapsed.has(node.id)) toggle(node.id);
        else focus(node.parentId ?? undefined);
        break;
      case "Enter":
      case " ":
        onSelect(node.id);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const renderNodes = (parentId: string | null): React.ReactNode =>
    (children.get(parentId) ?? []).map((node) => {
      const branch = children.has(node.id);
      const expanded = !collapsed.has(node.id);
      const name = `${node.tagName}${node.label ? ` ${node.label}` : ""}`;
      return (
        <li
          key={node.id}
          role="treeitem"
          aria-label={name}
          aria-selected={selected?.nodeId === node.id}
          aria-expanded={branch ? expanded : undefined}
          tabIndex={node.id === tabStop ? 0 : -1}
          data-layer-id={node.id}
          data-source-oid={node.oid}
          title={
            selected?.nodeId === node.id && sourceLabel
              ? sourceLabel
              : `Source ${node.oid}`
          }
          onFocus={(event) => {
            if (event.target === event.currentTarget) setFocused(node.id);
          }}
          onClick={(event) => {
            event.stopPropagation();
            event.currentTarget.focus();
            setFocused(node.id);
            onSelect(node.id);
          }}
          onKeyDown={(event) => keyDown(event, node)}
        >
          <div className="layer-row">
            {branch ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(node.id);
                  event.currentTarget
                    .closest<HTMLElement>('[role="treeitem"]')
                    ?.focus();
                }}
              >
                <span aria-hidden="true">{expanded ? "⌄" : "›"}</span>
              </button>
            ) : (
              <span className="layer-leaf" aria-hidden="true" />
            )}
            <span className="layer-tag">{node.tagName}</span>
            <span className="layer-label">{node.label}</span>
          </div>
          {branch && expanded ? (
            // biome-ignore lint/a11y/useSemanticElements: ARIA tree children form a tree group, not a form fieldset.
            <ul role="group">{renderNodes(node.id)}</ul>
          ) : null}
        </li>
      );
    });
  return (
    <>
      <p className="field-note">Rendered source elements</p>
      {!layers ? (
        <output className="field-note">Reading rendered layers…</output>
      ) : (
        <>
          {layers.truncated ? (
            <output className="field-note">
              Layer tree is partial: inspection limits reached.
            </output>
          ) : null}
          {selected && !byId.has(selected.nodeId) ? (
            <output className="field-note">
              Selected element is outside the displayed layer tree.
            </output>
          ) : null}
          {layers.nodes.length ? (
            <ul
              ref={tree}
              className="layer-tree"
              role="tree"
              aria-label="Rendered layers"
            >
              {renderNodes(null)}
            </ul>
          ) : (
            <p className="field-note">
              No source-backed elements found in the displayed tree.
            </p>
          )}
        </>
      )}
    </>
  );
}
