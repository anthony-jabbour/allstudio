import type { PreviewElementSnapshot } from "../preview-bridge/protocol.ts";
import type { ReorderReceipt } from "../site/source-edit-workspace.ts";

export function observesReorder(
  element: Pick<PreviewElementSnapshot, "oid" | "instances" | "neighbors">,
  receipt: ReorderReceipt,
): boolean {
  if (element.oid !== receipt.oid || element.instances !== 1) return false;
  const peer =
    receipt.direction === "up"
      ? element.neighbors.next
      : receipt.direction === "down"
        ? element.neighbors.previous
        : null;
  return peer?.oid === receipt.siblingOid && peer.instances === 1;
}
