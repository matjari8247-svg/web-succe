/**
 * WordPress Query API: WP_Query class
 *
 * TypeScript representation of WordPress WP_Query class
 * @package WordPress
 * @subpackage Query
 */

import type { WP_Term, WP_Post, WP_Post_Type, WP_User } from "./types";

// wvcClient is declared globally in provider files
// We reference it here for type safety in this file's scope
declare const wvcClient: {
	get_allowed_taxonomies?: (post_type: string) => string[];
	get_allowed_meta?: (post_type: string) => string[];
	[key: string]: any;
} | undefined;

/**
 * Default taxonomies that are always supported across all post types.
 * These are the core WordPress and WooCommerce taxonomies.
 */
const DEFAULT_TAXONOMIES = [
	"category",
	"tag",
	"product_cat",
	"product_tag",
	"product_brand"
];

/**
 * Query variables type
 */
export interface WP_Query_Vars {
	[key: string]: unknown;
	error?: string;
	m?: string;
	p?: number;
	post_parent?: number;
	subpost?: string;
	subpost_id?: number;
	attachment?: string;
	attachment_id?: number;
	name?: string;
	pagename?: string;
	page_id?: number;
	second?: number;
	minute?: number;
	hour?: number;
	day?: number;
	monthnum?: number;
	year?: number;
	w?: number;
	category_name?: string;
	tag?: string;
	cat?: string | number;
	tag_id?: number;
	author?: string | number;
	author_name?: string;
	feed?: string;
	tb?: string;
	paged?: number;
	meta_key?: string;
	meta_value?: string;
	preview?: string;
	s?: string;
	sentence?: boolean;
	title?: string;
	menu_order?: number;
	category__in?: number[];
	category__not_in?: number[];
	category__and?: number[];
	post__in?: number[];
	post__not_in?: number[];
	post_name__in?: string[];
	tag__in?: number[];
	tag__not_in?: number[];
	tag__and?: number[];
	tag_slug__in?: string[];
	tag_slug__and?: string[];
	post_parent__in?: number[];
	post_parent__not_in?: number[];
	author__in?: number[];
	author__not_in?: number[];
	search_columns?: string[];
	post_type?: string | string[];
	post_status?: string | string[];
	posts_per_page?: number;
	posts_per_archive_page?: number;
	nopaging?: boolean;
	offset?: number;
	order?: "ASC" | "DESC";
	orderby?: string | string[];
	ignore_sticky_posts?: boolean;
	suppress_filters?: boolean;
	no_found_rows?: boolean;
}

/**
 * The WordPress Query class.
 *
 * Represents query parameters and structure for querying posts.
 * This class defines what to query, not the query results, loop state, or SQL execution.
 *
 * @link https://developer.wordpress.org/reference/classes/wp_query/
 *
 *
 * @note In TypeScript, boolean query flags (is_single, is_page, etc.) are accessed
 *       as properties directly (e.g., query.is_single) rather than as methods.
 *       This is due to TypeScript's limitation of not allowing properties and methods
 *       with the same name. The properties provide the same functionality as the PHP methods.
 *
 * @note This class represents the query parameters and structure only. Query execution,
 *       SQL generation, loop-related properties (posts, post, have_posts, etc.), and
 *       result properties have been removed as they represent query results, not the query itself.
 */
export class WP_Query {
	/**
	 * Query vars set by the user.
	 *
	 * Contains the original query parameters as provided by the user.
	 * This is the raw input before parsing and normalization.
	 *
	 * @since 1.5.0
	 */
	public query: WP_Query_Vars | null = null;

	/**
	 * Query vars, after parsing.
	 *
	 * Contains the parsed and normalized query parameters that define what posts to query.
	 * These are the actual query arguments (post_type, posts_per_page, orderby, etc.).
	 *
	 * @since 1.5.0
	 */
	public query_vars: WP_Query_Vars = {};

	/**
	 * Taxonomy query container.
	 *
	 * Contains the taxonomy query structure for filtering posts by taxonomy terms.
	 * This is part of the query parameters, not query results.
	 *
	 * @since 3.1.0
	 */
	public tax_query: unknown = null;

	/**
	 * Metadata query container.
	 *
	 * Contains the meta query structure for filtering posts by custom fields/metadata.
	 * This is part of the query parameters, not query results.
	 *
	 * @since 3.2.0
	 */
	public meta_query: unknown = false;

	/**
	 * Date query container.
	 *
	 * Contains the date query structure for filtering posts by date ranges.
	 * This is part of the query parameters, not query results.
	 *
	 * @since 3.7.0
	 */
	public date_query: unknown = false;

	/**
	 * Holds the data for a single object that is queried.
	 *
	 * Contains information about the queried object (post, page, category, term, etc.)
	 * based on the query parameters. This represents what object the query is targeting,
	 * not the query results.
	 *
	 * @since 1.5.0
	 */
	public queried_object: WP_Term | WP_Post_Type | WP_Post | WP_User | null = null;

	/**
	 * The ID of the queried object.
	 *
	 * Contains the ID of the object being queried (e.g., category ID, post ID, author ID).
	 * This represents what object the query is targeting, not query results.
	 *
	 * @since 1.5.0
	 */
	public queried_object_id: number | null = null;



	/**
	 * Determines whether the query is for an existing single post.
	 *
	 * @since 1.5.0
	 * @note For parameter-based checks, use: query.is_single && (post ? checkPost(post) : true)
	 */
	public is_single: boolean = false;

	/**
	 * Determines whether the query is for a post or page preview.
	 *
	 * @since 2.0.0
	 */
	public is_preview: boolean = false;

	/**
	 * Determines whether the query is for an existing single page.
	 *
	 * @since 1.5.0
	 * @note For parameter-based checks, check the property and page_id query_var manually.
	 */
	public is_page: boolean = false;

	/**
	 * Determines whether the query is for an existing archive page.
	 *
	 * Archive pages include category, tag, author, date, custom post type,
	 * and custom taxonomy based archives.
	 *
	 * @since 1.5.0
	 */
	public is_archive: boolean = false;

	/**
	 * Determines whether the query is for a date archive.
	 *
	 * @since 1.5.0
	 */
	public is_date: boolean = false;

	/**
	 * Determines whether the query is for a year archive.
	 *
	 * @since 1.5.0
	 */
	public is_year: boolean = false;

	/**
	 * Determines whether the query is for a month archive.
	 *
	 * @since 1.5.0
	 */
	public is_month: boolean = false;

	/**
	 * Determines whether the query is for a day archive.
	 *
	 * @since 1.5.0
	 */
	public is_day: boolean = false;

	/**
	 * Determines whether the query is for a specific time.
	 *
	 * @since 1.5.0
	 */
	public is_time: boolean = false;

	/**
	 * Determines whether the query is for an existing author archive page.
	 *
	 * @since 1.5.0
	 * @note For parameter-based checks, check the property and author query_var manually.
	 */
	public is_author: boolean = false;

	/**
	 * Determines whether the query is for an existing category archive page.
	 *
	 * @since 1.5.0
	 * @note For parameter-based checks, check the property and cat query_var manually.
	 */
	public is_category: boolean = false;

	/**
	 * Determines whether the query is for an existing tag archive page.
	 *
	 * @since 2.3.0
	 * @note For parameter-based checks, check the property and tag_id query_var manually.
	 */
	public is_tag: boolean = false;

	/**
	 * Determines whether the query is for an existing custom taxonomy archive page.
	 *
	 * @since 2.5.0
	 * @note For parameter-based checks, check the property and tax_query manually.
	 */
	public is_tax: boolean = false;

	/**
	 * Determines whether the query is for a search.
	 *
	 * @since 1.5.0
	 */
	public is_search: boolean = false;

	/**
	 * Determines whether the query is for a feed.
	 *
	 * @since 1.5.0
	 * @note For parameter-based checks, check the property and feed query_var manually.
	 */
	public is_feed: boolean = false;

	/**
	 * Determines whether the query is for a comment feed.
	 *
	 * @since 2.2.0
	 */
	public is_comment_feed: boolean = false;

	/**
	 * Determines whether the query is for a trackback endpoint call.
	 *
	 * @since 1.5.0
	 */
	public is_trackback: boolean = false;

	/**
	 * Determines whether the query is for the blog homepage.
	 *
	 * @since 1.5.0
	 */
	public is_home: boolean = false;

	/**
	 * Determines whether the query is for the Privacy Policy page.
	 *
	 * @since 5.2.0
	 */
	public is_privacy_policy: boolean = false;

	/**
	 * Determines whether the query resulted in a 404 (implies no object was found).
	 *
	 * @since 1.5.0
	 */
	public is_404: boolean = false;

	/**
	 * Determines whether the query is for an embedded single post.
	 *
	 * @since 4.4.0
	 */
	public is_embed: boolean = false;

	/**
	 * Determines whether the query is for a paged result and not for the first page.
	 *
	 * @since 1.5.0
	 */
	public is_paged: boolean = false;

	/**
	 * Signifies whether the current query is for an administrative interface page.
	 *
	 * @since 1.5.0
	 */
	public is_admin: boolean = false;

	/**
	 * Determines whether the query is for an existing attachment page.
	 *
	 * @since 2.0.0
	 * @note For parameter-based checks, check the property and attachment_id manually.
	 */
	public is_attachment: boolean = false;

	/**
	 * Determines whether the query is for an existing single post of any post type
	 * (post, attachment, page, custom post types).
	 *
	 * @since 2.1.0
	 * @note For parameter-based checks, check the property and post_type query_var manually.
	 */
	public is_singular: boolean = false;

	/**
	 * Determines whether the query is for the robots.txt file.
	 *
	 * @since 2.1.0
	 */
	public is_robots: boolean = false;

	/**
	 * Determines whether the query is for the favicon.ico file.
	 *
	 * @since 5.4.0
	 */
	public is_favicon: boolean = false;

	/**
	 * Signifies whether the current query is for the page_for_posts page.
	 *
	 * Basically, the homepage if the option isn't set for the static homepage.
	 *
	 * @since 2.1.0
	 */
	public is_posts_page: boolean = false;

	/**
	 * Determines whether the query is for an existing post type archive page.
	 *
	 * @since 3.1.0
	 * @note For parameter-based checks, check the property and query_vars manually.
	 */
	public is_post_type_archive: boolean = false;

	/**
	 * Set if post thumbnails are cached
	 *
	 * @since 3.2.0
	 */
	public thumbnails_cached: boolean = false;

	/**
	 * Stores the query_vars state hash to detect changes.
	 *
	 * Contains a hash of the query_vars to detect if they have changed since
	 * the last parse. Used to determine if re-parsing is needed.
	 *
	 * @since 3.1.0
	 * @private
	 */
	private query_vars_hash: string | boolean = false;

	/**
	 * Whether query vars have changed since the initial parse_query() call.
	 *
	 * Tracks if query variables have been modified, used to detect changes
	 * made via hooks or direct modifications.
	 *
	 * @since 3.1.1
	 * @private
	 */
	private query_vars_changed: boolean = true;

	/**
	 * Controls whether an attachment query should include filenames or not.
	 *
	 * Query parameter that determines if attachment queries should match by filename.
	 * This is part of the query structure.
	 *
	 * @since 6.0.3
	 * @protected
	 */
	protected allow_query_attachment_by_filename: boolean = false;

	/**
	 * Cached list of search stopwords.
	 *
	 * Contains stopwords used for search query processing.
	 * This is part of the query processing structure.
	 *
	 * @since 3.7.0
	 * @private
	 */
	private stopwords: string[] | null = null;

	/**
	 * The cache key generated by the query.
	 *
	 * Contains a cache key generated from the normalized query parameters.
	 * Used for caching query results (not implemented in this class).
	 *
	 * @since 6.8.0
	 * @private
	 */
	private query_cache_key: string = "";

	/**
	 * Constructor.
	 *
	 * @since 1.5.0
	 *
	 * @param query Optional. Query string or object to initialize with.
	 */
	constructor(
		query?: string | WP_Query_Vars | Record<string, unknown>
	) {
		if (query) {
			let parsedQuery: Record<string, unknown>;
			if (typeof query === "string") {
				try {
					parsedQuery = JSON.parse(query) as Record<string, unknown>;
					this.query = parsedQuery as WP_Query_Vars;
				} catch {
					this.query = {} as WP_Query_Vars;
					parsedQuery = {};
				}
			} else {
				parsedQuery = query as Record<string, unknown>;
				this.query = query as WP_Query_Vars;
			}
			this.query_vars = { ...this.query };
			
			// Extract tax_query, meta_query, and date_query from the input
			if ("tax_query" in parsedQuery) {
				this.tax_query = parsedQuery.tax_query;
			}
			if ("meta_query" in parsedQuery) {
				this.meta_query = parsedQuery.meta_query;
			}
			if ("date_query" in parsedQuery) {
				this.date_query = parsedQuery.date_query;
			}
		}
		
		// Initialize private properties
		this.query_vars_hash = false;
		this.query_vars_changed = true;
		this.query_cache_key = "";
	}

	/**
	 * Resets query flags to false.
	 *
	 * Initializes all boolean query flags (is_single, is_page, is_archive, etc.) to false.
	 * These flags indicate what type of query this is based on the query parameters.
	 *
	 * @since 2.0.0
	 * @private
	 */
	private init_query_flags(): void {
		this.is_single = false;
		this.is_preview = false;
		this.is_page = false;
		this.is_archive = false;
		this.is_date = false;
		this.is_year = false;
		this.is_month = false;
		this.is_day = false;
		this.is_time = false;
		this.is_author = false;
		this.is_category = false;
		this.is_tag = false;
		this.is_tax = false;
		this.is_search = false;
		this.is_feed = false;
		this.is_comment_feed = false;
		this.is_trackback = false;
		this.is_home = false;
		this.is_privacy_policy = false;
		this.is_404 = false;
		this.is_embed = false;
		this.is_paged = false;
		this.is_admin = false;
		this.is_attachment = false;
		this.is_singular = false;
		this.is_robots = false;
		this.is_favicon = false;
		this.is_posts_page = false;
		this.is_post_type_archive = false;
	}

	/**
	 * Resets the query flags and query vars.
	 *
	 * Clears all query parameters and resets query flags to their default state.
	 * This prepares the query object for a new query.
	 *
	 * @since 1.5.0
	 */
	public init(): void {
		this.query = null;
		this.query_vars = {};
		this.queried_object = null;
		this.queried_object_id = null;
		this.tax_query = null;
		this.meta_query = false;
		this.date_query = false;
		this.query_vars_hash = false;
		this.query_vars_changed = true;
		this.query_cache_key = "";

		this.init_query_flags();
	}

	/**
	 * Retrieves the value of a query variable.
	 *
	 * Gets a specific query parameter value from query_vars.
	 *
	 * @since 1.5.0
	 *
	 * @param query_var     Query variable key (e.g., 'post_type', 'posts_per_page').
	 * @param default_value Optional. Value to return if the query variable is not set. Default empty string.
	 * @return The query variable value, or default_value if not set.
	 */
	public get(query_var: string, default_value: unknown = ""): unknown {
		if (this.query_vars[query_var] !== undefined) {
			return this.query_vars[query_var];
		}

		return default_value;
	}

	/**
	 * Sets the value of a query variable.
	 *
	 * Updates a specific query parameter in query_vars.
	 * Automatically marks query_vars as changed for hash tracking.
	 *
	 * @since 1.5.0
	 *
	 * @param query_var Query variable key (e.g., 'post_type', 'posts_per_page').
	 * @param value     Query variable value to set.
	 */
	public set(query_var: string, value: unknown): void {
		this.query_vars[query_var] = value;
		this.query_vars_changed = true;
	}

	/**
	 * Reparses the query vars.
	 *
	 * Fills in missing query variables with defaults and updates the query vars hash
	 * to track changes. This normalizes the query parameters.
	 *
	 * @since 1.5.0
	 */
	public parse_query_vars(): void {
		// Fill in missing query vars with defaults
		this.query_vars = this.fill_query_vars(this.query_vars);

		// Get post_type for validation messages (but not needed for wvcClient methods)
		const postType = this.get("post_type");
		const postTypeKey = Array.isArray(postType) 
			? (postType.length > 0 ? String(postType[0]) : "post")
			: (postType ? String(postType) : "post");
		
		// Get allowed taxonomies and meta fields from wvcClient
		// Always include default taxonomies, then merge with returned ones
		let allowedTaxonomies: string[] = [...DEFAULT_TAXONOMIES];
		let allowedMetaFields: string[] = [];
		
		if (typeof wvcClient !== "undefined" && wvcClient) {
			// Get taxonomies from wvcClient for this post_type
			const returnedTaxonomies = wvcClient.get_allowed_taxonomies?.(postTypeKey);
			// Handle empty array, null, or undefined - use defaults in those cases
			if (Array.isArray(returnedTaxonomies) && returnedTaxonomies.length > 0) {
				allowedTaxonomies = [...new Set([...DEFAULT_TAXONOMIES, ...returnedTaxonomies])];
			}
			// If returnedTaxonomies is empty/null/undefined, allowedTaxonomies already has DEFAULT_TAXONOMIES
			
			// Get meta fields from wvcClient for this post_type
			const returnedMetaFields = wvcClient.get_allowed_meta?.(postTypeKey);
			// Handle empty array, null, or undefined - use empty array in those cases
			if (Array.isArray(returnedMetaFields) && returnedMetaFields.length > 0) {
				allowedMetaFields = returnedMetaFields;
			}
			// If returnedMetaFields is empty/null/undefined, allowedMetaFields remains empty array
		}

		// Validate query_vars parameters against allowed taxonomies and meta fields
		// This helps catch typos or invalid parameters early
		const invalidParams: string[] = [];
		const standardWPParams = new Set([
			"error", "m", "p", "post_parent", "subpost", "subpost_id", "attachment", "attachment_id",
			"name", "pagename", "page_id", "second", "minute", "hour", "day", "monthnum", "year", "w",
			"category_name", "tag", "cat", "tag_id", "author", "author_name", "feed", "tb", "paged",
			"meta_key", "meta_value", "preview", "s", "sentence", "title", "menu_order",
			"category__in", "category__not_in", "category__and", "post__in", "post__not_in", "post_name__in",
			"tag__in", "tag__not_in", "tag__and", "tag_slug__in", "tag_slug__and",
			"post_parent__in", "post_parent__not_in", "author__in", "author__not_in", "search_columns",
			"post_type", "post_status", "posts_per_page", "posts_per_archive_page", "nopaging", "offset",
			"order", "orderby", "ignore_sticky_posts", "suppress_filters", "no_found_rows",
			"per_page", "page", "search", "status", "slug", "include", "exclude"
		]);

		for (const key in this.query_vars) {
			const value = this.query_vars[key];
			// Skip empty values, standard WordPress params, and params that are already in tax_query/meta_query
			if (value === undefined || value === null || value === "" || standardWPParams.has(key)) {
				continue;
			}
			
			// Check if this parameter is a valid taxonomy or meta field
			if (!allowedTaxonomies.includes(key) && !allowedMetaFields.includes(key)) {
				invalidParams.push(key);
			}
		}

		// if (invalidParams.length > 0 && typeof console !== "undefined" && console.warn) {
		// 	console.warn(
		// 		`WP_Query: Unknown parameters for post_type "${postTypeKey}" that are not in allowed taxonomies or meta fields: ${invalidParams.join(", ")}. ` +
		// 		`These will be left in query_vars but may not be processed correctly.`
		// 	);
		// }

		// Check for name collisions between taxonomies and meta fields
		// WordPress doesn't have this issue because tax_query and meta_query are separate parameters,
		// but in our simplified API, we need to handle collisions.
		// Precedence: Taxonomies are processed first (WordPress best practice - taxonomies are more performant)
		const collisions = allowedTaxonomies.filter(tax => allowedMetaFields.includes(tax));
		if (collisions.length > 0 && typeof console !== "undefined" && console.warn) {
			console.warn(
				`WP_Query: Name collision detected between taxonomies and meta fields for post_type "${postTypeKey}": ${collisions.join(", ")}. ` +
				`Taxonomies will take precedence. To use as meta fields, remove from allowed taxonomies or use meta_query directly.`
			);
		}

		// Convert taxonomy parameters from query_vars to tax_query format
		// This is the proper WordPress way to handle taxonomy queries
		// Note: Taxonomies are processed first, so they take precedence over meta fields with the same name
		const taxQueries: Array<Record<string, unknown>> = [];
		const taxonomiesToRemove: string[] = [];
		
		// Process each allowed taxonomy
		for (const taxonomy of allowedTaxonomies) {
			const taxonomyValue = this.query_vars[taxonomy];
			
			// Check if this taxonomy parameter exists and has a value
			if (taxonomyValue !== undefined && taxonomyValue !== null && taxonomyValue !== "") {
				const terms = Array.isArray(taxonomyValue) 
					? taxonomyValue 
					: [taxonomyValue];
				
				// Only add if we have valid terms
				if (terms.length > 0 && terms.some(term => term !== null && term !== undefined && term !== "")) {
					taxQueries.push({
						taxonomy: taxonomy,
						field: "term_id",
						terms: terms.filter(term => term !== null && term !== undefined && term !== ""),
						operator: "IN"
					});
					
					// Mark this taxonomy for removal from query_vars
					taxonomiesToRemove.push(taxonomy);
				}
			}
		}
		
		// Set tax_query if we have any taxonomy queries
		// WordPress tax_query structure: array with 'relation' as a top-level property (when multiple queries)
		// For JSON serialization to PHP backend, we use object format: {relation: "AND", "0": {...}, "1": {...}}
		if (taxQueries.length > 0) {
			// If there's already a tax_query, merge with it
			if (this.tax_query && typeof this.tax_query === "object") {
				let existingQueries: Array<Record<string, unknown>> = [];
				let relation = "AND";
				
				if (Array.isArray(this.tax_query)) {
					// Array format: check if first element has relation
					const arr = this.tax_query as Array<Record<string, unknown>>;
					if (arr.length > 0 && "relation" in (arr[0] || {})) {
						relation = (arr[0] as Record<string, unknown>).relation as string || "AND";
						existingQueries = arr.slice(1);
					} else {
						existingQueries = arr;
					}
				} else {
					// Object format: extract relation and queries
					const obj = this.tax_query as Record<string, unknown>;
					relation = (obj.relation as string) || "AND";
					existingQueries = Object.keys(obj)
						.filter(k => k !== "relation" && !isNaN(Number(k)))
						.sort((a, b) => Number(a) - Number(b))
						.map(k => obj[k] as Record<string, unknown>)
						.filter(q => q && typeof q === "object");
				}
				
				// Merge: replace existing clauses for the same taxonomy, keep others.
				// This prevents stale base clauses (e.g. parent product_cat) from
				// staying alongside newly selected clauses for that taxonomy.
				const newTaxonomies = new Set(
					taxQueries
						.map((q) => q.taxonomy)
						.filter((t): t is string => typeof t === "string" && t.length > 0)
				);
				const preservedExistingQueries = existingQueries.filter((q) => {
					const taxonomy = q?.taxonomy;
					return !(typeof taxonomy === "string" && newTaxonomies.has(taxonomy));
				});
				const allQueries = [...preservedExistingQueries, ...taxQueries];
				if (allQueries.length === 1) {
					// Single query: use array format
					this.tax_query = allQueries;
				} else {
					// Multiple queries: use object format with relation
					this.tax_query = {
						relation: relation,
						...allQueries.reduce((acc, q, i) => ({ ...acc, [String(i)]: q }), {})
					};
				}
			} else {
				// No existing tax_query, create new one
				if (taxQueries.length === 1) {
					// Single query: use array format
					this.tax_query = taxQueries;
				} else {
					// Multiple queries: use object format with relation property
					this.tax_query = {
						relation: "AND",
						...taxQueries.reduce((acc, q, i) => ({ ...acc, [String(i)]: q }), {})
					};
				}
			}
			
			// Remove taxonomy parameters from query_vars so they exist only in tax_query:
			// single source of truth, correct toJSON() shape for backend, and no double-counting in hashes.
			const restQueryVars: Record<string, unknown> = {};
			for (const key in this.query_vars) {
				if (!taxonomiesToRemove.includes(key)) {
					restQueryVars[key] = this.query_vars[key];
				}
			}
			this.query_vars = restQueryVars as WP_Query_Vars;
		}

		// Convert meta_key and meta_value to meta_query format
		// This is the standard WordPress way to handle meta queries
		const metaQueries: Array<Record<string, unknown>> = [];
		const metaFieldsToRemove: string[] = [];
		
		// Handle standard meta_key and meta_value
		if (this.query_vars.meta_key !== undefined && this.query_vars.meta_key !== null && this.query_vars.meta_key !== "") {
			const metaKey = String(this.query_vars.meta_key);
			const metaValue = this.query_vars.meta_value;
			
			if (metaValue !== undefined && metaValue !== null && metaValue !== "") {
				metaQueries.push({
					key: metaKey,
					value: metaValue,
					compare: "="
				});
				
				metaFieldsToRemove.push("meta_key", "meta_value");
			}
		}
		
		// Handle custom meta fields from allowedMetaFields list
		// Note: If a parameter name exists in both allowedTaxonomies and allowedMetaFields,
		// it will have already been processed as a taxonomy above (taxonomies take precedence)
		for (const metaField of allowedMetaFields) {
			// Skip if this was already processed as a taxonomy (collision handling)
			if (taxonomiesToRemove.includes(metaField)) {
				continue;
			}
			
			const metaFieldValue = this.query_vars[metaField];
			
			// Check if this meta field parameter exists and has a value
			if (metaFieldValue !== undefined && metaFieldValue !== null && metaFieldValue !== "") {
				metaQueries.push({
					key: metaField,
					value: metaFieldValue,
					compare: "="
				});
				
				// Mark this meta field for removal from query_vars
				metaFieldsToRemove.push(metaField);
			}
		}
		
		// Set meta_query if we have any meta queries
		// WordPress meta_query structure: array with 'relation' as a top-level property (when multiple queries)
		// For JSON serialization to PHP backend, we use object format: {relation: "AND", "0": {...}, "1": {...}}
		if (metaQueries.length > 0) {
			// If there's already a meta_query, merge with it
			if (this.meta_query && typeof this.meta_query === "object") {
				let existingQueries: Array<Record<string, unknown>> = [];
				let relation = "AND";
				
				if (Array.isArray(this.meta_query)) {
					// Array format: check if first element has relation
					const arr = this.meta_query as Array<Record<string, unknown>>;
					if (arr.length > 0 && "relation" in (arr[0] || {})) {
						relation = (arr[0] as Record<string, unknown>).relation as string || "AND";
						existingQueries = arr.slice(1);
					} else {
						existingQueries = arr;
					}
				} else {
					// Object format: extract relation and queries
					const obj = this.meta_query as Record<string, unknown>;
					relation = (obj.relation as string) || "AND";
					existingQueries = Object.keys(obj)
						.filter(k => k !== "relation" && !isNaN(Number(k)))
						.sort((a, b) => Number(a) - Number(b))
						.map(k => obj[k] as Record<string, unknown>)
						.filter(q => q && typeof q === "object");
				}
				
				// Merge: combine existing and new queries
				const allQueries = [...existingQueries, ...metaQueries];
				if (allQueries.length === 1) {
					// Single query: use array format
					this.meta_query = allQueries;
				} else {
					// Multiple queries: use object format with relation
					this.meta_query = {
						relation: relation,
						...allQueries.reduce((acc, q, i) => ({ ...acc, [String(i)]: q }), {})
					};
				}
			} else {
				// No existing meta_query, create new one
				if (metaQueries.length === 1) {
					// Single query: use array format
					this.meta_query = metaQueries;
				} else {
					// Multiple queries: use object format with relation property
					this.meta_query = {
						relation: "AND",
						...metaQueries.reduce((acc, q, i) => ({ ...acc, [String(i)]: q }), {})
					};
				}
			}
			
			// Remove meta parameters from query_vars since they're now in meta_query
			const restQueryVars: Record<string, unknown> = {};
			for (const key in this.query_vars) {
				if (!metaFieldsToRemove.includes(key)) {
					restQueryVars[key] = this.query_vars[key];
				}
			}
			this.query_vars = restQueryVars as WP_Query_Vars;
		}

		// Update query vars hash to track changes
		const hash = this.generate_query_vars_hash(this.query_vars);
		if (hash !== this.query_vars_hash) {
			this.query_vars_changed = true;
			this.query_vars_hash = hash;
		}
	}

	/**
	 * Generates a hash of query vars for change detection.
	 *
	 * @private
	 * @param query_vars Query variables to hash.
	 * @return Hash string.
	 */
	private generate_query_vars_hash(query_vars: WP_Query_Vars): string {
		// Create a simple hash by stringifying and hashing the query vars
		// In a full implementation, this would use a proper hash function
		try {
			const serialized = JSON.stringify(query_vars);
			// Simple hash function (similar to PHP's md5)
			let hash = 0;
			for (let i = 0; i < serialized.length; i++) {
				const char = serialized.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash = hash & hash; // Convert to 32-bit integer
			}
			return hash.toString(36);
		} catch {
			return "";
		}
	}

	/**
	 * Fills in the query variables, which do not exist within the parameter.
	 *
	 * Ensures all standard query variables have default values (empty strings for scalars,
	 * empty arrays for array parameters). This normalizes the query structure.
	 *
	 * @since 2.1.0
	 * @since 4.5.0 Removed the `comments_popup` public query variable.
	 *
	 * @param query_vars Defined query variables to fill.
	 * @return Complete query variables with undefined ones filled with empty defaults.
	 */
	public fill_query_vars(query_vars: WP_Query_Vars): WP_Query_Vars {
		// Create a copy to preserve all existing keys (including custom ones like product_cat, per_page, etc.)
		const filled: WP_Query_Vars = { ...query_vars };
		
		const keys: (keyof WP_Query_Vars)[] = [
			"error",
			"m",
			"p",
			"post_parent",
			"subpost",
			"subpost_id",
			"attachment",
			"attachment_id",
			"name",
			"pagename",
			"page_id",
			"second",
			"minute",
			"hour",
			"day",
			"monthnum",
			"year",
			"w",
			"category_name",
			"tag",
			"cat",
			"tag_id",
			"author",
			"author_name",
			"feed",
			"tb",
			"paged",
			"meta_key",
			"meta_value",
			"preview",
			"s",
			"sentence",
			"title",
			"menu_order",
		];

		for (const key of keys) {
			if (filled[key] === undefined) {
				(filled as Record<string, unknown>)[key] = "";
			}
		}

		const arrayKeys: (keyof WP_Query_Vars)[] = [
			"category__in",
			"category__not_in",
			"category__and",
			"post__in",
			"post__not_in",
			"post_name__in",
			"tag__in",
			"tag__not_in",
			"tag__and",
			"tag_slug__in",
			"tag_slug__and",
			"post_parent__in",
			"post_parent__not_in",
			"author__in",
			"author__not_in",
			"search_columns",
		];

		for (const key of arrayKeys) {
			if (filled[key] === undefined) {
				(filled as Record<string, unknown>)[key] = [];
			}
		}

		return filled;
	}

	/**
	 * Sets up query variables from the provided query.
	 *
	 * Initializes query variables from the provided query and prepares them for use.
	 * This is the main entry point for setting up a post query.
	 *
	 * @since 1.5.0
	 *
	 * @param query Query string (JSON) or object containing query parameters.
	 * @return WP_Post[]|number[] Empty array (query execution not implemented).
	 * @note In TypeScript, this method is named query_posts() to avoid conflict with the query property.
	 *       In PHP, both the property and method are named 'query'. Use query_posts() in TypeScript.
	 * @note Query execution is not implemented. This method sets up query parameters only.
	 */
	public query_posts(query: string | WP_Query_Vars | Record<string, unknown>): WP_Post[] | number[] {
		this.init();
		let parsedQuery: Record<string, unknown>;
		if (typeof query === "string") {
			try {
				parsedQuery = JSON.parse(query) as Record<string, unknown>;
				this.query = parsedQuery as WP_Query_Vars;
			} catch {
				this.query = {} as WP_Query_Vars;
				parsedQuery = {};
			}
		} else {
			parsedQuery = query as Record<string, unknown>;
			this.query = query as WP_Query_Vars;
		}
		this.query_vars = { ...this.query };
		
		// Extract tax_query, meta_query, and date_query from the input
		if ("tax_query" in parsedQuery) {
			this.tax_query = parsedQuery.tax_query;
		}
		if ("meta_query" in parsedQuery) {
			this.meta_query = parsedQuery.meta_query;
		}
		if ("date_query" in parsedQuery) {
			this.date_query = parsedQuery.date_query;
		}
		
		// Note: get_posts() is not implemented as per requirements
		// Query execution is not part of this class - it represents query parameters only
		return [];
	}

	/**
	 * Sets the 404 status and assigns queried object to null.
	 *
	 * Marks the query as a 404 (not found) and resets query flags.
	 * Preserves the is_feed flag if it was set.
	 *
	 * @since 1.5.0
	 */
	public set_404(): void {
		const is_feed = this.is_feed;

		this.init_query_flags();
		this.is_404 = true;

		this.is_feed = is_feed;

		// In a full implementation, this would fire a 'set_404' action
	}


	/**
	 * Retrieves the currently queried object.
	 *
	 * Returns the object that the query is targeting (e.g., category term, post type,
	 * single post, author). This represents what is being queried, not query results.
	 *
	 * @since 1.5.0
	 *
	 * @return WP_Term|WP_Post_Type|WP_Post|WP_User|null The queried object, or null if not set.
	 * @note In a full implementation, this would determine the queried object from query_vars
	 *       if not already set. Currently returns the stored queried_object property.
	 */
	public get_queried_object(): WP_Term | WP_Post_Type | WP_Post | WP_User | null {
		return this.queried_object;
	}

	/**
	 * Retrieves the ID of the currently queried object.
	 *
	 * Returns the ID of the object that the query is targeting.
	 * This represents what is being queried, not query results.
	 *
	 * @since 1.5.0
	 *
	 * @return number|null The queried object ID, or null if not set.
	 */
	public get_queried_object_id(): number | null {
		return this.queried_object_id;
	}

	/**
	 * Determines whether the query is for the front page of the site.
	 *
	 * Checks if the query is for the site's front page (homepage and not paged).
	 * This is a computed property based on is_home and is_paged flags.
	 *
	 * @since 2.5.0
	 *
	 * @return boolean Whether the query is for the front page.
	 */
	public is_front_page(): boolean {
		return this["is_home"] && !this["is_paged"];
	}

	/**
	 * Determines whether the query is the main query.
	 *
	 * Checks if this query instance is the main WordPress query.
	 * In WordPress, the main query is the primary query for the current page request.
	 *
	 * @since 3.3.0
	 *
	 * @return boolean Whether the query is the main query.
	 * @note In a full implementation, this would check against a global main query instance.
	 *       Currently returns false as there's no global context in this TypeScript implementation.
	 */
	public is_main_query(): boolean {
		// In a real implementation, this would check against a global main query
		// For now, we'll return false as we don't have a global context
		return false;
	}

	/**
	 * Gets the hash of the current query variables.
	 *
	 * Returns a hash string representing the current query_vars state.
	 * This can be used for comparison, caching, or change detection.
	 *
	 * @return string Hash string representing the query variables.
	 */
	public getHash(): string {
		// Ensure hash is up to date
		this.parse_query_vars();
		const baseHash = typeof this.query_vars_hash === "string" ? this.query_vars_hash : this.generate_query_vars_hash(this.query_vars);
		const taxHash = this.tax_query ? this.generate_query_vars_hash(this.tax_query as WP_Query_Vars) : "";
		const metaHash = this.meta_query ? this.generate_query_vars_hash(this.meta_query as WP_Query_Vars) : "";
		return baseHash + taxHash + metaHash;
	}

	/**
	 * Compares this WP_Query instance with another instance for equality.
	 *
	 * Two query instances are considered equal if their query_vars produce the same hash.
	 * This is equivalent to comparing the query parameters, not the query results.
	 *
	 * @param other The other WP_Query instance to compare with.
	 * @return boolean True if both instances have the same query parameters (same hash), false otherwise.
	 */
	public equals(other: WP_Query): boolean {
		if (!other || !(other instanceof WP_Query)) {
			return false;
		}
		return this.getHash() === other.getHash();
	}

	/**
	 * Serializes the query to a JSON-compatible object.
	 *
	 * Returns the parsed and validated query parameters along with complex query structures
	 * (meta_query, tax_query, date_query) as a plain object that can be serialized to JSON
	 * or passed to modules that don't know about the WP_Query class.
	 *
	 * The query_vars are parsed and validated (using parse_query_vars()) before serialization,
	 * ensuring the returned object contains normalized query parameters rather than the original
	 * raw input.
	 *
	 * @since 1.5.0
	 *
	 * @return An object containing query_vars, meta_query, tax_query, and date_query.
	 *         This object can be serialized with JSON.stringify() or passed to other modules.
	 */
	public toJSON(): {
		query_vars: Record<string, unknown>;
		meta_query: Record<string, unknown> | false;
		tax_query: Record<string, unknown> | null;
		date_query: Record<string, unknown> | false;
	} {
		// Ensure query_vars are parsed and validated
		this.parse_query_vars();

		return {
			query_vars: { ...this.query_vars },
			meta_query: this.meta_query as Record<string, unknown> | false,
			tax_query: this.tax_query as Record<string, unknown> | null,
			date_query: this.date_query as Record<string, unknown> | false,
		};
	}




}
