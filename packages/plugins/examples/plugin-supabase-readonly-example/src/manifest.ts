import {
  INSTANCE_CONFIG_SCHEMA,
  PLUGIN_ID,
  PLUGIN_VERSION,
  TOOL_DECLARATIONS,
} from "./constants.js";

const manifest = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Supabase Read-Only Connector",
  description: "Lets agents inspect configured Supabase Postgres databases with read-only queries only. Main agents can inspect every configured database; sub-agents only databases explicitly shared with them.",
  author: "AutoManager",
  categories: ["connector"],
  capabilities: [
    "agents.read",
    "secrets.read-ref",
    "agent.tools.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: INSTANCE_CONFIG_SCHEMA,
  tools: TOOL_DECLARATIONS,
};

export default manifest;
