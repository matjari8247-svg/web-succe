import React from "react";

import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { useEcommerceProducts } from "./WordPressEcommerceProductsContext";

/** Sort option value for ProductSortDropdown */
export type ProductSortOption =
    | "featured"
    | "new_arrivals"
    | "price_asc"
    | "price_desc"
    | "top_sellers";

const SORT_OPTIONS: { value: ProductSortOption; label: string; orderby: string; order: "asc" | "desc" }[] = [
    { value: "featured", label: "Featured", orderby: "menu_order", order: "asc" },
    { value: "new_arrivals", label: "New arrivals", orderby: "date", order: "desc" },
    { value: "price_asc", label: "Price low to high", orderby: "price", order: "asc" },
    { value: "price_desc", label: "Price high to low", orderby: "price", order: "desc" },
    { value: "top_sellers", label: "Top sellers", orderby: "popularity", order: "desc" },
];

function getSortOptionFromQuery(orderby: string | undefined, order: string | undefined): ProductSortOption {
    const o = (order ?? "asc").toLowerCase();
    const ob = (orderby ?? "menu_order").toLowerCase();
    const found = SORT_OPTIONS.find(
        (opt) => opt.orderby.toLowerCase() === ob && opt.order === o
    );
    return found?.value ?? "featured";
}

export interface ProductSortDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Optional label (e.g. "Sort by") shown before the dropdown */
    label?: React.ReactNode;
    /** Placeholder when value is not yet resolved */
    placeholder?: string;
}

/**
 * Optional sub-component: dropdown to sort products. Calls setSorting(orderby, order),
 * which updates orderby/order and resets to page 1, then triggers refetch.
 * Intended to be placed above the product list, right-aligned (e.g. in a flex container with justify-end).
 */
export const ProductSortDropdown: React.FC<ProductSortDropdownProps> = ({
    label,
    placeholder = "Sort by",
    className,
    ...divProps
}) => {
    const { query, setSorting } = useEcommerceProducts();
    const orderby = query?.orderby as string | undefined;
    const order = query?.order as string | undefined;
    const value = getSortOptionFromQuery(orderby, order);

    const handleValueChange = (newValue: ProductSortOption) => {
        const option = SORT_OPTIONS.find((o) => o.value === newValue);
        if (!option) return;
        setSorting(option.orderby, option.order);
    };

    return (
        <div
            className={cn("flex items-center justify-end gap-2", className)}
            data-wvc-dynamic="ProductSortDropdown"
            {...divProps}
        >
            {label != null && <span className="text-sm text-muted-foreground">{label}</span>}
            <Select value={value} onValueChange={(v) => handleValueChange(v as ProductSortOption)}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};