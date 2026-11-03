import {
  createFromTemplate,
  frameNode,
  pageBounds,
  shapeNode,
  textNode,
} from "@allstudio/editor/board";
import type {
  BoardDocumentV1,
  BoardFrameNode,
  BoardNode,
  BoardTextNode,
} from "@allstudio/project";
import type { FileStore } from "../files/file-store.ts";
import {
  type ActivityItem,
  type ActivityKind,
  type ChatMessage,
  type Conversation,
  createChatId,
  type MessagePart,
  type PlanStep,
} from "./chat-model.ts";

/**
 * The chat surface talks to an agent through this interface only. The public
 * build ships `LocalStudioAgent`: a deterministic, offline helper that turns
 * a brief into a real, editable board. It does not call any model. A BYOK
 * agent (Phase 5) or the premium cloud agent (private repo, Phases 8–10) can
 * implement the same contract without the UI changing.
 */
export type AgentEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "activity"; item: ActivityItem }
  | { type: "file"; fileId: string };

export interface AgentRun {
  prompt: string;
  conversation: Conversation;
  signal: AbortSignal;
  emit: (event: AgentEvent) => void;
}

export interface ChatAgent {
  id: string;
  name: string;
  /** Shown under the composer so users know what is actually answering. */
  description: string;
  run(run: AgentRun): Promise<void>;
}

export type Intent =
  | "plan"
  | "generate"
  | "refine"
  | "section"
  | "responsive"
  | "chat";

/** Keyword routing for the local agent. Quick actions send explicit verbs. */
export function detectIntent(prompt: string, hasBoard: boolean): Intent {
  const text = prompt.toLowerCase();
  if (/\bmake (it )?responsive\b|\bmobile version\b|\bresponsive\b/.test(text))
    return hasBoard ? "responsive" : "generate";
  if (/\badd (a |an )?(new )?section\b/.test(text))
    return hasBoard ? "section" : "generate";
  if (/^\s*plan\b|\bplan (for|out)\b|\bwhat('s| is) the plan\b/.test(text))
    return "plan";
  if (
    hasBoard &&
    /\b(refine|change|make it|darker|dark mode|lighter|headline|title|rename|warmer|bolder)\b/.test(
      text,
    )
  )
    return "refine";
  if (
    /\b(create|build|design|generate|make|homepage|landing|website|site|app|moodboard|page)\b/.test(
      text,
    )
  )
    return "generate";
  return hasBoard ? "refine" : "chat";
}

export type TemplateChoice = "landing" | "mobile" | "moodboard" | "responsive";

export function chooseTemplate(prompt: string): TemplateChoice {
  const text = prompt.toLowerCase();
  if (/\b(mobile|ios|android|app screen|phone)\b/.test(text)) return "mobile";
  if (/\b(moodboard|mood board|palette|brand board|inspiration)\b/.test(text))
    return "moodboard";
  if (/\b(responsive|breakpoints?)\b/.test(text)) return "responsive";
  return "landing";
}

/** `"Lumen"`, “Lumen”, or `called Lumen` → Lumen. */
export function extractBrand(prompt: string): string | null {
  const quoted = prompt.match(/["“”']([^"“”']{2,32})["“”']/);
  if (quoted?.[1]) return quoted[1].trim();
  const called = prompt.match(
    /\b(?:called|named|for)\s+([A-Z][\w&-]{1,24}(?:\s[A-Z][\w&-]{1,24})?)/,
  );
  return called?.[1]?.trim() ?? null;
}

export function extractHeadline(prompt: string): string | null {
  const match = prompt.match(
    /\b(?:headline|title)\b[^"“]*["“]([^"”]{2,80})["”]/i,
  );
  return match?.[1]?.trim() ?? null;
}

function walk(nodes: BoardNode[], visit: (node: BoardNode) => void) {
  for (const node of nodes) {
    visit(node);
    if (node.type === "frame") walk(node.children, visit);
  }
}

function mapNodes(
  nodes: BoardNode[],
  map: (node: BoardNode) => BoardNode,
): BoardNode[] {
  return nodes.map((node) => {
    const next = map(node);
    return next.type === "frame"
      ? { ...next, children: mapNodes(next.children, map) }
      : next;
  });
}

function mapDoc(
  doc: BoardDocumentV1,
  map: (node: BoardNode) => BoardNode,
): BoardDocumentV1 {
  return {
    ...doc,
    pages: doc.pages.map((page, index) =>
      index === 0 ? { ...page, nodes: mapNodes(page.nodes, map) } : page,
    ),
  };
}

function largestText(doc: BoardDocumentV1): BoardTextNode | null {
  let best: BoardTextNode | null = null;
  walk(doc.pages[0]?.nodes ?? [], (node) => {
    if (node.type === "text" && (!best || node.fontSize > best.fontSize)) {
      best = node;
    }
  });
  return best;
}

/** Puts the brand into the generated board (logo text and file name). */
export function personalize(
  doc: BoardDocumentV1,
  brand: string | null,
): BoardDocumentV1 {
  if (!brand) return doc;
  const named = { ...doc, name: `${brand} — ${doc.name}` };
  return mapDoc(named, (node) =>
    node.type === "text" && node.text.startsWith("✱")
      ? { ...node, text: brand.toUpperCase(), name: "Logo", letterSpacing: 4 }
      : node,
  );
}

export function applyRefinement(
  doc: BoardDocumentV1,
  prompt: string,
): { doc: BoardDocumentV1; summary: string[] } {
  const text = prompt.toLowerCase();
  const summary: string[] = [];
  let next = doc;
  const headline = extractHeadline(prompt);
  if (headline) {
    const target = largestText(next);
    if (target) {
      next = mapDoc(next, (node) =>
        node.id === target.id ? { ...node, text: headline } : node,
      );
      summary.push(`Changed the headline to “${headline}”.`);
    }
  }
  if (/\b(dark|darker|dark mode|night)\b/.test(text)) {
    next = mapDoc(next, (node) => {
      if (node.type === "frame") return { ...node, fill: "#121212" };
      if (node.type === "text") {
        const muted = node.color !== "#111111" && node.color !== "#ffffff";
        return { ...node, color: muted ? "#a3a3a3" : "#f5f5f5" };
      }
      if (node.fill === "#111111") return { ...node, fill: "#f5f5f5" };
      return node;
    });
    // Button labels sit on the now-light button: keep them readable.
    next = mapDoc(next, (node) =>
      node.type === "text" && /start|see our|get started/i.test(node.text)
        ? { ...node, color: "#111111" }
        : node,
    );
    summary.push("Switched the page to a dark palette.");
  } else if (/\b(light|lighter|bright)\b/.test(text)) {
    next = mapDoc(next, (node) =>
      node.type === "frame" ? { ...node, fill: "#fbfaf7" } : node,
    );
    summary.push("Lightened the page background.");
  }
  if (/\b(bold|bolder|punchier|bigger)\b/.test(text)) {
    const target = largestText(next);
    if (target) {
      next = mapDoc(next, (node) =>
        node.id === target.id && node.type === "text"
          ? {
              ...node,
              fontWeight: 800,
              fontSize: Math.min(160, Math.round(node.fontSize * 1.12)),
            }
          : node,
      );
      summary.push("Made the headline bolder and larger.");
    }
  }
  if (/\b(warm|warmer|orange)\b/.test(text)) {
    next = mapDoc(next, (node) =>
      node.type === "ellipse" || node.type === "rect"
        ? node.gradient
          ? { ...node, gradient: [node.gradient[0], "#ffd29a", "#ff6a2b"] }
          : node
        : node,
    );
    summary.push("Warmed up the accent shapes.");
  }
  return { doc: next, summary };
}

/** Adds a three-card section under the main frame and grows the frame. */
export function addSection(doc: BoardDocumentV1, label = "Selected work") {
  const page = doc.pages[0];
  const main = page?.nodes.find(
    (node): node is BoardFrameNode => node.type === "frame",
  );
  if (!page || !main) return doc;
  const top = main.height;
  const cardWidth = Math.round((main.width - 64 * 2 - 32 * 2) / 3);
  const cards = [0, 1, 2].flatMap((index) => {
    const x = 64 + index * (cardWidth + 32);
    return [
      shapeNode("rect", {
        name: `Card ${index + 1}`,
        x,
        y: top + 110,
        width: cardWidth,
        height: Math.round(cardWidth * 0.66),
        radius: 18,
        gradient: [
          150,
          ["#efe7dc", "#dfe6f5", "#e6efe4"][index] ?? "#eeeeee",
          ["#c7b39a", "#7c96d6", "#8fb38a"][index] ?? "#cccccc",
        ],
      }),
      textNode({
        text: ["Mesa — Brand identity", "Orbital — Product", "Field — Website"][
          index
        ] as string,
        x,
        y: top + 126 + Math.round(cardWidth * 0.66),
        width: cardWidth,
        fontSize: 16,
        fontWeight: 500,
      }),
    ];
  });
  const section: BoardNode[] = [
    textNode({
      text: label,
      x: 64,
      y: top + 40,
      width: 600,
      height: 44,
      fontSize: 36,
      fontWeight: 700,
      letterSpacing: -1,
      name: "Section title",
    }),
    ...cards,
  ];
  const grown: BoardFrameNode = {
    ...main,
    height: top + 200 + Math.round(cardWidth * 0.66),
    children: [...main.children, ...section],
  };
  return {
    ...doc,
    pages: doc.pages.map((item, index) =>
      index === 0
        ? {
            ...item,
            nodes: item.nodes.map((node) =>
              node.id === main.id ? grown : node,
            ),
          }
        : item,
    ),
  };
}

/** Adds a 390 px mobile frame beside the desktop frame. */
export function addMobileVersion(doc: BoardDocumentV1, brand: string | null) {
  const page = doc.pages[0];
  if (!page) return doc;
  const bounds = pageBounds(page);
  const x = bounds ? bounds.x + bounds.width + 120 : 0;
  const headline = largestText(doc)?.text ?? "Ideas that make an impact.";
  const mobile = frameNode({
    name: "Mobile — Home",
    x,
    y: bounds?.y ?? 0,
    width: 390,
    height: 844,
    fill: "#fbfaf7",
    radius: 28,
    children: [
      textNode({
        text: brand ? brand.toUpperCase() : "✱ studio",
        x: 24,
        y: 28,
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: brand ? 3 : 0,
      }),
      textNode({ text: "☰", x: 340, y: 26, width: 24, fontSize: 18 }),
      textNode({
        text: headline,
        x: 24,
        y: 140,
        width: 342,
        height: 200,
        fontSize: 46,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: -1.5,
      }),
      shapeNode("rect", {
        name: "Button",
        x: 24,
        y: 380,
        width: 342,
        height: 52,
        radius: 26,
        fill: "#111111",
      }),
      textNode({
        text: "Start a project",
        x: 24,
        y: 394,
        width: 342,
        textAlign: "center",
        color: "#ffffff",
        fontWeight: 600,
      }),
      shapeNode("ellipse", {
        name: "Orange sphere",
        x: 150,
        y: 500,
        width: 220,
        height: 220,
        gradient: [135, "#ffb27a", "#ff5a1f"],
      }),
    ],
  });
  return {
    ...doc,
    pages: doc.pages.map((item, index) =>
      index === 0 ? { ...item, nodes: [...item.nodes, mobile] } : item,
    ),
  };
}

const SUBJECT: Record<TemplateChoice, string> = {
  landing: "homepage",
  mobile: "app screens",
  moodboard: "moodboard",
  responsive: "responsive set",
};

export function generateSteps(choice: TemplateChoice): string[] {
  return [
    "Understand your goals and brand direction",
    "Create a visual direction and layout",
    `Generate the ${SUBJECT[choice]}`,
    choice === "landing"
      ? "Prepare responsive versions"
      : "Check spacing and hierarchy",
    "Share for your review",
  ];
}

class Aborted extends Error {}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Aborted());
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Aborted());
      },
      { once: true },
    );
  });
}

export interface LocalAgentOptions {
  files: FileStore;
  /** Pause between visible steps; 0 in tests. */
  stepMs?: number;
  now?: () => Date;
}

export class LocalStudioAgent implements ChatAgent {
  readonly id = "local-studio";
  readonly name = "Alli";
  readonly description =
    "Local studio agent · runs on this device, no AI model or network";

  constructor(private readonly options: LocalAgentOptions) {}

  async run({ prompt, conversation, signal, emit }: AgentRun) {
    const now = this.options.now ?? (() => new Date());
    const step = this.options.stepMs ?? 420;
    const message: ChatMessage = {
      id: createChatId("m"),
      role: "agent",
      createdAt: now().toISOString(),
      parts: [],
      status: "streaming",
    };
    const push = (parts: MessagePart[], status = message.status) => {
      message.parts = parts;
      message.status = status;
      emit({ type: "message", message: { ...message, parts: [...parts] } });
    };
    const activity = (kind: ActivityKind, label: string, fileId?: string) =>
      emit({
        type: "activity",
        item: {
          id: createChatId("a"),
          kind,
          label,
          at: now().toISOString(),
          fileId,
        },
      });

    const files = this.options.files;
    const fileId =
      conversation.fileId && files.get(conversation.fileId)
        ? conversation.fileId
        : undefined;
    const intent = detectIntent(prompt, Boolean(fileId));
    const brand =
      extractBrand(prompt) ??
      extractBrand(
        conversation.messages
          .filter((item) => item.role === "user")
          .flatMap((item) => item.parts)
          .map((part) => (part.kind === "text" ? part.text : ""))
          .join(" "),
      );

    try {
      push([{ kind: "text", text: "" }]);
      await sleep(step, signal);

      if (intent === "chat") {
        push(
          [
            {
              kind: "text",
              text: "I can plan and build boards for you. Tell me what you're making, for example “a homepage for a studio called Lumen”, or pick a suggestion below.",
            },
          ],
          "done",
        );
        return;
      }

      if (intent === "plan" || intent === "generate") {
        const labels = generateSteps(chooseTemplate(prompt));
        const steps: PlanStep[] = labels.map((label) => ({
          label,
          state: "pending",
        }));
        const intro: MessagePart = {
          kind: "text",
          text: brand
            ? `Great! Here's my plan for your ${brand} ${SUBJECT[chooseTemplate(prompt)]}:`
            : "Great! Here's how I'll approach it:",
        };
        if (intent === "plan") {
          push([intro, { kind: "plan", steps }]);
          activity("plan", "Planning complete");
          push(
            [
              intro,
              { kind: "plan", steps },
              {
                kind: "text",
                text: "Say “generate” when you're ready and I'll build it.",
              },
            ],
            "done",
          );
          return;
        }
        let doc: BoardDocumentV1 | null = null;
        let created: string | null = null;
        for (let index = 0; index < steps.length; index += 1) {
          steps[index] = {
            label: labels[index] as string,
            state: "active",
          };
          push([intro, { kind: "plan", steps: [...steps] }]);
          await sleep(step * 1.6, signal);
          if (index === 2) {
            doc = personalize(
              createFromTemplate(chooseTemplate(prompt)),
              brand,
            );
            const file = files.create(doc);
            created = file.id;
            emit({ type: "file", fileId: file.id });
            activity("generate", `Generated ${file.name}`, file.id);
          }
          if (
            index === 3 &&
            doc &&
            created &&
            chooseTemplate(prompt) === "landing"
          ) {
            doc = addMobileVersion(doc, brand);
            files.save(created, doc);
            activity("responsive", "Created responsive version", created);
          }
          steps[index] = {
            label: labels[index] as string,
            state: "done",
          };
        }
        if (!created) throw new Error("Nothing was generated.");
        push(
          [
            intro,
            { kind: "plan", steps },
            {
              kind: "text",
              text: "Here's a first version. It's a real board, so you can open it in Studio and edit anything, or tell me what to refine.",
            },
            {
              kind: "preview",
              fileId: created,
              title: files.get(created)?.name ?? "Board",
            },
          ],
          "done",
        );
        return;
      }

      if (!fileId) throw new Error("There is no board to change yet.");
      const current = files.read(fileId);
      let next = current;
      let lines: string[] = [];
      let kind: ActivityKind = "refine";
      if (intent === "section") {
        next = addSection(current);
        lines = ["Added a “Selected work” section with three project cards."];
        kind = "section";
      } else if (intent === "responsive") {
        next = addMobileVersion(current, brand);
        lines = ["Added a 390 px mobile frame next to the desktop design."];
        kind = "responsive";
      } else {
        const result = applyRefinement(current, prompt);
        next = result.doc;
        lines = result.summary;
      }
      await sleep(step * 2, signal);
      if (lines.length === 0) {
        push(
          [
            {
              kind: "text",
              text: "I can change the headline (headline “…”), switch to a dark or light palette, make the type bolder, warm up the accents, add a section or make it responsive. For anything else, open the board in Studio and edit it directly.",
            },
          ],
          "done",
        );
        return;
      }
      files.save(fileId, next);
      activity(
        kind,
        kind === "section"
          ? "Added a section"
          : kind === "responsive"
            ? "Created responsive version"
            : "Refined the design",
        fileId,
      );
      push(
        [
          { kind: "text", text: lines.join(" ") },
          {
            kind: "preview",
            fileId,
            title: files.get(fileId)?.name ?? "Board",
          },
        ],
        "done",
      );
    } catch (error) {
      if (error instanceof Aborted) {
        push(message.parts, "stopped");
        return;
      }
      push(
        [
          ...message.parts.filter(
            (part) => part.kind !== "text" || part.text !== "",
          ),
          {
            kind: "text",
            text:
              error instanceof Error ? error.message : "Something went wrong.",
          },
        ],
        "error",
      );
    }
  }
}
