import { z } from "zod";
export declare const envBindingPlainSchema: any;
export declare const envBindingSecretRefSchema: any;
export declare const envBindingSchema: any;
export declare const envConfigSchema: any;
export declare const createSecretSchema: any;
export type CreateSecret = z.infer<typeof createSecretSchema>;
export declare const rotateSecretSchema: any;
export type RotateSecret = z.infer<typeof rotateSecretSchema>;
export declare const updateSecretSchema: any;
export type UpdateSecret = z.infer<typeof updateSecretSchema>;
//# sourceMappingURL=secret.d.ts.map