/**
 * WordPress Common Types
 *
 * Shared TypeScript interfaces and types for WordPress integration classes.
 * @package WordPress
 */

/**
 * WordPress Term interface (database structure)
 *
 * Represents the WordPress database structure for terms.
 * Used in wp_query.ts for type annotations only (queried_object property).
 * This is NOT used for query parameters - use WP_Term_Query_Vars instead.
 * This is NOT used for REST API responses - use Term interface instead.
 * This is NOT used for React components - use Term interface instead.
 * Do not use for any other purpose.
 */
export interface WP_Term {
	term_id: number;
	name: string;
	slug: string;
	term_group: number;
	term_taxonomy_id: number;
	taxonomy: string;
	description: string;
	parent: number;
	count: number;
	filter?: string;
	object_id?: number; // Added for 'all_with_object_id' fields
}

/**
 * Term interface for React components
 *
 * Normalized term structure for use in React components.
 * Used in WordPressPostsProvider, WordPressEcommerceProductsProvider, and WordPressEcommerceTermsProvider.
 * Do not use for WordPress database queries or REST API requests.
 * For database structure, use WP_Term interface instead.
 */
export interface Term {
	id: number | string; // Flexible to accommodate both number (posts) and string (ecommerce terms)
	name: string;
	slug?: string; // Optional to accommodate ecommerce terms where slug may be undefined
	taxonomy: string; // e.g., "category", "post_tag", "product_cat", or "product_tag"
	link?: string;
}

/**
 * EcommerceTerm interface extends Term
 *
 * Adds image_url property specific to ecommerce terms.
 * Used in WordPressEcommerceTermsProvider for React components.
 * Do not use for WordPress database queries or REST API requests.
 */
export interface EcommerceTerm extends Term {
	id: string; // Override to ensure string type for ecommerce terms
	image_url?: string; // Image URL specific to ecommerce terms
}

/**
 * Author interface for React components
 *
 * Normalized author structure for use in React components.
 * Used in WordPressPostsProvider and WordPressEcommerceProductsProvider.
 * Do not use for WordPress database queries or REST API requests.
 * For database structure, use WP_User interface instead.
 */
export interface Author {
	id: number;
	name: string;
	slug?: string;
	link?: string;
	avatar?: Record<string, string>; // Avatar image URLs keyed by size (e.g., "24", "48", "96")
}

/**
 * Post interface for React components
 *
 * Normalized post structure for use in React components.
 * Represents REST API response data after normalization.
 * Used in WordPressPostsProvider.
 * Do not use for WordPress database queries or wp_query type annotations.
 * For database structure, use WP_Post interface instead.
 * For query parameters, use WP_Query_Vars interface instead.
 */
export interface Post {
	id: string;
	title: string;
	slug?: string;
	excerpt?: string;
	content?: string;
	link?: string;
	date?: string;
	author?: Author;
	featuredImage?: string;
	categories?: Term[];
	tags?: Term[];
	customFields?: Record<string, any>; // Custom post type fields from wvc_cpt_data meta
}

/**
 * EcommerceProduct interface extends Post
 *
 * Adds ecommerce-specific fields (descriptions, pricing, image URL).
 * Used in WordPressEcommerceProductsProvider for React components.
 * Do not use for WordPress database queries or REST API requests.
 */
export interface EcommerceProduct extends Post {
	short_description?: string; // Ecommerce-specific short description
	long_description?: string; // Ecommerce-specific long description
	featured_image_url?: string; // Ecommerce-specific image URL (alternative to featuredImage)
	price?: number;
	discounted_price?: number; // Falls back to price if not provided
}

/**
 * Default embeds and fields for PostsProvider (regular posts).
 * Fields = [] means "request all fields" so normalizePost always has full data.
 */
export const DEFAULT_POST_EMBEDS: string[] = ["wp:featuredmedia", "wp:term", "author"];
export const DEFAULT_POST_FIELDS: string[] = [];

/**
 * Default embeds and fields for PostsProvider with custom post types.
 * Only wp:featuredmedia is embedded so featured images are available.
 * Fields = ["meta"] ensures custom field data is always fetched.
 */
export const DEFAULT_CPT_EMBEDS: string[] = ["wp:featuredmedia"];
export const DEFAULT_CPT_FIELDS: string[] = ["meta"];

/**
 * Default embeds and fields for EcommerceProductsProvider.
 * Fields = [] means "request all fields" so normalizeEcommerceProduct always has full data.
 */
export const DEFAULT_ECOMMERCE_PRODUCT_EMBEDS: string[] = ["wp:featuredmedia", "wp:term"];
export const DEFAULT_ECOMMERCE_PRODUCT_FIELDS: string[] = [];

/**
 * Default embeds and fields for EcommerceTermsProvider.
 * Terms don't need embeds (no featured media, no author).
 * Fields = [] means "request all fields" so normalizeEcommerceTerm always has full data.
 */
export const DEFAULT_ECOMMERCE_TERM_EMBEDS: string[] = [];
export const DEFAULT_ECOMMERCE_TERM_FIELDS: string[] = [];

/**
 * WordPress Post interface (database structure)
 *
 * Represents the WordPress database structure for posts.
 * Used in wp_query.ts for type annotations only (queried_object, query_posts return type).
 * This is NOT used for query parameters - use WP_Query_Vars instead.
 * This is NOT used for REST API responses - use Post interface instead.
 * This is NOT used for React components - use Post interface instead.
 * Do not use for any other purpose.
 */
export interface WP_Post {
	ID: number;
	post_author: number;
	post_date: string;
	post_date_gmt: string;
	post_content: string;
	post_title: string;
	post_excerpt: string;
	post_status: string;
	comment_status: string;
	post_password: string;
	post_name: string;
	post_modified: string;
	post_modified_gmt: string;
	post_content_filtered: string;
	post_parent: number;
	guid: string;
	menu_order: number;
	post_type: string;
	post_mime_type: string;
	comment_count: number;
	filter?: string;
}

/**
 * WordPress Post Meta interface (database structure)
 *
 * Represents the WordPress database structure for post metadata.
 * Used for type annotations in WordPress integration classes.
 * Do not use for REST API requests/responses or React components.
 */
export interface WP_Post_Meta {
	meta_id: number;
	post_id: number;
	meta_key: string;
	meta_value: string;
}

/**
 * WordPress Term Meta interface (database structure)
 *
 * Represents the WordPress database structure for term metadata.
 * Used for type annotations in WordPress integration classes.
 * Do not use for REST API requests/responses or React components.
 */
export interface WP_Term_Meta {
	meta_id: number;
	term_id: number;
	meta_key: string;
	meta_value: string;
}

/**
 * WordPress User interface (database structure)
 *
 * Represents the WordPress database structure for users.
 * Used in wp_query.ts for type annotations only (queried_object).
 * Do not use for REST API requests/responses or React components.
 * For React components, use the Author interface instead.
 */
export interface WP_User {
	ID: number;
	user_login: string;
	user_nicename: string;
	user_email: string;
	user_url: string;
	user_registered: string;
	user_activation_key: string;
	user_status: string;
	display_name: string;
}

/**
 * WordPress Post Type interface (database structure)
 *
 * Represents the WordPress database structure for post types.
 * Used in wp_query.ts for type annotations only (queried_object).
 * Do not use for REST API requests/responses or React components.
 */
export interface WP_Post_Type {
	name: string;
	label: string;
	description: string;
	public: boolean;
	hierarchical: boolean;
	exclude_from_search: boolean;
	publicly_queryable: boolean;
	show_ui: boolean;
	show_in_menu: boolean;
	show_in_nav_menus: boolean;
	show_in_admin_bar: boolean;
	menu_position: number;
	menu_icon: string;
	capability_type: string;
	has_archive: boolean;
	rewrite: boolean | Record<string, unknown>;
	query_var: boolean | string;
	can_export: boolean;
	delete_with_user: boolean;
}

/**
 * WordPress Comment interface (database structure)
 *
 * Represents the WordPress database structure for comments.
 * Used for type annotations in WordPress integration classes.
 * Do not use for REST API requests/responses or React components.
 */
export interface WP_Comment {
	comment_ID: number;
	comment_post_ID: number;
	comment_author: string;
	comment_author_email: string;
	comment_author_url: string;
	comment_author_IP: string;
	comment_date: string;
	comment_date_gmt: string;
	comment_content: string;
	comment_karma: number;
	comment_approved: string;
	comment_agent: string;
	comment_type: string;
	comment_parent: number;
	user_id: number;
}

/**
 * Filter param option for ecommerce product filters
 *
 * Represents a single selectable option within a filter parameter.
 * Each option has a value used for filtering and a human-readable label.
 * Options are dynamic and typically populated from product data (e.g., available categories, price ranges).
 */
export interface EcommerceFilterParamOption {
	value: string;
	label: string;
	/**
	 * Optional hierarchy metadata for taxonomy options.
	 * Backends may use different key naming conventions; all are supported.
	 */
	parent?: string | number;
	parent_id?: string | number;
	parentId?: string | number;
}

/**
 * Enum-like constants for filter param view types
 *
 * Use these instead of raw strings when referencing view types programmatically.
 * - DROPDOWN: Single-select dropdown menu
 * - CHECKBOXES: Multi-select via checkboxes
 * - RADIO: Single-select via radio buttons
 * - COLOR_SWATCHES: Visual color selection
 * - RANGE: Numeric range slider (e.g., price range)
 */
export const FILTER_VIEW_TYPES = {
	DROPDOWN: "dropdown",
	CHECKBOXES: "checkboxes",
	RADIO: "radio",
	COLOR_SWATCHES: "color_swatches",
	RANGE: "range",
} as const;

/**
 * View type for filter param UI rendering
 *
 * Derived from FILTER_VIEW_TYPES values.
 */
export type EcommerceFilterParamViewType = typeof FILTER_VIEW_TYPES[keyof typeof FILTER_VIEW_TYPES];

/**
 * Filter parameter types as string literal values.
 *
 * - "taxonomy": Filters by a WordPress taxonomy (e.g., product_cat, product_tag)
 * - "attribute": Filters by a product attribute (e.g., color, size)
 * - "price": Filters by product price range
 * - "meta": Filters by custom product meta field
 */
export type EcommerceFilterParamType = "taxonomy" | "attribute" | "price" | "meta";

/**
 * Default view types for each filter parameter type.
 */
const DEFAULT_FILTER_PARAM_VIEW_TYPE: Record<EcommerceFilterParamType, EcommerceFilterParamViewType> = {
	"taxonomy": FILTER_VIEW_TYPES.CHECKBOXES,
	"attribute": FILTER_VIEW_TYPES.DROPDOWN,
	"price": FILTER_VIEW_TYPES.RANGE,
	"meta": FILTER_VIEW_TYPES.DROPDOWN,
};

/**
 * EcommerceFilterParam — represents a single filter criterion for ecommerce products.
 *
 * Each instance defines which product property to filter by, how to render the filter UI,
 * and the available options for the user to select.
 *
 * Static members expose the allowed param types as constants:
 *   EcommerceFilterParam.TAXONOMY, .ATTRIBUTE, .PRICE, .META
 *
 * Construct via `new EcommerceFilterParam({ key, label, type, options })`.
 * If `viewType` is omitted the class assigns the default for the given `type`.
 *
 * Used in WordPressEcommerceProductsProvider / ProductsFilter for React components.
 */
export class EcommerceFilterParam {
	// ── Static param-type constants ─────────────────────────────────
	static readonly TAXONOMY: EcommerceFilterParamType = "taxonomy";
	static readonly ATTRIBUTE: EcommerceFilterParamType = "attribute";
	static readonly PRICE: EcommerceFilterParamType = "price";
	static readonly META: EcommerceFilterParamType = "meta";

	// ── Static helpers ──────────────────────────────────────────────

	/** Returns the default view type for a given param type. */
	static defaultViewType(type: EcommerceFilterParamType): EcommerceFilterParamViewType {
		return DEFAULT_FILTER_PARAM_VIEW_TYPE[type] ?? FILTER_VIEW_TYPES.DROPDOWN;
	}

	// ── Instance fields ─────────────────────────────────────────────
	public readonly key: string;
	public readonly label: string;
	public readonly type: EcommerceFilterParamType;
	public readonly viewType: EcommerceFilterParamViewType;
	public options: EcommerceFilterParamOption[];

	constructor(params: {
		key: string;
		label: string;
		type: EcommerceFilterParamType;
		viewType?: EcommerceFilterParamViewType;
		options?: EcommerceFilterParamOption[];
	}) {
		this.key = params.key;
		this.label = params.label;
		this.type = params.type;
		this.viewType = params.viewType ?? EcommerceFilterParam.defaultViewType(params.type);
		this.options = params.options ?? [];
	}

	/** Serialize to a plain object (for JSON / context passing). */
	toJSON(): {
		key: string;
		label: string;
		type: EcommerceFilterParamType;
		viewType: EcommerceFilterParamViewType;
		options: EcommerceFilterParamOption[];
	} {
		return {
			key: this.key,
			label: this.label,
			type: this.type,
			viewType: this.viewType,
			options: this.options,
		};
	}

	/** Create an EcommerceFilterParam from a plain object (e.g., API response). */
	static fromJSON(obj: {
		key: string;
		label: string;
		type: EcommerceFilterParamType;
		viewType?: EcommerceFilterParamViewType;
		options?: EcommerceFilterParamOption[];
	}): EcommerceFilterParam {
		return new EcommerceFilterParam(obj);
	}
}

/**
 * Ecommerce products filter
 *
 * Top-level filter structure containing all filter parameters
 * for filtering a list of ecommerce products.
 * Used in WordPressEcommerceProductsProvider for React components.
 */
export interface EcommerceProductsFilter {
	params: EcommerceFilterParam[];
}