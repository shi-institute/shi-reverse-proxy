import { parseHTML } from 'linkedom';
import { AsyncLocalStorage } from 'node:async_hooks';
import { renderCustomElements } from '../custom-elements/server';
import furmanDarkModeOverrides from '../static/furman-edu-dark-mode.html';
import furmanHomeOverrides from '../static/furman-edu-home-overrides.css';
import furmanVideoPrefersReducedMotionSupport from '../static/furman-edu-video-reduce-motion-support.html';
import { ReverseProxy } from './ReverseProxy';
import handleApiRequest from './api';
import { getFooterHTML } from './footer';
import { getInjectableNavigation, getNavigationMenuData } from './menu';
import { redirects } from './redirects';

export default {
	async fetch(
		_request: Request<unknown, IncomingRequestCfProperties<unknown>>,
		env: Env,
		ctx: ExecutionContext<{ adminBarHref?: string }>,
	): Promise<Response> {
		try {
			let request = _request;
			let requestUrl = new URL(request.url);

			// redirect origins to shi.institute
			if (env.PRODUCTION && requestUrl.hostname !== 'shi.institute') {
				return Response.redirect(new URL(requestUrl.pathname + requestUrl.search, 'https://shi.institute'), 307);
			}

			// provide an easy way to list the menu items
			if (requestUrl.pathname === '/.data/menus.json') {
				const menuItems = await getNavigationMenuData(ctx);
				return new Response(JSON.stringify(menuItems), {
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Access-Control-Allow-Origin': '*',
						'Cache-Control': 'public, max-age=60',
					},
					status: 200,
					statusText: 'OK',
				});
			}

			// if there is a redirect for the current path, follow it
			const maybeRedirectPathname = redirects[requestUrl.pathname.endsWith('/') ? requestUrl.pathname.slice(0, -1) : requestUrl.pathname];
			if (maybeRedirectPathname) {
				return Response.redirect(new URL(maybeRedirectPathname, requestUrl.origin), 302);
			}

			// handle API requests
			const maybeApiResponse = await handleApiRequest.fetch(request, env, ctx);
			if (maybeApiResponse) {
				return maybeApiResponse;
			}

			// proxy all /research requests to the interactive-web deployment
			const researchProxy = new ReverseProxy({ originServer: new URL('https://interactive-web.shi.institute/research') });
			if (requestUrl.pathname.startsWith('/research')) {
				return researchProxy.fetch(request);
			}

			// replace home page with furman.edu/shi-institute
			// since we have not built a replacement home page on blogs.furman.edu
			if (requestUrl.pathname === '/' && requestUrl.search === '') {
				requestUrl = new URL('/shi-institute/new-home', requestUrl.origin);
				request = new Request(requestUrl.href, request) as typeof _request;
			}

			// proxy furman.edu website resources
			const isShiInstitutePath = requestUrl.pathname.startsWith('/shi-institute');
			const isFurmanThemeAsset = requestUrl.pathname.startsWith('/wp-content/themes/furman');
			const isPersonPage = requestUrl.pathname.startsWith('/people/') && requestUrl.pathname.split('/').filter(Boolean).length === 3; // only proxy /people/{type}/{slug}
			if (isShiInstitutePath || isFurmanThemeAsset || isPersonPage) {
				// re-write the request URL to point to furman.edu/people/{slug} when it is a person page
				let personType: string | null = null;
				if (isPersonPage) {
					personType = requestUrl.pathname.split('/')[2] ?? null;
					requestUrl.pathname = requestUrl.pathname.replace(`/people/${personType}/`, '/people/');
					request = new Request(requestUrl.href, request) as typeof _request;
				}

				if (requestUrl.pathname.includes('wp-content/uploads')) {
					return Response.redirect(new URL(requestUrl.pathname + requestUrl.search, 'https://www.furman.edu'), 307);
				}

				ctx.props.adminBarHref = 'https://www.furman.edu/shi-institute/wp-admin';

				const fuProxy = new ReverseProxy({
					originServer: new URL('https://www.furman.edu/shi-institute'),
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

							// inject our own navigation elements
							body = body.replace(
								`<!-- End Google Tag Manager (noscript) -->`,
								`<!-- End Google Tag Manager (noscript) -->${await getInjectableNavigation(ctx, requestUrl)}`,
							);

							// inject dark mode support via darkreader
							body = body.replace(
								'<meta charset="utf-8">',
								`<meta charset="utf-8">${furmanDarkModeOverrides}<!-- home-mods --><!-- reduce-motion-mods -->`,
							);

							// home page style modifications
							if (requestUrl.pathname === '/shi-institute/new-home') {
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

				const proxyResponse = await fuProxy.fetch(request);
				if (proxyResponse.status !== 404) {
					return proxyResponse;
				}

				// in the case of a 404 for a profile page, we need to undo the
				// URL rewrite so we can show the fallback page on the blog site
				if (isPersonPage && personType) {
					requestUrl.pathname = requestUrl.pathname.replace('/people/', `/people/${personType}/`);
					request = new Request(requestUrl.href, request) as typeof _request;
				}
			}

			// proxy all remaining requests to the blogs.furman.edu site
			const blogProxy = new ReverseProxy({
				originServer: new URL('https://blogs.furman.edu/jbtest'),
				notFoundPaths: ['/.well-known/appspecific/com.chrome.devtools.json'],
				stringReplacements: {
					'shi.institute/Shibboleth.sso': 'blogs.furman.edu/Shibboleth.sso', // fix login redirect
					'wpmucdn.com/jbtest': 'wpmucdn.com/blogs.furman.edu',
					[`"This is an internal version of The Shi Institute's website. Use the live version (https://shi.institute) when sharing or distributing links."`]:
						'',

					// use the text presentation form of the arrow to stop it from converting to an emoji variant: https://stackoverflow.com/a/54026677
					'↗': '↗︎',

					// inject our own navigation elements
					'</header>': `${await getInjectableNavigation(ctx, requestUrl)}</header>`,

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

			return blogProxy.fetch(request);
		} catch (error) {
			return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, {
				status: 500,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': 'no-store',
				},
				cf: { cacheTtl: 0, cacheEverything: false },
			});
		}
	},
};

// Replaces fetch with a modified fetch. In any context where
// fetchStorage.run() has been called, the first argument to
// fetchStorage.run() will be used as the fetch implementation
// instead of the global fetch. This allows us to use a custom
// fetch implementation that implements env.SELF.fetch to avoid
// 522 errors when making fetch requests to the same worker from
// within the worker.
export const fetchStorage = new AsyncLocalStorage<typeof fetch>();
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input, init) => {
	const scopedFetch = fetchStorage.getStore();
	if (scopedFetch) return scopedFetch(input, init);
	return originalFetch(input, init);
}) satisfies typeof fetch;

function prepareFetchWithSelf(env: Env, requestUrl: URL) {
	return ((input, init) => {
		const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
		if (url.hostname === requestUrl.hostname && env.SELF) {
			return env.SELF.fetch(new Request(input, init));
		}
		return originalFetch(input, init);
	}) satisfies typeof fetch;
}
