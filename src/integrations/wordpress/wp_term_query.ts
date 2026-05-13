/**
 * Taxonomy API: WP_Term_Query class.
 *
 * TypeScript representation of WordPress WP_Term_Query class
 * @package WordPress
 * @subpackage Taxonomy
 */


/**
 * Term query variables type
 */
export interface WP_Term_Query_Vars {
	[key: string]: unknown;
	taxonomy?: string | string[] | null;
	object_ids?: number | number[] | null;
	orderby?: string;
	order?: "ASC" | "DESC";
	hide_empty?: boolean | number;
	include?: number[] | string;
	exclude?: number[] | string;
	exclude_tree?: number[] | string;
	number?: number | string;
	offset?: number | string;
	fields?:
		| "all"
		| "all_with_object_id"
		| "ids"
		| "tt_ids"
		| "names"
		| "slugs"
		| "count"
		| "id=>parent"
		| "id=>name"
		| "id=>slug";
	name?: string | string[];
	slug?: string | string[];
	term_taxonomy_id?: number | number[] | string;
	hierarchical?: boolean;
	search?: string;
	name__like?: string;
	description__like?: string;
	pad_counts?: boolean;
	get?: string;
	child_of?: number;
	parent?: number | string;
	childless?: boolean;
	cache_domain?: string;
	cache_results?: boolean;
	update_term_meta_cache?: boolean;
	meta_key?: string | string[];
	meta_value?: string | string[];
	meta_compare?: string;
	meta_compare_key?: string;
	meta_type?: string;
	meta_type_key?: string;
	meta_query?: unknown;
}

/**
 * Class used for querying terms.
 *
 * Represents query parameters and structure for querying terms.
 * This class defines what to query, not the query results or execution.
 *
 *
 * @note This class represents the query parameters and structure only. Query execution,
 *       result properties (terms), and result formatting methods have been removed as they
 *       represent query results, not the query itself.
 */
export class WP_Term_Query {
	/**
	 * Metadata query container.
	 *
	 * Contains the meta query structure for filtering terms by metadata.
	 * This is part of the query parameters, not query results.
	 *
	 */
	public meta_query: unknown = false;

	
	/**
	 * Query vars set by the user.
	 *
	 * Contains the query parameters that define what terms to query for.
	 * These are the actual query arguments (taxonomy, orderby, include, etc.).
	 *
	 */
	public query_vars: WP_Term_Query_Vars = {};

	/**
	 * Default values for query vars.
	 *
	 * Contains the default values for all query parameters.
	 * Used when merging user-provided query vars with defaults.
	 *
	 */
	public query_var_defaults: WP_Term_Query_Vars = {
		taxonomy: null,
		object_ids: null,
		orderby: "name",
		order: "ASC",
		hide_empty: true,
		include: [],
		exclude: [],
		exclude_tree: [],
		number: "",
		offset: "",
		fields: "all",
		name: "",
		slug: "",
		term_taxonomy_id: "",
		hierarchical: true,
		search: "",
		name__like: "",
		description__like: "",
		pad_counts: false,
		get: "",
		child_of: 0,
		parent: "",
		childless: false,
		cache_domain: "core",
		cache_results: true,
		update_term_meta_cache: true,
		meta_query: "",
		meta_key: "",
		meta_value: "",
		meta_type: "",
		meta_compare: "",
	};


	/**
	 * Constructor.
	 *
	 * Sets up the term query, based on the query vars passed.
	 *
	 *
	 * @param query Optional. Query string or object to initialize with.
	 */
	constructor(query?: string | WP_Term_Query_Vars | Record<string, unknown>) {
		if (query) {
			if (typeof query === "string") {
				try {
					const parsed = JSON.parse(query) as WP_Term_Query_Vars;
					this.query_vars = { ...this.query_var_defaults, ...parsed };
				} catch {
					this.query_vars = { ...this.query_var_defaults };
				}
			} else {
				this.query_vars = { ...this.query_var_defaults, ...(query as WP_Term_Query_Vars) };
			}
		} else {
			this.query_vars = { ...this.query_var_defaults };
		}
	}

	/**
	 * Parse arguments passed to the term query with default query parameters.
	 *
	 * Normalizes and validates query parameters, merging them with defaults.
	 * Handles parameter normalization (e.g., converting strings to numbers,
	 * handling special parameter interactions like 'parent' overriding 'child_of').
	 *
	 *
	 * @param query Optional. WP_Term_Query arguments. If empty, uses current query_vars.
	 *              Can be a JSON string, object, or Record.
	 */
	public parse_query(query: string | WP_Term_Query_Vars | Record<string, unknown> = ""): void {
		let queryVars: WP_Term_Query_Vars;

		if (!query || (typeof query === "string" && query === "")) {
			// Create a copy to preserve all existing keys (including custom ones)
			queryVars = { ...this.query_vars };
		} else {
			if (typeof query === "string") {
				try {
					queryVars = JSON.parse(query) as WP_Term_Query_Vars;
				} catch {
					// Create a copy to preserve all existing keys (including custom ones)
					queryVars = { ...this.query_vars };
				}
			} else {
				// Create a copy to preserve all existing keys (including custom ones)
				queryVars = { ...(query as WP_Term_Query_Vars) };
			}
		}

		const taxonomies = queryVars.taxonomy
			? Array.isArray(queryVars.taxonomy)
				? queryVars.taxonomy
				: [queryVars.taxonomy]
			: null;

		// Merge with defaults - this preserves all custom keys from queryVars
		queryVars = { ...this.query_var_defaults, ...queryVars };

		// Normalize number and offset
		if (typeof queryVars.number === "string") {
			queryVars.number = queryVars.number === "" ? 0 : parseInt(queryVars.number, 10);
		}
		if (typeof queryVars.offset === "string") {
			queryVars.offset = queryVars.offset === "" ? 0 : parseInt(queryVars.offset, 10);
		}

		// 'parent' overrides 'child_of'
		if (queryVars.parent && typeof queryVars.parent === "number" && queryVars.parent > 0) {
			queryVars.child_of = 0;
		}

		// 'all' get parameter overrides several settings
		if (queryVars.get === "all") {
			queryVars.childless = false;
			queryVars.child_of = 0;
			queryVars.hide_empty = false;
			queryVars.hierarchical = false;
			queryVars.pad_counts = false;
		}

		queryVars.taxonomy = taxonomies;

		this.query_vars = queryVars;
	}

	/**
	 * Sets up the query parameters.
	 *
	 * Initializes query variables from the provided query and parses them.
	 * This is the main entry point for setting up a term query.
	 *
	 *
	 * @param query Query string (JSON) or object containing query parameters.
	 * @note Query execution is not implemented. This method sets up query parameters only.
	 */
	public query(query: string | WP_Term_Query_Vars | Record<string, unknown>): void {
		if (typeof query === "string") {
			try {
				this.query_vars = { ...this.query_var_defaults, ...(JSON.parse(query) as WP_Term_Query_Vars) };
			} catch {
				this.query_vars = { ...this.query_var_defaults };
			}
		} else {
			this.query_vars = { ...this.query_var_defaults, ...(query as WP_Term_Query_Vars) };
		}
		this.parse_query(this.query_vars);
	}

	/**
	 * Processes and normalizes the query parameters.
	 *
	 * Parses the current query_vars, normalizes them, and initializes meta_query.
	 * This method prepares the query structure but does not execute the query.
	 *
	 *
	 * @note Query execution is not implemented. This method parses and normalizes query parameters
	 *       but does not perform actual database queries or return results. The method name
	 *       is kept for WordPress compatibility, but it only processes query parameters.
	 */
	public get_terms(): void {
		this.parse_query(this.query_vars);

		// Initialize meta_query (stub - not implemented)
		this.meta_query = false;

		// Query execution is not implemented - this represents the query parameters only
	}

	/**
	 * Parse and sanitize 'orderby' keys passed to the term query.
	 *
	 * Validates and normalizes the orderby parameter. Returns the validated
	 * orderby value that can be used in the query structure.
	 *
	 *
	 * @param orderby_raw Alias for the field to order by (e.g., 'name', 'count', 'term_id').
	 * @return string|false Validated orderby value. Returns false if invalid or empty.
	 */
	protected parse_orderby(orderby_raw: string): string | false {
		if (!orderby_raw) {
			return false;
		}

		const orderby = orderby_raw.toLowerCase();

		// Standard term fields
		if (["term_id", "name", "slug", "term_group"].includes(orderby)) {
			return orderby;
		}

		// Term taxonomy fields
		if (["count", "parent", "taxonomy", "term_taxonomy_id", "description"].includes(orderby)) {
			return orderby;
		}

		// Special cases
		if (orderby === "term_order") {
			return "term_order";
		}

		if (orderby === "include" && Array.isArray(this.query_vars.include) && this.query_vars.include.length > 0) {
			return "include";
		}

		if (orderby === "slug__in" && Array.isArray(this.query_vars.slug) && this.query_vars.slug.length > 0) {
			return "slug__in";
		}

		if (orderby === "none") {
			return "none";
		}

		if (!orderby || orderby === "id" || orderby === "term_id") {
			return "term_id";
		}

		// Check for meta orderby
		const metaOrderby = this.parse_orderby_meta(orderby);
		if (metaOrderby) {
			return metaOrderby;
		}

		return "name";
	}


	/**
	 * Parse an 'orderby' param that is potentially related to a meta query.
	 *
	 * Validates orderby values that relate to term meta fields (e.g., 'meta_value',
	 * 'meta_value_num', or meta_query clause keys).
	 *
	 *
	 * @param orderby_raw Raw 'orderby' value passed to WP_Term_Query.
	 * @return string Validated meta orderby value, or empty string if not a meta orderby.
	 */
	protected parse_orderby_meta(orderby_raw: string): string {
		// In a full implementation, this would validate against meta_query clauses
		// For now, just validate known meta orderby values
		if (orderby_raw === "meta_value" || orderby_raw === "meta_value_num") {
			return orderby_raw;
		}

		// Could be a meta_query clause key
		if (this.meta_query && typeof this.meta_query === "object") {
			// In full implementation, would check meta_query clauses
			// For now, return empty string
		}

		return "";
	}

	/**
	 * Parse an 'order' query variable and cast it to ASC or DESC as necessary.
	 *
	 * Validates and normalizes the order direction parameter.
	 * Returns 'ASC' for ascending or 'DESC' for descending order.
	 *
	 *
	 * @param order The 'order' query variable ('ASC' or 'DESC', case-insensitive).
	 * @return "ASC" | "DESC" The sanitized 'order' query variable. Defaults to 'DESC' if invalid.
	 */
	protected parse_order(order: string): "ASC" | "DESC" {
		if (!order || typeof order !== "string") {
			return "DESC";
		}

		if (order.toUpperCase() === "ASC") {
			return "ASC";
		}

		return "DESC";
	}



	/**
	 * Generate cache key from query arguments.
	 *
	 * Creates a unique cache key based on the query parameters.
	 * This is used for caching query results (not implemented in this class).
	 *
	 *
	 * @param args WP_Term_Query arguments to generate cache key from.
	 * @return string Cache key string in format 'get_terms:{hash}'.
	 */
	protected generate_cache_key(args: WP_Term_Query_Vars): string {
		// Generate a hash from query arguments
		try {
			const serialized = JSON.stringify(args);
			let hash = 0;
			for (let i = 0; i < serialized.length; i++) {
				const char = serialized.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash = hash & hash; // Convert to 32-bit integer
			}
			return `get_terms:${hash.toString(36)}`;
		} catch {
			return "get_terms:0";
		}
	}

	/**
	 * Generates a hash of query vars for comparison.
	 *
	 * Creates a hash string from the current query_vars.
	 * This is used for comparison, caching, or change detection.
	 *
	 * @param query_vars Query variables to hash.
	 * @return string Hash string.
	 */
	private generate_query_vars_hash(query_vars: WP_Term_Query_Vars): string {
		// Create a simple hash by stringifying and hashing the query vars
		try {
			const serialized = JSON.stringify(query_vars);
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
	 * Gets the hash of the current query variables.
	 *
	 * Returns a hash string representing the current query_vars state.
	 * This can be used for comparison, caching, or change detection.
	 *
	 * @return string Hash string representing the query variables.
	 */
	public getHash(): string {
		// Ensure query is parsed and normalized
		this.parse_query(this.query_vars);
		return this.generate_query_vars_hash(this.query_vars);
	}

	/**
	 * Compares this WP_Term_Query instance with another instance for equality.
	 *
	 * Two query instances are considered equal if their query_vars produce the same hash.
	 * This is equivalent to comparing the query parameters, not the query results.
	 *
	 * @param other The other WP_Term_Query instance to compare with.
	 * @return boolean True if both instances have the same query parameters (same hash), false otherwise.
	 */
	public equals(other: WP_Term_Query): boolean {
		if (!other || !(other instanceof WP_Term_Query)) {
			return false;
		}
		return this.getHash() === other.getHash();
	}

	/**
	 * Serializes the query to a JSON-compatible object.
	 *
	 * Returns the parsed and validated query parameters along with complex query structures
	 * (meta_query) as a plain object that can be serialized to JSON or passed to modules
	 * that don't know about the WP_Term_Query class.
	 *
	 * The query_vars are parsed and validated (using parse_query()) before serialization,
	 * ensuring the returned object contains normalized query parameters rather than the original
	 * raw input.
	 *
	 * @return An object containing query_vars and meta_query.
	 *         This object can be serialized with JSON.stringify() or passed to other modules.
	 */
	public toJSON(): {
		query_vars: Record<string, unknown>;
		meta_query: Record<string, unknown> | false;
	} {
		// Ensure query_vars are parsed and validated
		this.parse_query(this.query_vars);

		return {
			query_vars: { ...this.query_vars },
			meta_query: this.meta_query as Record<string, unknown> | false,
		};
	}
}
