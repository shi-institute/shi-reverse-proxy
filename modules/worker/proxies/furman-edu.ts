import furmanDarkModeOverrides from '../../static/furman-edu-dark-mode.html';
import furmanHomeOverrides from '../../static/furman-edu-home-overrides.css';
import furmanOverrides from '../../static/furman-edu-overrides.css';
import furmanVideoPrefersReducedMotionSupport from '../../static/furman-edu-video-reduce-motion-support.html';
import type { ReverseProxyHandler } from '../common/Handler';
import { ReverseProxy } from '../common/ReverseProxy';
import { getFooterHTML } from '../footer';
import { getInjectableNavigation } from '../menu';
import { rewrites } from '../redirects';

const FURMAN_EDU_ORIGIN = 'https://www.furman.edu';
const SHI_INSTITUTE_BASE = '/shi-institute';
const FURMAN_THEME_ASSETS_BASE = '/wp-content/themes/furman';
const PEOPLE_BASE = '/people';

const approvedPersonTypes = ['staff', 'affiliates', 'fellows'];

/**
 * Proxies all requests for the following:
 *
 * - /shi-institute and its subdirectories to the shi-institute subdirectory on furman.edu
 * - /wp-content/themes/furman and its subdirectories to the furman theme assets on furman.edu
 * - /people/{slug} to the corresponding person page on furman.edu, where {slug} is the person's
 *   slug on furman.edu. This is used for faculty and staff profile pages.
 *
 * Additionally, the home page (/) is re-written to show the content from
 * furman.edu/shi-institute/new-home while keeping the URL as / in the browser.
 */
export default {
	async fetch({ request, requestUrl, originalRequestUrl }, env, ctx) {
		const isShiInstituteRequest = requestUrl.pathname.startsWith(SHI_INSTITUTE_BASE);
		const isFurmanThemeAssetsRequest = requestUrl.pathname.startsWith(FURMAN_THEME_ASSETS_BASE);
		const isPeopleRequest = requestUrl.pathname.startsWith(PEOPLE_BASE) && requestUrl.pathname.split('/').length >= 3; // only match /
		if (!isShiInstituteRequest && !isFurmanThemeAssetsRequest && !isPeopleRequest) {
			return;
		}

		// re-write the request URL to point to furman.edu/people/{slug} when it is a person page
		let personType: string | null = null;
		if (isPeopleRequest) {
			const parts = requestUrl.pathname.split('/');

			// only accept /people/{personType}/{slug}/ and /people/{slug}/, but not /people/ or /people/{personType}/
			if (parts.length < 4) {
				if (process.env.DEVELOPMENT) {
					console.debug(`Rejecting request to ${requestUrl.pathname} because it does not have enough parts to be a valid person page`);
				}
				return;
			}

			// structure is /people/{slug}/
			if (parts.length === 4) {
				const slug = parts[2];

				if (!slug) {
					if (process.env.DEVELOPMENT) {
						console.debug('slug is empty:', { slug, requestUrl });
					}
					return;
				}

				// block slugs that are actually a person type
				if (approvedPersonTypes.includes(slug)) {
					if (process.env.DEVELOPMENT) {
						console.debug(
							`Rejecting request to ${requestUrl.pathname} because the slug is actually a person type, which is not allowed in the URL structure without a person type`,
						);
					}
					return;
				}
			}

			// structure is /people/{personType}/{slug}
			if (parts.length === 5) {
				const foundPersonType = requestUrl.pathname.split('/')[2] ?? null;
				if (foundPersonType && approvedPersonTypes.includes(foundPersonType)) {
					personType = foundPersonType;
					requestUrl.pathname = requestUrl.pathname.replace(`/people/${personType}/`, '/people/');
				} else {
					if (process.env.DEVELOPMENT) {
						console.debug(`Rejecting request to ${requestUrl.pathname} because it has an invalid person type`);
					}
					return;
				}
			}

			if (parts.length > 5) {
				if (process.env.DEVELOPMENT) {
					console.debug(`Rejecting request to ${requestUrl.pathname} because it has too many parts to be a valid person page`);
				}
				return;
			}
		}

		// redirect requests for uploaded files instead of proxying
		if (requestUrl.pathname.includes('wp-content/uploads')) {
			return Response.redirect(new URL(requestUrl.pathname + requestUrl.search, FURMAN_EDU_ORIGIN), 307);
		}

		ctx.props.adminBarHref = `${FURMAN_EDU_ORIGIN}${SHI_INSTITUTE_BASE}/wp-admin`;

		const fuProxy = new ReverseProxy({
			originServer: new URL('https://www.furman.edu/shi-institute'),
			staleWhileRevalidate: 43200, // 12 hours
			afterBodyReplacements: async (body, requestUrl, contentType) => {
				if (contentType.includes('text/html') && typeof body === 'string') {
					// hide furman.edu navigation elements
					body = body.replace(
						'</head>',
						`<style>#app > .alert, #app > header, #app > footer, body > footer, .section-menu-wrapper, #section-menu-container { display: none !important; }</style></head>`,
					);

					// Replace all relative paths (href="/something") with absolute paths (href="https://www.furman.edu/something")
					// except for paths that start with /shi-institute or /people. We only want to proxy the /shi-institute subdirectory,
					// so we want to keep links to other parts of the furman.edu site on the furman.edu origin.
					body = body.replace(/(href|src|srcset)=["']\/(?!(?:shi-institute|people))([^"']*)["']/g, (match, attr, value) => {
						if (attr === 'srcset' && typeof value === 'string') {
							// handle comma-separated list in srcset
							const updatedSrcset = value
								.split(',')
								.map((item) => {
									const parts = item.trim().split(' ');
									// If it does not already look like an absolute URL, prepend the furman.edu origin
									if (parts[0]?.startsWith('/')) {
										parts[0] = `https://www.furman.edu${parts[0]}`;
									} else if (!parts[0]?.startsWith('http')) {
										parts[0] = `https://www.furman.edu/${parts[0]}`;
									}
									return parts.join(' ');
								})
								.join(', ');

							return `${attr}="${updatedSrcset}"`;
						}

						return `${attr}="https://www.furman.edu/${value}"`;
					});

					// Replace all relative link paths that correspond to an alias with the alias.
					body = body.replaceAll(new RegExp(`\\bhref\\s*=\\s*["'](\\/[^"']*)["']`, 'gi'), (match, originalHref, value) => {
						if (Object.keys(rewrites).includes(originalHref)) {
							const aliasPath = rewrites[originalHref];
							return `href="${aliasPath}"`;
						}

						return match;
					});

					// inject our own navigation elements after the skip link for keyboard users
					const skipLinkOuterHTML = body.match(/<a\b[^>]*\brole-action\s*=\s*["']skip-link["'][^>]*>[\s\S]*?<\/a>/i)?.[0];
					if (skipLinkOuterHTML) {
						body = body.replace(skipLinkOuterHTML, skipLinkOuterHTML + (await getInjectableNavigation(ctx, originalRequestUrl)));
					}

					// inject CSS overrides
					body = body.replace(
						'<meta charset="utf-8">',
						`<meta charset="utf-8"><style>${furmanOverrides}</style><!-- dark-mode --><!-- home-mods --><!-- reduce-motion-mods -->`,
					);

					// inject dark mode support via darkreader
					body = body.replace('<!-- dark-mode -->', furmanDarkModeOverrides);

					// home page style modifications
					if (requestUrl.pathname === '/shi-institute/new-home/') {
						body = body.replace('<!-- home-mods -->', `<style>${furmanHomeOverrides}</style>`);
						body = body.replace('target="_blank" href="https://shi.institute/about/"', `href="${requestUrl.origin}/about/"`);
					}

					// use relative paths for shi.institute origin references
					body = body.replaceAll(new RegExp('https://shi.institute' + '/([^"\' ]*)', 'g'), (match, path) => {
						return `/${path}`;
					});

					// disable video autoplay and other animations when prefers-reduced-motion is set to reduced
					body = body.replace('<!-- reduce-motion-mods -->', furmanVideoPrefersReducedMotionSupport);

					// replace footer with the one from the WordPress blog site
					const footerHTML = await getFooterHTML(ctx);
					if (footerHTML) {
						body = body.replace(/<footer[\s\S]*?<\/footer>/, '');
						body = body.replace('</body>', `${footerHTML}</body>`);
					}
				}

				return body;
			},
		});

		// Since we want to use our main 404 page, we do not use 404 pages from furman.edu.
		const proxyResponse = await fuProxy.fetch(request.current);
		if (proxyResponse.status !== 404) {
			return proxyResponse;
		}

		// In the case of a 404 for a profile page, we need to undo the
		// URL rewrite so we can show the fallback page on the blog site.
		if (isPeopleRequest && personType) {
			requestUrl.pathname = requestUrl.pathname.replace('/people/', `/people/${personType}/`);
		}
	},
} satisfies ReverseProxyHandler<{ adminBarHref?: string }>;
