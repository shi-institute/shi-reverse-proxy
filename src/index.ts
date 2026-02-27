import { ReverseProxy } from './ReverseProxy';
import customElementsLoader, { ssrCustomElement } from './elements-loader';
import { getNavigationElements, toLabelHrefPair } from './menu';
import { redirects } from './redirects';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			const requestUrl = new URL(request.url);

			// redirect origins to shi.institute
			if (env.DEVELOPMENT !== 'true' && requestUrl.hostname !== 'shi.institute') {
				return Response.redirect(new URL(requestUrl.pathname + requestUrl.search, 'https://shi.institute'), 307);
			}

			// if there is a redirect for the current path, follow it
			const maybeRedirectPathname = redirects[requestUrl.pathname.endsWith('/') ? requestUrl.pathname.slice(0, -1) : requestUrl.pathname];
			if (maybeRedirectPathname) {
				return Response.redirect(new URL(maybeRedirectPathname, requestUrl.origin), 302);
			}

			// if the request is for a custom element script, serve it from the static assets
			customElementsLoader.fetch(request, env);

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

							// inject our own navigation elements
							body = body.replace(
								`<!-- End Google Tag Manager (noscript) -->`,
								`<!-- End Google Tag Manager (noscript) -->${await getInjectableNavigation(ctx)}<style>${shiFontFaces}</style>`,
							);

							// Replace links to <origin>/<pathname> where the pathname does not start with /shi-institute.
							// These are links that point to part of the furman.edu website that we are not proxying.
							body = body.replace(/http:\/\/localhost:8787\/([^"' ]*)/g, (match, path) => {
								if (path.startsWith('shi-institute/') || path === 'shi-institute') return match; // leave intact
								return `https://www.furman.edu/${path}`;
							});
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
					'<!-- #wrapper-navbar end -->': `<!-- #wrapper-navbar end -->${await getInjectableNavigation(ctx)}<style>${shiFontFaces}</style>`,

					// hide built-in navigation elemenets
					'</head>': '<style>#navbar-secondary,#wrapper-navbar-main {display: none !important;}</style></head>',
				},
				removePath: true,
			});

			return blogProxy.fetch(request);
		} catch (error) {
			return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, {
				status: 500,
			});
		}
	},
} satisfies ExportedHandler<Env>;

const shiFontFaces = `
@font-face {
  font-family: 'Epilogue';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(/wp-content/themes/cpschool/fonts/epilogue/fonts/Epilogue-VariableFont_wght.ttf) format('woff2');
}
`;

async function getInjectableNavigation(ctx: ExecutionContext) {
	const primaryMenuBarHtml = ssrCustomElement(
		'shi-primary-menu-bar',
		() => import('../static/custom-elements/shi-primary-menu-bar.js').then((mod) => mod.ShiPrimaryNavigationBar),
		{
			items: await (async () => {
				const navigationElements = await getNavigationElements('primary', ctx);

				const menuItems = navigationElements.flatMap((item, index, array) => {
					const labelHrefPair = toLabelHrefPair(item);

					// add a divider before services and after projects
					if (index === array.length - 3 || index === array.length - 1) {
						return [labelHrefPair, { label: 'divider', href: '' }];
					}

					return labelHrefPair;
				});

				return menuItems;
			})(),
			'side-nav-items': (await getNavigationElements('menu', ctx)).map(toLabelHrefPair),
		},
	);

	const secondaryMenuBarHtml = ssrCustomElement(
		'shi-secondary-menu-bar',
		() => import('../static/custom-elements/shi-secondary-menu-bar.js').then((mod) => mod.ShiSecondaryNavigationBar),
		{
			'left-items': await getNavigationElements('secondaryLeft', ctx).then((elements) => elements.map(toLabelHrefPair)),
			'right-items': await getNavigationElements('secondaryRight', ctx).then((elements) => elements.map(toLabelHrefPair)),
		},
	);

	return `
		${await secondaryMenuBarHtml}
		${await primaryMenuBarHtml}
		<script type="module">
			import '/custom-elements/define.js';
		</script>
		<style>
			@view-transition {
				navigation: auto;
			}
			${shiFontFaces}
		</style>
	`;
}
