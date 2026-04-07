import type { ReverseProxyHandler } from '../common/Handler';
import { ReverseProxy } from '../common/ReverseProxy';
import { getFooterHTML } from '../footer';
import { getInjectableNavigation } from '../menu';

const SUSTAIN_SC_ORIGIN = 'https://www.sustainsouthcarolina.org';
const SLI_BASE = '/sli';

/**
 * Proxies /sli requests to https://www.sustainsouthcarolina.org/sli.
 */
export default {
	async fetch({ request, requestUrl, originalRequestUrl }, env, ctx) {
		if (!requestUrl.pathname.startsWith(SLI_BASE)) {
			return;
		}

		const sliProxy = new ReverseProxy({
			originServer: new URL(SLI_BASE, SUSTAIN_SC_ORIGIN),
			speculationRules: {
				prerender: [
					{
						where: {
							and: [{ href_matches: '/*' }, { not: { selector_matches: '[data-no-prefetch], .no-prefetch, .no-prefetch a' } }],
						},
						eagerness: 'moderate', // prerender on hover
					},
				],
			},
			async afterBodyReplacements(body, requestUrl, contentType) {
				if (contentType.includes('text/html') && typeof body === 'string') {
					// remove the header
					body = body.replace(/<header[\s\S]*?<\/header>/, '');

					// replace favicon
					body = body.replace(/<link[^>]*rel=["']icon["'][^>]*>/, `<link rel="icon" href="/favicon.ico">`);

					// replace title
					body = body.replace(
						/<title>[\s\S]*?<\/title>/,
						`<title>Sustainability Leadership Initiative (SLI) | Shi Institute + Sustain SC | Furman University</title>`,
					);

					// add fallback fonts
					body = body.replace(
						'</head>',
						`<style>
							body {
								--heading-font-font-family: "brandon-grotesque", Poppins, sans-serif;
							}
						</style></head>`,
					);

					// Replace all relative paths (href="/something") with absolute paths (href="https://www.sustainsouthcarolina.org/something")
					body = body.replace(/(href|src|srcset)=["']\/([^"']*)["']/g, (match, attr, value) => {
						if (attr === 'srcset' && typeof value === 'string') {
							// handle comma-separated list in srcset
							const updatedSrcset = value
								.split(',')
								.map((item) => {
									const parts = item.trim().split(' ');
									// If it does not already look like an absolute URL, prepend the furman.edu origin
									if (parts[0]?.startsWith('/')) {
										parts[0] = `${SUSTAIN_SC_ORIGIN}}${parts[0]}`;
									} else if (!parts[0]?.startsWith('http')) {
										parts[0] = `${SUSTAIN_SC_ORIGIN}/${parts[0]}`;
									}
									return parts.join(' ');
								})
								.join(', ');

							return `${attr}="${updatedSrcset}"`;
						}

						return `${attr}="${SUSTAIN_SC_ORIGIN}/${value}"`;
					});

					// Make all hyperlinks open in a new tab with noopener and noreferrer
					body = body.replace(/<a\s+([^>]*?)>/g, (match, attributes) => {
						// If the link already has a target attribute, we won't modify it
						if (/target=/.test(attributes)) {
							return match;
						}
						return `<a ${attributes} target="_blank" rel="noopener noreferrer">`;
					});

					// inject our own navigation elements
					body = body.replace(
						/(<div[\s\S]*?\bid\s*=\s*["']siteWrapper["'][\s\S]*?>)/,
						`<link rel="preconnect" href="https://fonts.googleapis.com">
                      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap" rel="stylesheet">
                      <style>header { display: none; } .header-skip-link { position: fixed; z-index: 1000; transform: translateY(-100%); } .header-skip-link:focus { transform: translateY(0%); }</style>
                      <a href="#page" class="header-skip-link sqs-button-element--primary">Skip to Content</a>
                      <header class="injected" style="all: unset;">${await getInjectableNavigation(ctx, originalRequestUrl)}</header>
                      $1`,
					);

					// Use Shi favicon
					body = body.replace('https://www.sustainsouthcarolina.org/favicon.ico', '/favicon.svg');

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
		return sliProxy.fetch(request.current);
	},
} satisfies ReverseProxyHandler<{ adminBarHref?: string }>;
