import {
  buildHelpEmbed,
  buildIntelEmbeds,
  buildRivalsEmbed,
} from "./discord-embeds";
import { runIntelPull } from "./intel-pull";

export type InteractionOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
};

export type InteractionData = {
  name?: string;
  options?: InteractionOption[];
};

function optionValue(
  data: InteractionData | undefined,
  name: string,
): string | undefined {
  const hit = data?.options?.find((opt) => opt.name === name);
  return hit && typeof hit.value === "string" ? hit.value : undefined;
}

/** Shared slash-command resolver (used by interactions route + tests). */
export async function resolveDiscordCommand(
  data: InteractionData | undefined,
): Promise<unknown> {
  const name = data?.name ?? "";
  if (name === "help") {
    return {
      type: 4,
      data: { embeds: [buildHelpEmbed()] },
    };
  }
  if (name === "rivals") {
    return {
      type: 4,
      data: { embeds: [buildRivalsEmbed()] },
    };
  }
  if (name === "intel") {
    const mode = optionValue(data, "mode") ?? "example";
    const forceMock = mode !== "live";
    const snapshot = await runIntelPull({ forceMock, persist: !forceMock });
    return {
      type: 4,
      data: {
        content: `📅 **Monday Diff** · \`${snapshot.week}\` · ${snapshot.label}`,
        embeds: buildIntelEmbeds(snapshot).slice(0, 10),
      },
    };
  }
  return {
    type: 4,
    data: { content: "Unknown command. Try `/help`." },
  };
}
