import React from "react";

import { WordPressBlock } from "./WordPressBlock";
import { WOOCOMMERCE_CHECKOUT_BLOCK_HTML } from "./woocommerceCheckoutBlockHtml";

export type WooCommerceCheckoutBlockProps = {
    className?: string;
};

export function WooCommerceCheckoutBlock({ className }: WooCommerceCheckoutBlockProps) {
    return (
        <WordPressBlock html={WOOCOMMERCE_CHECKOUT_BLOCK_HTML} className={className} />
    );
}