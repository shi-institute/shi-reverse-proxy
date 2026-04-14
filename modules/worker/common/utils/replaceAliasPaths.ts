import { rewrites } from '../../redirects';

/**
 * Replaces all relative link paths that correspond to an alias with the alias.
 * @param body string of the HTML body
 * @return the modified body with alias paths replaced
 */
export function replaceAliasPaths(body: string) {
	return body.replaceAll(new RegExp(`\\bhref\\s*=\\s*["'](\\/[^"']*)["']`, 'gi'), (match, originalHref, value) => {
		const originalUrl = new URL(originalHref, 'http://localhost');
		if (Object.keys(rewrites).includes(originalUrl.pathname)) {
			const aliasPath = rewrites[originalHref];
			return `href="${aliasPath + originalUrl.search}"`;
		}
		return match;
	});
}
