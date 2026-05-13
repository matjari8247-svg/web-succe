import React, {
    createContext,
    useCallback,
    useContext,
    useState,
    useEffect,
    useRef
} from 'react';

import { cn } from "@/lib/utils"


// Types for menu structure
interface MenuItem {
    id: string;
    label: string;
    href?: string;
    children?: MenuItem[];
}

interface MenuContextType {
    menuItems: MenuItem[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    isRefetching: boolean;
}


const createMenuItem = (data: any): MenuItem =>{
    return {
        id: String(data.id),
        label: String(data.title),
        href: data.resolved_url,
        children: Array.isArray(data.children)
            ? data.children.map(createMenuItem)
            : undefined
    };
}

// Create context
const MenuContext = createContext<MenuContextType | null>(null);

// Custom hook to use menu context
const useMenu = () => {
    const context = useContext(MenuContext);
    if (!context) {
        throw new Error('useMenu must be used within a MenuProvider');
    }
    return context;
};

// MenuProvider component
type WordpressMenuProviderProps = {
    children: React.ReactNode;
    menu_id: string;
} & React.HTMLAttributes<HTMLDivElement>;

const WordpressMenuProvider = ({children, menu_id, ...divProps}: WordpressMenuProviderProps) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefetching, setIsRefetching] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleError = useCallback(() => {
        const message = 'Failed to fetch menu items';
        setError(message);
    }, []);

    const fetchMenuItems = async (signal?: AbortSignal) => {
        // Prevent race conditions
        if (isRefetching) return;

        setLoading(true);
        setIsRefetching(true);
        setError(null);

        try {
            const data = await wvcClient.getMenuItems({ menuId: parseInt(menu_id) });
            const menuItems: MenuItem[] = data.map(createMenuItem);
            setMenuItems(menuItems);

        } catch {
            handleError();
        } finally {
            setLoading(false);
            setIsRefetching(false);
        }
    };

    useEffect(() => {
        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();

        fetchMenuItems(abortControllerRef.current.signal);

        // Setup event listener for external refresh events
        const handleMenuRefresh = () => {
            refetch();
        };
        window.addEventListener("WVC_MENU_REFRESH", handleMenuRefresh);

        // Cleanup function
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            window.removeEventListener("WVC_MENU_REFRESH", handleMenuRefresh);
        };
    }, []);

    const refetch = async () => {
        // Create new AbortController for refetch
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        await fetchMenuItems(abortControllerRef.current.signal);
    };

    const value: MenuContextType = {
        menuItems,
        loading,
        error,
        refetch,
        isRefetching
    };

    return (
        <MenuContext.Provider value={value}>
            <div
                {...divProps}
                data-wvc-dynamic="MenuProvider"
                data-wvc-menu_id={menu_id}
            >
                {children}
            </div>
        </MenuContext.Provider>
    );
};

export const MenuProvider = WordpressMenuProvider;
export { WordpressMenuProvider, MenuItem, useMenu };