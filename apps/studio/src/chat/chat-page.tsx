import "./chat.css";
import { BoardThumbnail } from "@allstudio/editor/board";
import type { BoardDocumentV1 } from "@allstudio/project";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useElementSize } from "../files/file-card.tsx";
import { browserStorage, formatEdited } from "../files/file-store.ts";
import { useFileStore, useFiles } from "../files/use-files.ts";
import { href, navigate } from "../router.ts";
import { Menu, PromptDialog, useToast } from "../ui/controls.tsx";
import { Icon } from "../ui/icons.tsx";
import type { ThemePreference } from "../ui/theme.ts";
import { type ChatAgent, LocalStudioAgent } from "./agent.ts";
import { ALLI, CAST, CharacterAvatar } from "./avatars.tsx";
import {
  type ActivityItem,
  CHAT_LIMITS,
  type ChatMessage,
  type Conversation,
  createChatId,
  type MessagePart,
  type PlanStep,
  titleFromPrompt,
} from "./chat-model.ts";
import {
  type Entitlement,
  PRO_FEATURES,
  readEntitlement,
  writePlan,
} from "./entitlement.ts";
import { useChatStore, useConversations } from "./use-chats.ts";

const SUGGESTIONS = [
  {
    icon: <Icon.Lightbulb />,
    tone: "amber",
    label: "Plan a homepage from an idea",
    prompt: "Plan a homepage for a creative studio called “Lumen”.",
  },
  {
    icon: <Icon.Hammer />,
    tone: "violet",
    label: "Build a landing page for my brand",
    prompt:
      "Create a homepage for a creative studio called “Lumen”. It should feel modern, bold and minimal, with a hero, work sections and simple navigation.",
  },
  {
    icon: <Icon.Mobile />,
    tone: "green",
    label: "Design a mobile app screen",
    prompt:
      "Design a mobile app home screen for a habit tracker called “Tally”.",
  },
  {
    icon: <Icon.Palette />,
    tone: "rose",
    label: "Make a moodboard for a brand",
    prompt: "Make a moodboard for a coffee brand called “Ember”.",
  },
];

const QUICK_ACTIONS = [
  { label: "Plan", icon: <Icon.Steps />, prompt: "Plan it out first." },
  { label: "Generate", icon: <Icon.Wand />, prompt: "Generate a homepage." },
  {
    label: "Refine",
    icon: <Icon.Pencil />,
    prompt: "Make it darker and bolder.",
  },
  {
    label: "Add section",
    icon: <Icon.Section />,
    prompt: "Add a section showing selected work.",
  },
  {
    label: "Make responsive",
    icon: <Icon.Mobile />,
    prompt: "Make it responsive.",
  },
];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ---------------------------------------------------------------- pieces */

function BoardPreview({
  fileId,
  height,
  onOpen,
}: {
  fileId: string;
  height: number;
  onOpen?: () => void;
}) {
  const store = useFileStore();
  const files = useFiles();
  const file = files.find((item) => item.id === fileId);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const doc = useMemo<BoardDocumentV1 | null>(() => {
    if (!file) return null;
    try {
      return store.read(file.id);
    } catch {
      return null;
    }
    // `file` changes identity on every save, so each agent edit re-reads.
  }, [store, file]);
  if (!file || !doc) {
    return <p className="ch-preview-missing">This board was deleted.</p>;
  }
  return (
    <div className="ch-preview" ref={ref} style={{ height }}>
      {size.width > 0 ? (
        <BoardThumbnail
          document={doc}
          width={size.width}
          height={height}
          padding={12}
        />
      ) : null}
      {onOpen ? (
        <button
          type="button"
          className="ch-icon-button ch-preview-open"
          aria-label={`Open ${file.name} in Studio`}
          title="Open in Studio"
          onClick={onOpen}
        >
          <Icon.External size={14} />
        </button>
      ) : null}
    </div>
  );
}

function PlanCard({ steps }: { steps: PlanStep[] }) {
  return (
    <ol className="ch-plan" aria-label="Plan">
      {steps.map((step, index) => (
        <li key={step.label} className={`ch-step ${step.state}`}>
          <span className="ch-step-mark" aria-hidden="true">
            {step.state === "done" ? <Icon.Check size={13} /> : index + 1}
          </span>
          <span className="ch-step-label">{step.label}</span>
          {step.state === "active" ? (
            <Icon.Spinner size={16} className="ch-spin" aria-label="Working" />
          ) : null}
          <span className="sr-only">
            {step.state === "done"
              ? "done"
              : step.state === "active"
                ? "in progress"
                : "pending"}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Part({
  part,
  onOpen,
}: {
  part: MessagePart;
  onOpen: (id: string) => void;
}) {
  if (part.kind === "text") {
    if (!part.text) return null;
    return (
      <>
        {part.text.split(/\n{2,}/).map((paragraph) => (
          <p key={paragraph} className="ch-text">
            {paragraph}
          </p>
        ))}
      </>
    );
  }
  if (part.kind === "plan") return <PlanCard steps={part.steps} />;
  return (
    <figure className="ch-preview-card">
      <BoardPreview
        fileId={part.fileId}
        height={300}
        onOpen={() => onOpen(part.fileId)}
      />
      <figcaption>
        <Icon.File size={14} />
        <span>{part.title}</span>
        <button
          type="button"
          className="ch-link"
          onClick={() => onOpen(part.fileId)}
        >
          Open in Studio <Icon.Arrow size={13} />
        </button>
      </figcaption>
    </figure>
  );
}

function Message({
  message,
  onOpen,
}: {
  message: ChatMessage;
  onOpen: (id: string) => void;
}) {
  if (message.role === "user") {
    return (
      <article className="ch-msg user" aria-label="You">
        <div className="ch-bubble">
          {message.parts.map((part, index) =>
            part.kind === "text" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
              <p key={index}>{part.text}</p>
            ) : null,
          )}
        </div>
      </article>
    );
  }
  const thinking =
    message.status === "streaming" &&
    message.parts.every((part) => part.kind === "text" && !part.text);
  return (
    <article className="ch-msg agent" aria-label={`${ALLI.name} replied`}>
      <CharacterAvatar character={ALLI} size={34} />
      <div className="ch-msg-body">
        <header className="ch-msg-head">
          <strong>{ALLI.name}</strong>
          <span className="ch-badge">AI agent</span>
          <time dateTime={message.createdAt}>
            {timeLabel(message.createdAt)}
          </time>
        </header>
        {thinking ? (
          <p className="ch-thinking" aria-live="polite">
            <span />
            <span />
            <span />
            <span className="sr-only">Alli is thinking</span>
          </p>
        ) : (
          message.parts.map((part, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
            <Part key={index} part={part} onOpen={onOpen} />
          ))
        )}
        {message.status === "stopped" ? (
          <p className="ch-note">Stopped.</p>
        ) : null}
        {message.status === "error" ? (
          <p className="ch-note error" role="alert">
            Alli couldn't finish this one.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Composer({
  disabled,
  running,
  context,
  agent,
  onSend,
  onStop,
  autoFocus,
}: {
  disabled: boolean;
  running: boolean;
  context: string;
  agent: ChatAgent;
  onSend: (text: string) => void;
  onStop: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    const area = input.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 180)}px`;
  });
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const clean = text.trim();
    if (!clean || running || disabled) return;
    onSend(clean);
    setText("");
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <form className="ch-composer" onSubmit={submit}>
      <div className="ch-composer-context">
        <Icon.Folder size={14} />
        <span>{context}</span>
        <span className="ch-composer-cast" aria-hidden="true">
          {CAST.slice(1, 4).map((character) => (
            <CharacterAvatar
              key={character.id}
              character={character}
              size={18}
            />
          ))}
        </span>
      </div>
      <div className="ch-composer-box">
        <textarea
          ref={input}
          rows={1}
          value={text}
          maxLength={CHAT_LIMITS.promptLength}
          disabled={disabled}
          placeholder={`Tell ${ALLI.name} what to build, change, or plan…`}
          aria-label={`Message ${ALLI.name}`}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKey}
        />
        <div className="ch-composer-row">
          <button
            type="button"
            className="ch-icon-button"
            aria-label="Attach a file (coming soon)"
            title="Attachments arrive with the BYOK agent"
            disabled
          >
            <Icon.Attach />
          </button>
          <fieldset className="ch-quick" aria-label="Quick actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="ch-chip"
                disabled={running || disabled}
                onClick={() => onSend(action.prompt)}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </fieldset>
          <span className="ch-agent" title={agent.description}>
            <Icon.Logo size={13} /> {agent.name} · Local
          </span>
          {running ? (
            <button
              type="button"
              className="ch-send stop"
              aria-label="Stop"
              onClick={onStop}
            >
              <Icon.Stop size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              className="ch-send"
              aria-label="Send"
              disabled={!text.trim() || disabled}
            >
              <Icon.Send />
            </button>
          )}
        </div>
      </div>
      <p className="ch-disclosure">{agent.description}</p>
    </form>
  );
}

function ProGate({ onPreview }: { onPreview: () => void }) {
  return (
    <section className="ch-gate" aria-labelledby="ch-gate-title">
      <span className="ch-gate-icon" aria-hidden="true">
        <Icon.Zap />
      </span>
      <div>
        <h2 id="ch-gate-title">Chat is part of allstudio Pro</h2>
        <ul>
          {PRO_FEATURES.map((feature) => (
            <li key={feature}>
              <Icon.Check size={14} /> {feature}
            </li>
          ))}
        </ul>
        <p className="ch-gate-note">
          Plans and billing live in allstudio cloud. This local build has no
          account, so you can preview Pro on this device.
        </p>
      </div>
      <button type="button" className="button dark" onClick={onPreview}>
        Preview Pro locally
      </button>
    </section>
  );
}

function activityIcon(item: ActivityItem) {
  switch (item.kind) {
    case "generate":
      return <Icon.Sparkle size={14} />;
    case "responsive":
      return <Icon.Mobile size={14} />;
    case "section":
      return <Icon.Section size={14} />;
    case "plan":
      return <Icon.Check size={14} />;
    default:
      return <Icon.Pencil size={14} />;
  }
}

function ContextPanel({
  conversation,
  onOpen,
}: {
  conversation: Conversation;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState<"preview" | "steps" | "activity">("preview");
  const files = useFiles();
  const file = conversation.fileId
    ? files.find((item) => item.id === conversation.fileId)
    : undefined;
  const plan = [...conversation.messages]
    .reverse()
    .flatMap((message) => message.parts)
    .find(
      (part): part is Extract<MessagePart, { kind: "plan" }> =>
        part.kind === "plan",
    );
  const now = new Date();
  const tabs = [
    ["preview", "Preview"],
    ["steps", "Steps"],
    ["activity", "Activity"],
  ] as const;
  return (
    <aside className="ch-panel" aria-label="Chat context">
      <div className="ch-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "preview" ? (
        <div className="ch-panel-body">
          {file ? (
            <>
              <div className="ch-live">
                <span className="ch-dot" aria-hidden="true" />
                <div>
                  <strong>{file.name}</strong>
                  <span>Live preview · updates as Alli works</span>
                </div>
              </div>
              <BoardPreview
                fileId={file.id}
                height={260}
                onOpen={() => onOpen(file.id)}
              />
              <button
                type="button"
                className="button secondary ch-wide"
                onClick={() => onOpen(file.id)}
              >
                Open in Studio <Icon.Arrow size={14} />
              </button>
            </>
          ) : (
            <p className="ch-panel-empty">
              The board Alli builds shows up here and updates live.
            </p>
          )}
          <h3 className="ch-panel-heading">Latest activity</h3>
          <ActivityList items={conversation.activity.slice(0, 5)} now={now} />
        </div>
      ) : tab === "steps" ? (
        <div className="ch-panel-body">
          {plan ? (
            <PlanCard steps={plan.steps} />
          ) : (
            <p className="ch-panel-empty">Ask for a plan to see the steps.</p>
          )}
        </div>
      ) : (
        <div className="ch-panel-body">
          <ActivityList items={conversation.activity} now={now} />
        </div>
      )}
    </aside>
  );
}

function ActivityList({ items, now }: { items: ActivityItem[]; now: Date }) {
  if (items.length === 0) {
    return <p className="ch-panel-empty">Nothing yet.</p>;
  }
  return (
    <ul className="ch-activity">
      {items.map((item) => (
        <li key={item.id}>
          <span className={`ch-activity-icon ${item.kind}`} aria-hidden="true">
            {activityIcon(item)}
          </span>
          <span>
            {item.label}
            <time dateTime={item.at}>{formatEdited(item.at, now)}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ page */

export function ChatPage({
  conversationId,
  theme,
  onTheme,
  agent: agentOverride,
}: {
  conversationId?: string;
  theme: ThemePreference;
  onTheme: (theme: ThemePreference) => void;
  agent?: ChatAgent;
}) {
  const chats = useChatStore();
  const conversations = useConversations();
  const files = useFileStore();
  const toast = useToast();
  const storage = useMemo(() => browserStorage(), []);
  const [entitlement, setEntitlement] = useState<Entitlement>(() =>
    readEntitlement(storage),
  );
  const agent = useMemo(
    () => agentOverride ?? new LocalStudioAgent({ files }),
    [agentOverride, files],
  );
  const [running, setRunning] = useState<AbortController | null>(null);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const thread = useRef<HTMLDivElement>(null);
  const conversation = conversationId ? chats.get(conversationId) : undefined;
  const userName = files.settings().displayName || "there";
  const pro = entitlement.plan === "pro";

  const lastMessage = conversation?.messages.at(-1);
  // Follow the newest message while Alli works.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on change
  useEffect(() => {
    const element = thread.current;
    if (element) element.scrollTo({ top: element.scrollHeight });
  }, [lastMessage, conversation?.messages.length]);

  useEffect(() => () => running?.abort(), [running]);

  const open = (id: string) => navigate({ name: "file", id });

  const send = async (text: string) => {
    if (running || !pro) return;
    const prompt = text.slice(0, CHAT_LIMITS.promptLength);
    let current = conversation ?? chats.create(titleFromPrompt(prompt));
    if (!conversation) navigate({ name: "chat", id: current.id });
    if (current.messages.length === 0) {
      current = { ...current, title: titleFromPrompt(prompt) };
    }
    const userMessage: ChatMessage = {
      id: createChatId("m"),
      role: "user",
      createdAt: new Date().toISOString(),
      parts: [{ kind: "text", text: prompt }],
      status: "done",
    };
    current = chats.save({
      ...current,
      updatedAt: userMessage.createdAt,
      messages: [...current.messages, userMessage],
    });
    const id = current.id;
    const controller = new AbortController();
    setRunning(controller);
    try {
      await agent.run({
        prompt,
        conversation: current,
        signal: controller.signal,
        emit: (event) => {
          const latest = chats.get(id);
          if (!latest) return;
          const at = new Date().toISOString();
          if (event.type === "message") {
            const exists = latest.messages.some(
              (message) => message.id === event.message.id,
            );
            chats.save({
              ...latest,
              updatedAt: at,
              messages: exists
                ? latest.messages.map((message) =>
                    message.id === event.message.id ? event.message : message,
                  )
                : [...latest.messages, event.message],
            });
          } else if (event.type === "activity") {
            chats.save({
              ...latest,
              updatedAt: at,
              activity: [event.item, ...latest.activity].slice(0, 50),
            });
          } else {
            chats.save({ ...latest, updatedAt: at, fileId: event.fileId });
          }
        },
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Chat failed.", "error");
    } finally {
      setRunning(null);
    }
  };

  const nav = (
    label: string,
    icon: ReactNode,
    target: string,
    current = false,
  ) => (
    <a
      className={current ? "ws-nav active" : "ws-nav"}
      href={target}
      aria-current={current ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </a>
  );

  const hasThread = Boolean(conversation && conversation.messages.length > 0);
  const boardName = conversation?.fileId
    ? (files.get(conversation.fileId)?.name ?? "New board")
    : "New board";

  return (
    <div
      className={`chat-app${hasThread && showPanel ? " with-panel" : ""}`}
      data-plan={entitlement.plan}
    >
      <aside className="ws-sidebar ch-sidebar" aria-label="Chat navigation">
        <a
          className="ws-brand"
          href={href({ name: "studio", section: "home" })}
        >
          <Icon.Logo /> <strong>allstudio</strong>
        </a>
        <nav aria-label="Main">
          {nav(
            "Home",
            <Icon.Home />,
            href({ name: "studio", section: "home" }),
          )}
          {nav("Chat", <Icon.Chat />, href({ name: "chat" }), true)}
          {nav(
            "Studio",
            <Icon.Studio />,
            href({ name: "studio", section: "projects" }),
          )}
          {nav(
            "Templates",
            <Icon.Template />,
            href({ name: "studio", section: "templates" }),
          )}
          {nav(
            "Files",
            <Icon.Grid />,
            href({ name: "home", section: "recents" }),
          )}
        </nav>
        <button
          type="button"
          className="ch-new"
          onClick={() => navigate({ name: "chat" })}
        >
          <Icon.NewChat /> New chat
        </button>
        <h2 className="ws-heading">Recents</h2>
        <nav aria-label="Recent chats" className="ch-recents">
          {conversations.length === 0 ? (
            <p className="ch-recents-empty">Your chats appear here.</p>
          ) : (
            conversations.slice(0, 30).map((item) => (
              <a
                key={item.id}
                className={
                  item.id === conversationId ? "ws-nav active" : "ws-nav"
                }
                href={href({ name: "chat", id: item.id })}
                aria-current={item.id === conversationId ? "page" : undefined}
              >
                <span className="ch-recent-dot" aria-hidden="true" />
                <span>{item.title}</span>
              </a>
            ))
          )}
        </nav>
        <div className="sidebar-spacer" />
        {pro ? (
          <div className="ch-plan-card pro">
            <Icon.Zap size={16} />
            <div>
              <strong>Pro · local preview</strong>
              <span>Billing connects in allstudio cloud.</span>
            </div>
            <button
              type="button"
              className="ch-link"
              onClick={() => {
                writePlan(storage, "free");
                setEntitlement(readEntitlement(storage));
              }}
            >
              End
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ch-plan-card"
            onClick={() => {
              writePlan(storage, "pro");
              setEntitlement(readEntitlement(storage));
            }}
          >
            <Icon.Zap size={16} />
            <div>
              <strong>Upgrade to Pro</strong>
              <span>Chat with Alli, generate and refine boards.</span>
            </div>
            <Icon.ChevronRight size={14} />
          </button>
        )}
        <Menu
          label="Appearance"
          className="ws-account"
          align="start"
          trigger={
            <>
              <span className="avatar small" aria-hidden="true">
                {(files.settings().displayName || "L")[0]?.toUpperCase()}
              </span>
              <span>{files.settings().displayName || "Local studio"}</span>
            </>
          }
          items={(["system", "light", "dark"] as const).map((option) => ({
            label: `${option[0]?.toUpperCase()}${option.slice(1)} theme`,
            icon:
              option === "system" ? (
                <Icon.Monitor />
              ) : option === "light" ? (
                <Icon.Sun />
              ) : (
                <Icon.Moon />
              ),
            shortcut: theme === option ? "✓" : undefined,
            onSelect: () => onTheme(option),
          }))}
        />
      </aside>

      <main className="ch-main">
        <header className="ch-topbar">
          {conversation ? (
            <Menu
              label="Chat options"
              className="ch-title"
              align="start"
              trigger={
                <>
                  <Icon.Chat size={15} />
                  <span>{conversation.title}</span>
                  <Icon.Chevron size={14} />
                </>
              }
              items={[
                {
                  label: "Rename",
                  icon: <Icon.Pencil />,
                  onSelect: () => setRenaming(conversation),
                },
                "separator",
                {
                  label: "Delete chat",
                  icon: <Icon.Trash />,
                  danger: true,
                  onSelect: () => {
                    if (
                      window.confirm(
                        `Delete “${conversation.title}”? The board it made is kept.`,
                      )
                    ) {
                      running?.abort();
                      chats.remove(conversation.id);
                      navigate({ name: "chat" });
                    }
                  },
                },
              ]}
            />
          ) : (
            <span className="ch-title static">
              <Icon.Chat size={15} /> New chat
            </span>
          )}
          <div className="ch-topbar-actions">
            {conversation?.fileId ? (
              <button
                type="button"
                className="button dark"
                onClick={() => conversation.fileId && open(conversation.fileId)}
              >
                Open in Studio <Icon.External size={14} />
              </button>
            ) : null}
            {hasThread ? (
              <button
                type="button"
                className="ch-icon-button"
                aria-label={
                  showPanel ? "Hide preview panel" : "Show preview panel"
                }
                aria-pressed={showPanel}
                onClick={() => setShowPanel((value) => !value)}
              >
                <Icon.Panel />
              </button>
            ) : null}
          </div>
        </header>

        {hasThread && conversation ? (
          <div className="ch-thread" ref={thread}>
            <div className="ch-thread-inner">
              <div className="ch-intro">
                <CharacterAvatar
                  character={ALLI}
                  size={64}
                  className="ch-intro-avatar"
                />
                <div>
                  <h1>Let's build it together.</h1>
                  <p>
                    Tell me what you're making and I'll turn it into a real,
                    editable board you can refine here or open in Studio.
                  </p>
                </div>
              </div>
              {conversation.messages.map((message) => (
                <Message key={message.id} message={message} onOpen={open} />
              ))}
            </div>
          </div>
        ) : (
          <div className="ch-welcome">
            <ul className="ch-cast" aria-label="Your studio agents">
              {CAST.map((character) => (
                <li
                  key={character.id}
                  title={`${character.name} · ${character.role}`}
                >
                  <CharacterAvatar character={character} size={58} />
                </li>
              ))}
            </ul>
            <h1>What are we working on today, {userName}?</h1>
            <div className="ch-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  className="ch-suggestion"
                  disabled={!pro || Boolean(running)}
                  onClick={() => void send(suggestion.prompt)}
                >
                  <span className={`ch-suggestion-icon ${suggestion.tone}`}>
                    {suggestion.icon}
                  </span>
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ch-dock">
          {pro ? (
            <Composer
              disabled={false}
              running={Boolean(running)}
              context={boardName}
              agent={agent}
              onSend={(text) => void send(text)}
              onStop={() => running?.abort()}
              autoFocus={!hasThread}
            />
          ) : (
            <ProGate
              onPreview={() => {
                writePlan(storage, "pro");
                setEntitlement(readEntitlement(storage));
              }}
            />
          )}
        </div>
      </main>

      {hasThread && conversation && showPanel ? (
        <ContextPanel conversation={conversation} onOpen={open} />
      ) : null}

      {renaming ? (
        <PromptDialog
          title="Rename chat"
          label="Name"
          initial={renaming.title}
          confirm="Rename"
          onCancel={() => setRenaming(null)}
          onSubmit={(value) => {
            chats.rename(renaming.id, value);
            setRenaming(null);
          }}
        />
      ) : null}
    </div>
  );
}
