import { parseHTML } from 'linkedom';
import { render } from '../custom-elements/server';
import { ReverseProxy } from './ReverseProxy';
import handleApiRequest from './api';
import { getInjectableNavigation, getNavigationMenuData } from './menu';
import { redirects } from './redirects';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			const requestUrl = new URL(request.url);

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
				return Response.redirect(new URL('/shi-institute', requestUrl.origin), 302);
			}

			// proxy furman.edu website resources
			if (requestUrl.pathname.startsWith('/shi-institute') || requestUrl.pathname.startsWith('/wp-content/themes/furman')) {
				if (requestUrl.pathname.includes('wp-content/uploads')) {
					return Response.redirect(new URL(requestUrl.pathname + requestUrl.search, 'https://www.furman.edu'), 307);
				}

				const fuProxy = new ReverseProxy({
					originServer: new URL('https://www.furman.edu/shi-institute'),
					afterBodyReplacements: async (body, requestUrl, contentType) => {
						if (contentType.includes('text/html') && typeof body === 'string') {
							// hide furman.edu navigation elements
							body = body.replace(
								'</head>',
								`<style>#app > .alert, #app > header, #app > footer, body > footer, .section-menu-wrapper, #section-menu-container { display: none !important; }</style></head>`,
							);

							// Replace links to <origin>/<pathname> where the pathname does not start with /shi-institute.
							// These are links that point to part of the furman.edu website that we are not proxying.
							body = body.replace(/http:\/\/localhost:8787\/([^"' ]*)/g, (match, path) => {
								if (path.startsWith('shi-institute/') || path === 'shi-institute') return match; // leave intact
								return `https://www.furman.edu/${path}`;
							});

							// replace all relative paths (href="/something") with absolute paths (href="https://www.furman.edu/something") except for paths that start with /shi-institute
							body = body.replace(/(href|src)=["']\/(?!shi-institute)([^"' ]*)["']/g, (match, attr, path) => {
								return `${attr}="https://www.furman.edu/${path}"`;
							});

							// inject our own navigation elements
							body = body.replace(
								`<!-- End Google Tag Manager (noscript) -->`,
								`<!-- End Google Tag Manager (noscript) -->${await getInjectableNavigation(ctx, requestUrl)}`,
							);
						}

						return body;
					},
				});

				return fuProxy.fetch(request);
			}

			// proxy all remaining requests to the blogs.furman.edu/shi-applied-research site
			const blogProxy = new ReverseProxy({
				originServer: new URL('https://blogs.furman.edu/shi-applied-research'),
				notFoundPaths: ['/.well-known/appspecific/com.chrome.devtools.json'],
				stringReplacements: {
					'blogs.furman.edu/shi-applied-research': '',
					'blogs.furman.edu/': 'shi.institute/', // search results link label
					'shi.institute/Shibboleth.sso': 'blogs.furman.edu/Shibboleth.sso', // fix login redirect
					[`"This is an internal version of The Shi Institute's website. Use the live version (https://shi.institute) when sharing or distributing links."`]:
						'',

					// use the text presentation form of the arrow to stop it from converting to an emoji variant: https://stackoverflow.com/a/54026677
					'↗': '↗︎',

					// inject our own navigation elements
					'<!-- #wrapper-navbar end -->': `<!-- #wrapper-navbar end -->${await getInjectableNavigation(ctx, requestUrl)}`,

					// hide built-in navigation elemenets
					'</head>': '<style>#navbar-secondary,#wrapper-navbar-main {display: none !important;}</style></head>',
				},
				async afterBodyReplacements(body, requestUrl, contentType) {
					if (contentType.includes('text/html') && typeof body === 'string') {
						const { document } = parseHTML(body);

						// SSR for PostCardGrid
						const grids = document.querySelectorAll('shi-post-card-grid');
						for (const grid of Array.from(grids)) {
							const currentAttributes = Object.fromEntries(Array.from(grid.attributes).map((attr) => [attr.name, attr.value]));

							const tags =
								requestUrl.searchParams
									.get('tag')
									?.split(',')
									.map((s) => parseInt(s.trim()))
									.filter((n) => Number.isInteger(n)) ?? [];

							const ssrGrid = await render(
								'PostCardGrid',
								{
									props: {
										minColumnWidth: currentAttributes['min-column-width'] ?? undefined,
										maxColumnWidth: currentAttributes['max-column-width'] ?? undefined,
										gap: currentAttributes['gap'] ?? undefined,
										categoryIds: currentAttributes['category-ids'] ? JSON.parse(currentAttributes['category-ids']) : [],
										tagIds: tags,
									},
								},
								{
									url: requestUrl,
								},
							);
							grid.outerHTML = ssrGrid;
						}

						body = document.documentElement.outerHTML;
					}

					return body;
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
} satisfies ExportedHandler<Env>;
