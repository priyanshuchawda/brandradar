import {
  buildCompanyIntelEmbeds,
  buildHelpEmbed,
  buildIntelContent,
  buildIntelEmbeds,
  buildRivalsEmbed,
  buildSchemaEmbed,
} from "./discord-embeds";
import { runIntelPull } from "./intel-pull";
import { loadCohortConfig } from "./rivals";

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
  if (name === "schema") {
    return {
      type: 4,
      data: { embeds: [buildSchemaEmbed()] },
    };
  }
  if (name === "company") {
    const rivalName = (optionValue(data, "name") ?? "roame").toLowerCase();
    const mode = optionValue(data, "mode") ?? "example";
    const forceMock = mode !== "live";
    const snapshot = await runIntelPull({
      forceMock,
      persist: !forceMock,
      refresh: false,
    });
    const config = loadCohortConfig();
    const rival = config.rivals.find(
      (r) => r.id.toLowerCase() === rivalName || r.name.toLowerCase() === rivalName,
    );
    if (!rival) {
      return {
        type: 4,
        data: {
          content: `Unknown rival \`${rivalName}\`. Valid options: ${config.rivals.map((r) => `\`${r.id}\``).join(", ")}.`,
        },
      };
    }
    const bucket = snapshot.rivals.find((r) => r.rival_id === rival.id);
    const diff = snapshot.diff.find((d) => d.rival_id === rival.id);
    const embeds = buildCompanyIntelEmbeds(rival, {
      bucket,
      diff,
      plays: snapshot.plays,
      week: snapshot.week,
      visibility: snapshot.visibility,
      collectorId: bucket?.collector_id ?? snapshot.health.collector_ids[0],
    });
    return {
      type: 4,
      data: {
        content: `🏢 **Deep-Dive Intel Report:** \`${rival.name}\` (Week \`${snapshot.week}\`)`,
        embeds,
      },
    };
  }
  if (name === "intel") {
    const mode = optionValue(data, "mode") ?? "example";
    const forceMock = mode !== "live";
    const snapshot = await runIntelPull({
      forceMock,
      persist: !forceMock,
      refresh: false,
    });
    return {
      type: 4,
      data: {
        content: buildIntelContent(snapshot),
        embeds: buildIntelEmbeds(snapshot).slice(0, 10),
      },
    };
  }
  return {
    type: 4,
    data: { content: "Unknown command. Try `/help`." },
  };
}
