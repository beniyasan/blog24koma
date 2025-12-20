type PagesFunction<Env = unknown> = (context: { request: Request; env: Env }) => Response | Promise<Response>;

type KVNamespace = any;

type D1Database = any;
