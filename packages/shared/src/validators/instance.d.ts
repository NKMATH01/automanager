import { z } from "zod";
export declare const instanceGeneralSettingsSchema: any;
export declare const patchInstanceGeneralSettingsSchema: any;
export declare const instanceExperimentalSettingsSchema: any;
export declare const patchInstanceExperimentalSettingsSchema: any;
export type InstanceGeneralSettings = z.infer<typeof instanceGeneralSettingsSchema>;
export type PatchInstanceGeneralSettings = z.infer<typeof patchInstanceGeneralSettingsSchema>;
export type InstanceExperimentalSettings = z.infer<typeof instanceExperimentalSettingsSchema>;
export type PatchInstanceExperimentalSettings = z.infer<typeof patchInstanceExperimentalSettingsSchema>;
//# sourceMappingURL=instance.d.ts.map