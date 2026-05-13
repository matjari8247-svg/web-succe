import React, { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { WP_Query } from "./wp_query";
import { useEcommerceProducts } from "./WordPressEcommerceProductsContext";
import {
    EcommerceFilterParam,
    type EcommerceFilterParamOption,
    type EcommerceProductsFilter,
} from "./types";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion";

let htmlDecoderEl: HTMLTextAreaElement | null = null;

function decodeHtmlEntities(value: string): string {
    if (!value || typeof document === "undefined") return value;
    if (!htmlDecoderEl) {
        htmlDecoderEl = document.createElement("textarea");
    }
    htmlDecoderEl.innerHTML = value;
    return htmlDecoderEl.value;
}

declare global {
    const wvcClient: any;
}

// ─── Template types ─────────────────────────────────────────────────

/**
 * HTML string templates for customising ProductsFilter appearance.
 *
 * Each key is optional. When provided AND valid, the HTML string is rendered
 * via TemplateRenderer with `{{slot}}` placeholders replaced by functional
 * React elements. When omitted or invalid, the built-in default JSX is used.
 */
export interface ProductsFilterTemplates {
    /** Overall layout. Slots: {{label}}, {{active_filters}}, {{filters}} */
    layout?: string;
    /** Active-filter tags strip. Slots: {{tags}}, {{reset_button}} */
    activeFilters?: string;
    /** Single active-filter tag. Slots: {{label}}, {{remove_button}} */
    activeFilterTag?: string;
    /** Wrapper for each filter param section. Slots: {{label}}, {{control}} */
    param?: string;
    /** Dropdown control wrapper. Slots: {{control}} */
    dropdown?: string;
    /** Checkboxes list container. Slots: {{items}} */
    checkboxes?: string;
    /** Single checkbox row. Slots: {{checkbox}}, {{label}} */
    checkboxItem?: string;
    /** Radio list container. Slots: {{items}} */
    radio?: string;
    /** Single radio row. Slots: {{input}}, {{label}} */
    radioItem?: string;
    /** Color swatches container. Slots: {{items}} */
    colorSwatches?: string;
    /** Single color swatch. Slots: {{button}} */
    colorSwatchItem?: string;
    /** Range inputs. Slots: {{min_input}}, {{max_input}}, {{separator}} */
    range?: string;
}

/**
 * Required slot names for each template key.
 * Used by validateTemplate to ensure all mandatory placeholders are present.
 */
const REQUIRED_SLOTS: Record<keyof ProductsFilterTemplates, string[]> = {
    layout: ["filters"],
    activeFilters: ["tags"],
    activeFilterTag: ["label", "remove_button"],
    param: ["label", "control"],
    dropdown: ["control"],
    checkboxes: ["items"],
    checkboxItem: ["checkbox", "label"],
    radio: ["items"],
    radioItem: ["input", "label"],
    colorSwatches: ["items"],
    colorSwatchItem: ["button"],
    range: ["min_input", "max_input"],
};

/**
 * Reference default templates (exported for documentation / AI prompt usage).
 * When the `templates` prop is not provided, the component renders built-in JSX
 * (Accordion, Radix primitives, etc.) which cannot be expressed as HTML strings.
 * These constants document what a minimal custom template looks like for each key.
 */
export const DEFAULT_TEMPLATES: Required<ProductsFilterTemplates> = {
    layout:
        '<div class="space-y-1">' +
            '<div class="mb-2">{{label}}</div>' +
            '{{active_filters}}' +
            '{{filters}}' +
        '</div>',
    activeFilters:
        '<div class="mb-3 pb-3 border-b space-y-2">' +
            '<div class="flex flex-wrap items-center gap-1.5">{{tags}}</div>' +
            '<div class="flex justify-end">{{reset_button}}</div>' +
        '</div>',
    activeFilterTag:
        '<span class="inline-flex items-center gap-1">' +
            '{{label}}' +
            '{{remove_button}}' +
        '</span>',
    param:
        '<div class="py-2">' +
            '<p class="text-sm font-medium mb-1">{{label}}</p>' +
            '<div>{{control}}</div>' +
        '</div>',
    dropdown: '<div>{{control}}</div>',
    checkboxes: '<div class="space-y-2">{{items}}</div>',
    checkboxItem:
        '<div class="flex items-center gap-2">' +
            '{{checkbox}}' +
            '<span class="text-sm cursor-pointer">{{label}}</span>' +
        '</div>',
    radio: '<div class="grid gap-3">{{items}}</div>',
    radioItem:
        '<div class="flex items-center gap-2">' +
            '{{input}}' +
            '<span class="text-sm cursor-pointer">{{label}}</span>' +
        '</div>',
    colorSwatches: '<div class="flex flex-wrap gap-2">{{items}}</div>',
    colorSwatchItem: '<div>{{button}}</div>',
    range:
        '<div class="flex items-center gap-2">' +
            '{{min_input}}' +
            '<span class="text-sm text-muted-foreground">–</span>' +
            '{{max_input}}' +
        '</div>',
};

// ─── Template validation ────────────────────────────────────────────

/**
 * Validates an HTML template string.
 *
 * Checks:
 * 1. Non-empty string
 * 2. All required slot placeholders ({{slotName}}) are present
 * 3. No <script> tags
 * 4. No inline event handler attributes (onclick, onchange, etc.)
 *
 * @returns `true` if the template is safe and contains all required slots.
 */
function validateTemplate(
    template: string | undefined,
    templateKey: keyof ProductsFilterTemplates
): template is string {
    if (!template || typeof template !== "string" || template.trim().length === 0) {
        return false;
    }
    const required = REQUIRED_SLOTS[templateKey] ?? [];
    for (const slot of required) {
        if (!template.includes(`{{${slot}}}`)) return false;
    }
    if (/<script[\s>]/i.test(template)) return false;
    if (/\bon\w+\s*=/i.test(template)) return false;
    return true;
}

// ─── TemplateRenderer ───────────────────────────────────────────────

/**
 * Renders an HTML string template with React elements injected into
 * `{{slot}}` placeholder positions via DOM portals.
 *
 * The template HTML controls layout and styling (Tailwind classes, wrappers).
 * Interactive React elements (checkboxes, selects, buttons) are mounted into
 * marker `<div data-template-slot="...">` elements using `createPortal`.
 *
 * Uses `useLayoutEffect` so portals appear before the browser paints,
 * avoiding a flash of empty placeholders.
 */
const TemplateRenderer: React.FC<{
    template: string;
    slots: Record<string, React.ReactNode>;
    className?: string;
}> = ({ template, slots, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Map of slot name → marker DOM element, populated after mount
    const [markers, setMarkers] = useState<Map<string, HTMLElement>>(new Map());

    // Replace {{slotName}} with marker divs
    const html = useMemo(() => {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
            return `<div data-template-slot="${key}"></div>`;
        });
    }, [template]);

    // After DOM mutation, find marker elements and store references
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const found = new Map<string, HTMLElement>();
        containerRef.current
            .querySelectorAll<HTMLElement>("[data-template-slot]")
            .forEach((el) => {
                const name = el.getAttribute("data-template-slot");
                if (name) found.set(name, el);
            });
        setMarkers(found);
    }, [html]);

    // Build portals during render so they always reflect current slot values
    const portals: React.ReactPortal[] = [];
    markers.forEach((marker, slotName) => {
        if (marker.isConnected && slots[slotName] !== undefined) {
            portals.push(createPortal(<>{slots[slotName]}</>, marker, slotName));
        }
    });

    return (
        <>
            <div
                ref={containerRef}
                className={className}
                dangerouslySetInnerHTML={{ __html: html }}
            />
            {portals}
        </>
    );
};

// ─── Shared prop type for view-type sub-renderers ───────────────────

interface FilterViewProps {
    param: EcommerceFilterParam;
    selectedValues: string[];
    onChange: (values: string[]) => void;
    templates?: ProductsFilterTemplates;
}

// ─── Sub-renderers (one per viewType) ───────────────────────────────

/** Single-select dropdown */
const FilterDropdown: React.FC<FilterViewProps> = ({ param, selectedValues, onChange, templates }) => {
    const value = selectedValues[0] ?? "__all__";
    const paramLabel = decodeHtmlEntities(param.label);

    const control = (
        <Select
            value={value}
            onValueChange={(v) => onChange(v === "__all__" ? [] : [v])}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={paramLabel} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {param.options.map((option: EcommerceFilterParamOption) => (
                    <SelectItem key={option.value} value={option.value}>
                        {decodeHtmlEntities(option.label)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    if (validateTemplate(templates?.dropdown, "dropdown")) {
        return <TemplateRenderer template={templates!.dropdown!} slots={{ "control": control }} />;
    }

    return control;
};

/** Multi-select checkboxes */
const FilterCheckboxes: React.FC<FilterViewProps> = ({ param, selectedValues, onChange, templates }) => {
    const handleCheck = (optionValue: string, checked: boolean) => {
        if (checked) {
            onChange([...selectedValues, optionValue]);
        } else {
            onChange(selectedValues.filter((v) => v !== optionValue));
        }
    };

    const hasItemTemplate = validateTemplate(templates?.checkboxItem, "checkboxItem");
    const hasContainerTemplate = validateTemplate(templates?.checkboxes, "checkboxes");

    const items = param.options.map((option: EcommerceFilterParamOption) => {
        const id = `filter-${param.key}-${option.value}`;
        const optionLabel = decodeHtmlEntities(option.label);
        const checkbox = (
            <Checkbox
                id={id}
                checked={selectedValues.includes(option.value)}
                onCheckedChange={(checked) => handleCheck(option.value, !!checked)}
            />
        );
        const label = (
            <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
                {optionLabel}
            </Label>
        );

        if (hasItemTemplate) {
            return (
                <TemplateRenderer
                    key={option.value}
                    template={templates!.checkboxItem!}
                    slots={{ "checkbox": checkbox, "label": label }}
                />
            );
        }

        return (
            <div key={option.value} className="flex items-center gap-2">
                {checkbox}
                {label}
            </div>
        );
    });

    if (hasContainerTemplate) {
        return <TemplateRenderer template={templates!.checkboxes!} slots={{ "items": <>{items}</> }} />;
    }

    return <div className="space-y-2">{items}</div>;
};

/** Single-select radio buttons */
const FilterRadio: React.FC<FilterViewProps> = ({ param, selectedValues, onChange, templates }) => {
    const hasItemTemplate = validateTemplate(templates?.radioItem, "radioItem");
    const hasContainerTemplate = validateTemplate(templates?.radio, "radio");

    const items = param.options.map((option: EcommerceFilterParamOption) => {
        const id = `filter-${param.key}-${option.value}`;
        const optionLabel = decodeHtmlEntities(option.label);
        const input = <RadioGroupItem value={option.value} id={id} />;
        const label = (
            <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
                {optionLabel}
            </Label>
        );

        if (hasItemTemplate) {
            return (
                <TemplateRenderer
                    key={option.value}
                    template={templates!.radioItem!}
                    slots={{ "input": input, "label": label }}
                />
            );
        }

        return (
            <div key={option.value} className="flex items-center gap-2">
                {input}
                {label}
            </div>
        );
    });

    // RadioGroup must always wrap items for Radix context
    const radioGroup = (
        <RadioGroup
            value={selectedValues[0] ?? ""}
            onValueChange={(v) => onChange(v ? [v] : [])}
        >
            {hasContainerTemplate ? (
                <TemplateRenderer template={templates!.radio!} slots={{ "items": <>{items}</> }} />
            ) : (
                items
            )}
        </RadioGroup>
    );

    return radioGroup;
};

/** Color swatch multi-select */
const FilterColorSwatches: React.FC<FilterViewProps> = ({ param, selectedValues, onChange, templates }) => {
    const handleToggle = (optionValue: string) => {
        if (selectedValues.includes(optionValue)) {
            onChange(selectedValues.filter((v) => v !== optionValue));
        } else {
            onChange([...selectedValues, optionValue]);
        }
    };

    const hasItemTemplate = validateTemplate(templates?.colorSwatchItem, "colorSwatchItem");
    const hasContainerTemplate = validateTemplate(templates?.colorSwatches, "colorSwatches");

    const items = param.options.map((option: EcommerceFilterParamOption) => {
        const optionLabel = decodeHtmlEntities(option.label);
        const btn = (
            <button
                key={option.value}
                type="button"
                title={optionLabel}
                onClick={() => handleToggle(option.value)}
                className={cn(
                    "size-8 rounded-full border-2 transition-all",
                    selectedValues.includes(option.value)
                        ? "border-primary ring-2 ring-primary/30 scale-110"
                        : "border-border hover:border-foreground/50"
                )}
                style={{ backgroundColor: option.value }}
            />
        );

        if (hasItemTemplate) {
            return (
                <TemplateRenderer
                    key={option.value}
                    template={templates!.colorSwatchItem!}
                    slots={{ "button": btn }}
                />
            );
        }

        return btn;
    });

    if (hasContainerTemplate) {
        return <TemplateRenderer template={templates!.colorSwatches!} slots={{ "items": <>{items}</> }} />;
    }

    return <div className="flex flex-wrap gap-2">{items}</div>;
};

/** Numeric range with min / max inputs.
 *  Uses local state for typing; commits to parent onChange only on blur
 *  so the auto-apply debounce doesn't fire on every keystroke. */
const FilterRange: React.FC<FilterViewProps> = ({ param, selectedValues, onChange, templates }) => {
    const rangeMin = param.options.length > 0 ? Number(param.options[0].value) : 0;
    const rangeMax = param.options.length > 1 ? Number(param.options[param.options.length - 1].value) : 1000;

    const committedMin = selectedValues[0] ?? String(rangeMin);
    const committedMax = selectedValues[1] ?? String(rangeMax);

    const [localMin, setLocalMin] = useState(committedMin);
    const [localMax, setLocalMax] = useState(committedMax);

    // Sync local state when the committed (parent) values change externally
    // (e.g. reset, tag removal).
    useEffect(() => {
        setLocalMin(committedMin);
        setLocalMax(committedMax);
    }, [committedMin, committedMax]);

    const handleBlur = () => {
        if (localMin !== committedMin || localMax !== committedMax) {
            onChange([localMin, localMax]);
        }
    };

    const minInput = (
        <Input
            type="number"
            min={rangeMin}
            max={rangeMax}
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={handleBlur}
            placeholder="Min"
            className="w-24 text-sm"
        />
    );
    const maxInput = (
        <Input
            type="number"
            min={rangeMin}
            max={rangeMax}
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={handleBlur}
            placeholder="Max"
            className="w-24 text-sm"
        />
    );
    const separator = <span className="text-sm text-muted-foreground">–</span>;

    if (validateTemplate(templates?.range, "range")) {
        return (
            <TemplateRenderer
                template={templates!.range!}
                slots={{ "min_input": minInput, "max_input": maxInput, "separator": separator }}
            />
        );
    }

    return (
        <div className="flex items-center gap-2">
            {minInput}
            {separator}
            {maxInput}
        </div>
    );
};

// ─── View-type dispatcher ───────────────────────────────────────────

const FilterParamRenderer: React.FC<FilterViewProps> = (props) => {
    switch (props.param.viewType) {
        case "dropdown":
            return <FilterDropdown {...props} />;
        case "checkboxes":
            return <FilterCheckboxes {...props} />;
        case "radio":
            return <FilterRadio {...props} />;
        case "color_swatches":
            return <FilterColorSwatches {...props} />;
        case "range":
            return <FilterRange {...props} />;
        default:
            return null;
    }
};

// ─── Active-filter tag data ─────────────────────────────────────────

interface ActiveFilterTag {
    /** Filter param key (e.g. "pa_color") */
    paramKey: string;
    /** Human-readable param name (e.g. "Color") */
    paramLabel: string;
    /** The raw option value */
    value: string;
    /** Human-readable option label (e.g. "Red") */
    valueLabel: string;
}

/**
 * Collects every selected value across all filter params into a flat list
 * of ActiveFilterTag objects, ready to be rendered as removable chips.
 *
 * Range-type filters produce a single tag like "Price: $10 – $50" rather
 * than individual min/max tags.
 */
function collectActiveFilterTags(
    filterParams: EcommerceFilterParam[],
    values: Record<string, string[]>
): ActiveFilterTag[] {
    const tags: ActiveFilterTag[] = [];

    for (const param of filterParams) {
        const selected = values[param.key] ?? [];
        if (selected.length === 0) continue;

        if (param.viewType === "range" && selected.length === 2) {
            tags.push({
                paramKey: param.key,
                paramLabel: decodeHtmlEntities(param.label),
                value: selected.join("-"),
                valueLabel: `${selected[0]} – ${selected[1]}`,
            });
            continue;
        }

        for (const val of selected) {
            const option = param.options.find((o) => o.value === val);
            tags.push({
                paramKey: param.key,
                paramLabel: decodeHtmlEntities(param.label),
                value: val,
                valueLabel: option?.label ? decodeHtmlEntities(option.label) : val,
            });
        }
    }

    return tags;
}

// ─── ActiveFilterTags component ─────────────────────────────────────

interface ActiveFilterTagsProps {
    filterParams: EcommerceFilterParam[];
    selectedValues: Record<string, string[]>;
    onRemove: (paramKey: string, value: string) => void;
    resetButton: React.ReactNode;
    templates?: ProductsFilterTemplates;
}

/**
 * Renders the currently selected filter values as removable badge-style tags,
 * with a reset button right-aligned below the tag list.
 */
const ActiveFilterTags: React.FC<ActiveFilterTagsProps> = ({
    filterParams,
    selectedValues,
    onRemove,
    resetButton,
    templates,
}) => {
    const tags = useMemo(
        () => collectActiveFilterTags(filterParams, selectedValues),
        [filterParams, selectedValues]
    );

    if (tags.length === 0) return null;

    const hasTagTemplate = validateTemplate(templates?.activeFilterTag, "activeFilterTag");
    const hasContainerTemplate = validateTemplate(templates?.activeFilters, "activeFilters");

    const tagElements = tags.map((tag) => {
        const key = `${tag.paramKey}::${tag.value}`;

        const removeButton = (
            <button
                type="button"
                aria-label={`Remove ${tag.paramLabel}: ${tag.valueLabel}`}
                onClick={() => onRemove(tag.paramKey, tag.value)}
                className="ml-0.5 rounded-sm opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                </svg>
            </button>
        );

        if (hasTagTemplate) {
            return (
                <TemplateRenderer
                    key={key}
                    template={templates!.activeFilterTag!}
                    slots={{
                        "label": <span className="text-xs">{tag.paramLabel}: {tag.valueLabel}</span>,
                        "remove_button": removeButton,
                    }}
                />
            );
        }

        return (
            <Badge key={key} variant="secondary" className="gap-1 pr-1">
                <span className="text-xs">{tag.paramLabel}: {tag.valueLabel}</span>
                {removeButton}
            </Badge>
        );
    });

    if (hasContainerTemplate) {
        return (
            <TemplateRenderer
                template={templates!.activeFilters!}
                slots={{
                    "tags": <>{tagElements}</>,
                    "reset_button": resetButton,
                }}
            />
        );
    }

    return (
        <div className="mb-3 pb-3 border-b space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
                {tagElements}
            </div>
            <div className="flex justify-end">
                {resetButton}
            </div>
        </div>
    );
};

// ─── Base query snapshot ────────────────────────────────────────────

interface BaseQuerySnapshot {
    query_vars: Record<string, unknown>;
    tax_query: unknown;
    meta_query: unknown;
    date_query: unknown;
}

/**
 * Creates a deep-copied plain-object snapshot of a WP_Query.
 * The snapshot is fully disconnected from the original WP_Query instance,
 * so later mutations to that instance (via parse_query_vars, etc.) cannot
 * corrupt the stored base.
 */
function snapshotQuery(q: WP_Query): BaseQuerySnapshot {
    return JSON.parse(JSON.stringify(q.toJSON()));
}

function normalizeTermValue(value: unknown): string {
    return String(value ?? "").trim();
}

function extractParentTermValue(option: EcommerceFilterParamOption): string | null {
    const candidates = [option.parent, option.parent_id, option.parentId];
    for (const candidate of candidates) {
        const normalized = normalizeTermValue(candidate);
        if (normalized !== "" && normalized !== "0") {
            return normalized;
        }
    }
    return null;
}

/**
 * For hierarchical taxonomies, keep only the deepest selected terms.
 * Example: ["shoes", "sneakers"] -> ["sneakers"], while sibling terms are preserved.
 */
function collapseHierarchySelections(
    values: string[],
    options: EcommerceFilterParamOption[]
): string[] {
    const uniqueValues = Array.from(
        new Set(values.map((v) => normalizeTermValue(v)).filter((v) => v !== ""))
    );
    if (uniqueValues.length <= 1) return uniqueValues;

    const parentByValue = new Map<string, string>();
    for (const option of options) {
        const value = normalizeTermValue(option.value);
        if (!value) continue;
        const parent = extractParentTermValue(option);
        if (parent && parent !== value) {
            parentByValue.set(value, parent);
        }
    }
    if (parentByValue.size === 0) return uniqueValues;

    const hasSelectedDescendant = (candidate: string): boolean => {
        for (const value of uniqueValues) {
            if (value === candidate) continue;
            const visited = new Set<string>();
            let current = parentByValue.get(value);
            while (current && !visited.has(current)) {
                if (current === candidate) return true;
                visited.add(current);
                current = parentByValue.get(current);
            }
        }
        return false;
    };

    return uniqueValues.filter((value) => !hasSelectedDescendant(value));
}

// ─── Constants ──────────────────────────────────────────────────────

/** Query var keys that affect only ordering / pagination.
 *  Changes to these should NOT trigger a filter-params re-fetch or
 *  reset selectedValues. */
const PAGINATION_ORDER_KEYS = new Set([
    "paged", "page", "order", "orderby",
    "posts_per_page", "posts_per_archive_page", "offset", "nopaging",
]);

// ─── Main component ─────────────────────────────────────────────────

export interface ProductsFilterProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Optional heading shown above the filters */
    label?: React.ReactNode;
    /** Label for the reset button */
    resetLabel?: React.ReactNode;
    /**
     * HTML string templates for customising appearance.
     * Each key is optional — omitted or invalid templates fall back to built-in JSX.
     */
    templates?: ProductsFilterTemplates;
}

/**
 * ProductsFilter — renders filter controls for ecommerce products.
 *
 * Must be placed **inside** an `EcommerceProductsProvider` (sibling to the consumer).
 * On mount and whenever the underlying `wp_query` changes it fetches the applicable
 * filter params from the WP REST API via `wvcClient.getProductFilters()`, then renders
 * each param according to its `viewType`.
 *
 * **Customisation via templates:**
 * Pass HTML string templates with `{{slot}}` placeholders in the `templates` prop.
 * Templates control appearance (Tailwind classes, structure); interactive behaviour
 * (event handlers, state) is managed internally. Invalid or missing templates
 * silently fall back to built-in defaults.
 *
 * Filter selections are applied immediately (auto-apply). The **Reset** button
 * clears all selections and is shown inside the active-filter tags strip.
 *
 *   receive query → ask WP for filter params → render filters
 *       → user picks options → auto-apply → modify query → loop
 */
export const ProductsFilter: React.FC<ProductsFilterProps> = ({
    label,
    resetLabel = "Reset",
    templates,
    className,
    ...divProps
}) => {
    const { wp_query, setWPQuery } = useEcommerceProducts();

    // ── Filter params fetched from WP REST API ──────────────────────
    const [filterParams, setFilterParams] = useState<EcommerceFilterParam[]>([]);
    const [filtersLoading, setFiltersLoading] = useState(true);
    const [filtersError, setFiltersError] = useState<string | null>(null);
    const [termsRefreshTick, setTermsRefreshTick] = useState(0);

    // ── Single-tier state (auto-applied) ────────────────────────────
    const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});

    const hasActiveFilters = (Object.values(selectedValues) as string[][]).some((v) => v.length > 0);

    // ── Refs (declared before any effect that uses them) ────────────
    const lastCommittedHash = useRef<string>(JSON.stringify({}));
    const isInitialMount = useRef(true);
    const fetchGeneration = useRef(0);

    // Deep-copied snapshot of the page-level query (e.g. "category A")
    // plus any sort changes from sibling components.  Filter commits
    // always rebuild on top of this snapshot so the original constraints
    // (tax_query, meta_query, date_query) are never lost.
    //
    // Stored as a plain object (via snapshotQuery) so mutations to the
    // live WP_Query from parse_query_vars / getHash / toJSON cannot
    // corrupt the saved base.
    //
    // Updated by external (non-filter) changes such as sorting; never
    // by filter commits.  We distinguish the two by comparing the
    // current wp_query hash against lastFilterCommitHash.
    const baseSnapshotRef = useRef<BaseQuerySnapshot | null>(null);
    const lastFilterCommitHash = useRef<string>("");
    const initialPageRef = useRef<unknown>(undefined);

    if (!baseSnapshotRef.current && wp_query) {
        baseSnapshotRef.current = snapshotQuery(wp_query);
        initialPageRef.current = wp_query.query_vars?.paged || "";
    }

    // ── Query hashes ────────────────────────────────────────────────
    const queryHash = wp_query?.getHash() ?? "";

    // Keep the base snapshot in sync with external (non-filter) changes
    // such as sorting.
    useEffect(() => {
        if (!wp_query) return;
        if (queryHash !== lastFilterCommitHash.current) {
            baseSnapshotRef.current = snapshotQuery(wp_query);
        }
    }, [queryHash, wp_query]);

    // Hash of query_vars excluding pagination/ordering.
    // Only changes when filter-relevant parts of the query change
    // (e.g. category, search, taxonomy terms, attributes).
    const filterQueryHash = useMemo(() => {
        if (!wp_query) return "";
        const vars: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(wp_query.query_vars)) {
            if (!PAGINATION_ORDER_KEYS.has(key)) {
                vars[key] = val;
            }
        }
        return JSON.stringify(vars);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryHash]);

    // Refresh filter params when ecommerce terms/products are externally renewed.
    useEffect(() => {
        const handleExternalRefresh = () => {
            setTermsRefreshTick((prev) => prev + 1);
        };

        window.addEventListener("WVC_TERMS_REFRESH", handleExternalRefresh);
        window.addEventListener("WVC_PRODUCTS_REFRESH", handleExternalRefresh);
        return () => {
            window.removeEventListener("WVC_TERMS_REFRESH", handleExternalRefresh);
            window.removeEventListener("WVC_PRODUCTS_REFRESH", handleExternalRefresh);
        };
    }, []);

    // ── Fetch filter params when filter-relevant query changes ──────

    useEffect(() => {
        const snapshot = baseSnapshotRef.current;
        if (!snapshot) return;

        if (filterParams.length === 0) setFiltersLoading(true);
        setFiltersError(null);

        // Track this fetch's generation so stale responses are ignored.
        const generation = ++fetchGeneration.current;

        wvcClient
            .get_product_filters(snapshot)
            .then((res: EcommerceProductsFilter) => {
                if (generation !== fetchGeneration.current) return;
                const params = (res?.params ?? []).map(EcommerceFilterParam.fromJSON);
                setFilterParams(params);
            })
            .catch((e: any) => {
                if (generation !== fetchGeneration.current) return;
                setFiltersError(e?.message ?? String(e));
            })
            .finally(() => {
                if (generation !== fetchGeneration.current) return;
                setFiltersLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterQueryHash, termsRefreshTick]);

    // ── Commit selections to wp_query ───────────────────────────────

    const commitToQuery = useCallback(
        (selections: Record<string, string[]>) => {
            const snapshot = baseSnapshotRef.current;
            const vars = { ...(snapshot?.query_vars ?? {}) };

            const hasSelections = Object.values(selections).some((v) => v.length > 0);
            vars.paged = hasSelections ? 1 : (initialPageRef.current || "");

            for (const param of filterParams) {
                const values = selections[param.key] ?? [];
                if (values.length === 0) continue;
                switch (param.type) {
                    case "taxonomy":
                    case "attribute":
                        vars[param.key] = values.map(Number);
                        break;
                    case "price":
                        if (values.length === 2) {
                            const a = Number(values[0]);
                            const b = Number(values[1]);
                            vars["min_price"] = Math.min(a, b);
                            vars["max_price"] = Math.max(a, b);
                        }
                        break;
                    case "meta":
                        vars[param.key] = values.length === 1 ? values[0] : values;
                        break;
                }
            }

            const newQuery = new WP_Query(vars);
            if (snapshot) {
                newQuery.tax_query = snapshot.tax_query ? JSON.parse(JSON.stringify(snapshot.tax_query)) : null;
                newQuery.meta_query = snapshot.meta_query ? JSON.parse(JSON.stringify(snapshot.meta_query)) : false;
                newQuery.date_query = snapshot.date_query ? JSON.parse(JSON.stringify(snapshot.date_query)) : false;
            }
            lastFilterCommitHash.current = newQuery.getHash();
            setWPQuery(newQuery);
        },
        [filterParams, setWPQuery]
    );

    // ── Auto-apply: commit to query whenever selections change ──────

    const commitRef = useRef(commitToQuery);
    commitRef.current = commitToQuery;

    const selectedHash = JSON.stringify(selectedValues);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (selectedHash === lastCommittedHash.current) return;
        const timer = setTimeout(() => {
            commitRef.current(selectedValues);
            lastCommittedHash.current = selectedHash;
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedHash]);

    // ── Handlers ────────────────────────────────────────────────────

    const handleReset = useCallback(() => {
        const emptyHash = JSON.stringify({});
        setSelectedValues({});
        commitToQuery({});
        lastCommittedHash.current = emptyHash;
    }, [commitToQuery]);

    const handleFilterChange = useCallback(
        (key: string, values: string[]) => {
            const param = filterParams.find((p) => p.key === key);
            const nextValues =
                param?.type === EcommerceFilterParam.TAXONOMY
                    ? collapseHierarchySelections(values, param.options)
                    : values;
            setSelectedValues((prev) => ({ ...prev, [key]: nextValues }));
        },
        [filterParams]
    );

    /** Remove a single value from a filter param (used by active-filter tags). */
    const handleRemoveTag = useCallback(
        (paramKey: string, value: string) => {
            const param = filterParams.find((p) => p.key === paramKey);
            if (param?.viewType === "range") {
                setSelectedValues((prev) => ({ ...prev, [paramKey]: [] }));
            } else {
                setSelectedValues((prev) => ({
                    ...prev,
                    [paramKey]: (prev[paramKey] ?? []).filter((v) => v !== value),
                }));
            }
        },
        [filterParams]
    );

    // ── Render helpers ──────────────────────────────────────────────

    /** Render a single filter param control (delegates to sub-renderer) */
    const renderControl = (param: EcommerceFilterParam) => (
        <FilterParamRenderer
            param={param}
            selectedValues={selectedValues[param.key] ?? []}
            onChange={(values) => handleFilterChange(param.key, values)}
            templates={templates}
        />
    );

    /** Render a single param section (label + control) */
    const renderParamSection = (param: EcommerceFilterParam) => {
        const control = renderControl(param);
        const paramLabel = decodeHtmlEntities(param.label);

        if (validateTemplate(templates?.param, "param")) {
            return (
                <TemplateRenderer
                    key={param.key}
                    template={templates!.param!}
                    slots={{
                        "label": <span>{paramLabel}</span>,
                        "control": control,
                    }}
                />
            );
        }

        // Default param wrapper (simple div with label + control)
        return (
            <div key={param.key} className="py-2">
                <p className="text-sm font-medium mb-1">{paramLabel}</p>
                <div>{control}</div>
            </div>
        );
    };

    // ── Loading / error states ──────────────────────────────────────

    if (filtersLoading && filterParams.length === 0) {
        return (
            <div className={cn("space-y-3", className)} data-wvc-dynamic="ProductsFilter" {...divProps}>
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-10 rounded-md bg-muted/30 animate-pulse" />
                ))}
            </div>
        );
    }

    if (filterParams.length === 0) {
        return null;
    }

    // ── Shared rendered pieces ──────────────────────────────────────

    const resetButton = (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasActiveFilters}
        >
            {resetLabel}
        </Button>
    );

    const labelElement = label != null ? <span className="text-sm font-medium">{label}</span> : null;

    // ── Layout: custom template ─────────────────────────────────────

    const activeFilterTagsElement = (
        <ActiveFilterTags
            filterParams={filterParams}
            selectedValues={selectedValues}
            onRemove={handleRemoveTag}
            resetButton={resetButton}
            templates={templates}
        />
    );

    if (validateTemplate(templates?.layout, "layout")) {
        const filterSections = filterParams.map(renderParamSection);

        return (
            <div className={className} data-wvc-dynamic="ProductsFilter" {...divProps}>
                <TemplateRenderer
                    template={templates!.layout!}
                    slots={{
                        "label": labelElement ?? <span />,
                        "active_filters": activeFilterTagsElement,
                        "filters": <>{filterSections}</>,
                    }}
                />
            </div>
        );
    }

    // ── Layout: built-in default (Accordion) ────────────────────────

    return (
        <div
            className={cn("space-y-1", className)}
            data-wvc-dynamic="ProductsFilter"
            {...divProps}
        >
            {/* Header */}
            {labelElement != null && (
                <div className="flex items-center justify-between mb-2">
                    {labelElement}
                </div>
            )}

            {/* Active filter tags + reset button */}
            {activeFilterTagsElement}

            {/* Accordion param sections */}
            <Accordion type="multiple" defaultValue={filterParams.map((p) => p.key)}>
                {filterParams.map((param) => (
                    <AccordionItem key={param.key} value={param.key}>
                        <AccordionTrigger>{decodeHtmlEntities(param.label)}</AccordionTrigger>
                        <AccordionContent>
                            {renderControl(param)}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};

export default ProductsFilter;