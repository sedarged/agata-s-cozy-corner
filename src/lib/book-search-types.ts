// Shared book-search types. Imported by both the client wrapper (book-search.ts)
// and the server implementation (book-search.server.ts) so neither has to import
// the other.
export type BookSearchSource = "openlibrary" | "google" | "bn";

export interface BookSearchResult {
  source: BookSearchSource;
  external_id: string;
  title: string;
  subtitle?: string;
  author: string;
  authors?: string[];
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  cover_url?: string;
  description?: string;
  page_count?: number;
  published_date?: string;
  category?: string;
  subjects?: string[];
  publisher?: string;
  language?: string;
  rating?: number;
  ratings_count?: number;
  edition_count?: number;
  first_sentence?: string;
  preview_url?: string;
  info_url?: string;
  buy_url?: string;
  read_online_url?: string;
  maturity_rating?: string;
}
