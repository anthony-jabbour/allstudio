import type { StorageLike } from "../files/file-store.ts";

/**
 * Chat conversations are local data: they live next to the board files in
 * browser storage and never leave the device in the public build. The cloud
 * (private repo) can supply its own store and agent behind the same types.
 */

export type StepState = "done" | "active" | "pending";

export interface PlanStep {
  label: string;
  state: StepState;
}

export type MessagePart =
  | { kind: "text"; text: string }
  | { kind: "plan"; steps: PlanStep[] }
  | { kind: "preview"; fileId: string; title: string };

export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  createdAt: string;
  parts: MessagePart[];
  status: MessageStatus;
}

export type ActivityKind =
  | "plan"
  | "generate"
  | "refine"
  | "section"
  | "responsive";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  label: string;
  at: string;
  fileId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** The board this conversation is building, once one exists. */
  fileId?: string;
  messages: ChatMessage[];
  activity: ActivityItem[];
}

export const CHAT_LIMITS = {
  conversations: 200,
  messagesPerConversation: 400,
  promptLength: 4000,
  titleLength: 80,
} as const;

const KEY = "allstudio.chats.v1";

export function createChatId(prefix = "c"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${random}`;
}

/** A short, readable title from the first prompt. */
export function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  const title =
    firstSentence.length > 48
      ? `${firstSentence.slice(0, 46).trimEnd()}…`
      : firstSentence;
  return title.replace(/[.!?]$/, "");
}

export function messageText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePart(value: unknown): MessagePart | null {
  if (!isRecord(value)) return null;
  if (value.kind === "text" && typeof value.text === "string") {
    return { kind: "text", text: value.text };
  }
  if (value.kind === "plan" && Array.isArray(value.steps)) {
    const steps = value.steps.flatMap((step): PlanStep[] =>
      isRecord(step) &&
      typeof step.label === "string" &&
      (step.state === "done" ||
        step.state === "active" ||
        step.state === "pending")
        ? [{ label: step.label, state: step.state }]
        : [],
    );
    return { kind: "plan", steps };
  }
  if (
    value.kind === "preview" &&
    typeof value.fileId === "string" &&
    typeof value.title === "string"
  ) {
    return { kind: "preview", fileId: value.fileId, title: value.title };
  }
  return null;
}

function parseMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.createdAt !== "string") {
    return null;
  }
  if (value.role !== "user" && value.role !== "agent") return null;
  const parts = Array.isArray(value.parts)
    ? value.parts.map(parsePart).filter((part) => part !== null)
    : [];
  // A reply that was streaming when the tab closed is shown as stopped.
  const status: MessageStatus =
    value.status === "done" ||
    value.status === "error" ||
    value.status === "stopped"
      ? value.status
      : "stopped";
  return {
    id: value.id,
    role: value.role,
    createdAt: value.createdAt,
    parts,
    status,
  };
}

function parseActivity(value: unknown): ActivityItem | null {
  if (!isRecord(value)) return null;
  const kinds: ActivityKind[] = [
    "plan",
    "generate",
    "refine",
    "section",
    "responsive",
  ];
  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.at !== "string" ||
    !kinds.includes(value.kind as ActivityKind)
  ) {
    return null;
  }
  return {
    id: value.id,
    kind: value.kind as ActivityKind,
    label: value.label,
    at: value.at,
    fileId: typeof value.fileId === "string" ? value.fileId : undefined,
  };
}

/** Lenient on read: one corrupt conversation never hides the others. */
export function parseConversations(text: string | null): Conversation[] {
  if (!text) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value): Conversation[] => {
    if (!isRecord(value)) return [];
    if (
      typeof value.id !== "string" ||
      typeof value.title !== "string" ||
      typeof value.createdAt !== "string" ||
      typeof value.updatedAt !== "string"
    ) {
      return [];
    }
    return [
      {
        id: value.id,
        title: value.title.slice(0, CHAT_LIMITS.titleLength),
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        fileId: typeof value.fileId === "string" ? value.fileId : undefined,
        messages: Array.isArray(value.messages)
          ? value.messages
              .map(parseMessage)
              .filter((message) => message !== null)
              .slice(-CHAT_LIMITS.messagesPerConversation)
          : [],
        activity: Array.isArray(value.activity)
          ? value.activity.map(parseActivity).filter((item) => item !== null)
          : [],
      },
    ];
  });
}

export class ChatStore {
  private cache: Conversation[];
  private listeners = new Set<() => void>();

  constructor(private readonly storage: StorageLike) {
    this.cache = parseConversations(storage.getItem(KEY));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Most recently updated first. */
  list(): Conversation[] {
    return this.cache;
  }

  get(id: string): Conversation | undefined {
    return this.cache.find((conversation) => conversation.id === id);
  }

  create(title = "New chat", now = new Date()): Conversation {
    const at = now.toISOString();
    const conversation: Conversation = {
      id: createChatId(),
      title: title.slice(0, CHAT_LIMITS.titleLength),
      createdAt: at,
      updatedAt: at,
      messages: [],
      activity: [],
    };
    this.write([conversation, ...this.cache]);
    return conversation;
  }

  save(conversation: Conversation): Conversation {
    const next: Conversation = {
      ...conversation,
      title: conversation.title.slice(0, CHAT_LIMITS.titleLength),
      messages: conversation.messages.slice(
        -CHAT_LIMITS.messagesPerConversation,
      ),
    };
    this.write([
      next,
      ...this.cache.filter((item) => item.id !== conversation.id),
    ]);
    return next;
  }

  rename(id: string, title: string): void {
    const conversation = this.get(id);
    const clean = title.trim();
    if (!conversation || !clean) return;
    this.save({ ...conversation, title: clean });
  }

  remove(id: string): void {
    this.write(this.cache.filter((item) => item.id !== id));
  }

  private write(conversations: Conversation[]) {
    const bounded = conversations.slice(0, CHAT_LIMITS.conversations);
    this.storage.setItem(KEY, JSON.stringify(bounded));
    this.cache = bounded;
    for (const listener of this.listeners) listener();
  }
}
