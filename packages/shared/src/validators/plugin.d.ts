import { z } from "zod";
/**
 * Permissive validator for JSON Schema objects. Accepts any `Record<string, unknown>`
 * that contains at least a `type`, `$ref`, or composition keyword (`oneOf`/`anyOf`/`allOf`).
 * Empty objects are also accepted.
 *
 * Used to validate `instanceConfigSchema` and `parametersSchema` fields in the
 * plugin manifest without fully parsing JSON Schema.
 *
 * @see PLUGIN_SPEC.md §10.1 — Manifest shape
 */
export declare const jsonSchemaSchema: any;
export declare const pluginJobDeclarationSchema: any;
export type PluginJobDeclarationInput = z.infer<typeof pluginJobDeclarationSchema>;
/**
 * Validates a {@link PluginWebhookDeclaration} — a webhook endpoint declared
 * in the plugin manifest. Requires `endpointKey` and `displayName`.
 *
 * @see PLUGIN_SPEC.md §18 — Webhooks
 */
export declare const pluginWebhookDeclarationSchema: any;
export type PluginWebhookDeclarationInput = z.infer<typeof pluginWebhookDeclarationSchema>;
/**
 * Validates a {@link PluginToolDeclaration} — an agent tool contributed by the
 * plugin. Requires `name`, `displayName`, `description`, and a valid
 * `parametersSchema`. Requires the `agent.tools.register` capability.
 *
 * @see PLUGIN_SPEC.md §11 — Agent Tools
 */
export declare const pluginToolDeclarationSchema: any;
export type PluginToolDeclarationInput = z.infer<typeof pluginToolDeclarationSchema>;
/**
 * Validates a {@link PluginUiSlotDeclaration} — a UI extension slot the plugin
 * fills with a React component. Includes `superRefine` checks for slot-specific
 * requirements such as `entityTypes` for context-sensitive slots.
 *
 * @see PLUGIN_SPEC.md §19 — UI Extension Model
 */
export declare const pluginUiSlotDeclarationSchema: any;
export type PluginUiSlotDeclarationInput = z.infer<typeof pluginUiSlotDeclarationSchema>;
/**
 * Validates the action payload for a declarative plugin launcher.
 */
export declare const pluginLauncherActionDeclarationSchema: any;
export type PluginLauncherActionDeclarationInput = z.infer<typeof pluginLauncherActionDeclarationSchema>;
/**
 * Validates optional render hints for a plugin launcher destination.
 */
export declare const pluginLauncherRenderDeclarationSchema: any;
export type PluginLauncherRenderDeclarationInput = z.infer<typeof pluginLauncherRenderDeclarationSchema>;
/**
 * Validates declarative launcher metadata in a plugin manifest.
 */
export declare const pluginLauncherDeclarationSchema: any;
export type PluginLauncherDeclarationInput = z.infer<typeof pluginLauncherDeclarationSchema>;
/**
 * Zod schema for {@link PaperclipPluginManifestV1} — the complete runtime
 * validator for plugin manifests read at install time.
 *
 * Field-level constraints (see PLUGIN_SPEC.md §10.1 for the normative rules):
 *
 * | Field                    | Type       | Constraints                                  |
 * |--------------------------|------------|----------------------------------------------|
 * | `id`                     | string     | `^[a-z0-9][a-z0-9._-]*$`                    |
 * | `apiVersion`             | literal 1  | must equal `PLUGIN_API_VERSION`              |
 * | `version`                | string     | semver (`\d+\.\d+\.\d+`)                    |
 * | `displayName`            | string     | 1–100 chars                                  |
 * | `description`            | string     | 1–500 chars                                  |
 * | `author`                 | string     | 1–200 chars                                  |
 * | `categories`             | enum[]     | at least one; values from PLUGIN_CATEGORIES  |
 * | `minimumHostVersion`     | string?    | semver lower bound if present, no leading `v`|
 * | `minimumPaperclipVersion`| string?    | legacy alias of `minimumHostVersion`         |
 * | `capabilities`           | enum[]     | at least one; values from PLUGIN_CAPABILITIES|
 * | `entrypoints.worker`     | string     | min 1 char                                   |
 * | `entrypoints.ui`         | string?    | required when `ui.slots` is declared         |
 *
 * Cross-field rules enforced via `superRefine`:
 * - `entrypoints.ui` required when `ui.slots` declared
 * - `agent.tools.register` capability required when `tools` declared
 * - `jobs.schedule` capability required when `jobs` declared
 * - `webhooks.receive` capability required when `webhooks` declared
 * - duplicate `jobs[].jobKey` values are rejected
 * - duplicate `webhooks[].endpointKey` values are rejected
 * - duplicate `tools[].name` values are rejected
 * - duplicate `ui.slots[].id` values are rejected
 *
 * @see PLUGIN_SPEC.md §10.1 — Manifest shape
 * @see {@link PaperclipPluginManifestV1} — the inferred TypeScript type
 */
export declare const pluginManifestV1Schema: any;
export type PluginManifestV1Input = z.infer<typeof pluginManifestV1Schema>;
/**
 * Schema for installing (registering) a plugin.
 * The server receives the packageName and resolves the manifest from the
 * installed package.
 */
export declare const installPluginSchema: any;
export type InstallPlugin = z.infer<typeof installPluginSchema>;
/**
 * Schema for creating or updating a plugin's instance configuration.
 * configJson is validated permissively here; runtime validation against
 * the plugin's instanceConfigSchema is done at the service layer.
 */
export declare const upsertPluginConfigSchema: any;
export type UpsertPluginConfig = z.infer<typeof upsertPluginConfigSchema>;
/**
 * Schema for partially updating a plugin's instance configuration.
 * Allows a partial merge of config values.
 */
export declare const patchPluginConfigSchema: any;
export type PatchPluginConfig = z.infer<typeof patchPluginConfigSchema>;
/**
 * Schema for updating a plugin's lifecycle status. Used by the lifecycle
 * manager to persist state transitions.
 *
 * @see {@link PLUGIN_STATUSES} for the valid status values
 */
export declare const updatePluginStatusSchema: any;
export type UpdatePluginStatus = z.infer<typeof updatePluginStatusSchema>;
/** Schema for the uninstall request. `removeData` controls hard vs soft delete. */
export declare const uninstallPluginSchema: any;
export type UninstallPlugin = z.infer<typeof uninstallPluginSchema>;
/**
 * Schema for a plugin state scope key — identifies the exact location where
 * state is stored. Used by the `ctx.state.get()`, `ctx.state.set()`, and
 * `ctx.state.delete()` SDK methods.
 *
 * @see PLUGIN_SPEC.md §21.3 `plugin_state`
 */
export declare const pluginStateScopeKeySchema: any;
export type PluginStateScopeKey = z.infer<typeof pluginStateScopeKeySchema>;
/**
 * Schema for setting a plugin state value.
 */
export declare const setPluginStateSchema: any;
export type SetPluginState = z.infer<typeof setPluginStateSchema>;
/**
 * Schema for querying plugin state entries. All fields are optional to allow
 * flexible list queries (e.g. all state for a plugin within a scope).
 */
export declare const listPluginStateSchema: any;
export type ListPluginState = z.infer<typeof listPluginStateSchema>;
//# sourceMappingURL=plugin.d.ts.map