// A tiny stand-in for the Supabase client: records each query and answers from a script. No network.
type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

export interface RecordedQuery {
  table: string;
  steps: [string, ...unknown[]][];
}

export function fakeSupabase(answer: (q: RecordedQuery) => Result) {
  const queries: RecordedQuery[] = [];
  const from = (table: string) => {
    const q: RecordedQuery = { table, steps: [] };
    queries.push(q);
    const builder: Record<string, unknown> = {};
    for (const name of ["select", "insert", "update", "upsert", "delete", "eq", "order"]) {
      builder[name] = (...args: unknown[]) => {
        q.steps.push([name, ...args]);
        return builder;
      };
    }
    const finish = (name: string) => () => {
      q.steps.push([name]);
      return Promise.resolve({ data: null, error: null, ...answer(q) });
    };
    builder.single = finish("single");
    builder.maybeSingle = finish("maybeSingle");
    builder.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...answer(q) }).then(resolve, reject);
    return builder;
  };
  return { client: { from } as never, queries };
}
