import { createAvatar } from "@dicebear/core";
import * as openPeeps from "@dicebear/open-peeps";

/**
 * Agent characters only. The user never gets a character: user messages show
 * no avatar and the account menu shows an initial.
 *
 * Artwork: "Open Peeps" by Pablo Stanley (CC0 1.0), rendered locally by
 * DiceBear (MIT, dicebear/dicebear, pinned 9.4.2). Each agent's look is
 * pinned explicitly (not left to the seed), so the cast stays the same
 * across library updates. No avatar service is called.
 */

type PeepOptions = Partial<openPeeps.Options>;

export interface Character {
  id: string;
  name: string;
  role: string;
  background: string;
  look: PeepOptions;
}

/** Alli leads; the others are the specialists shown in the welcome row. */
export const CAST: Character[] = [
  {
    id: "alli",
    name: "Alli",
    role: "Design agent",
    background: "fde2cf",
    look: {
      head: ["bun2"],
      face: ["lovingGrin1"],
      skinColor: ["edb98a"],
      clothingColor: ["e78276"],
      accessories: ["glasses4"],
      accessoriesProbability: 100,
    },
  },
  {
    id: "plan",
    name: "Pip",
    role: "Planner",
    background: "dfe8ff",
    look: {
      head: ["afro"],
      face: ["smile"],
      skinColor: ["ae5d29"],
      clothingColor: ["8fa7df"],
    },
  },
  {
    id: "layout",
    name: "Lou",
    role: "Layout",
    background: "dcf2e1",
    look: {
      head: ["pomp"],
      face: ["calm"],
      skinColor: ["ffdbb4"],
      clothingColor: ["78e185"],
      facialHair: ["moustache3"],
      facialHairProbability: 100,
    },
  },
  {
    id: "type",
    name: "Tess",
    role: "Typography",
    background: "fff0c2",
    look: {
      head: ["longCurly"],
      face: ["cute"],
      skinColor: ["d08b5b"],
      clothingColor: ["ffcf77"],
    },
  },
  {
    id: "color",
    name: "Remy",
    role: "Color",
    background: "fbdce9",
    look: {
      head: ["mohawk2"],
      face: ["cheeky"],
      skinColor: ["694d3d"],
      clothingColor: ["e279c7"],
    },
  },
  {
    id: "review",
    name: "Ode",
    role: "Review",
    background: "e9e2ff",
    look: {
      head: ["grayShort"],
      face: ["smile"],
      skinColor: ["ffdbb4"],
      clothingColor: ["9ddadb"],
      accessories: ["glasses"],
      accessoriesProbability: 100,
    },
  },
];

export const ALLI = CAST[0] as Character;

const cache = new Map<string, string>();

export function characterUri(character: Character): string {
  const hit = cache.get(character.id);
  if (hit) return hit;
  const uri = createAvatar(openPeeps, {
    seed: character.id,
    accessoriesProbability: 0,
    facialHairProbability: 0,
    maskProbability: 0,
    ...character.look,
    backgroundColor: [character.background],
    radius: 50,
    scale: 86,
    translateY: 4,
  }).toDataUri();
  cache.set(character.id, uri);
  return uri;
}

export function CharacterAvatar({
  character,
  size = 32,
  className,
}: {
  character: Character;
  size?: number;
  className?: string;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: local data URI, not a page image
    <img
      className={className ? `ch-avatar ${className}` : "ch-avatar"}
      src={characterUri(character)}
      width={size}
      height={size}
      alt={`${character.name}, ${character.role}`}
      draggable={false}
    />
  );
}
