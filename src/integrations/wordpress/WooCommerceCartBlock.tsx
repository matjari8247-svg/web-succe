import React from "react";

import { WordPressBlock } from "./WordPressBlock";
import { WOOCOMMERCE_CART_BLOCK_HTML } from "./woocommerceCartBlockHtml";

export type WooCommerceCartBlockProps = {
    className?: string;
};

export function WooCommerceCartBlock({ className }: WooCommerceCartBlockProps) {
    return <WordPressBlock html={WOOCOMMERCE_CART_BLOCK_HTML} className={className} />;
}