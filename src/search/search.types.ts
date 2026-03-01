export const SEARCH_TYPES = [
  'user',
  'post',
  'tag',
  'category',
] as const;

export type SearchType = typeof SEARCH_TYPES[number];


