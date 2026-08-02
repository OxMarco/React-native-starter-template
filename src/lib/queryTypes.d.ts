type AppQueryMeta = {
  [key: string]: unknown;
  operationName?: string;
  persist?: boolean;
  sensitive?: boolean;
};

type AppMutationMeta = {
  [key: string]: unknown;
  offline?: boolean;
  operationName?: string;
  persist?: boolean;
};

declare module '@tanstack/react-query' {
  interface Register {
    // Query functions are extension points and may throw anything. Consumers
    // must normalize at a UI/reporting boundary instead of being promised an
    // AppError that the type system cannot enforce.
    defaultError: unknown;
    queryMeta: AppQueryMeta;
    mutationMeta: AppMutationMeta;
  }
}

export {};
