import type { StorageLike } from "../files/file-store.ts";

/**
 * Chat is a paid (Pro) feature. Real entitlements come from the private cloud
 * (Clerk + billing, Phase 10); the public build has no account, so the plan
 * is read from local storage and the founder-approved source replaces this
 * reader later. "Preview Pro locally" is explicit and labelled in the UI.
 */
export type Plan = "free" | "pro";

export interface Entitlement {
  plan: Plan;
  source: "local-preview" | "none";
}

const KEY = "allstudio.plan";

export function readEntitlement(storage: StorageLike): Entitlement {
  return storage.getItem(KEY) === "pro"
    ? { plan: "pro", source: "local-preview" }
    : { plan: "free", source: "none" };
}

export function writePlan(storage: StorageLike, plan: Plan) {
  if (plan === "pro") storage.setItem(KEY, "pro");
  else storage.removeItem(KEY);
}

export const PRO_FEATURES = [
  "Chat with Alli to plan and build boards",
  "Generate, refine and make designs responsive",
  "Open every result in Studio as an editable board",
];
