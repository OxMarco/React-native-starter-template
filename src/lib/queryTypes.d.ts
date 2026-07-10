import type { AppError } from './appError';

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
    defaultError: AppError;
    queryMeta: AppQueryMeta;
    mutationMeta: AppMutationMeta;
  }
}

export {};
