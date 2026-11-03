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
  storageBytes: 1_000_000,
} as const;

const KEY = "allstudio.chats.v1";
const CHAT_STORAGE_ERROR =
  "Chat storage is full or unavailable. Delete older chats or boards, then try again.";
const CHAT_CONVERSATION_LIMIT_ERROR =
  "Chat limit reached. Delete an older chat before starting another; no chats were removed.";
const CHAT_MESSAGE_LIMIT_ERROR =
  "This chat reached its message limit. Start a new chat to continue; existing messages were kept.";

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
  private persistedBytes: number;

  constructor(private readonly storage: StorageLike) {
    const raw = storage.getItem(KEY);
    this.cache = parseConversations(raw);
    this.persistedBytes = new TextEncoder().encode(raw ?? "").byteLength;
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

  create(
    title = "New chat",
    now = new Date(),
    initialMessages: ChatMessage[] = [],
  ): Conversation {
    if (initialMessages.length > CHAT_LIMITS.messagesPerConversation) {
      throw new Error(CHAT_MESSAGE_LIMIT_ERROR);
    }
    const at = now.toISOString();
    const conversation: Conversation = {
      id: createChatId(),
      title: title.slice(0, CHAT_LIMITS.titleLength),
      createdAt: at,
      updatedAt: at,
      messages: initialMessages,
      activity: [],
    };
    this.write([conversation, ...this.cache]);
    return conversation;
  }

  save(conversation: Conversation): Conversation {
    const previous = this.get(conversation.id);
    if (
      conversation.messages.length > CHAT_LIMITS.messagesPerConversation &&
      conversation.messages.length > (previous?.messages.length ?? 0)
    ) {
      throw new Error(CHAT_MESSAGE_LIMIT_ERROR);
    }
    const next: Conversation = {
      ...conversation,
      title: conversation.title.slice(0, CHAT_LIMITS.titleLength),
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
    if (
      conversations.length > CHAT_LIMITS.conversations &&
      conversations.length > this.cache.length
    ) {
      throw new Error(CHAT_CONVERSATION_LIMIT_ERROR);
    }
    const serialized = JSON.stringify(conversations);
    const bytes = new TextEncoder().encode(serialized).byteLength;
    if (bytes > CHAT_LIMITS.storageBytes && bytes > this.persistedBytes) {
      throw new Error(CHAT_STORAGE_ERROR);
    }
    try {
      this.storage.setItem(KEY, serialized);
    } catch {
      throw new Error(CHAT_STORAGE_ERROR);
    }
    this.cache = conversations;
    this.persistedBytes = bytes;
    for (const listener of this.listeners) listener();
  }
}
