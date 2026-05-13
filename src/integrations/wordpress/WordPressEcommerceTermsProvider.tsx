import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { cn, decodeHtmlEntities } from "@/lib/utils"
import type { EcommerceTerm } from "./types";
import { DEFAULT_ECOMMERCE_TERM_EMBEDS, DEFAULT_ECOMMERCE_TERM_FIELDS } from "./types";
import { WP_Term_Query, type WP_Term_Query_Vars } from "./wp_term_query";

declare global {
    const wvcClient: any;
}


type TermQueryParams = Record<string, any>;

interface EcommerceTermsContextType {
    // data
    terms: EcommerceTerm[];
    total: number;
    totalPages: number;

    // status
    loading: boolean;
    isRefetching: boolean;
    error: string | null;

    // current query state (editable from children)
    wp_term_query: WP_Term_Query | null;
    query: TermQueryParams; // Derived from wp_term_query.query_vars for backward compatibility
    embeds: string[];
    fields: string[];

    /**
     * Mutation helpers (children can drive queries)
     *
     * - setWPTermQuery: sets or updates the WP_Term_Query object
     * - setQuery: merges into the existing query by default (update mode). Pass a function to fully replace.
     * - setEmbeds: replaces the entire array by default (reset mode). Pass a function to update/merge manually.
     * - setFields: same as setEmbeds — replace by default, update if you pass a function.
     */
    setWPTermQuery: (next: WP_Term_Query | ((prev: WP_Term_Query | null) => WP_Term_Query)) => void;
    setQuery: (next: Partial<TermQueryParams> | ((prev: TermQueryParams) => TermQueryParams)) => void;
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

    // network
    refetch: () => Promise<void>;
    fetch: (opts?: {
        wp_term_query?: WP_Term_Query | Partial<TermQueryParams>;
        embeds?: string[];
        fields?: string[];
        append?: boolean;
        refresh?: boolean; // force isRefresh mode
    }) => Promise<void>;
}

// Convert a single WP REST term into our EcommerceTerm type.
// WooCommerce returns category images as { image: { src, alt, id } }.
const normalizeEcommerceTerm = (raw: any): EcommerceTerm => {
    const name = decodeHtmlEntities(raw?.name ?? String(raw?.name || "Untitled"));

    const link = raw?.resolved_url || raw?.link || raw?.url || undefined;

    const image_url =
        raw?.image?.src ??
        raw?.image_url ??
        undefined;

    return {
        id: String(raw?.id ?? raw?.ID),
        name: String(name),
        slug: raw?.slug,
        taxonomy: String(raw?.taxonomy ?? ""),
        image_url,
        link,
    };
};

export const convertWPResponseToEcommerceTerms = (input: any): EcommerceTerm[] => {
    if (!Array.isArray(input)) return [];
    return input.map(normalizeEcommerceTerm);
};

const EcommerceTermsContext = createContext<EcommerceTermsContextType | null>(null);

// hack to return the products as a property, instead of posts property for consumers
export const useEcommerceTerms = (): EcommerceTermsContextType & { terms: EcommerceTerm[] } => {
    const ctx = useContext(EcommerceTermsContext);
    if (!ctx) throw new Error("useEcommerceTerms must be used within a WordPressEcommerceTermsProvider");
    return {
        ...ctx,
        terms: ctx.terms,
    };
};

type WordPressEcommerceTermsProviderProps = {
    children: React.ReactNode;
    taxonomy?: string;      // taxonomy to fetch (defaults to 'product_cat')
    wp_term_query?: WP_Term_Query | TermQueryParams; // WP_Term_Query object or initial query args (for backward compatibility)
} & React.HTMLAttributes<HTMLDivElement>;

const WordPressEcommerceTermsProvider = ({
    children,
    taxonomy = 'product_cat',
    wp_term_query: wp_term_query_prop,
    ...divProps
}: WordPressEcommerceTermsProviderProps) => {
    // Convert wp_term_query prop to WP_Term_Query object if it's not already
    // Ensure taxonomy is set from taxonomy prop if not already in wp_term_query
    const initialWPTermQuery = useMemo(() => {
        let query: WP_Term_Query;
        if (wp_term_query_prop instanceof WP_Term_Query) {
            query = wp_term_query_prop;
        } else if (wp_term_query_prop && typeof wp_term_query_prop === 'object') {
            // Convert plain object to WP_Term_Query
            query = new WP_Term_Query(wp_term_query_prop as WP_Term_Query_Vars);
        } else {
            query = new WP_Term_Query({});
        }
        
        // Ensure taxonomy is set from taxonomy prop if not already in query
        // Taxonomy should be in query_vars from getCurrentWPTermQueryParams(), but fallback to prop
        if (!query.query_vars.taxonomy || query.query_vars.taxonomy === null) {
            query.query_vars.taxonomy = taxonomy;
        }
        
        return query;
    }, [wp_term_query_prop, taxonomy]);

    // Editable query state (seeded from props)
    const [wp_term_query, setWPTermQueryState] = useState<WP_Term_Query | null>(initialWPTermQuery);
    const [embedsState, setEmbedsState] = useState<string[]>(DEFAULT_ECOMMERCE_TERM_EMBEDS);
    const [fieldsState, setFieldsState] = useState<string[]>(DEFAULT_ECOMMERCE_TERM_FIELDS);

    // Derived query params from wp_term_query.query_vars for backward compatibility
    const query = useMemo(() => {
        return wp_term_query?.query_vars || {};
    }, [wp_term_query]);

    // Data + status
    const [terms, setTerms] = useState<EcommerceTerm[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefetching, setIsRefetching] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    const providerInstanceIdRef = useRef<string>(`terms-provider-${Math.random().toString(36).slice(2, 10)}`);
    const activeRequestKeyRef = useRef<string>("");

    // Sync state when parent passes a new query (by content so query-driven providers reliably refresh)
    const wp_term_query_prop_hash = wp_term_query_prop?.getHash?.() ?? "";
    useEffect(() => {
        if (wp_term_query_prop instanceof WP_Term_Query) {
            if (!wp_term_query_prop.query_vars.taxonomy || wp_term_query_prop.query_vars.taxonomy === null) {
                wp_term_query_prop.query_vars.taxonomy = taxonomy;
            }
            setWPTermQueryState(wp_term_query_prop);
        } else if (wp_term_query_prop && typeof wp_term_query_prop === 'object') {
            const nextQuery = new WP_Term_Query(wp_term_query_prop as WP_Term_Query_Vars);
            if (!nextQuery.query_vars.taxonomy || nextQuery.query_vars.taxonomy === null) {
                nextQuery.query_vars.taxonomy = taxonomy;
            }
            setWPTermQueryState(nextQuery);
        } else {
            const nextQuery = new WP_Term_Query({});
            nextQuery.query_vars.taxonomy = taxonomy;
            setWPTermQueryState(nextQuery);
        }
    }, [wp_term_query_prop_hash, wp_term_query_prop, taxonomy]);

    const handleError = useCallback((e?: unknown) => {
        const msg = (e as any)?.message ?? String(e);
        setError(msg);
    }, []);

    const effectiveDeps = [
        wp_term_query?.getHash() || JSON.stringify(query),
        JSON.stringify(embedsState),
        JSON.stringify(fieldsState),
    ];

    const fetch = (opts?: {
        wp_term_query?: WP_Term_Query | Partial<TermQueryParams>;
        embeds?: string[];
        fields?: string[];
        append?: boolean;
        refresh?: boolean;
        flushCache?: boolean;
    }): Promise<void> => {
        const isRefresh = Boolean(opts?.refresh);
        const shouldFlushCache = Boolean(opts?.flushCache);
        if (isRefresh && isRefetching) return Promise.resolve();

        setError(null);
        if (isRefresh) setIsRefetching(true);
        else setLoading(true);

        // Determine which WP_Term_Query to use
        let queryToUse: WP_Term_Query;
        if (opts?.wp_term_query instanceof WP_Term_Query) {
            queryToUse = opts.wp_term_query;
        } else if (opts?.wp_term_query && typeof opts.wp_term_query === 'object') {
            // Merge partial query params into current wp_term_query
            const currentQuery = wp_term_query || new WP_Term_Query({});
            const mergedVars = { ...currentQuery.query_vars, ...opts.wp_term_query };
            queryToUse = new WP_Term_Query(mergedVars);
        } else {
            queryToUse = wp_term_query || new WP_Term_Query({});
        }

        // Ensure query vars are parsed
        queryToUse.parse_query(queryToUse.query_vars);

        // Extract taxonomy from wp_term_query, fallback to taxonomy prop
        const queryTaxonomy = queryToUse.query_vars.taxonomy;
        const effectiveTaxonomy = (queryTaxonomy && typeof queryTaxonomy === "string") 
            ? queryTaxonomy 
            : (Array.isArray(queryTaxonomy) && queryTaxonomy.length > 0 && typeof queryTaxonomy[0] === "string")
                ? queryTaxonomy[0]
                : taxonomy;
        queryToUse.query_vars.taxonomy = effectiveTaxonomy;

        const usedEmbeds = opts?.embeds ?? embedsState;
        const usedFields = opts?.fields ?? fieldsState;
        const requestHash = JSON.stringify({
            query: queryToUse.toJSON(),
            taxonomy: effectiveTaxonomy,
            embeds: usedEmbeds,
            fields: usedFields,
            append: Boolean(opts?.append),
            refresh: isRefresh,
        });
        const requestKey = `${providerInstanceIdRef.current}:${requestHash}`;
        activeRequestKeyRef.current = requestKey;

        // Use get_wp_term_query_results
        // taxonomy is already in wp_term_query.query_vars (from getCurrentWPTermQueryParams() or prop)
        return wvcClient?.get_wp_term_query_results?.(
            queryToUse.toJSON(),
            {
                embeds: usedEmbeds,
                fields: usedFields,
            },
            shouldFlushCache
        ).then((res: any) => {
            if (activeRequestKeyRef.current !== requestKey) {
                return;
            }
            const normalized = (res?.terms ?? []).map(normalizeEcommerceTerm);
            setTerms(prev => (opts?.append ? [...prev, ...normalized] : normalized));
            setTotal(Number(res?.total ?? 0));
            setTotalPages(Number(res?.total_pages ?? 0));
        }).catch((e: any) => {
            if (activeRequestKeyRef.current !== requestKey) {
                return;
            }
            handleError(e);
        }).finally(() => {
            if (activeRequestKeyRef.current !== requestKey) {
                return;
            }
            if (isRefresh) setIsRefetching(false);
            else setLoading(false);
        });
    };

    // Initial + reactive fetch when query knobs change
    useEffect(() => {
        fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, effectiveDeps);

    // Setup event listener for external refresh events (mount/unmount only)
    useEffect(() => {
        const handleTermsRefresh = () => {
            refetch(true);
        };
        window.addEventListener("WVC_TERMS_REFRESH", handleTermsRefresh);

        // Cleanup function
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            window.removeEventListener("WVC_TERMS_REFRESH", handleTermsRefresh);
        };
    }, []);

    const refetch = (flushCache = false): Promise<void> => {
        // Create new AbortController for refetch
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        return fetch({ refresh: true, flushCache });
    };

    // Expose convenient setters to children
    const setWPTermQuery: EcommerceTermsContextType["setWPTermQuery"] = (next) => {
        setWPTermQueryState(prev => {
            if (typeof next === "function") {
                return (next as any)(prev);
            } else {
                return next;
            }
        });
    };

    const setQuery: EcommerceTermsContextType["setQuery"] = (next) => {
        setWPTermQueryState(prev => {
            const currentQuery = prev || new WP_Term_Query({});
            const updatedVars = typeof next === "function" 
                ? (next as any)(currentQuery.query_vars)
                : { ...currentQuery.query_vars, ...next };
            return new WP_Term_Query(updatedVars);
        });
    };

    const setEmbeds: EcommerceTermsContextType["setEmbeds"] = (next) => {
        setEmbedsState(prev => (typeof next === "function" ? (next as any)(prev) : next));
    };

    const setFields: EcommerceTermsContextType["setFields"] = (next) => {
        setFieldsState(prev => (typeof next === "function" ? (next as any)(prev) : next));
    };

    // Pagination helpers derived from current query & totals
    const currentPage = Number(query?.page ?? 1) || 1;
    const hasNext = currentPage < (totalPages || 0);
    const hasPrev = currentPage > 1;

    const setPage = (page: number) => {
        const pageNum = Math.max(1, Math.floor(page || 1));
        setWPTermQueryState(prev => {
            const currentQuery = prev || new WP_Term_Query({});
            currentQuery.query_vars.page = pageNum;
            return new WP_Term_Query(currentQuery.query_vars);
        });
    };
    const nextPage = () => hasNext && setPage(currentPage + 1);
    const prevPage = () => hasPrev && setPage(currentPage - 1);
    
    // Load more: fetches next page and appends to existing terms
    const loadMore = async (): Promise<void> => {
        if (!hasNext) return;
        const nextPageNum = currentPage + 1;
        // Fetch with append=true to add to existing terms, without triggering setPage
        // which would cause a full refresh
        await fetch({ 
            wp_term_query: { page: nextPageNum },
            append: true 
        });
        // Update the page in wp_term_query after successful fetch
        setWPTermQueryState(prev => {
            if (!prev) {
                const newQuery = new WP_Term_Query({});
                newQuery.query_vars.page = nextPageNum;
                return newQuery;
            }
            prev.query_vars.page = nextPageNum;
            return new WP_Term_Query(prev.query_vars);
        });
    };

    const value: EcommerceTermsContextType = useMemo(() => ({
        // data
        terms,
        total,
        totalPages,

        // status
        loading,
        isRefetching,
        error,

        // state
        wp_term_query,
        query,
        embeds: embedsState,
        fields: fieldsState,

        // setters
        setWPTermQuery,
        setQuery,
        setEmbeds,
        setFields,

        // pagination
        hasNext,
        hasPrev,
        currentPage,
        setPage,
        nextPage,
        prevPage,
        loadMore,

        // network
        refetch,
        fetch,
    }), [
        terms,
        total,
        totalPages,
        loading,
        isRefetching,
        error,
        wp_term_query,
        query,
        embedsState,
        fieldsState,
        hasNext,
        hasPrev,
        currentPage,
    ]);

    return (
        <EcommerceTermsContext.Provider value={value}>
            <div
                {...divProps}
                data-wvc-dynamic="EcommerceTermsProvider"
            >
                {children}
            </div>
        </EcommerceTermsContext.Provider>
    );
};

export { WordPressEcommerceTermsProvider, WordPressEcommerceTermsProvider as EcommerceTermsProvider };