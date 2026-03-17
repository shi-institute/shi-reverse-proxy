import { parseHTML } from 'linkedom';
import { AsyncLocalStorage } from 'node:async_hooks';
import { renderCustomElements } from '../custom-elements/server';
import blogCssOverrides from '../static/overrides.css';
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
			const isShiInstitutePath = requestUrl.pathname.startsWith('/shi-institute');
			const isFurmanThemeAsset = requestUrl.pathname.startsWith('/wp-content/themes/furman');
			const isPersonPage = requestUrl.pathname.startsWith('/people/') && requestUrl.pathname.split('/').filter(Boolean).length === 2; // only proxy /people/{slug}
			if (isShiInstitutePath || isFurmanThemeAsset || isPersonPage) {
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
								`<meta charset="utf-8">
								<style>
									html { background-color: #212121; }
									.primary-hero-left-caption::before,
									.page-banner.tertiary-hero .caption::before,
									.module-content-block-media-carousel-slider::before {
										filter: invert(80%);
									}
									.module-content-block-media-carousel-slider .slick-dots li.slick-active a {
										--darkreader-text-ffffff: #000;
									}
								</style>
								<script>document.documentElement.style.visibility = 'hidden';</script>
								<script type="module">
									import * as DarkReader from "https://esm.run/darkreader";

									DarkReader.setFetchMethod((url) => {
										let headers = new Headers();
										headers.append("Access-Control-Allow-Origin", "*");

										return window.fetch(url, {
											headers,
											mode: "no-cors",
										});
									});

									DarkReader.auto({
										brightness: 125,
									});
									
									document.documentElement.style.visibility = '';
								</script>
								<style>
									.person-new-designed .tab-content,
									.person-new-designed .tab-content p,
									.person-new-designed .tab-content li,
									.person-new-designed .profile-block__list .headline-06,
									.person-new-designed .profile-block__list .paragraph-02,
									.person-new-designed .profile-block__list .paragraph-02 a:not(:hover):not(:active) {
										color: light-dark(#4D4D4F, #C9C9C9) !important;
									}
									.person-new-designed .tabbed-section .tab-content .tab-pane h3,
									.person-new-designed .profile-block__name, .person-new-designed .profile-block__title {
										color: light-dark(#201547, #C9C9C9) !important;
									}

									:root {
										--shi-color-purple: #582c83;
										--shi-adaptive-color--purple: light-dark(var(--shi-color-purple), oklch(from var(--shi-color-purple) calc(l + 0.48) calc(c - 0.08) h));
										--shi-adaptive-color--on-purple: light-dark(var(--shi-color--on-purple), #000);
	
										--shi-color-yellow: #f2be1a;
										--shi-color--on-yellow: #000;
										
										--shi-color-blue: #aadeeb;
										--shi-color--on-blue: #000;
									}

									a {
										--darkreader-text-000000: oklch(from #582c83 calc(l + 0.48) calc(c - 0.08) h);
										color: light-dark(var(--shi-color-purple), var(--darkreader-text-000000))) !important;
									}

									.person-new-designed .tabbed-section .nav-link:not(.active) {
										--darkreader-text-000000: oklch(from #582c83 calc(l + 0.48) calc(c - 0.08) h);
										color: light-dark(var(--shi-adaptive-color--purple), var(--darkreader-text-000000)) !important;
										box-shadow: unset !important;
										transition: 200ms ease;
									}
									.person-new-designed .tabbed-section .nav-link {
										cursor: default;
									}
									.person-new-designed .tabbed-section .nav-link:not(.active):hover {
										color: var(--shi-color--on-yellow) !important;
										background-color: var(--shi-color-yellow) !important;
									}
									.person-new-designed .tabbed-section .nav-link:not(.active):active {
										color: var(--shi-color--on-blue) !important;
										background-color: var(--shi-color-blue) !important;
									}
								</style>
							`,
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
					'wpmucdn.com/shi.institute': 'wpmucdn.com/blogs.furman.edu',
					[`"This is an internal version of The Shi Institute's website. Use the live version (https://shi.institute) when sharing or distributing links."`]:
						'',

					// use the text presentation form of the arrow to stop it from converting to an emoji variant: https://stackoverflow.com/a/54026677
					'↗': '↗︎',

					// inject our own stylesheet to override the WordPress theme's styles
					'<!-- #wrapper-navbar end -->': `<!-- #wrapper-navbar end --><!-- injected-nav --><style>${blogCssOverrides}</style>`,
					'<meta charset="UTF-8">': `<meta charset="UTF-8"><meta name="darkreader-lock">`,

					// inject our own navigation elements
					'<!-- injected-nav -->': `<!-- injected-nav -->${await getInjectableNavigation(ctx, requestUrl)}`,

					// hide built-in navigation elemenets
					'</head>': '<style>#navbar-secondary,#wrapper-navbar-main {display: none !important;}</style></head>',

					// ensure 1Password does not fill form honeypots
					'name="coblocks-verify-email" autocomplete="off" placeholder="Email"': `name="coblocks-verify-email" autocomplete="off" placeholder="Email" data-1p-ignore`,
				},
				async afterBodyReplacements(body, requestUrl, contentType) {
					if (!contentType.includes('text/html') || typeof body !== 'string') {
						return;
					}

					// The WordPress theme adds "…. Continue Reading <title>" to the end of post excerpts, even
					// when the excerppt is only a string. In this case, it is usally rendered in a paragrahp tag.
					// The text is indeded by the theme to include divs and spans with classes for styling, but
					// the text-only form results in undesired extra text at the end of excepts. We need to remove
					// this text by removing text from the ellipsis to the start of the closing paragraph tag.
					body = body.replace(/&#8230;\.\s*Continue Reading.*?<\/p>/gi, '.</p>');
					body = body.replace(/&#8230;\s*Continue Reading.*?<\/p>/gi, '</p>');

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
								return { ...props, tagIds };
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
} satisfies ExportedHandler<Env>;

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
