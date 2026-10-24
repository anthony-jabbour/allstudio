# allstudio — design.md

Version: V0.1  
Status: Working design direction  
Last updated: 2026-10-24

Approved mockup copies: `docs/design/studio-mockup.png` (Studio) and `docs/design/chat-mockup.png` (Chat). Originals remain in the parent `Design/` folder.

---

## 1. Purpose

This document defines the visual and product design direction for **allstudio**.

allstudio should feel like a **web-native design studio** that combines:
- the calm, creative, canvas-forward feel of **Paper**,
- the production-ready website workflow of **Framer**,
- and the AI-assisted creation flow of **Onlook-style chat and editing**.

The goal is **not** to make allstudio feel like just another AI website builder. It should feel like a **serious design tool** first, with AI deeply integrated into the workflow.

---

## 2. Product positioning

**allstudio** is a local-first, AI-native design studio for designing websites and interfaces.

It has two primary surfaces:

1. **Studio** — the main visual editor where users design, edit, inspect, and refine pages.
2. **Chat / Agent Workspace** — the AI-first surface where users can describe what they want and collaborate with an agent that plans, generates, and refines designs for them.

These two surfaces should feel like two modes of the same product, not two separate apps.

---

## 3. Core design idea

The design direction should be:

- **Minimal and refined**
- **Soft, premium, and editorial**
- **Professional, not toy-like**
- **Creative, but still structured**
- **Quiet UI with bold work on the canvas**

The interface should stay out of the way so the page or design becomes the hero.

The aesthetic should feel like:
- large whitespace,
- subtle panel contrast,
- smooth rounded corners,
- elegant typography,
- restrained color use,
- and bold hero compositions on the canvas.

---

## 4. Primary visual references

The current design direction is based on the two approved allstudio mockups:

### A. Studio interface
A clean editor with:
- a left project/layers sidebar,
- a central website canvas,
- a top mode and viewport toolbar,
- and a right inspector for design/layout/typography.

### B. Chat / Agent interface
A workspace where:
- the user talks to an AI agent,
- the agent plans work in steps,
- generates a live preview,
- and lets the user refine or open the result in Studio.

These two mockups are now the **working visual baseline**.

---

## 5. Product principles

### 5.1 Design tool first
allstudio should feel like a real design product, not just a prompt box.

### 5.2 AI is collaborative, not the whole product
AI helps users plan, generate, refine, and speed up work — but the visual editor remains central.

### 5.3 Calm interface, bold output
The app chrome should be quiet and neutral. The page design itself should carry the expressive energy.

### 5.4 Professional but approachable
The interface should feel suitable for designers, founders, and developers. It should remain easy to understand even for non-designers.

### 5.5 Shared design language across surfaces
Studio and Chat should share the same visual system, spacing, typography, controls, and polish.

---

## 6. Main product surfaces

## 6.1 Studio

The Studio is the main editing environment.

### Layout structure
The Studio should have four primary zones:

1. **Top bar**
   - Brand/logo
   - Section switching (e.g. Design, CMS, Publish)
   - Viewport/device controls
   - Zoom controls
   - Collaboration avatars
   - Share / Publish actions

2. **Left sidebar**
   - Search
   - Pages / Layers / Components tabs
   - Site structure
   - Layer tree
   - Quick tool icons

3. **Main canvas**
   - The editable website or interface
   - Floating contextual text/selection toolbar when relevant
   - Strong focus on the designed artifact

4. **Right inspector**
   - Design tab
   - Interactions tab
   - Code tab
   - Layout, appearance, typography, effects, responsive settings

### Studio behavior
The Studio should support:
- page editing,
- layer inspection,
- responsive work,
- visual style adjustments,
- and code-aware editing in supported projects.

The canvas should feel polished and highly visual, but the controls should still feel practical and precise.

---

## 6.2 Chat / Agent Workspace

The Chat surface is where users can work directly with an AI agent.

### Layout structure
The Chat surface should have three major zones:

1. **Left sidebar**
   - Global navigation (Home, Chat, Studio, Templates, Brand, Assets)
   - Workspaces
   - Pages
   - Upgrade/account area

2. **Main chat workspace**
   - Friendly agent introduction
   - User prompts/messages
   - Agent responses
   - Planning/checklist card
   - Design preview card(s)
   - Composer at the bottom with quick actions such as Plan, Generate, Refine, Add section, Make responsive

3. **Right context panel**
   - Preview tab
   - Steps tab
   - Assets tab
   - Live preview of generated page
   - Recent activity timeline
   - Supporting work cards or outputs

### Chat behavior
The agent should feel like a design collaborator.

It should:
- explain what it is doing,
- break work into understandable steps,
- show progress,
- produce previews,
- and let the user refine before opening the result in Studio.

The chat interface should feel calm, helpful, and transparent.

---

## 7. Visual language

## 7.1 Color system
The product UI should use a primarily neutral system.

### Base UI palette
- **Background:** warm off-white / soft neutral
- **Panels:** white or very light gray
- **Borders:** soft gray
- **Primary text:** near-black / charcoal
- **Secondary text:** medium gray
- **Inactive controls:** muted gray

### Accent behavior
Accent color should be used sparingly in the chrome.

The design should rely on:
- neutral UI foundations,
- dark text and controls,
- and expressive color inside the design canvas and generated work.

### Hero / artwork accents
The current approved visual language includes:
- warm orange gradients,
- soft peach tones,
- deep blue forms,
- occasional soft pink or cream highlights,
- and natural image cards.

This color feeling should inform the visual personality of allstudio.

---

## 7.2 Typography
Typography should be modern, clean, and confident.

### Product UI typography
Use a clean sans-serif for the interface.

Desired qualities:
- highly readable,
- neutral,
- modern,
- compact enough for dense controls,
- elegant at larger sizes.

### Canvas / marketing typography
For hero sections and generated pages, typography should be bold and editorial.

Desired qualities:
- strong display headlines,
- crisp hierarchy,
- tight spacing where needed,
- premium and modern tone.

Typography should be one of the main differentiators of allstudio's design quality.

---

## 7.3 Shape language
The shape system should feel:
- softly rounded,
- smooth,
- modern,
- spacious,
- and slightly tactile.

This applies to:
- windows,
- cards,
- buttons,
- tabs,
- input fields,
- floating toolbars,
- preview cards,
- and workspace panels.

Rounded corners should be consistent and refined, not overly bubbly.

---

## 7.4 Iconography
Iconography should be:
- simple,
- thin-to-medium weight,
- modern,
- and functional.

Icons should support clarity and not become visually noisy.

---

## 8. Agent identity

The agents are an important part of the product identity.

### Agent concept
allstudio should feature illustrated agent characters that users can work with.

These should feel:
- friendly,
- polished,
- memorable,
- and visually cohesive with the overall brand.

They should not feel childish or overly cartoonish.

### Role in the product
Agents can represent different kinds of help, such as:
- planning,
- design direction,
- editing,
- refinement,
- or specialized workflows.

In the current mockups, the agent acts as a design collaborator in the chat workspace. This should remain a core concept.

### Style direction
The illustration style should be:
- simple,
- clean,
- rounded,
- slightly expressive,
- and recognizable at small sizes.

The agents should evoke some of the warmth that Notion-style characters create, but with a more polished and professional product-design tone.

---

## 9. Navigation and information architecture

The current design direction suggests a simple top-level product structure.

### Primary product navigation
Possible primary sections:
- Home
- Chat
- Studio
- Templates
- Brand
- Assets

### Studio-specific sections
Within the Studio, major modes may include:
- Design
- CMS
- Publish

### Inspector structure
The right panel in Studio should prioritize:
- Design
- Interactions
- Code

This structure feels strong and should remain the baseline.

---

## 10. Interaction design principles

### 10.1 Keep controls close to the work
When editing text or selected objects, contextual controls should appear near the object when appropriate.

### 10.2 Preserve focus
The canvas should feel central. Panels should support, not dominate.

### 10.3 Make AI visible and understandable
The user should see:
- what the agent is doing,
- what step it is on,
- what changed,
- and where outputs came from.

### 10.4 Make transitions between Chat and Studio seamless
A generated design should be easily opened in Studio for direct editing.

### 10.5 Reward refinement
Users should be able to iterate naturally:
- prompt,
- preview,
- refine,
- inspect,
- edit manually,
- publish.

---

## 11. Branding direction

### Brand feeling
The allstudio brand should feel:
- modern,
- calm,
- ambitious,
- design-literate,
- and premium.

### Current logo
The current allstudio logo used in the approved mockups is accepted as the working logo for now.

It should remain in the current design system until we deliberately refine it later.

That means:
- keep the current mark and wordmark direction,
- use it consistently across Studio and Chat,
- and revisit logo exploration in a later branding pass.

---

## 12. What makes allstudio different

The design should express that allstudio is not just:
- a static design canvas,
- a plain AI website generator,
- or a developer-only code tool.

allstudio sits at the intersection of:
- **creative design tooling**,
- **AI collaboration**,
- and **real implementation workflows**.

The design system should make that feel obvious.

---

## 13. Non-goals for V1 design

To keep the product cohesive, V1 should avoid:
- overly colorful or playful UI chrome,
- cluttered pro-tool complexity,
- excessive modal-driven workflows,
- loud gradients in the app shell,
- and a “chat-only” product identity.

The product must remain visually premium and grounded.

---

## 14. Implementation guidance

When implementing allstudio's design:

1. **Use the two approved mockups as the working baseline.**
2. **Match the overall polish, spacing, and calm visual hierarchy.**
3. **Keep the Studio and Chat interfaces within one visual system.**
4. **Let the generated/design content carry the visual expression.**
5. **Use the current logo until a dedicated logo refinement pass happens.**

If implementation trade-offs arise, the product should prioritize:
1. clarity,
2. professionalism,
3. editability,
4. creative confidence,
5. and seamless AI collaboration.

---

## 15. Future refinement areas

After the first implementation pass, likely refinement areas will include:
- final brand/logo refinement,
- exact color tokens,
- final typography scale,
- motion behavior,
- agent illustration system,
- icon system,
- responsive behavior of the app shell,
- and the final visual relationship between Studio and Chat.

---

## 16. Final summary

allstudio should feel like:
- a **beautiful professional design tool**,
- with a **Paper-like calm and creative workspace**,
- a **Framer-like production-ready website editing experience**,
- and an **Onlook-style AI companion flow** integrated into the product.

The approved mockups now define the product's baseline design direction.

This document should be treated as the source of truth for the visual foundation of allstudio until a more detailed component-level design system is created.
