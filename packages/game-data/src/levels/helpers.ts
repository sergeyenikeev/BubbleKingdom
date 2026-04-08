import type { BubbleColor, BubbleKind, LevelDefinition } from "@bubble-kingdom/shared";

const tokenColorMap: Record<string, BubbleColor> = {
  R: "ruby",
  B: "sapphire",
  G: "emerald",
  Y: "sun",
  P: "amethyst",
  C: "aqua",
};

const colorTokenMap: Record<BubbleColor, string> = {
  ruby: "R",
  sapphire: "B",
  emerald: "G",
  sun: "Y",
  amethyst: "P",
  aqua: "C",
};

export interface ParsedLayoutToken {
  kind: BubbleKind | "empty";
  color: BubbleColor | null;
}

export function tokenForColor(color: BubbleColor): string {
  return colorTokenMap[color];
}

export function parseLayoutToken(token: string): ParsedLayoutToken {
  if (token === ".") {
    return {
      kind: "empty",
      color: null,
    };
  }

  if (token === "S") {
    return {
      kind: "stone",
      color: null,
    };
  }

  const [prefix, suffix] = token.length === 1 ? ["", token] : [token[0]!, token[1]!];
  const color = tokenColorMap[suffix];
  if (!color) {
    throw new Error(`Unknown token color for ${token}`);
  }

  switch (prefix) {
    case "":
      return { kind: "normal", color };
    case "I":
      return { kind: "ice", color };
    case "V":
      return { kind: "vine", color };
    case "F":
      return { kind: "fog", color };
    case "C":
      return { kind: "crystal", color };
    case "P":
      return { kind: "pet", color };
    case "H":
      return { kind: "flower", color };
    case "A":
      return { kind: "artifact", color };
    case "L":
      return { kind: "line", color };
    default:
      throw new Error(`Unknown token prefix for ${token}`);
  }
}

export function collectLayoutColors(layout: string[]): Set<BubbleColor> {
  const colors = new Set<BubbleColor>();

  for (const row of layout) {
    for (const token of row.split(" ")) {
      const parsed = parseLayoutToken(token);
      if (parsed.color) {
        colors.add(parsed.color);
      }
    }
  }

  return colors;
}

export function countLayoutKinds(layout: string[]): Record<ParsedLayoutToken["kind"], number> {
  const counts: Record<ParsedLayoutToken["kind"], number> = {
    empty: 0,
    normal: 0,
    rainbow: 0,
    bomb: 0,
    line: 0,
    stone: 0,
    ice: 0,
    vine: 0,
    fog: 0,
    crystal: 0,
    pet: 0,
    flower: 0,
    artifact: 0,
  };

  for (const row of layout) {
    for (const token of row.split(" ")) {
      const parsed = parseLayoutToken(token);
      counts[parsed.kind] += 1;
    }
  }

  return counts;
}

export function createQueuePattern(
  palette: BubbleColor[],
  seed: number,
  options?: {
    length?: number;
    prefix?: LevelDefinition["queue"];
    specials?: Array<{
      index: number;
      value: LevelDefinition["queue"][number];
    }>;
  },
): LevelDefinition["queue"] {
  const length = options?.length ?? 24;
  const prefix = options?.prefix ?? [];
  const specialByIndex = new Map(options?.specials?.map((entry) => [entry.index, entry.value]) ?? []);

  return Array.from({ length }, (_, index) => {
    const special = specialByIndex.get(index);
    if (special) {
      return special;
    }

    if (index < prefix.length) {
      return prefix[index]!;
    }

    return palette[(seed + index) % palette.length] ?? palette[0] ?? "ruby";
  });
}
