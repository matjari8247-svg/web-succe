import React, { createContext, useContext } from "react";

import type { EcommerceProduct } from "./types";
import type { WP_Query } from "./wp_query";

export type QueryParams = Record<string, any>;

export interface EcommerceProductsContextType {
    // data
    posts: EcommerceProduct[];
    total: number;
    totalPages: number;

    // status
    loading: boolean;
    isRefetching: boolean;
    error: string | null;

    // current query state (editable from children)
    wp_query: WP_Query | null;
    query: QueryParams; // Derived from wp_query.query_vars for backward compatibility
    embeds: string[];
    fields: string[];

    /**
     * Mutation helpers (children can drive queries)
     *
     * - setWPQuery: sets or updates the WP_Query object
     * - setQuery: shallow merge — replaces top-level keys (e.g. orderby, order, paged) only; does not go into
     *   depth of tax_query, meta_query, or date_query (those are preserved from prev unless you pass them at top level).
     *   Pass a function to fully replace query_vars.
     * - setEmbeds: replaces the entire array by default (reset mode). Pass a function to update/merge manually.
     * - setFields: same as setEmbeds — replace by default, update if you pass a function.
     */
    setWPQuery: (next: WP_Query | ((prev: WP_Query | null) => WP_Query)) => void;
    setQuery: (next: Partial<QueryParams> | ((prev: QueryParams) => QueryParams)) => void;
    setEmbeds: (next: string[] | ((prev: string[]) => string[])) => void;
    setFields: (next: string[] | ((prev: string[]) => string[])) => void;

    // pagination helpers
    hasNext: boolean;
    hasPrev: boolean;
    currentPage: number;
    setPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    loadMore: () => Promise<void>;

    // sorting (resets to page 1, preserves tax_query etc.)
    setSorting: (orderby: string, order: "asc" | "desc") => void;

    // network
    refetch: () => Promise<void>;
    fetch: (opts?: {
        wp_query?: WP_Query | Partial<QueryParams>;
        embeds?: string[];
        fields?: string[];
        append?: boolean;
        refresh?: boolean; // force isRefresh mode
    }) => Promise<void>;
}

const EcommerceProductsContext = createContext<EcommerceProductsContextType | null>(null);

/**
 * Hook to access ecommerce products context. Must be used within a WordPressEcommerceProductsProvider.
 * Returns context with a `products` alias for `posts` for consumer convenience.
 */
export const useEcommerceProducts = (): EcommerceProductsContextType & { products: EcommerceProduct[] } => {
    const ctx = useContext(EcommerceProductsContext);
    if (!ctx) throw new Error("useEcommerceProducts must be used within a WordPressEcommerceProductsProvider");
    return {
        ...ctx,
        products: ctx.posts,
    };
};

export { EcommerceProductsContext };