import {
  type BoardDocumentV1,
  type BoardFrameNode,
  type BoardNode,
  type BoardPage,
  type BoardTextNode,
  createBoardDocument,
  createBoardId,
} from "@allstudio/project";

/** Default UI sans stack for new text; no font files are downloaded. */
export const DEFAULT_FONT =
  'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const FONT_CHOICES: { label: string; value: string }[] = [
  { label: "Inter / System", value: DEFAULT_FONT },
  { label: "Serif", value: 'ui-serif, Georgia, "Times New Roman", serif' },
  {
    label: "Mono",
    value: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
  {
    label: "Rounded",
    value: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  },
];

export function textNode(
  props: Partial<BoardTextNode> & Pick<BoardTextNode, "text" | "x" | "y">,
): BoardTextNode {
  return {
    id: createBoardId(),
    type: "text",
    name: props.text.slice(0, 32).replace(/\s+/g, " ") || "Text",
    width: 240,
    height: 24,
    color: "#111111",
    fontFamily: DEFAULT_FONT,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.3,
    letterSpacing: 0,
    textAlign: "left",
    ...props,
  };
}

export function frameNode(
  props: Partial<BoardFrameNode> &
    Pick<BoardFrameNode, "name" | "x" | "y" | "width" | "height">,
): BoardFrameNode {
  return {
    id: createBoardId(),
    type: "frame",
    fill: "#ffffff",
    clip: true,
    children: [],
    ...props,
  };
}

export function shapeNode(
  type: "rect" | "ellipse",
  props: Partial<BoardNode> & Pick<BoardNode, "x" | "y" | "width" | "height">,
): BoardNode {
  return {
    id: createBoardId(),
    type,
    name: type === "rect" ? "Rectangle" : "Ellipse",
    fill: "#d9d9d9",
    ...props,
  } as BoardNode;
}

function page(
  name: string,
  nodes: BoardNode[],
  background = "transparent",
): BoardPage {
  return { id: createBoardId("p"), name, background, nodes };
}

function landingFrame(x: number, y: number): BoardFrameNode {
  return frameNode({
    name: "Desktop — Home",
    x,
    y,
    width: 1440,
    height: 900,
    fill: "#fbfaf7",
    children: [
      textNode({
        text: "✱ studio",
        x: 64,
        y: 40,
        fontWeight: 700,
        fontSize: 20,
      }),
      textNode({
        text: "Work   About   Contact",
        x: 1120,
        y: 44,
        width: 260,
        textAlign: "right",
        color: "#555555",
        fontSize: 15,
      }),
      textNode({
        text: "Ideas that\nmake an impact.",
        x: 64,
        y: 200,
        width: 760,
        height: 210,
        fontSize: 92,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: -3,
      }),
      textNode({
        text: "A small studio crafting brands, products and websites with care.",
        x: 64,
        y: 450,
        width: 520,
        height: 60,
        fontSize: 20,
        color: "#555555",
        lineHeight: 1.45,
      }),
      shapeNode("rect", {
        name: "Button",
        x: 64,
        y: 556,
        width: 168,
        height: 52,
        fill: "#111111",
        radius: 26,
      }),
      textNode({
        text: "Start a project",
        x: 64,
        y: 570,
        width: 168,
        textAlign: "center",
        color: "#ffffff",
        fontWeight: 600,
      }),
      shapeNode("ellipse", {
        name: "Orange sphere",
        x: 860,
        y: 260,
        width: 220,
        height: 220,
        gradient: [135, "#ffb27a", "#ff5a1f"],
      }),
      shapeNode("rect", {
        name: "Blue pill",
        x: 1000,
        y: 420,
        width: 340,
        height: 150,
        radius: 75,
        gradient: [160, "#3d7bff", "#123a9c"],
      }),
    ],
  });
}

function mobileFrame(x: number, y: number): BoardFrameNode {
  return frameNode({
    name: "Mobile — Home",
    x,
    y,
    width: 390,
    height: 844,
    radius: 32,
    fill: "#f4f1ec",
    children: [
      textNode({
        text: "Good morning",
        x: 24,
        y: 72,
        color: "#777777",
        fontSize: 15,
      }),
      textNode({
        text: "Beyond the\nordinary.",
        x: 24,
        y: 100,
        width: 340,
        height: 100,
        fontSize: 40,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: -1,
      }),
      shapeNode("rect", {
        name: "Card",
        x: 24,
        y: 240,
        width: 342,
        height: 220,
        radius: 24,
        gradient: [140, "#dfe7ff", "#a9bfff"],
      }),
      shapeNode("ellipse", {
        name: "Sphere",
        x: 60,
        y: 300,
        width: 96,
        height: 96,
        gradient: [140, "#5b8cff", "#0d2e8a"],
      }),
      shapeNode("rect", {
        name: "Tab bar",
        x: 24,
        y: 756,
        width: 342,
        height: 60,
        radius: 30,
        fill: "#111111",
      }),
    ],
  });
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  create: () => BoardDocumentV1;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "blank",
    name: "Blank board",
    description: "An empty canvas.",
    create: () => createBoardDocument("Untitled"),
  },
  {
    id: "landing",
    name: "Landing page",
    description: "Desktop hero with type, button and shapes.",
    create: () =>
      createBoardDocument("Landing page", [page("Home", [landingFrame(0, 0)])]),
  },
  {
    id: "mobile",
    name: "Mobile app",
    description: "A 390 × 844 phone screen.",
    create: () =>
      createBoardDocument("Mobile app", [page("Screens", [mobileFrame(0, 0)])]),
  },
  {
    id: "moodboard",
    name: "Moodboard",
    description: "Color and form exploration.",
    create: () =>
      createBoardDocument("Moodboard", [
        page("Explore", [
          frameNode({
            name: "Palette",
            x: 0,
            y: 0,
            width: 960,
            height: 560,
            fill: "#efede8",
            children: [
              textNode({
                text: "Form follows feeling.",
                x: 48,
                y: 40,
                width: 600,
                height: 56,
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: -1,
              }),
              ...[
                ["#ff5a1f", "#ffb27a"],
                ["#123a9c", "#3d7bff"],
                ["#8a8378", "#d6d0c4"],
                ["#111111", "#4a4a4a"],
              ].map(([to, from], index) =>
                shapeNode("ellipse", {
                  name: `Swatch ${index + 1}`,
                  x: 48 + index * 220,
                  y: 160,
                  width: 180,
                  height: 180,
                  gradient: [135, from as string, to as string],
                }),
              ),
              shapeNode("rect", {
                name: "Strip",
                x: 48,
                y: 400,
                width: 864,
                height: 96,
                radius: 48,
                gradient: [90, "#ffb27a", "#3d7bff"],
              }),
            ],
          }),
        ]),
      ]),
  },
  {
    id: "responsive",
    name: "Responsive set",
    description: "Desktop and mobile frames side by side.",
    create: () =>
      createBoardDocument("Responsive set", [
        page("Design", [landingFrame(0, 0), mobileFrame(1540, 0)]),
      ]),
  },
];

export function createFromTemplate(templateId: string): BoardDocumentV1 {
  const template = BOARD_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown template "${templateId}".`);
  return template.create();
}
