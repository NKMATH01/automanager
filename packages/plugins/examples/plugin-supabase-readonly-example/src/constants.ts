export const PLUGIN_ID = "automanager.supabase-readonly-example";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_MAX_ROWS_PER_QUERY = 50;
export const MAX_ROWS_PER_QUERY = 500;
export const DEFAULT_STATEMENT_TIMEOUT_MS = 10_000;
export const MAX_STATEMENT_TIMEOUT_MS = 120_000;
export const MAX_SEARCH_COLUMNS = 25;
export const DEFAULT_CONTENT_PREVIEW_ROWS = 5;
export const DEFAULT_TABLE_PREVIEW_ROWS = 25;

export const TOOL_NAMES = {
  listDatabases: "list-databases",
  listTables: "list-tables",
  describeTable: "describe-table",
  selectRows: "select-rows",
  searchRows: "search-rows",
} as const;

interface LocalToolDeclaration {
  name: string;
  displayName: string;
  description: string;
  parametersSchema: Record<string, unknown>;
}

const filterSchema = {
  type: "object",
  properties: {
    column: {
      type: "string",
      title: "Column",
    },
    operator: {
      type: "string",
      title: "Operator",
      enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is_null", "not_null"],
      default: "eq",
    },
    value: {
      title: "Value",
    },
  },
  required: ["column", "operator"],
};

export const INSTANCE_CONFIG_SCHEMA = {
  type: "object",
  properties: {
    mainAgentIds: {
      type: "array",
      title: "Main Agent IDs",
      description: "Agents listed here can inspect every configured database. When empty, root agents with no reportsTo are treated as main agents.",
      items: {
        type: "string",
      },
      default: [],
    },
    defaultMaxRowsPerQuery: {
      type: "integer",
      title: "Default Row Limit",
      description: "Per-query hard cap applied when a database entry does not override it.",
      default: DEFAULT_MAX_ROWS_PER_QUERY,
      minimum: 1,
      maximum: MAX_ROWS_PER_QUERY,
    },
    defaultStatementTimeoutMs: {
      type: "integer",
      title: "Default Statement Timeout (ms)",
      description: "Per-query timeout applied when a database entry does not override it.",
      default: DEFAULT_STATEMENT_TIMEOUT_MS,
      minimum: 1000,
      maximum: MAX_STATEMENT_TIMEOUT_MS,
    },
    databases: {
      type: "array",
      title: "Supabase Databases",
      description: "Add one entry per Supabase Postgres database or project.",
      default: [],
      items: {
        type: "object",
        properties: {
          key: {
            type: "string",
            title: "Database Key",
            description: "Stable key agents will use when calling the tools.",
            pattern: "^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$",
          },
          displayName: {
            type: "string",
            title: "Display Name",
          },
          connectionStringSecretRef: {
            type: "string",
            title: "Connection String Secret",
            description: "Secret ref containing a Postgres connection string for this Supabase project.",
            format: "secret-ref",
          },
          defaultSchema: {
            type: "string",
            title: "Default Schema",
            default: "public",
            pattern: "^[A-Za-z_][A-Za-z0-9_]*$",
          },
          allowedSchemas: {
            type: "array",
            title: "Allowed Schemas",
            description: "Leave empty to allow every non-system schema. Add explicit values to narrow access.",
            default: [],
            items: {
              type: "string",
              pattern: "^[A-Za-z_][A-Za-z0-9_]*$",
            },
          },
          allowSubAgents: {
            type: "boolean",
            title: "Allow Sub-Agents",
            description: "When enabled, subordinate agents may inspect this database. Main agents can always inspect it.",
            default: true,
          },
          maxRowsPerQuery: {
            type: "integer",
            title: "Row Limit Override",
            default: DEFAULT_MAX_ROWS_PER_QUERY,
            minimum: 1,
            maximum: MAX_ROWS_PER_QUERY,
          },
          statementTimeoutMs: {
            type: "integer",
            title: "Statement Timeout Override (ms)",
            default: DEFAULT_STATEMENT_TIMEOUT_MS,
            minimum: 1000,
            maximum: MAX_STATEMENT_TIMEOUT_MS,
          },
        },
        required: ["key", "connectionStringSecretRef"],
      },
    },
  },
  required: ["databases"],
};

export const TOOL_DEFINITIONS = {
  listDatabases: {
    name: TOOL_NAMES.listDatabases,
    displayName: "List Accessible Supabase Databases",
    description: "Shows the Supabase databases the current agent is allowed to inspect.",
    parametersSchema: {
      type: "object",
      properties: {},
    },
  },
  listTables: {
    name: TOOL_NAMES.listTables,
    displayName: "List Supabase Tables",
    description: "Lists tables available inside one configured Supabase database and optional schema.",
    parametersSchema: {
      type: "object",
      properties: {
        databaseKey: {
          type: "string",
          title: "Database Key",
        },
        schema: {
          type: "string",
          title: "Schema",
        },
      },
      required: ["databaseKey"],
    },
  },
  describeTable: {
    name: TOOL_NAMES.describeTable,
    displayName: "Describe Supabase Table",
    description: "Shows a table's columns, nullability, defaults, primary keys, and estimated row count.",
    parametersSchema: {
      type: "object",
      properties: {
        databaseKey: {
          type: "string",
          title: "Database Key",
        },
        schema: {
          type: "string",
          title: "Schema",
        },
        table: {
          type: "string",
          title: "Table",
        },
      },
      required: ["databaseKey", "table"],
    },
  },
  selectRows: {
    name: TOOL_NAMES.selectRows,
    displayName: "Select Supabase Rows",
    description: "Reads rows from one configured table with optional filters and sort order. Read-only only.",
    parametersSchema: {
      type: "object",
      properties: {
        databaseKey: {
          type: "string",
          title: "Database Key",
        },
        schema: {
          type: "string",
          title: "Schema",
        },
        table: {
          type: "string",
          title: "Table",
        },
        columns: {
          type: "array",
          title: "Columns",
          items: {
            type: "string",
          },
        },
        filters: {
          type: "array",
          title: "Filters",
          items: filterSchema,
        },
        orderByColumn: {
          type: "string",
          title: "Order By Column",
        },
        orderDirection: {
          type: "string",
          title: "Order Direction",
          enum: ["asc", "desc"],
          default: "asc",
        },
        limit: {
          type: "integer",
          title: "Limit",
          minimum: 1,
          maximum: MAX_ROWS_PER_QUERY,
        },
      },
      required: ["databaseKey", "table"],
    },
  },
  searchRows: {
    name: TOOL_NAMES.searchRows,
    displayName: "Search Supabase Rows",
    description: "Searches a table with ILIKE matching across specific columns or across all discovered columns in the table.",
    parametersSchema: {
      type: "object",
      properties: {
        databaseKey: {
          type: "string",
          title: "Database Key",
        },
        schema: {
          type: "string",
          title: "Schema",
        },
        table: {
          type: "string",
          title: "Table",
        },
        searchTerm: {
          type: "string",
          title: "Search Term",
        },
        columns: {
          type: "array",
          title: "Columns",
          items: {
            type: "string",
          },
        },
        limit: {
          type: "integer",
          title: "Limit",
          minimum: 1,
          maximum: MAX_ROWS_PER_QUERY,
        },
      },
      required: ["databaseKey", "table", "searchTerm"],
    },
  },
} satisfies Record<string, LocalToolDeclaration>;

export const TOOL_DECLARATIONS = Object.values(TOOL_DEFINITIONS);
