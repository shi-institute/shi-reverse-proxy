import xss, { type IFilterXSSOptions } from 'xss';

const INLINE_ONLY_CONFIG: IFilterXSSOptions = {
	allowList: {
		a: ['style', 'class', 'href', 'title', 'target', 'rel'],
		abbr: ['style', 'class', 'title'],
		time: ['style', 'class', 'datetime'],
		span: ['style', 'class'],
		b: ['style', 'class'],
		i: ['style', 'class'],
		em: ['style', 'class'],
		strong: ['style', 'class'],
		u: ['style', 'class'],
		s: ['style', 'class'],
		sub: ['style', 'class'],
		sup: ['style', 'class'],
		br: ['style', 'class'],
		small: ['style', 'class'],
		code: ['style', 'class'],
		kbd: ['style', 'class'],
		mark: ['style', 'class'],
	},
	// removes unrecognized tags while keeping their inner content (instead of escaping the < and > characters)
	stripIgnoreTag: true,
};

/**
 * Removes all non-inline tags from the given value and removes most attributes, leaving only a
 * small set of safe attributes on a limited set of tags.
 */
export function sanitizeInlineHtml(value: string) {
	return xss(value, INLINE_ONLY_CONFIG).trim();
}
