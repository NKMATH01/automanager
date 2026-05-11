# Supabase Read-Only Connector

This bundled plugin lets AutoManager agents inspect configured Supabase Postgres
databases without any create, update, or delete capability.

What it does:

- exposes read-only agent tools for listing databases, tables, columns, and rows
- classifies root agents or explicitly configured agents as `main`
- restricts sub-agents to only the databases where `allowSubAgents` is enabled
- runs every query inside a read-only transaction with a statement timeout

Recommended setup:

1. Create a dedicated read-only Postgres user for each Supabase project.
2. Store each connection string as a secret in AutoManager.
3. Install this plugin from the bundled examples list.
4. Open the plugin settings page and add your database entries plus any
   explicit `mainAgentIds`.

Repo helper:

- install the plugin and upsert secrets/config with
  `node ./scripts/configure-supabase-readonly-plugin.mjs --config ./scripts/configure-supabase-readonly-plugin.example.json`
- use `--dry-run` first to verify which company, agents, and database entries
  will be targeted without writing anything

Important limits:

- the plugin is read-only by design, but you should still use read-only
  database credentials
- if `mainAgentIds` is empty, agents with `reportsTo = null` are treated as
  main agents
- leaving `allowedSchemas` empty allows every non-system schema in that
  database
