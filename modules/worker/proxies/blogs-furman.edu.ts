import { parseHTML } from 'linkedom';
import { prepareFetchWithSelf } from '..';
import { renderCustomElements } from '../../custom-elements/server';
import type { ReverseProxyHandler } from '../common/Handler';
import { ReverseProxy } from '../common/ReverseProxy';
import { getInjectableNavigation } from '../menu';

const BLOG_ORIGIN = 'https://blogs.furman.edu';
const SHI_BLOG_BASE = '/jbtest';

/**
 * Proxies all requests to blogs.furman.edu/jbtest.
 */
export default {
	async fetch({ request, requestUrl, originalRequestUrl }, env, ctx) {
		const blogProxy = new ReverseProxy({
			originServer: new URL(`${BLOG_ORIGIN}${SHI_BLOG_BASE}`),
			notFoundPaths: ['/.well-known/appspecific/com.chrome.devtools.json'],
			staleWhileRevalidate: 43200, // 12 hours
			stringReplacements: {
				'shi.institute/Shibboleth.sso': 'blogs.furman.edu/Shibboleth.sso', // fix login redirect
				'wpmucdn.com/jbtest': 'wpmucdn.com/blogs.furman.edu',
				[`"This is an internal version of The Shi Institute's website. Use the live version (https://shi.institute) when sharing or distributing links."`]:
					'',

				// use the text presentation form of the arrow to stop it from converting to an emoji variant: https://stackoverflow.com/a/54026677
				'↗': '↗︎',

				// inject our own navigation elements
				'</header>': `<style>
						/* hide the old menus */
						header > div:nth-child(1),
						header > div:nth-child(2) {
							display: none;
						}
						/* stop WordPress from adding margin before our menu items */
						header > * {
							margin: 0 !important;
						}
					</style>
					${await getInjectableNavigation(ctx, originalRequestUrl)}
				</header>`,

				// hide built-in navigation elements
				'</head>': '<style>header>div:nth-child(1),header>div:nth-child(2){display:none !important;}</style></head>',
				// stop WordPress from adding margin before our injected custom navigation elements
				'</style></head>': '<style>header>*{margin:0 !important;}</style></head>',

				// ensure 1Password does not fill form honeypots
				'name="coblocks-verify-email" autocomplete="off" placeholder="Email"': `name="coblocks-verify-email" autocomplete="off" placeholder="Email" data-1p-ignore`,
			},
			async afterBodyReplacements(body, requestUrl, contentType) {
				if (!contentType.includes('text/html') || typeof body !== 'string') {
					return;
				}

				// Render custom elements (e.g. shi-post-card or shi-post-card-grid) on the server to HTML,
				// ensuring that the content is visible immediately on document download and that it can
				// be easily indexed by search engines.
				return await renderCustomElements({
					prefix: 'shi',
					globals: { document: parseHTML(body).document, url: requestUrl, fetch: prepareFetchWithSelf(env, requestUrl) },
					adjustPropsBeforeRender(props, componentName) {
						// For the post grid on the projects page, we want to filter the posts by the tags in the URL.
						// The projects page sets the tags search param whenever a user uses the filters menu.
						if (componentName === 'PostCardGrid' && requestUrl.pathname === '/projects/') {
							const tagsIdStrings = requestUrl.searchParams.getAll('tag');
							const tagIds = tagsIdStrings?.map((s) => parseInt(s.trim())).filter((n) => Number.isInteger(n)) ?? [];
							return { ...props, taxonomies: { ...(props.taxonomies || {}), 'project-tag': tagIds } };
						}
					},
				});
			},
			removePath: true,
		});

		return blogProxy.fetch(request.current);
	},
} satisfies ReverseProxyHandler<{ adminBarHref?: string }>;
