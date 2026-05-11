declare module "postgres" {
  export interface SqlClient {
    unsafe<T = unknown>(query: string, params?: readonly unknown[]): Promise<T>;
    end(): Promise<void>;
  }

  export default function postgres(
    connectionString: string,
    options?: Record<string, unknown>,
  ): SqlClient;
}
