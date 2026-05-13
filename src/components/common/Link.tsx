import React from "react";
import { Link as RouterLink } from "react-router-dom";

type RouterLinkTo = React.ComponentPropsWithoutRef<typeof RouterLink>["to"];

type LinkProps = Omit<
    React.ComponentPropsWithoutRef<typeof RouterLink>,
    "to"
> & {
    to?: RouterLinkTo;
    href?: RouterLinkTo;
    /** If true, opens in a new tab (sets target and rel defaults). */
    newTab?: boolean;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
    ({ to, newTab = false, target, rel, children, href, ...rest }, ref) => {
        const finalTarget = newTab ? target ?? "_blank" : target;
        const finalRel = newTab ? rel ?? "noopener noreferrer" : rel;

        // Use href as to if to is not provided
        const linkTo = to ?? href ?? "#";

        return (
            <RouterLink ref={ref} to={linkTo} target={finalTarget} rel={finalRel} {...rest}>
                {children}
            </RouterLink>
        );
    }
);