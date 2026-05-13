import React, { useEffect, useMemo, useRef, useState } from "react";

import { cn, decodeHtmlEntities } from "@/lib/utils"
import type { Term, Author, EcommerceProduct } from "./types";
import { DEFAULT_ECOMMERCE_PRODUCT_EMBEDS, DEFAULT_ECOMMERCE_PRODUCT_FIELDS } from "./types";
import { WP_Query, type WP_Query_Vars } from "./wp_query";

import { Button } from "@/components/ui/button"
import { Loader } from "lucide-react";

import { EcommerceProductsContext } from "./WordPressEcommerceProductsContext";

declare global {
    const wvcClient: any;
}

export interface AddToCartButtonProps extends React.HTMLAttributes<HTMLDivElement> {
    productId: number | string;
    // Content
    text?: React.ReactNode;
    loadingText?: React.ReactNode;
    icon?: React.ReactNode;
    // Configuration
    showQuantity?: boolean;
    minQuantity?: number;
    maxQuantity?: number;
    // Styling
    buttonClassName?: string;
    quantityClassName?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
}

import type { QueryParams, EcommerceProductsContextType } from "./WordPressEcommerceProductsContext";

// Convert a single WP REST post (with optional _embedded) into our Post type
const normalizeEcommerceProduct = (raw: any): EcommerceProduct => {
    const safeExtractText = (value: any): string | undefined => {
        if (!value) return undefined;
        if (typeof value === "string") return value;
        if (typeof value === "object" && typeof value.rendered === "string") {
            return value.rendered;
        }
        return undefined;
    };

    const title =
        decodeHtmlEntities(
            safeExtractText(raw?.title) ??
            raw?.post_title ??
            String(raw?.title || raw?.name || "Untitled")
        );

    const shortDescription =
        safeExtractText(raw?.short_description) ??
        safeExtractText(raw?.excerpt) ??
        raw?.post_excerpt ??
        undefined;

    const longDescription =
        safeExtractText(raw?.long_description) ??
        safeExtractText(raw?.description) ??
        safeExtractText(raw?.content) ??
        raw?.post_content ??
        shortDescription ??
        undefined;

    const link = raw?.resolved_url || raw?.link || raw?.permalink || raw?.url || undefined;

    const featured_image_url =
        raw?._embedded?.["wp:featuredmedia"]?.[0]?.source_url ??
        raw?.images?.[0]?.src ??
        raw?.featured_media_url ??
        raw?.featured_image_url ??
        undefined;

    const mapTerm = (t: any, defaultTaxonomy?: string): Term => ({
        id: Number(t?.id ?? 0),
        name: decodeHtmlEntities(String(t?.name ?? "")),
        slug: String(t?.slug ?? ""),
        taxonomy: String(t?.taxonomy ?? defaultTaxonomy ?? ""),
        link: t?.link,
    });

    // Categories: prefer top-level raw.categories (API flat format), then _embedded["wp:term"]
    let categories: Term[] = [];
    if (Array.isArray(raw?.categories) && raw.categories.length > 0) {
        categories = raw.categories.map((t: any) => mapTerm(t, "product_cat"));
    } else {
        const termGroups: any[][] | undefined = raw?._embedded?.["wp:term"];
        if (Array.isArray(termGroups)) {
            categories = termGroups
                .reduce((acc, group) => acc.concat(group), [])
                .filter((t: any) => t && t.taxonomy === "product_cat")
                .map((t: any) => mapTerm(t));
        }
    }

    // Tags: prefer top-level raw.tags (API flat format), then _embedded["wp:term"]
    let tags: Term[] = [];
    if (Array.isArray(raw?.tags) && raw.tags.length > 0) {
        tags = raw.tags.map((t: any) => mapTerm(t, "product_tag"));
    } else {
        const termGroups: any[][] | undefined = raw?._embedded?.["wp:term"];
        if (Array.isArray(termGroups)) {
            tags = termGroups
                .reduce((acc, group) => acc.concat(group), [])
                .filter((t: any) => t && t.taxonomy === "product_tag")
                .map((t: any) => mapTerm(t));
        }
    }

    // Extract custom fields from individual meta keys (for custom post types)
    // Meta keys follow pattern: wvc_{post_type}_{field_key}
    let customFields: Record<string, any> | undefined = undefined;
    if (raw?.meta) {
        const postType = raw?.type || 'product';
        const prefix = `wvc_${postType}_`;
        const fields: Record<string, any> = {};

        Object.keys(raw.meta).forEach(key => {
            if (key.startsWith(prefix)) {
                const fieldKey = key.replace(prefix, '');
                fields[fieldKey] = raw.meta[key];
            }
        });

        if (Object.keys(fields).length > 0) {
            customFields = fields;
        }
    }

    // Store API: prices.regular_price / prices.sale_price / prices.price (in minor units)
    // REST API: flat raw.price / raw.discounted_price (already in major units)
    const minorUnit = raw?.prices?.currency_minor_unit ?? 0;
    const divisor = minorUnit > 0 ? Math.pow(10, minorUnit) : 1;
    const rawRegularPrice = raw?.prices?.regular_price ?? raw?.price;
    const rawSalePrice = raw?.prices?.sale_price ?? raw?.discounted_price;
    const price = rawRegularPrice != null ? Number(rawRegularPrice) / divisor : 0;
    const discounted_price = rawSalePrice != null && rawSalePrice !== "" ? Number(rawSalePrice) / divisor : price;

    return {
        id: String(raw?.id ?? raw?.ID),
        title: String(title),
        slug: raw?.slug,
        short_description: typeof shortDescription === "string" ? shortDescription : undefined,
        long_description: typeof longDescription === "string" ? longDescription : undefined,
        link,
        date: raw?.date || raw?.post_date || undefined,
        featured_image_url,
        categories: categories && categories.length ? categories : [],
        tags: tags && tags.length ? tags : [],
        customFields: customFields,
        price: price,
        discounted_price: discounted_price,
    };
};

export const convertWPResponseToEcommerceProducts = (input: any): EcommerceProduct[] => {
    if (!Array.isArray(input)) return [];
    return input.map(normalizeEcommerceProduct);
};

type WordPressEcommerceProductsProviderProps = {
    children: React.ReactNode;
    postType?: string;      // post type to fetch (defaults to 'product')
    wp_query?: WP_Query | QueryParams; // WP_Query object or initial query args (for backward compatibility)
} & React.HTMLAttributes<HTMLDivElement>;

const WordPressEcommerceProductsProvider = ({
    children,
    postType = 'product',
    wp_query: wp_query_prop,
    ...divProps
}: WordPressEcommerceProductsProviderProps) => {
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
    const [embedsState, setEmbedsState] = useState<string[]>(DEFAULT_ECOMMERCE_PRODUCT_EMBEDS);
    const [fieldsState, setFieldsState] = useState<string[]>(DEFAULT_ECOMMERCE_PRODUCT_FIELDS);

    // Derived query params from wp_query.query_vars for backward compatibility
    const query = useMemo(() => {
        return wp_query?.query_vars || {};
    }, [wp_query]);

    // Data + status
    const [posts, setPosts] = useState<EcommerceProduct[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefetching, setIsRefetching] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    const providerInstanceIdRef = useRef<string>(`products-provider-${Math.random().toString(36).slice(2, 10)}`);
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

    // Process WP_Query to determine what should be rendered
    // Extract query vars and determine if we should render a list of posts
    const shouldRenderPosts = useMemo(() => {
        if (!wp_query) return true; // Default to rendering posts
        
        // Check query flags to determine what to render
        // For ecommerce products, we typically want to render a list
        // Single product queries (is_single) might be handled differently
        if (wp_query.is_single) {
            // Single product - render one product
            return true;
        }
        
        // Archive, category, tag, search, etc. - render list
        return true; // Always render posts for ecommerce products
    }, [wp_query]);

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
        flushCache?: boolean;
    }): Promise<void> => {
        const isRefresh = Boolean(opts?.refresh);
        const shouldFlushCache = Boolean(opts?.flushCache);
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
            shouldFlushCache
        ).then((res: any) => {
            if (activeRequestKeyRef.current !== requestKey) {
                return;
            }
            const normalized = (res?.posts ?? []).map(normalizeEcommerceProduct);
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
        const handleProductsRefresh = () => {
            refetch(true);
        };
        window.addEventListener("WVC_PRODUCTS_REFRESH", handleProductsRefresh);

        // Cleanup function
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            window.removeEventListener("WVC_PRODUCTS_REFRESH", handleProductsRefresh);
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
    const setWPQuery: EcommerceProductsContextType["setWPQuery"] = (next) => {
        setWPQueryState(prev => {
            if (typeof next === "function") {
                return (next as any)(prev);
            } else {
                return next;
            }
        });
    };

    // setQuery is shallow: merges top-level keys only; does not deep-merge into tax_query / meta_query / date_query
    const setQuery: EcommerceProductsContextType["setQuery"] = (next) => {
        setWPQueryState(prev => {
            const currentQuery = prev || new WP_Query({});
            const nextObj = typeof next === "function" ? undefined : next;
            const updatedVars = typeof next === "function"
                ? (next as any)(currentQuery.query_vars)
                : { ...currentQuery.query_vars, ...next };
            const newQuery = new WP_Query(updatedVars);
            // Preserve tax_query, meta_query, date_query from prev when caller did not pass them at top level
            if (prev) {
                if (!(nextObj && "tax_query" in nextObj)) newQuery.tax_query = prev.tax_query;
                if (!(nextObj && "meta_query" in nextObj)) newQuery.meta_query = prev.meta_query;
                if (!(nextObj && "date_query" in nextObj)) newQuery.date_query = prev.date_query;
            }
            return newQuery;
        });
    };

    const setEmbeds: EcommerceProductsContextType["setEmbeds"] = (next) => {
        setEmbedsState(prev => (typeof next === "function" ? (next as any)(prev) : next));
    };

    const setFields: EcommerceProductsContextType["setFields"] = (next) => {
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
            return newQuery;
        });
    };

    const setSorting: EcommerceProductsContextType["setSorting"] = (orderby, order) => {
        setWPQueryState(prev => {
            const vars = { ...(prev?.query_vars ?? {}), orderby, order, paged: 1 };
            const newQuery = new WP_Query(vars);
            if (prev) {
                newQuery.tax_query = prev.tax_query;
                newQuery.meta_query = prev.meta_query;
                newQuery.date_query = prev.date_query;
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
        // Update the page in wp_query after successful fetch (preserve orderby, order, etc.)
        setWPQueryState(prev => {
            if (!prev) return new WP_Query({ paged: nextPageNum });
            const vars = { ...prev.query_vars, paged: nextPageNum };
            return new WP_Query(vars);
        });
    };

    const value: EcommerceProductsContextType = useMemo(() => ({
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
        setSorting,

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

    return (
        <EcommerceProductsContext.Provider value={value}>
            <div
                {...divProps}
                data-wvc-dynamic="EcommerceProductsProvider"
            >
                {shouldRenderPosts && children}
            </div>
        </EcommerceProductsContext.Provider>
    );
};

const AddToCartButton: React.FC<AddToCartButtonProps> = ({
    productId,
    className,
    text = "Add to Cart",
    loadingText = "Adding...",
    icon,
    showQuantity = true,
    minQuantity = 1,
    maxQuantity = 99,
    buttonClassName,
    quantityClassName,
    variant = "default",
    size = "default",
    ...props
}) => {
    const [quantity, setQuantity] = useState(minQuantity);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const decrement = () => setQuantity(Math.max(minQuantity, quantity - 1));
    const increment = () => setQuantity(Math.min(maxQuantity, quantity + 1));

    const handleAddToCart = async () => {
        setIsAdding(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (wvcClient?.cart?.addToCart) {
                const item = {
                    id: productId,
                    quantity: quantity,
                    addedAt: new Date().toISOString()
                };

                const response = await wvcClient.cart.addToCart(item);

                if (response?.success) {
                    document.dispatchEvent(new Event("wvc_cart_updated"));
                    setSuccessMessage(response.message || "Product added to cart!");
                    setTimeout(() => setSuccessMessage(null), 3000);
                } else {
                    setError(response?.message || "Failed to add product to cart");
                }
            } else {
                console.error("wvcClient.cart.addToCart is not available");
                setError("Cart functionality unavailable");
            }
        } catch (err: any) {
            console.error("Add to cart error:", err);
            setError(err.message || "Failed to add product.");
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-2", className)} {...props}>
            <div className="flex items-center gap-2">
                {showQuantity && (
                    <div className={cn("flex items-center border rounded-md", quantityClassName)}>
                        <button
                            className="px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
                            onClick={decrement}
                            disabled={isAdding || quantity <= minQuantity}
                            type="button"
                        >
                            -
                        </button>
                        <span className="px-2 py-1 min-w-[2rem] text-center">{quantity}</span>
                        <button
                            className="px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
                            onClick={increment}
                            disabled={isAdding || quantity >= maxQuantity}
                            type="button"
                        >
                            +
                        </button>
                    </div>
                )}

                <Button
                    onClick={handleAddToCart}
                    disabled={isAdding}
                    className={cn("flex-1 gap-2", buttonClassName)}
                    variant={variant}
                    size={size}
                >
                    {isAdding ? (
                        <>
                            <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {loadingText}
                        </>
                    ) : (
                        <>
                            {icon}
                            {text}
                        </>
                    )}
                </Button>
            </div>

            {successMessage && (
                <p className="text-sm text-green-600 animate-in fade-in slide-in-from-top-1">
                    {successMessage}
                </p>
            )}

            {error && (
                <p className="text-sm text-red-600 animate-in fade-in slide-in-from-top-1">
                    {error}
                </p>
            )}
        </div>
    );
};


export {
    WordPressEcommerceProductsProvider,
    WordPressEcommerceProductsProvider as EcommerceProductsProvider,
    AddToCartButton,
};
export { useEcommerceProducts } from "./WordPressEcommerceProductsContext";
export { ProductSortDropdown, type ProductSortOption } from "./ProductSortDropdown";
export { ProductsFilter, type ProductsFilterProps, type ProductsFilterTemplates, DEFAULT_TEMPLATES as DEFAULT_FILTER_TEMPLATES } from "./ProductsFilter";