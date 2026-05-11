import { createCipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT_DIR = process.cwd();
const ENV_PATH = path.join(ROOT_DIR, ".env");
const POSTGRES_MODULE_PATH = path.join(
  ROOT_DIR,
  "node_modules",
  ".pnpm",
  "postgres@3.4.8",
  "node_modules",
  "postgres",
  "src",
  "index.js",
);
const PLUGIN_PACKAGE_PATH = path.join(
  ROOT_DIR,
  "packages",
  "plugins",
  "examples",
  "plugin-supabase-readonly-example",
);
const PLUGIN_MANIFEST_PATH = path.join(PLUGIN_PACKAGE_PATH, "dist", "manifest.js");
const PLUGIN_PACKAGE_JSON_PATH = path.join(PLUGIN_PACKAGE_PATH, "package.json");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = { configPath: null, dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--config") {
      const next = argv[index + 1];
      if (!next) fail("Missing value for --config");
      args.configPath = path.resolve(next);
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${token}`);
  }

  return args;
}

function readDatabaseUrl() {
  const env = fs.readFileSync(ENV_PATH, "utf8");
  const databaseUrl = env
    .split(/\r?\n/)
    .find((line) => line.startsWith("DATABASE_URL="))
    ?.slice("DATABASE_URL=".length)
    ?.trim();

  if (!databaseUrl) fail("DATABASE_URL not found in .env");
  return databaseUrl;
}

function decodeMasterKey(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // ignored
  }

  if (Buffer.byteLength(trimmed, "utf8") === 32) {
    return Buffer.from(trimmed, "utf8");
  }
  return null;
}

function resolveMasterKeyFilePath() {
  const fromEnv = process.env.AUTOMANAGER_SECRETS_MASTER_KEY_FILE;
  if (fromEnv && fromEnv.trim().length > 0) return path.resolve(fromEnv.trim());
  return path.resolve(ROOT_DIR, "data", "secrets", "master.key");
}

function loadOrCreateMasterKey() {
  const rawEnvKey = process.env.AUTOMANAGER_SECRETS_MASTER_KEY;
  if (rawEnvKey && rawEnvKey.trim().length > 0) {
    const decoded = decodeMasterKey(rawEnvKey);
    if (!decoded) fail("Invalid AUTOMANAGER_SECRETS_MASTER_KEY");
    return decoded;
  }

  const keyPath = resolveMasterKeyFilePath();
  if (fs.existsSync(keyPath)) {
    const decoded = decodeMasterKey(fs.readFileSync(keyPath, "utf8"));
    if (!decoded) fail(`Invalid secrets master key at ${keyPath}`);
    return decoded;
  }

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  const generated = randomBytes(32);
  fs.writeFileSync(keyPath, generated.toString("base64"), { encoding: "utf8", mode: 0o600 });
  return generated;
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function encryptValue(masterKey, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    scheme: "local_encrypted_v1",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function toSecretName(database) {
  if (database.connectionStringSecretName) return database.connectionStringSecretName;
  const key = String(database.key ?? "").trim();
  if (!key) fail("Each database entry must have a key");
  return `SUPABASE_${key.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase()}_READONLY_URL`;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    fail("Config file must contain a JSON object");
  }

  const config = rawConfig;
  const databases = normalizeArray(config.databases).map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`databases[${index}] must be an object`);
    }
    const database = entry;
    if (!database.key || typeof database.key !== "string") {
      fail(`databases[${index}].key is required`);
    }

    if (
      database.connectionString == null &&
      database.connectionStringSecretId == null &&
      database.connectionStringSecretName == null
    ) {
      fail(
        `databases[${index}] needs one of connectionString, connectionStringSecretId, or connectionStringSecretName`,
      );
    }

    return {
      key: database.key,
      displayName: typeof database.displayName === "string" ? database.displayName : database.key,
      connectionString: typeof database.connectionString === "string" ? database.connectionString : null,
      connectionStringSecretId:
        typeof database.connectionStringSecretId === "string" ? database.connectionStringSecretId : null,
      connectionStringSecretName:
        typeof database.connectionStringSecretName === "string"
          ? database.connectionStringSecretName
          : null,
      defaultSchema: typeof database.defaultSchema === "string" ? database.defaultSchema : "public",
      allowedSchemas: normalizeArray(database.allowedSchemas).filter((value) => typeof value === "string"),
      allowSubAgents: database.allowSubAgents !== false,
      maxRowsPerQuery:
        typeof database.maxRowsPerQuery === "number" ? Math.trunc(database.maxRowsPerQuery) : 50,
      statementTimeoutMs:
        typeof database.statementTimeoutMs === "number" ? Math.trunc(database.statementTimeoutMs) : 10000,
    };
  });

  return {
    companyId: typeof config.companyId === "string" ? config.companyId : null,
    mainAgentIds: normalizeArray(config.mainAgentIds).filter((value) => typeof value === "string"),
    defaultMaxRowsPerQuery:
      typeof config.defaultMaxRowsPerQuery === "number" ? Math.trunc(config.defaultMaxRowsPerQuery) : 50,
    defaultStatementTimeoutMs:
      typeof config.defaultStatementTimeoutMs === "number"
        ? Math.trunc(config.defaultStatementTimeoutMs)
        : 10000,
    databases,
  };
}

async function loadRuntime() {
  const [{ default: postgres }, { default: manifest }] = await Promise.all([
    import(pathToFileURL(POSTGRES_MODULE_PATH).href),
    import(pathToFileURL(PLUGIN_MANIFEST_PATH).href),
  ]);
  const packageJson = JSON.parse(fs.readFileSync(PLUGIN_PACKAGE_JSON_PATH, "utf8"));
  return { postgres, manifest, packageJson };
}

async function getCurrentState(sql) {
  const companies = await sql.unsafe(`
    select id, name, status
    from companies
    order by created_at desc
  `);
  const rootAgents = await sql.unsafe(`
    select id, company_id, name, status
    from agents
    where reports_to is null
    order by created_at desc
  `);
  const plugin = await sql.unsafe(`
    select id, plugin_key, status
    from plugins
    where plugin_key = 'automanager.supabase-readonly-example'
    limit 1
  `);

  return {
    companies,
    rootAgents,
    plugin: plugin[0] ?? null,
  };
}

async function ensurePluginInstalled(sql, manifest, packageJson, dryRun) {
  const pluginRows = await sql.unsafe(
    `
      select id
      from plugins
      where plugin_key = $1
      limit 1
    `,
    [manifest.id],
  );

  const packagePath = PLUGIN_PACKAGE_PATH;
  const packageName = packageJson.name;

  if (pluginRows.length > 0) {
    const pluginId = pluginRows[0].id;
    if (!dryRun) {
      await sql.unsafe(
        `
          update plugins
          set
            package_name = $2,
            version = $3,
            api_version = $4,
            categories = $5::jsonb,
            manifest_json = $6::jsonb,
            status = 'ready',
            package_path = $7,
            last_error = null,
            updated_at = now()
          where id = $1
        `,
        [
          pluginId,
          packageName,
          manifest.version,
          manifest.apiVersion,
          JSON.stringify(manifest.categories ?? []),
          JSON.stringify(manifest),
          packagePath,
        ],
      );
    }
    return pluginId;
  }

  const nextOrderRows = await sql.unsafe(`
    select coalesce(max(install_order), 0) + 1 as next_install_order
    from plugins
  `);
  const nextInstallOrder = Number(nextOrderRows[0]?.next_install_order ?? 1);

  if (dryRun) {
    return "__dry_run_plugin_id__";
  }

  const inserted = await sql.unsafe(
    `
      insert into plugins (
        plugin_key,
        package_name,
        version,
        api_version,
        categories,
        manifest_json,
        status,
        install_order,
        package_path
      )
      values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'ready', $7, $8)
      returning id
    `,
    [
      manifest.id,
      packageName,
      manifest.version,
      manifest.apiVersion,
      JSON.stringify(manifest.categories ?? []),
      JSON.stringify(manifest),
      nextInstallOrder,
      packagePath,
    ],
  );

  return inserted[0].id;
}

async function resolveCompanyId(sql, desiredCompanyId) {
  if (desiredCompanyId) {
    const rows = await sql.unsafe(
      `
        select id, name
        from companies
        where id = $1
        limit 1
      `,
      [desiredCompanyId],
    );
    if (rows.length === 0) fail(`Company not found: ${desiredCompanyId}`);
    return rows[0].id;
  }

  const rows = await sql.unsafe(`
    select id
    from companies
    order by created_at desc
    limit 1
  `);
  if (rows.length === 0) fail("No company found in app database");
  return rows[0].id;
}

async function resolveSecretId(sql, companyId, database, masterKey, dryRun) {
  if (database.connectionStringSecretId) {
    return database.connectionStringSecretId;
  }

  const secretName = toSecretName(database);
  const existingRows = await sql.unsafe(
    `
      select id, latest_version
      from company_secrets
      where company_id = $1
        and name = $2
      limit 1
    `,
    [companyId, secretName],
  );

  if (database.connectionString == null) {
    if (dryRun) {
      return `__dry_run_secret_${database.key}__`;
    }
    if (existingRows.length === 0) {
      fail(`Secret not found for ${database.key}: ${secretName}`);
    }
    return existingRows[0].id;
  }

  const material = encryptValue(masterKey, database.connectionString);
  const valueSha256 = sha256Hex(database.connectionString);

  if (existingRows.length === 0) {
    if (dryRun) {
      return `__dry_run_secret_${database.key}__`;
    }

    const insertedSecrets = await sql.unsafe(
      `
        insert into company_secrets (
          company_id,
          name,
          provider,
          latest_version,
          description,
          created_by_user_id
        )
        values ($1, $2, 'local_encrypted', 1, $3, 'board')
        returning id
      `,
      [
        companyId,
        secretName,
        `Read-only Supabase Postgres connection string for ${database.displayName}`,
      ],
    );

    const secretId = insertedSecrets[0].id;
    await sql.unsafe(
      `
        insert into company_secret_versions (
          secret_id,
          version,
          material,
          value_sha256,
          created_by_user_id
        )
        values ($1, 1, $2::jsonb, $3, 'board')
      `,
      [secretId, JSON.stringify(material), valueSha256],
    );
    return secretId;
  }

  const existing = existingRows[0];
  const nextVersion = Number(existing.latest_version) + 1;

  if (dryRun) {
    return existing.id;
  }

  await sql.unsafe(
    `
      insert into company_secret_versions (
        secret_id,
        version,
        material,
        value_sha256,
        created_by_user_id
      )
      values ($1, $2, $3::jsonb, $4, 'board')
    `,
    [existing.id, nextVersion, JSON.stringify(material), valueSha256],
  );
  await sql.unsafe(
    `
      update company_secrets
      set latest_version = $2, updated_at = now()
      where id = $1
    `,
    [existing.id, nextVersion],
  );
  return existing.id;
}

async function upsertPluginConfig(sql, pluginId, configJson, dryRun) {
  if (dryRun) return;

  const existingRows = await sql.unsafe(
    `
      select id
      from plugin_config
      where plugin_id = $1
      limit 1
    `,
    [pluginId],
  );

  if (existingRows.length > 0) {
    await sql.unsafe(
      `
        update plugin_config
        set config_json = $2::jsonb, last_error = null, updated_at = now()
        where plugin_id = $1
      `,
      [pluginId, JSON.stringify(configJson)],
    );
    return;
  }

  await sql.unsafe(
    `
      insert into plugin_config (plugin_id, config_json)
      values ($1, $2::jsonb)
    `,
    [pluginId, JSON.stringify(configJson)],
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { postgres, manifest, packageJson } = await loadRuntime();
  const databaseUrl = readDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    const state = await getCurrentState(sql);
    const rawConfig = args.configPath
      ? JSON.parse(fs.readFileSync(args.configPath, "utf8"))
      : { mainAgentIds: [], databases: [] };
    const normalized = normalizeConfig(rawConfig);
    const companyId = await resolveCompanyId(sql, normalized.companyId);
    const masterKey = loadOrCreateMasterKey();
    const pluginId = await ensurePluginInstalled(sql, manifest, packageJson, args.dryRun);

    const databases = [];
    for (const database of normalized.databases) {
      const secretId = await resolveSecretId(sql, companyId, database, masterKey, args.dryRun);
      databases.push({
        key: database.key,
        displayName: database.displayName,
        connectionStringSecretRef: secretId,
        defaultSchema: database.defaultSchema,
        allowedSchemas: database.allowedSchemas,
        allowSubAgents: database.allowSubAgents,
        maxRowsPerQuery: database.maxRowsPerQuery,
        statementTimeoutMs: database.statementTimeoutMs,
      });
    }

    const pluginConfig = {
      mainAgentIds: normalized.mainAgentIds,
      defaultMaxRowsPerQuery: normalized.defaultMaxRowsPerQuery,
      defaultStatementTimeoutMs: normalized.defaultStatementTimeoutMs,
      databases,
    };

    await upsertPluginConfig(sql, pluginId, pluginConfig, args.dryRun);

    console.log(
      JSON.stringify(
        {
          dryRun: args.dryRun,
          selectedCompanyId: companyId,
          installedPluginId: pluginId,
          companies: state.companies,
          rootAgents: state.rootAgents,
          pluginConfig,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}

await main();
