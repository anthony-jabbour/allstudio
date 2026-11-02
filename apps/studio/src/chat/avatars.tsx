import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

/**
 * Hand-drawn characters from the "Notionists" set by Zoish (CC0 1.0),
 * rendered by DiceBear (MIT, dicebear/dicebear, pinned 9.4.2). They are an
 * openly licensed, independent illustration set, not Notion's own artwork.
 * Everything is generated locally from a seed: no avatar service is called.
 */

export interface Character {
  id: string;
  name: string;
  role: string;
  seed: string;
  background: string;
}

/** Alli leads; the others are the helpers shown in the welcome row. */
export const CAST: Character[] = [
  {
    id: "alli",
    name: "Alli",
    role: "Design agent",
    seed: "Alli-studio-7",
    background: "fde7d9",
  },
  {
    id: "plan",
    name: "Pip",
    role: "Planner",
    seed: "Pip-planner-2",
    background: "e3ecff",
  },
  {
    id: "layout",
    name: "Lou",
    role: "Layout",
    seed: "Lou-layout-4",
    background: "e2f4e6",
  },
  {
    id: "type",
    name: "Tess",
    role: "Typography",
    seed: "Tess-type-9",
    background: "fff1c7",
  },
  {
    id: "color",
    name: "Remy",
    role: "Color",
    seed: "Remy-color-3",
    background: "fbe0ec",
  },
  {
    id: "review",
    name: "Ode",
    role: "Review",
    seed: "Ode-review-5",
    background: "ece5ff",
  },
];

export const ALLI = CAST[0] as Character;

const cache = new Map<string, string>();

export function avatarUri(seed: string, background = "f1efe9"): string {
  const key = `${seed}|${background}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const uri = createAvatar(notionists, {
    seed,
    backgroundColor: [background],
    radius: 50,
    scale: 105,
  }).toDataUri();
  cache.set(key, uri);
  return uri;
}

export function Avatar({
  seed,
  background,
  size = 32,
  label,
  className,
}: {
  seed: string;
  background?: string;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <img
      className={className ? `ch-avatar ${className}` : "ch-avatar"}
      src={avatarUri(seed, background)}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  );
}

export function CharacterAvatar({
  character,
  size,
  className,
}: {
  character: Character;
  size?: number;
  className?: string;
}) {
  return (
    <Avatar
      seed={character.seed}
      background={character.background}
      size={size}
      label={`${character.name}, ${character.role}`}
      className={className}
    />
  );
}
