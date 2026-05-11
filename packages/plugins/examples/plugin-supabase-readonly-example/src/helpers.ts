import {
  DEFAULT_CONTENT_PREVIEW_ROWS,
  DEFAULT_MAX_ROWS_PER_QUERY,
  DEFAULT_STATEMENT_TIMEOUT_MS,
  DEFAULT_TABLE_PREVIEW_ROWS,
  MAX_ROWS_PER_QUERY,
  MAX_SEARCH_COLUMNS,
  MAX_STATEMENT_TIMEOUT_MS,
} from "./constants.js";

type AgentLike = {
  reportsTo: string | null;
};

const DATABASE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_SCHEMAS = new Set(["information_schema"]);
const RESERVED_SCHEMA_PREFIXES = ["pg_"];

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "is_null"
  | "not_null";

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface SelectRowsParams {
  schema?: string;
  table: string;
  columns?: string[];
  filters?: FilterCondition[];
  orderByColumn?: string;
  orderDirection?: "asc" | "desc";
  limit?: number;
}

export interface SearchRowsParams {
  schema?: string;
  table: string;
  searchTerm: string;
  columns?: string[];
  limit?: number;
}

type RawReadonlyDatabaseConfig = {
  key?: unknown;
  displayName?: unknown;
  connectionStringSecretRef?: unknown;
  defaultSchema?: unknown;
  allowedSchemas?: unknown;
  allowSubAgents?: unknown;
  maxRowsPerQuery?: unknown;
  statementTimeoutMs?: unknown;
};

export type RawReadonlyPluginConfig = {
  mainAgentIds?: unknown;
  databases?: unknown;
  defaultMaxRowsPerQuery?: unknown;
  defaultStatementTimeoutMs?: unknown;
};

export interface NormalizedReadonlyDatabaseConfig {
  key: string;
  displayName: string;
  connectionStringSecretRef: string;
  defaultSchema: string;
  allowedSchemas: string[] | null;
  allowSubAgents: boolean;
  maxRowsPerQuery: number;
  statementTimeoutMs: number;
}

export interface NormalizedReadonlyPluginConfig {
  mainAgentIds: string[];
  databases: NormalizedReadonlyDatabaseConfig[];
  defaultMaxRowsPerQuery: number;
  defaultStatementTimeoutMs: number;
}

export type AgentAccessMode = "main" | "sub";

export interface AgentAccessProfile {
  mode: AgentAccessMode;
  databases: NormalizedReadonlyDatabaseConfig[];
}

export interface BuiltQuery {
  query: string;
  params: unknown[];
  schema: string;
  table: string;
  limit: number;
}

export function isSafeIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}

export function quoteIdentifier(value: string): string {
  if (!isSafeIdentifier(value)) {
    throw new Error(`Unsafe identifier: ${value}`);
  }
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function isReservedSchema(value: string): boolean {
  return RESERVED_SCHEMAS.has(value) || RESERVED_SCHEMA_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function assertAllowedSchemaName(value: string): string {
  const next = value.trim();
  if (!isSafeIdentifier(next)) {
    throw new Error(`Invalid schema name: ${value}`);
  }
  if (isReservedSchema(next)) {
    throw new Error(`System schema "${next}" is not allowed`);
  }
  return next;
}

export function assertTableName(value: string): string {
  const next = value.trim();
  if (!isSafeIdentifier(next)) {
    throw new Error(`Invalid table name: ${value}`);
  }
  return next;
}

export function assertColumnNames(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) return undefined;
  return uniqueStrings(values.map((value) => {
    const next = value.trim();
    if (!isSafeIdentifier(next)) {
      throw new Error(`Invalid column name: ${value}`);
    }
    return next;
  }));
}

export function sanitizePositiveInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const next = Math.trunc(value);
  if (next < min) return min;
  if (next > max) return max;
  return next;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function normalizeAllowedSchemas(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = uniqueStrings(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => assertAllowedSchemaName(entry)),
  );
  return items.length > 0 ? items : null;
}

export function normalizePluginConfig(raw: Record<string, unknown>): NormalizedReadonlyPluginConfig {
  const typed = raw as RawReadonlyPluginConfig;
  const defaultMaxRowsPerQuery = sanitizePositiveInteger(
    typed.defaultMaxRowsPerQuery,
    DEFAULT_MAX_ROWS_PER_QUERY,
    1,
    MAX_ROWS_PER_QUERY,
  );
  const defaultStatementTimeoutMs = sanitizePositiveInteger(
    typed.defaultStatementTimeoutMs,
    DEFAULT_STATEMENT_TIMEOUT_MS,
    1000,
    MAX_STATEMENT_TIMEOUT_MS,
  );
  const mainAgentIds = Array.isArray(typed.mainAgentIds)
    ? uniqueStrings(typed.mainAgentIds.filter((entry): entry is string => typeof entry === "string"))
    : [];
  const rawDatabases = Array.isArray(typed.databases) ? typed.databases : [];

  const databases = rawDatabases.map((entry, index) =>
    normalizeDatabaseConfig(entry, index, defaultMaxRowsPerQuery, defaultStatementTimeoutMs),
  );

  return {
    mainAgentIds,
    databases,
    defaultMaxRowsPerQuery,
    defaultStatementTimeoutMs,
  };
}

function normalizeDatabaseConfig(
  raw: unknown,
  index: number,
  defaultMaxRowsPerQuery: number,
  defaultStatementTimeoutMs: number,
): NormalizedReadonlyDatabaseConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Database entry ${index + 1} must be an object`);
  }

  const typed = raw as RawReadonlyDatabaseConfig;
  const key = typeof typed.key === "string" ? typed.key.trim() : "";
  if (!DATABASE_KEY_PATTERN.test(key)) {
    throw new Error(`Database entry ${index + 1} has an invalid key`);
  }

  const connectionStringSecretRef =
    typeof typed.connectionStringSecretRef === "string" ? typed.connectionStringSecretRef.trim() : "";
  if (!connectionStringSecretRef) {
    throw new Error(`Database "${key}" is missing connectionStringSecretRef`);
  }

  const defaultSchema = typed.defaultSchema == null
    ? "public"
    : assertAllowedSchemaName(String(typed.defaultSchema));
  const allowedSchemas = normalizeAllowedSchemas(typed.allowedSchemas);
  if (allowedSchemas && !allowedSchemas.includes(defaultSchema)) {
    throw new Error(`Database "${key}" defaultSchema must also exist in allowedSchemas`);
  }

  return {
    key,
    displayName:
      typeof typed.displayName === "string" && typed.displayName.trim().length > 0
        ? typed.displayName.trim()
        : key,
    connectionStringSecretRef,
    defaultSchema,
    allowedSchemas,
    allowSubAgents: typed.allowSubAgents !== false,
    maxRowsPerQuery: sanitizePositiveInteger(
      typed.maxRowsPerQuery,
      defaultMaxRowsPerQuery,
      1,
      MAX_ROWS_PER_QUERY,
    ),
    statementTimeoutMs: sanitizePositiveInteger(
      typed.statementTimeoutMs,
      defaultStatementTimeoutMs,
      1000,
      MAX_STATEMENT_TIMEOUT_MS,
    ),
  };
}

export function validateNormalizedConfig(config: NormalizedReadonlyPluginConfig): string[] {
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  for (const database of config.databases) {
    if (seenKeys.has(database.key)) {
      errors.push(`Duplicate database key: ${database.key}`);
    }
    seenKeys.add(database.key);
  }

  return errors;
}

export function resolveAgentAccess(
  config: NormalizedReadonlyPluginConfig,
  agentId: string,
  agent: AgentLike | null,
): AgentAccessProfile {
  const isExplicitMain = config.mainAgentIds.includes(agentId);
  const isImplicitRootMain = config.mainAgentIds.length === 0 && agent?.reportsTo == null;
  const mode: AgentAccessMode = isExplicitMain || isImplicitRootMain ? "main" : "sub";

  return {
    mode,
    databases: config.databases.filter((database) => mode === "main" || database.allowSubAgents),
  };
}

export function findAccessibleDatabase(
  access: AgentAccessProfile,
  databaseKey: string,
): NormalizedReadonlyDatabaseConfig {
  const database = access.databases.find((entry) => entry.key === databaseKey);
  if (!database) {
    throw new Error(`Database "${databaseKey}" is not accessible to this agent`);
  }
  return database;
}

export function resolveSchema(
  database: NormalizedReadonlyDatabaseConfig,
  schema?: string,
): string {
  const next = schema ? assertAllowedSchemaName(schema) : database.defaultSchema;
  if (database.allowedSchemas && !database.allowedSchemas.includes(next)) {
    throw new Error(`Schema "${next}" is not allowed for database "${database.key}"`);
  }
  return next;
}

export function buildListTablesQuery(
  database: NormalizedReadonlyDatabaseConfig,
  schema?: string,
): { query: string; params: unknown[] } {
  const params: unknown[] = [];
  let query = `
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema <> 'information_schema'
      AND table_schema NOT LIKE 'pg_%'
  `;

  if (schema) {
    const resolvedSchema = resolveSchema(database, schema);
    params.push(resolvedSchema);
    query += ` AND table_schema = $${params.length}`;
  } else if (database.allowedSchemas) {
    const placeholders = database.allowedSchemas.map((allowed) => {
      params.push(allowed);
      return `$${params.length}`;
    });
    query += ` AND table_schema IN (${placeholders.join(", ")})`;
  }

  query += " ORDER BY table_schema, table_name";
  return { query, params };
}

export function buildSelectRowsQuery(
  database: NormalizedReadonlyDatabaseConfig,
  input: SelectRowsParams,
): BuiltQuery {
  const schema = resolveSchema(database, input.schema);
  const table = assertTableName(input.table);
  const columns = assertColumnNames(input.columns);
  const params: unknown[] = [];
  const selectSql = columns && columns.length > 0
    ? columns.map((column) => quoteIdentifier(column)).join(", ")
    : "*";

  let query = `SELECT ${selectSql} FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const filters = Array.isArray(input.filters) ? input.filters : [];
  const clauses: string[] = [];

  for (const filter of filters) {
    if (!filter || typeof filter !== "object") {
      throw new Error("Each filter must be an object");
    }

    const columnName = typeof filter.column === "string" ? filter.column : "";
    const column = quoteIdentifier(columnName);
    const operator = String(filter.operator) as FilterOperator;
    switch (operator) {
      case "eq":
        params.push(filter.value);
        clauses.push(`${column} = $${params.length}`);
        break;
      case "neq":
        params.push(filter.value);
        clauses.push(`${column} <> $${params.length}`);
        break;
      case "gt":
        params.push(filter.value);
        clauses.push(`${column} > $${params.length}`);
        break;
      case "gte":
        params.push(filter.value);
        clauses.push(`${column} >= $${params.length}`);
        break;
      case "lt":
        params.push(filter.value);
        clauses.push(`${column} < $${params.length}`);
        break;
      case "lte":
        params.push(filter.value);
        clauses.push(`${column} <= $${params.length}`);
        break;
      case "like":
        params.push(String(filter.value ?? ""));
        clauses.push(`${column} LIKE $${params.length}`);
        break;
      case "ilike":
        params.push(String(filter.value ?? ""));
        clauses.push(`${column} ILIKE $${params.length}`);
        break;
      case "in": {
        if (!Array.isArray(filter.value) || filter.value.length === 0) {
          throw new Error(`Filter "${columnName}" with operator "in" requires a non-empty array`);
        }
        const placeholders = filter.value.map((entry) => {
          params.push(entry);
          return `$${params.length}`;
        });
        clauses.push(`${column} IN (${placeholders.join(", ")})`);
        break;
      }
      case "is_null":
        clauses.push(`${column} IS NULL`);
        break;
      case "not_null":
        clauses.push(`${column} IS NOT NULL`);
        break;
      default:
        throw new Error(`Unsupported filter operator: ${operator}`);
    }
  }

  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(" AND ")}`;
  }

  if (typeof input.orderByColumn === "string" && input.orderByColumn.trim().length > 0) {
    const direction = String(input.orderDirection ?? "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
    query += ` ORDER BY ${quoteIdentifier(input.orderByColumn.trim())} ${direction}`;
  }

  const limit = sanitizePositiveInteger(input.limit, database.maxRowsPerQuery, 1, database.maxRowsPerQuery);
  params.push(limit);
  query += ` LIMIT $${params.length}`;

  return { query, params, schema, table, limit };
}

export function buildSearchRowsQuery(
  database: NormalizedReadonlyDatabaseConfig,
  input: SearchRowsParams,
  availableColumns: string[],
): BuiltQuery {
  const schema = resolveSchema(database, input.schema);
  const table = assertTableName(input.table);
  const explicitColumns = assertColumnNames(input.columns);
  const columns = (explicitColumns && explicitColumns.length > 0 ? explicitColumns : availableColumns).slice(0, MAX_SEARCH_COLUMNS);

  if (columns.length === 0) {
    throw new Error(`Table "${schema}.${table}" does not expose any searchable columns`);
  }

  const searchTerm = String(input.searchTerm ?? "").trim();
  if (!searchTerm) {
    throw new Error("searchTerm is required");
  }

  const params: unknown[] = [`%${searchTerm}%`];
  const clauses = columns.map((column) => `CAST(${quoteIdentifier(column)} AS TEXT) ILIKE $1`);
  const limit = sanitizePositiveInteger(input.limit, database.maxRowsPerQuery, 1, database.maxRowsPerQuery);
  params.push(limit);

  const query = `
    SELECT *
    FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
    WHERE ${clauses.join(" OR ")}
    LIMIT $${params.length}
  `;

  return {
    query,
    params,
    schema,
    table,
    limit,
  };
}

export function truncateRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, truncateValue(value)]),
  );
}

function truncateValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }
  if (Array.isArray(value)) {
    return value.length > 10 ? [...value.slice(0, 10), "..."] : value;
  }
  if (value && typeof value === "object") {
    const asJson = JSON.stringify(value);
    if (!asJson) return value;
    return asJson.length > 160 ? `${asJson.slice(0, 157)}...` : JSON.parse(asJson);
  }
  return value;
}

export function formatRowPreview(
  rows: Record<string, unknown>[],
  maxRows: number = DEFAULT_CONTENT_PREVIEW_ROWS,
): string {
  if (rows.length === 0) return "No rows matched.";
  return rows
    .slice(0, maxRows)
    .map((row, index) => `${index + 1}. ${JSON.stringify(truncateRow(row))}`)
    .join("\n");
}

export function formatDatabaseList(access: AgentAccessProfile): string {
  if (access.databases.length === 0) {
    return access.mode === "main"
      ? "No Supabase databases are configured yet."
      : "No Supabase databases are currently shared with this sub-agent.";
  }

  return access.databases
    .map((database) => {
      const schemaLabel = database.allowedSchemas?.join(", ") ?? "all non-system schemas";
      return `- ${database.key}: ${database.displayName} (default schema: ${database.defaultSchema}, schemas: ${schemaLabel})`;
    })
    .join("\n");
}

export function formatTableList(rows: Array<{ table_schema: string; table_name: string }>): string {
  if (rows.length === 0) return "No tables matched the requested scope.";
  return rows
    .slice(0, DEFAULT_TABLE_PREVIEW_ROWS)
    .map((row) => `- ${row.table_schema}.${row.table_name}`)
    .join("\n");
}
