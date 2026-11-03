import { createFromTemplate } from "@allstudio/editor/board";
import { parseBoardDocument } from "@allstudio/project";
import { describe, expect, it } from "vitest";
import {
  type AgentEvent,
  addMobileVersion,
  addSection,
  applyRefinement,
  chooseTemplate,
  detectIntent,
  extractBrand,
  LocalStudioAgent,
  personalize,
} from "../src/chat/agent.ts";
import {
  CHAT_LIMITS,
  ChatStore,
  type Conversation,
  parseConversations,
  titleFromPrompt,
} from "../src/chat/chat-model.ts";
import { readEntitlement, writePlan } from "../src/chat/entitlement.ts";
import { FileStore, memoryStorage } from "../src/files/file-store.ts";
import { parseRoute } from "../src/router.ts";

const LUMEN =
  "I want to create a homepage for a creative studio called “Lumen”. It should feel modern, bold, and minimal.";

async function run(
  agent: LocalStudioAgent,
  chats: ChatStore,
  conversation: Conversation,
  prompt: string,
  signal = new AbortController().signal,
) {
  const events: AgentEvent[] = [];
  await agent.run({
    prompt,
    conversation,
    signal,
    emit: (event) => {
      events.push(event);
      const latest = chats.get(conversation.id) as Conversation;
      if (event.type === "file")
        chats.save({ ...latest, fileId: event.fileId });
      if (event.type === "message") {
        const others = latest.messages.filter((m) => m.id !== event.message.id);
        chats.save({ ...latest, messages: [...others, event.message] });
      }
    },
  });
  return events;
}

describe("chat routing", () => {
  it("parses chat routes", () => {
    expect(parseRoute("#/chat")).toEqual({ name: "chat" });
    expect(parseRoute("#/chat/c_abc")).toEqual({ name: "chat", id: "c_abc" });
  });
});

describe("chat store", () => {
  it("creates, saves, orders and removes conversations", () => {
    const storage = memoryStorage();
    const store = new ChatStore(storage);
    const a = store.create("First");
    const b = store.create("Second");
    expect(store.list().map((c) => c.id)).toEqual([b.id, a.id]);
    store.save({ ...a, title: "First (edited)" });
    expect(store.list()[0]?.title).toBe("First (edited)");
    // Persists across instances.
    expect(new ChatStore(storage).list()).toHaveLength(2);
    store.remove(a.id);
    expect(store.list().map((c) => c.id)).toEqual([b.id]);
  });

  it("rejects oversized chat history without discarding the saved conversation", () => {
    const storage = memoryStorage();
    const store = new ChatStore(storage);
    const saved = store.create("Saved chat");
    const messages = Array.from({ length: 300 }, (_, index) => ({
      id: `m_${index}`,
      role: "user" as const,
      createdAt: "2026-11-03T00:00:00.000Z",
      parts: [
        { kind: "text" as const, text: "x".repeat(CHAT_LIMITS.promptLength) },
      ],
      status: "done" as const,
    }));

    expect(() => store.save({ ...saved, messages })).toThrow(
      /chat storage is full/i,
    );
    expect(store.get(saved.id)?.messages).toEqual([]);
    expect(new ChatStore(storage).get(saved.id)?.messages).toEqual([]);
  });

  it("turns storage quota errors into a visible chat save error", () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const store = new ChatStore(storage);

    expect(() => store.create("Unsaved chat")).toThrow(/chat storage is full/i);
    expect(store.list()).toEqual([]);
  });

  it("is lenient with corrupt storage and marks interrupted replies stopped", () => {
    expect(parseConversations("{nope")).toEqual([]);
    const parsed = parseConversations(
      JSON.stringify([
        { id: 1 },
        {
          id: "c_1",
          title: "ok",
          createdAt: "2026-11-02T00:00:00Z",
          updatedAt: "2026-11-02T00:00:00Z",
          messages: [
            {
              id: "m",
              role: "agent",
              createdAt: "2026-11-02T00:00:00Z",
              parts: [{ kind: "text", text: "hi" }, { kind: "evil" }],
              status: "streaming",
            },
          ],
          activity: [{ id: "a", kind: "nope", label: "x", at: "y" }],
        },
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.messages[0]?.status).toBe("stopped");
    expect(parsed[0]?.messages[0]?.parts).toHaveLength(1);
    expect(parsed[0]?.activity).toEqual([]);
  });

  it("titles a chat from the first sentence", () => {
    expect(titleFromPrompt(LUMEN)).toBe(
      "I want to create a homepage for a creative stu…",
    );
    expect(titleFromPrompt("Make a moodboard.")).toBe("Make a moodboard");
    expect(titleFromPrompt("   ")).toBe("New chat");
  });
});

describe("entitlement", () => {
  it("defaults to free and only previews Pro when asked", () => {
    const storage = memoryStorage();
    expect(readEntitlement(storage).plan).toBe("free");
    writePlan(storage, "pro");
    expect(readEntitlement(storage)).toEqual({
      plan: "pro",
      source: "local-preview",
    });
    writePlan(storage, "free");
    expect(readEntitlement(storage).plan).toBe("free");
  });
});

describe("local agent helpers", () => {
  it("routes intents", () => {
    expect(detectIntent(LUMEN, false)).toBe("generate");
    expect(detectIntent("Plan it out first.", false)).toBe("plan");
    expect(detectIntent("Make it responsive.", true)).toBe("responsive");
    expect(detectIntent("Add a section showing work", true)).toBe("section");
    expect(detectIntent("Make it darker", true)).toBe("refine");
    expect(detectIntent("hello", false)).toBe("chat");
  });

  it("chooses templates and brands", () => {
    expect(chooseTemplate(LUMEN)).toBe("landing");
    expect(chooseTemplate("a mobile app for habits")).toBe("mobile");
    expect(chooseTemplate("moodboard for coffee")).toBe("moodboard");
    expect(extractBrand(LUMEN)).toBe("Lumen");
    expect(extractBrand("a site for Acme Labs")).toBe("Acme Labs");
    expect(extractBrand("make it nice")).toBeNull();
  });

  it("keeps every transformation schema-valid", () => {
    let doc = personalize(createFromTemplate("landing"), "Lumen");
    expect(doc.name).toBe("Lumen — Landing page");
    doc = applyRefinement(
      doc,
      'Make it darker and bolder, headline "Hello there"',
    ).doc;
    doc = addSection(doc);
    doc = addMobileVersion(doc, "Lumen");
    const valid = parseBoardDocument(JSON.parse(JSON.stringify(doc)));
    const page = valid.pages[0];
    expect(page?.nodes).toHaveLength(2);
    const texts = JSON.stringify(valid);
    expect(texts).toContain("LUMEN");
    expect(texts).toContain("Hello there");
    expect(texts).toContain("Selected work");
  });

  it("explains when a refinement is not understood", () => {
    const doc = createFromTemplate("landing");
    expect(applyRefinement(doc, "sprinkle some magic").summary).toEqual([]);
  });
});

describe("LocalStudioAgent", () => {
  it("plans, generates a real board, then refines it", async () => {
    const files = new FileStore(memoryStorage());
    const chats = new ChatStore(memoryStorage());
    const agent = new LocalStudioAgent({ files, stepMs: 0 });
    let conversation = chats.create("Lumen");
    const before = files.list().length;

    const events = await run(agent, chats, conversation, LUMEN);
    conversation = chats.get(conversation.id) as Conversation;
    expect(files.list()).toHaveLength(before + 1);
    expect(conversation.fileId).toBeTruthy();
    const reply = conversation.messages.at(-1);
    expect(reply?.status).toBe("done");
    const plan = reply?.parts.find((part) => part.kind === "plan");
    expect(
      plan?.kind === "plan" && plan.steps.every((s) => s.state === "done"),
    ).toBe(true);
    expect(reply?.parts.some((part) => part.kind === "preview")).toBe(true);
    expect(events.filter((e) => e.type === "activity")).toHaveLength(2);
    const generated = files.read(conversation.fileId as string);
    expect(generated.pages[0]?.nodes).toHaveLength(2); // desktop + mobile

    await run(
      agent,
      chats,
      conversation,
      "Add a section showing selected work.",
    );
    conversation = chats.get(conversation.id) as Conversation;
    expect(JSON.stringify(files.read(conversation.fileId as string))).toContain(
      "Selected work",
    );
  });

  it("stops cleanly when aborted", async () => {
    const files = new FileStore(memoryStorage());
    const chats = new ChatStore(memoryStorage());
    const agent = new LocalStudioAgent({ files, stepMs: 5 });
    const conversation = chats.create("Stop");
    const controller = new AbortController();
    const done = run(agent, chats, conversation, LUMEN, controller.signal);
    controller.abort();
    await done;
    const reply = chats.get(conversation.id)?.messages.at(-1);
    expect(reply?.status).toBe("stopped");
  });
});
