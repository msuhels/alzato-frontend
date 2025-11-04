// Deprecated: the axios client has been removed.
// This file now only exposes shared API response types to avoid breaking imports.

export type PaginatedResponse<T> = {
  success?: boolean;
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
 


