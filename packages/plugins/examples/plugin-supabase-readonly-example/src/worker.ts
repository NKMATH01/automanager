import postgres from "postgres";
import { TOOL_DEFINITIONS } from "./constants.js";
import {
  buildListTablesQuery,
  buildSearchRowsQuery,
  buildSelectRowsQuery,
  findAccessibleDatabase,
  formatDatabaseList,
  formatRowPreview,
  formatTableList,
  normalizePluginConfig,
  resolveAgentAccess,
  resolveSchema,
  validateNormalizedConfig,
} from "./helpers.js";

interface LocalToolRunContext {
  agentId: string;
  runId: string;
  companyId: string;
  projectId: string;
}

interface LocalToolResult {
  content?: string;
  data?: unknown;
  error?: string;
}

interface LocalAgent {
  reportsTo: string | null;
}

interface LocalPluginContext {
  config: {
    get(): Promise<Record<string, unknown>>;
  };
  secrets: {
    resolve(secretRef: string): Promise<string>;
  };
  agents: {
    get(agentId: string, companyId: string): Promise<LocalAgent | null>;
  };
  tools: {
    register(
      name: string,
      declaration: {
        displayName: string;
        description: string;
        parametersSchema: Record<string, unknown>;
      },
      fn: (params: unknown, runCtx: LocalToolRunContext) => Promise<LocalToolResult>,
    ): void;
  };
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
  };
}

interface LocalPluginDefinition {
  setup(ctx: LocalPluginContext): Promise<void>;
  onValidateConfig?(config: Record<string, unknown>): Promise<{
    ok: boolean;
    errors?: string[];
    warnings?: string[];
  }>;
}

interface LocalPaperclipPlugin {
  definition: LocalPluginDefinition;
}

const sdkDistBaseUrl = new URL("../../../sdk/dist/", import.meta.url);
const { definePlugin } = await import(new URL("define-plugin.js", sdkDistBaseUrl).href) as {
  definePlugin: unknown;
};
const { runWorker } = await import(new URL("worker-rpc-host.js", sdkDistBaseUrl).href) as {
  runWorker: unknown;
};

const definePluginTyped = definePlugin as (definition: LocalPluginDefinition) => LocalPaperclipPlugin;
const runWorkerTyped = runWorker as (plugin: LocalPaperclipPlugin, metaUrl: string) => void;

type SqlClient = ReturnType<typeof postgres>;

interface TableSummaryRow {
  table_schema: string;
  table_name: string;
  table_type: string;
}

interface ColumnSummaryRow {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

interface PrimaryKeyRow {
  column_name: string;
}

interface EstimateRow {
  estimated_rows: number | null;
}

function createClient(connectionString: string): SqlClient {
  return postgres(connectionString, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  });
}

async function runReadOnlyQuery<T = Record<string, unknown>>(
  ctx: LocalPluginContext,
  databaseKey: string,
  secretRef: string,
  statementTimeoutMs: number,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const connectionString = await ctx.secrets.resolve(secretRef);
  const sql = createClient(connectionString);

  try {
    await sql.unsafe("BEGIN READ ONLY");
    try {
      await sql.unsafe(`SET LOCAL statement_timeout = ${statementTimeoutMs}`);
      const rows = await sql.unsafe<T[]>(query, params as never[]);
      await sql.unsafe("COMMIT");
      return rows;
    } catch (error) {
      try {
        await sql.unsafe("ROLLBACK");
      } catch {
        // Preserve the original query error.
      }
      throw error;
    }
  } catch (error) {
    ctx.logger.error("Supabase read-only query failed", {
      databaseKey,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await sql.end();
  }
}

async function loadInvokingAgent(
  ctx: LocalPluginContext,
  runCtx: LocalToolRunContext,
): Promise<LocalAgent | null> {
  try {
    return await ctx.agents.get(runCtx.agentId, runCtx.companyId);
  } catch (error) {
    ctx.logger.warn("Failed to load invoking agent for Supabase access classification", {
      agentId: runCtx.agentId,
      companyId: runCtx.companyId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveAccess(
  ctx: LocalPluginContext,
  runCtx: LocalToolRunContext,
) {
  const config = normalizePluginConfig(await ctx.config.get());
  const invokingAgent = await loadInvokingAgent(ctx, runCtx);
  const access = resolveAgentAccess(config, runCtx.agentId, invokingAgent);
  return { config, access, invokingAgent };
}

async function loadTableColumns(
  ctx: LocalPluginContext,
  databaseKey: string,
  secretRef: string,
  statementTimeoutMs: number,
  schema: string,
  table: string,
): Promise<string[]> {
  const rows = await runReadOnlyQuery<ColumnSummaryRow>(
    ctx,
    databaseKey,
    secretRef,
    statementTimeoutMs,
    `
      SELECT column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `,
    [schema, table],
  );

  return rows.map((row) => row.column_name);
}

const plugin = definePluginTyped({
  async setup(ctx: LocalPluginContext) {
    const declarationFor = <T extends { displayName: string; description: string; parametersSchema: Record<string, unknown> }>(definition: T) => ({
      displayName: definition.displayName,
      description: definition.description,
      parametersSchema: definition.parametersSchema,
    });

    ctx.tools.register(
      TOOL_DEFINITIONS.listDatabases.name,
      declarationFor(TOOL_DEFINITIONS.listDatabases),
      async (_params, runCtx): Promise<LocalToolResult> => {
        const { access } = await resolveAccess(ctx, runCtx);
        return {
          content: `Accessible Supabase databases for this ${access.mode} agent:\n${formatDatabaseList(access)}`,
          data: {
            accessMode: access.mode,
            databases: access.databases.map((database) => ({
              key: database.key,
              displayName: database.displayName,
              defaultSchema: database.defaultSchema,
              allowedSchemas: database.allowedSchemas,
              allowSubAgents: database.allowSubAgents,
              maxRowsPerQuery: database.maxRowsPerQuery,
              statementTimeoutMs: database.statementTimeoutMs,
            })),
          },
        };
      },
    );

    ctx.tools.register(
      TOOL_DEFINITIONS.listTables.name,
      declarationFor(TOOL_DEFINITIONS.listTables),
      async (params, runCtx): Promise<LocalToolResult> => {
        const input = params as { databaseKey?: string; schema?: string };
        if (!input.databaseKey) {
          return { error: "databaseKey is required" };
        }

        const { access } = await resolveAccess(ctx, runCtx);
        const database = findAccessibleDatabase(access, input.databaseKey);
        const { query, params: queryParams } = buildListTablesQuery(database, input.schema);
        const rows = await runReadOnlyQuery<TableSummaryRow>(
          ctx,
          database.key,
          database.connectionStringSecretRef,
          database.statementTimeoutMs,
          query,
          queryParams,
        );

        return {
          content: `Found ${rows.length} tables in ${database.key}.\n${formatTableList(rows)}`,
          data: {
            accessMode: access.mode,
            databaseKey: database.key,
            tables: rows,
          },
        };
      },
    );

    ctx.tools.register(
      TOOL_DEFINITIONS.describeTable.name,
      declarationFor(TOOL_DEFINITIONS.describeTable),
      async (params, runCtx): Promise<LocalToolResult> => {
        const input = params as { databaseKey?: string; schema?: string; table?: string };
        if (!input.databaseKey || !input.table) {
          return { error: "databaseKey and table are required" };
        }

        const { access } = await resolveAccess(ctx, runCtx);
        const database = findAccessibleDatabase(access, input.databaseKey);
        const schema = resolveSchema(database, input.schema);

        const columns = await runReadOnlyQuery<ColumnSummaryRow>(
          ctx,
          database.key,
          database.connectionStringSecretRef,
          database.statementTimeoutMs,
          `
            SELECT column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1
              AND table_name = $2
            ORDER BY ordinal_position
          `,
          [schema, input.table],
        );

        const primaryKeyColumns = await runReadOnlyQuery<PrimaryKeyRow>(
          ctx,
          database.key,
          database.connectionStringSecretRef,
          database.statementTimeoutMs,
          `
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
             AND tc.table_name = kcu.table_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
            ORDER BY kcu.ordinal_position
          `,
          [schema, input.table],
        );

        const estimates = await runReadOnlyQuery<EstimateRow>(
          ctx,
          database.key,
          database.connectionStringSecretRef,
          database.statementTimeoutMs,
          `
            SELECT c.reltuples::bigint AS estimated_rows
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND c.relname = $2
            LIMIT 1
          `,
          [schema, input.table],
        );

        const estimatedRowCount = estimates[0]?.estimated_rows ?? null;
        const columnLines = columns.length === 0
          ? "No columns found."
          : columns
            .map((column) =>
              `- ${column.column_name}: ${column.data_type} (${column.udt_name})${column.is_nullable === "YES" ? ", nullable" : ", not null"}${column.column_default ? `, default=${column.column_default}` : ""}`,
            )
            .join("\n");

        return {
          content: [
            `Table ${schema}.${input.table} in ${database.key}:`,
            columnLines,
            primaryKeyColumns.length > 0
              ? `Primary key: ${primaryKeyColumns.map((column) => column.column_name).join(", ")}`
              : "Primary key: none detected",
            estimatedRowCount == null ? "Estimated rows: unavailable" : `Estimated rows: ${estimatedRowCount}`,
          ].join("\n"),
          data: {
            accessMode: access.mode,
            databaseKey: database.key,
            schema,
            table: input.table,
            columns,
            primaryKeyColumns: primaryKeyColumns.map((column) => column.column_name),
            estimatedRowCount,
          },
        };
      },
    );

    ctx.tools.register(
      TOOL_DEFINITIONS.selectRows.name,
      declarationFor(TOOL_DEFINITIONS.selectRows),
      async (params, runCtx): Promise<LocalToolResult> => {
        const input = params as {
          databaseKey?: string;
          schema?: string;
          table?: string;
          columns?: string[];
          filters?: Array<Record<string, unknown>>;
          orderByColumn?: string;
          orderDirection?: "asc" | "desc";
          limit?: number;
        };
        if (!input.databaseKey || !input.table) {
          return { error: "databaseKey and table are required" };
        }

        const { access } = await resolveAccess(ctx, runCtx);
        const database = findAccessibleDatabase(access, input.databaseKey);
        const built = buildSelectRowsQuery(database, {
          schema: input.schema,
          table: input.table,
          columns: input.columns,
          filters: input.filters as never,
          orderByColumn: input.orderByColumn,
          orderDirection: input.orderDirection,
          limit: input.limit,
        });

        const rows = await runReadOnlyQuery(
          ctx,
          database.key,
          database.connectionStringSecretRef,
          database.statementTimeoutMs,
          built.query,
          built.params,
        );

        return {
          content: [
            `Returned ${rows.length} rows from ${database.key}.${built.schema}.${built.table} (limit ${built.limit}).`,
            formatRowPreview(rows),
          ].join("\n"),
          data: {
            accessMode: access.mode,
            databaseKey: database.key,
            schema: built.schema,
            table: built.table,
            rowCount: rows.length,
            rows,
          },
        };
      },
    );

    ctx.tools.register(
      TOOL_DEFINITIONS.searchRows.name,
      declarationFor(TOOL_DEFINITIONS.searchRows),
      async (params, runCtx): Promise<LocalToolResult> => {
        const input = params as {
          databaseKey?: string;
          schema?: string;
          table?: string;
          searchTerm?: string;
          columns?: string[];
          limit?: number;
        };
        if (!input.databaseKey || !input.table || !input.searchTerm) {
          return { error: "databaseKey, table, and searchTerm are required" };
        }

        const { access } = await resolveAccess(ctx, runCtx);
        const database = findAccessibleDatabase(access, input.databaseKey);
        const schema = resolveSchema(database, input.schema);
        const availableColumns = await loadTableColumns(
          ctx,
          database.key,
          database.connectionStringSecretRef,
          database.statementTimeoutMs,
          schema,
          input.table,
        );
        const built = buildSearchRowsQuery(database, {
          schema,
          table: input.table,
          searchTerm: input.searchTerm,
          columns: input.columns,
          limit: input.limit,
        }, availableColumns);

        const rows = await runReadOnlyQuery(
          ctx,
          database.key,
          database.connectionStringSecretRef,
          database.statementTimeoutMs,
          built.query,
          built.params,
        );

        return {
          content: [
            `Search for "${input.searchTerm}" returned ${rows.length} rows from ${database.key}.${built.schema}.${built.table}.`,
            formatRowPreview(rows),
          ].join("\n"),
          data: {
            accessMode: access.mode,
            databaseKey: database.key,
            schema: built.schema,
            table: built.table,
            rowCount: rows.length,
            rows,
          },
        };
      },
    );
  },

  async onValidateConfig(config: Record<string, unknown>) {
    try {
      const normalized = normalizePluginConfig(config);
      const errors = validateNormalizedConfig(normalized);
      const warnings: string[] = [];

      if (normalized.databases.length === 0) {
        warnings.push("No Supabase databases are configured yet.");
      }
      if (normalized.mainAgentIds.length === 0) {
        warnings.push("No mainAgentIds were set. Root agents with no reportsTo will be treated as main agents.");
      }

      return {
        ok: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        ok: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  },
});

export default plugin;
runWorkerTyped(plugin, import.meta.url);
