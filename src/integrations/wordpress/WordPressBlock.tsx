import React from "react";

import { cn } from "@/lib/utils";

export type WordPressBlockProps = {
    html: string;
    className?: string;
};

/**
 * Renders WordPress / WooCommerce block save HTML for hydration on the WP host.
 * Do not pass untrusted strings.
 */
export function WordPressBlock({ html, className }: WordPressBlockProps) {
    return (
        <div
            className={cn(className)}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}