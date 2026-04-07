type SpeculationRulesEagerness = 'immediate' | 'eager' | 'moderate' | 'conservative';

type SpeculationRulesWhereCondition =
	| { href_matches: string | string[]; relative_to?: 'document' | 'ruleset' }
	| { selector_matches: string | string[] }
	| { and: SpeculationRulesWhereCondition[] }
	| { or: SpeculationRulesWhereCondition[] }
	| { not: SpeculationRulesWhereCondition };

interface SpeculationRulesDocumentRule {
	where: SpeculationRulesWhereCondition;
	eagerness?: SpeculationRulesEagerness;
	referrer_policy?: string;
	expects_no_vary_search?: string;
	tag?: string;
}

interface SpeculationRulesListRule {
	urls: string[];
	eagerness?: SpeculationRulesEagerness;
	referrer_policy?: string;
	expects_no_vary_search?: string;
	requires?: 'anonymous-client-ip-when-cross-origin'[];
	tag?: string;
}

type SpeculationRulesRule = SpeculationRulesDocumentRule | SpeculationRulesListRule;

interface SpeculationRulesConfig {
	/** Prefetch rules – fetches the document body only. */
	prefetch?: SpeculationRulesRule[];
	/** Prerender rules – fully renders the page in a hidden tab. */
	prerender?: SpeculationRulesRule[];
	/** Optional tag to identify the ruleset in Sec-Speculation-Tags request headers. */
	tag?: string;
}
