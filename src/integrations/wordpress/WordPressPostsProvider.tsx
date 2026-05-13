import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { cn, decodeHtmlEntities } from "@/lib/utils"
import type { Term, Author, Post } from "./types";
import { DEFAULT_CPT_EMBEDS, DEFAULT_CPT_FIELDS, DEFAULT_POST_EMBEDS, DEFAULT_POST_FIELDS } from "./types";
import { WP_Query, type WP_Query_Vars } from "./wp_query";

declare global {
    const wvcClient: any;
}

type QueryParams = Record<string, any>;

interface PostsContextType {
    // data
    posts: Post[];
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
     * - setQuery: merges into the existing query by default (update mode). Pass a function to fully replace.
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

// Detect the wvc_ prefix from meta keys when raw.type is unavailable.
// Returns the first matching prefix or undefined.
const detectWvcPrefix = (meta: Record<string, any>): string | undefined => {
    const wvcKey = Object.keys(meta).find(k => k.startsWith("wvc_"));
    if (!wvcKey) return undefined;
    // Keys follow "wvc_{post_type}_{field}" — grab "wvc_{post_type}_"
    const parts = wvcKey.split("_");
    if (parts.length >= 3) {
        return `${parts[0]}_${parts[1]}_`;
    }
    return undefined;
};

// Convert a single WP REST post (with optional _embedded) into our Post type.
// An optional `postTypeHint` can be provided by the caller (e.g. from the
// provider's query context) so the correct meta-key prefix is used even when
// the raw response does not include a `type` field.
const normalizePost = (raw: any, postTypeHint?: string): Post => {
    const title = decodeHtmlEntities(
        raw?.title?.rendered ?? raw?.title ?? raw?.post_title ?? String(raw?.title || raw?.name || "Untitled")
    );
    const excerpt = raw?.excerpt?.rendered ?? raw?.excerpt ?? raw?.post_excerpt ?? undefined;
    const content = raw?.content?.rendered ?? raw?.content ?? raw?.post_content ?? undefined;

    const link = raw?.resolved_url || raw?.link || raw?.permalink || raw?.url || undefined;

    const featuredImage =
        raw?._embedded?.["wp:featuredmedia"]?.[0]?.source_url ??
        raw?.featured_media_url ??
        undefined;

    const authorRaw = raw?._embedded?.author?.[0];
    const author: Author | undefined = authorRaw
        ? {
            id: Number(authorRaw?.id ?? 0),
            name: decodeHtmlEntities(String(authorRaw?.name ?? "")),
            slug: authorRaw?.slug ?? "",
            link: authorRaw?.link,
            avatar: authorRaw?.avatar_urls as Record<string, string> | undefined, // Avatar image URLs keyed by size (e.g., "24", "48", "96")
        }
        : undefined;

    const mapTerm = (t: any): Term => ({
        id: Number(t?.id ?? 0),
        name: decodeHtmlEntities(String(t?.name ?? "")),
        slug: String(t?.slug ?? ""),
        taxonomy: String(t?.taxonomy ?? ""),
        link: t?.link,
    });

    // Category & tag objects from _embedded.wp:term (array of arrays)
    const termGroups: any[][] | undefined = raw?._embedded?.["wp:term"];
    const categories: Term[] | undefined = Array.isArray(termGroups)
        ? termGroups
            .reduce((acc, group) => acc.concat(group), [])
            .filter((t: any) => t && t.taxonomy === "category")
            .map(mapTerm)
        : undefined;
    const tags: Term[] | undefined = Array.isArray(termGroups)
        ? termGroups
            .reduce((acc, group) => acc.concat(group), [])
            .filter((t: any) => t && t.taxonomy === "post_tag")
            .map(mapTerm)
        : undefined;

    // Extract custom fields from individual meta keys (for custom post types)
    // Meta keys follow pattern: wvc_{post_type}_{field_key}
    let customFields: Record<string, any> | undefined = undefined;
    if (raw?.meta) {
        const resolvedType = raw?.type || postTypeHint || "post";
        const prefix = `wvc_${resolvedType}_`;
        const fields: Record<string, any> = {};

        Object.keys(raw.meta).forEach(key => {
            if (key.startsWith(prefix)) {
                const fieldKey = key.replace(prefix, "");
                fields[fieldKey] = raw.meta[key];
            }
        });

        // Fallback: if no fields matched with the resolved prefix, try auto-detecting
        // the prefix from the meta keys themselves (handles cases where the post type
        // hint was wrong or missing).
        if (Object.keys(fields).length === 0) {
            const detected = detectWvcPrefix(raw.meta);
            if (detected && detected !== prefix) {
                Object.keys(raw.meta).forEach(key => {
                    if (key.startsWith(detected)) {
                        const fieldKey = key.replace(detected, "");
                        fields[fieldKey] = raw.meta[key];
                    }
                });
            }
        }

        if (Object.keys(fields).length > 0) {
            customFields = fields;
        }
    }

    return {
        id: String(raw?.id ?? raw?.ID),
        title: String(title),
        slug: raw?.slug,
        excerpt: typeof excerpt === "string" ? excerpt : undefined,
        content: typeof content === "string" ? content : undefined,
        link,
        date: raw?.date || raw?.post_date || undefined,
        author,
        featuredImage,
        categories: categories && categories.length ? categories : undefined,
        tags: tags && tags.length ? tags : undefined,
        customFields: customFields,
    };
};

export const convertWPResponseToPosts = (input: any, postType?: string): Post[] => {
    if (!Array.isArray(input)) return [];
    return input.map((item: any) => normalizePost(item, postType));
};

const PostsContext = createContext<PostsContextType | null>(null);

const usePosts = () => {
    const ctx = useContext(PostsContext);
    if (!ctx) throw new Error("usePosts must be used within a WordPressPostsProvider");
    return ctx;
};

type WordPressPostsProviderProps = {
    children: React.ReactNode;
    postType?: string;      // post type to fetch (defaults to 'post')
    wp_query?: WP_Query | QueryParams; // WP_Query object or initial query args (for backward compatibility)
} & React.HTMLAttributes<HTMLDivElement>;

const WordPressPostsProvider = ({
    children,
    postType = 'post',
    wp_query: wp_query_prop,
    ...divProps
}: WordPressPostsProviderProps) => {
    // Convert wp_query prop to WP_Query object if it's not already
    // Ensure post_type is set from postType prop if not already in wp_query
    const initialWPQuery = useMemo(() => {
        let query: WP_Query;
        if (wp_query_prop instanceof WP_Query) {
            query = wp_query_prop;
        } else if (wp_query_prop && typeof wp_query_prop === 'object') {
            // Convert plain object to WP_Query
            query = new WP_Query(wp_query_prop as WP_Query_Vars);
        } else {
            query = new WP_Query({});
        }

        // Ensure post_type is set from postType prop if not already in query
        if (!query.get("post_type")) {
            query.set("post_type", postType);
        }

        return query;
    }, [wp_query_prop, postType]);



    // Editable query state (seeded from props)
    const [wp_query, setWPQueryState] = useState<WP_Query | null>(initialWPQuery);
    const [embedsState, setEmbedsState] = useState<string[]>(postType === "post" ? DEFAULT_POST_EMBEDS : DEFAULT_CPT_EMBEDS);
    const [fieldsState, setFieldsState] = useState<string[]>(postType === "post" ? DEFAULT_POST_FIELDS : DEFAULT_CPT_FIELDS);

    // Derived query params from wp_query.query_vars for backward compatibility
    const query = useMemo(() => {
        return wp_query?.query_vars || {};
    }, [wp_query]);

    // Data + status
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefetching, setIsRefetching] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    const providerInstanceIdRef = useRef<string>(`posts-provider-${Math.random().toString(36).slice(2, 10)}`);
    const activeRequestKeyRef = useRef<string>("");

    // Sync state when parent passes a new query (by content so search/input-driven providers reliably refresh)
    const wp_query_prop_hash = wp_query_prop?.getHash?.() ?? "";
    useEffect(() => {
        if (wp_query_prop instanceof WP_Query) {
            if (!wp_query_prop.get("post_type")) {
                wp_query_prop.set("post_type", postType);
            }
            setWPQueryState(wp_query_prop);
        } else if (wp_query_prop && typeof wp_query_prop === 'object') {
            const nextQuery = new WP_Query(wp_query_prop as WP_Query_Vars);
            if (!nextQuery.get("post_type")) {
                nextQuery.set("post_type", postType);
            }
            setWPQueryState(nextQuery);
        } else {
            const nextQuery = new WP_Query({});
            nextQuery.set("post_type", postType);
            setWPQueryState(nextQuery);
        }
    }, [wp_query_prop_hash, wp_query_prop, postType]);

    const handleError = (e?: unknown) => {
        const msg = (e as any)?.message ?? String(e);
        setError(msg);
    };

    const effectiveDeps = [
        wp_query?.getHash() || JSON.stringify(query),
        JSON.stringify(embedsState),
        JSON.stringify(fieldsState),
    ];

    const fetch = (opts?: {
        wp_query?: WP_Query | Partial<QueryParams>;
        embeds?: string[];
        fields?: string[];
        append?: boolean;
        refresh?: boolean;
    }): Promise<void> => {
        const isRefresh = Boolean(opts?.refresh);
        if (isRefresh && isRefetching) return Promise.resolve();

        setError(null);
        if (isRefresh) setIsRefetching(true);
        else setLoading(true);

        // Determine which WP_Query to use
        let queryToUse: WP_Query;
        if (opts?.wp_query instanceof WP_Query) {
            queryToUse = opts.wp_query;
        } else if (opts?.wp_query && typeof opts.wp_query === 'object') {
            // Merge partial query params into current wp_query
            const currentQuery = wp_query || new WP_Query({});
            const mergedVars = { ...currentQuery.query_vars, ...opts.wp_query };
            queryToUse = new WP_Query(mergedVars);
        } else {
            queryToUse = wp_query || new WP_Query({});
        }

        // Ensure query vars are parsed
        queryToUse.parse_query_vars();

        // Extract post_type from wp_query, fallback to postType prop
        const queryPostType = queryToUse.get("post_type");
        const effectivePostType = (queryPostType && typeof queryPostType === "string")
            ? queryPostType
            : (Array.isArray(queryPostType) && queryPostType.length > 0 && typeof queryPostType[0] === "string")
                ? queryPostType[0]
                : postType;
        queryToUse.set("post_type", effectivePostType);

        const usedEmbeds = opts?.embeds ?? embedsState;
        const usedFields = opts?.fields ?? fieldsState;
        const requestHash = JSON.stringify({
            query: queryToUse.toJSON(),
            postType: effectivePostType,
            embeds: usedEmbeds,
            fields: usedFields,
            append: Boolean(opts?.append),
            refresh: isRefresh,
        });
        const requestKey = `${providerInstanceIdRef.current}:${requestHash}`;
        activeRequestKeyRef.current = requestKey;

        // Use get_wp_query_results instead of getPosts
        // post_type is already in wp_query.query_vars
        return wvcClient.get_wp_query_results(
            queryToUse.toJSON(),
            {
                embeds: usedEmbeds,
                fields: usedFields,
            },
            false
        ).then((res: any) => {
            if (activeRequestKeyRef.current !== requestKey) {
                return;
            }
            const normalized = (res?.posts ?? []).map((item: any) => normalizePost(item, effectivePostType));
            setPosts(prev => (opts?.append ? [...prev, ...normalized] : normalized));
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
        const handlePostsRefresh = () => {
            refetch();
        };
        window.addEventListener("WVC_POSTS_REFRESH", handlePostsRefresh);

        // Cleanup function
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            window.removeEventListener("WVC_POSTS_REFRESH", handlePostsRefresh);
        };
    }, []);

    const refetch = (): Promise<void> => {
        // Create new AbortController for refetch
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        return fetch({ refresh: true });
    };

    // Expose convenient setters to children
    const setWPQuery: PostsContextType["setWPQuery"] = (next) => {
        setWPQueryState(prev => {
            if (typeof next === "function") {
                return (next as any)(prev);
            } else {
                return next;
            }
        });
    };

    const setQuery: PostsContextType["setQuery"] = (next) => {
        setWPQueryState(prev => {
            const currentQuery = prev || new WP_Query({});
            const updatedVars = typeof next === "function"
                ? (next as any)(currentQuery.query_vars)
                : { ...currentQuery.query_vars, ...next };
            return new WP_Query(updatedVars);
        });
    };

    const setEmbeds: PostsContextType["setEmbeds"] = (next) => {
        setEmbedsState(prev => (typeof next === "function" ? (next as any)(prev) : next));
    };

    const setFields: PostsContextType["setFields"] = (next) => {
        setFieldsState(prev => (typeof next === "function" ? (next as any)(prev) : next));
    };

    // Pagination helpers derived from current query & totals
    const currentPage = Number(query?.paged ?? query?.page ?? 1) || 1;
    const hasNext = currentPage < (totalPages || 0);
    const hasPrev = currentPage > 1;

    const setPage = (page: number) => {
        const pageNum = Math.max(1, Math.floor(page || 1));
        setWPQueryState(prev => {
            const vars = { ...(prev?.query_vars ?? {}), paged: pageNum };
            const newQuery = new WP_Query(vars);
            // Preserve tax_query, meta_query, date_query (they live outside query_vars after parse)
            if (prev) {
                newQuery.tax_query = prev.tax_query;
                newQuery.meta_query = prev.meta_query;
                newQuery.date_query = prev.date_query;
            }
            if (!newQuery.get("post_type")) {
                newQuery.set("post_type", postType);
            }
            return newQuery;
        });
    };
    const nextPage = () => hasNext && setPage(currentPage + 1);
    const prevPage = () => hasPrev && setPage(currentPage - 1);

    // Load more: fetches next page and appends to existing posts
    const loadMore = async (): Promise<void> => {
        if (!hasNext) return;
        const nextPageNum = currentPage + 1;
        // Fetch with append=true to add to existing posts, without triggering setPage
        // which would cause a full refresh
        await fetch({
            wp_query: { paged: nextPageNum },
            append: true
        });
        // Update the page in wp_query after successful fetch
        setWPQueryState(prev => {
            const vars = { ...(prev?.query_vars ?? {}), paged: nextPageNum };
            const newQuery = new WP_Query(vars);
            if (prev) {
                newQuery.tax_query = prev.tax_query;
                newQuery.meta_query = prev.meta_query;
                newQuery.date_query = prev.date_query;
            }
            if (!newQuery.get("post_type")) {
                newQuery.set("post_type", postType);
            }
            return newQuery;
        });
    };

    const value: PostsContextType = useMemo(() => ({
        // data
        posts,
        total,
        totalPages,

        // status
        loading,
        isRefetching,
        error,

        // state
        wp_query,
        query,
        embeds: embedsState,
        fields: fieldsState,

        // setters
        setWPQuery,
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
        posts,
        total,
        totalPages,
        loading,
        isRefetching,
        error,
        wp_query,
        query,
        embedsState,
        fieldsState,
        hasNext,
        hasPrev,
        currentPage,
    ]);

    // Extract post_type from wp_query for data attributes
    const effectivePostType = useMemo(() => {
        if (!wp_query) return 'post';
        const queryPostType = wp_query.get("post_type");
        if (typeof queryPostType === "string") return queryPostType;
        if (Array.isArray(queryPostType) && queryPostType.length > 0) return queryPostType[0];
        return 'post';
    }, [wp_query]);

    return (
        <PostsContext.Provider value={value}>
            <div
                {...divProps}
                data-wvc-dynamic={effectivePostType === 'post' ? 'PostsProvider' : 'DynamicDataProvider'}
                data-wvc-post-type={effectivePostType !== 'post' ? effectivePostType : undefined}
            >
                {children}
            </div>
        </PostsContext.Provider>
    );
};

export const PostsProvider = WordPressPostsProvider;
export { WordPressPostsProvider, usePosts };