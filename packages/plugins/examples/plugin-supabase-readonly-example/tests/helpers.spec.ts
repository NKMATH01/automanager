import { describe, expect, it } from "vitest";
import {
  buildSearchRowsQuery,
  buildSelectRowsQuery,
  findAccessibleDatabase,
  normalizePluginConfig,
  quoteIdentifier,
  resolveAgentAccess,
  type NormalizedReadonlyDatabaseConfig,
} from "../src/helpers.js";

function makeDatabase(overrides: Partial<NormalizedReadonlyDatabaseConfig> = {}): NormalizedReadonlyDatabaseConfig {
  return {
    key: "academy",
    displayName: "Academy",
    connectionStringSecretRef: "secret-ref-1",
    defaultSchema: "public",
    allowedSchemas: ["public"],
    allowSubAgents: true,
    maxRowsPerQuery: 50,
    statementTimeoutMs: 10000,
    ...overrides,
  };
}

describe("normalizePluginConfig", () => {
  it("normalizes defaults and database entries", () => {
    const config = normalizePluginConfig({
      databases: [
        {
          key: "academy",
          connectionStringSecretRef: "secret-ref-1",
        },
      ],
    });

    expect(config.mainAgentIds).toEqual([]);
    expect(config.databases[0]).toMatchObject({
      key: "academy",
      displayName: "academy",
      defaultSchema: "public",
      allowSubAgents: true,
      maxRowsPerQuery: 50,
      statementTimeoutMs: 10000,
    });
  });

  it("rejects invalid database keys", () => {
    expect(() =>
      normalizePluginConfig({
        databases: [
          {
            key: "bad key",
            connectionStringSecretRef: "secret-ref-1",
          },
        ],
      }),
    ).toThrow(/invalid key/i);
  });
});

describe("resolveAgentAccess", () => {
  it("treats root agents as main when mainAgentIds are empty", () => {
    const database = makeDatabase();
    const access = resolveAgentAccess(
      {
        mainAgentIds: [],
        databases: [database],
        defaultMaxRowsPerQuery: 50,
        defaultStatementTimeoutMs: 10000,
      },
      "agent-main",
      {
        id: "agent-main",
        companyId: "company-1",
        name: "Main",
        urlKey: "main",
        role: "general",
        title: null,
        icon: null,
        status: "active",
        reportsTo: null,
        capabilities: null,
        adapterType: "claude-code",
        adapterConfig: {},
        runtimeConfig: {},
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        pauseReason: null,
        pausedAt: null,
        permissions: { canCreateAgents: false },
        lastHeartbeatAt: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    expect(access.mode).toBe("main");
    expect(access.databases).toHaveLength(1);
  });

  it("filters sub-agent databases using allowSubAgents", () => {
    const access = resolveAgentAccess(
      {
        mainAgentIds: ["agent-main"],
        databases: [
          makeDatabase({ key: "allowed", allowSubAgents: true }),
          makeDatabase({ key: "restricted", allowSubAgents: false }),
        ],
        defaultMaxRowsPerQuery: 50,
        defaultStatementTimeoutMs: 10000,
      },
      "agent-sub",
      {
        id: "agent-sub",
        companyId: "company-1",
        name: "Sub",
        urlKey: "sub",
        role: "general",
        title: null,
        icon: null,
        status: "active",
        reportsTo: "agent-main",
        capabilities: null,
        adapterType: "claude-code",
        adapterConfig: {},
        runtimeConfig: {},
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        pauseReason: null,
        pausedAt: null,
        permissions: { canCreateAgents: false },
        lastHeartbeatAt: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    expect(access.mode).toBe("sub");
    expect(access.databases.map((database) => database.key)).toEqual(["allowed"]);
    expect(() => findAccessibleDatabase(access, "restricted")).toThrow(/not accessible/i);
  });
});

describe("SQL builders", () => {
  it("quotes identifiers safely", () => {
    expect(quoteIdentifier("student_name")).toBe("\"student_name\"");
    expect(() => quoteIdentifier("student-name")).toThrow(/unsafe identifier/i);
  });

  it("builds filtered select queries with a capped limit", () => {
    const database = makeDatabase({ maxRowsPerQuery: 25 });
    const built = buildSelectRowsQuery(database, {
      table: "students",
      filters: [
        { column: "status", operator: "eq", value: "active" },
        { column: "name", operator: "ilike", value: "%kim%" },
      ],
      orderByColumn: "created_at",
      orderDirection: "desc",
      limit: 999,
    });

    expect(built.schema).toBe("public");
    expect(built.limit).toBe(25);
    expect(built.query).toContain("FROM \"public\".\"students\"");
    expect(built.query).toContain("\"status\" = $1");
    expect(built.query).toContain("\"name\" ILIKE $2");
    expect(built.query).toContain("ORDER BY \"created_at\" DESC");
    expect(built.params).toEqual(["active", "%kim%", 25]);
  });

  it("builds search queries against discovered columns", () => {
    const database = makeDatabase();
    const built = buildSearchRowsQuery(database, {
      table: "students",
      searchTerm: "kim",
    }, ["name", "email"]);

    expect(built.query).toContain("CAST(\"name\" AS TEXT) ILIKE $1");
    expect(built.query).toContain("CAST(\"email\" AS TEXT) ILIKE $1");
    expect(built.params).toEqual(["%kim%", 50]);
  });
});
