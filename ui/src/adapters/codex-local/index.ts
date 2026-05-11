import type { UIAdapterModule } from "../types";
import { parseCodexStdoutLine } from "@automanager/adapter-codex-local/ui";
import { CodexLocalConfigFields } from "./config-fields";
import { buildCodexLocalConfig } from "@automanager/adapter-codex-local/ui";

export const codexLocalUIAdapter: UIAdapterModule = {
  type: "codex_local",
  label: "Codex (local)",
  parseStdoutLine: parseCodexStdoutLine,
  ConfigFields: CodexLocalConfigFields,
  buildAdapterConfig: buildCodexLocalConfig,
};
