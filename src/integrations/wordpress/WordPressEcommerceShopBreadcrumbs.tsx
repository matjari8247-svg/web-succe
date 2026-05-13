import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export interface ShopBreadcrumbLink {
    title: string;
    href: string;
}

interface ShopBreadcrumbsContextType {
    links: ShopBreadcrumbLink[];
    loading: boolean;
    error: string | null;
    /**
     * Refetch breadcrumbs from the underlying WordPress bridge.
     * "wvcClient.get_breadcrumbs" is async; refetch lets consumers reload after navigation.
     */
    refetch: () => void;
}

const ShopBreadcrumbsContext = createContext<ShopBreadcrumbsContextType | null>(null);

export const useShopBreadcrumbs = (): ShopBreadcrumbsContextType => {
    const ctx = useContext(ShopBreadcrumbsContext);
    if (!ctx) {
        throw new Error("useShopBreadcrumbs must be used within a ShopBreadcrumbsProvider");
    }
    return ctx;
};

type ShopBreadcrumbsProviderProps = {
    children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const normalizeLink = (raw: any): ShopBreadcrumbLink | null => {
    if (!raw) return null;

    const title = String(raw.title ?? raw.label ?? raw.text ?? "");
    const href = String(raw.href ?? raw.url ?? raw.link ?? "");

    if (!title || !href) {
        return null;
    }

    return { title, href };
};

export const ShopBreadcrumbsProvider = ({
    children,
    ...divProps
}: ShopBreadcrumbsProviderProps) => {
    const [links, setLinks] = useState<ShopBreadcrumbLink[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        try {
            setError(null);
            setLoading(true);

            // If the WordPress bridge client is not available, do not render any breadcrumbs.
            if (!wvcClient) {
                setLinks([]);
                setLoading(false);
                return;
            }

            let rawLinks: any = [];

            if (typeof wvcClient.get_breadcrumbs === "function") {
                rawLinks = await wvcClient.get_breadcrumbs();
            }

            const normalized: ShopBreadcrumbLink[] = Array.isArray(rawLinks)
                ? rawLinks
                    .map(normalizeLink)
                    .filter((link): link is ShopBreadcrumbLink => link !== null)
                : [];

            let finalLinks = normalized;

            // Fallback: if no breadcrumb links are available, use the shop URL
            // as a single "Shop" breadcrumb item when possible.
            if (
                finalLinks.length === 0 &&
                typeof wvcClient.get_shop_url === "function"
            ) {
                const shopUrl = wvcClient.get_shop_url();
                if (shopUrl) {
                    finalLinks = [
                        {
                            title: "Shop",
                            href: String(shopUrl),
                        },
                    ];
                }
            }

            setLinks(finalLinks);
        } catch (e: any) {
            setError(e?.message ?? String(e));
            setLinks([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value: ShopBreadcrumbsContextType = useMemo(
        () => ({
            links,
            loading,
            error,
            refetch: load,
        }),
        [links, loading, error],
    );

    return (
        <ShopBreadcrumbsContext.Provider value={value}>
            <div
                {...divProps}
                data-wvc-dynamic="ShopBreadcrumbsProvider"
            >
                {children}
            </div>
        </ShopBreadcrumbsContext.Provider>
    );
};