import { z } from "zod";
export declare const projectExecutionWorkspacePolicySchema: any;
export declare const projectWorkspaceRuntimeConfigSchema: any;
export declare const createProjectWorkspaceSchema: any;
export type CreateProjectWorkspace = z.infer<typeof createProjectWorkspaceSchema>;
export declare const updateProjectWorkspaceSchema: any;
export type UpdateProjectWorkspace = z.infer<typeof updateProjectWorkspaceSchema>;
export declare const createProjectSchema: any;
export type CreateProject = z.infer<typeof createProjectSchema>;
export declare const updateProjectSchema: any;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ProjectExecutionWorkspacePolicy = z.infer<typeof projectExecutionWorkspacePolicySchema>;
//# sourceMappingURL=project.d.ts.map