import { ReverseProxy } from './ReverseProxy';
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

			// proxy all /research requests to the interactive-web deployment
			const researchProxy = new ReverseProxy({ originServer: new URL('https://interactive-web.shi.institute/research') });
			if (requestUrl.pathname.startsWith('/research')) {
				return researchProxy.fetch(request);
			}

			// proxy all remaining requests to the blogs.furman.edu/shi-applied-research site
			const blogProxy = new ReverseProxy({
				originServer: new URL('https://blogs.furman.edu/shi-applied-research'),
				notFoundPaths: ['/.well-known/appspecific/com.chrome.devtools.json'],
				stringReplacements: {
					'blogs.furman.edu/shi-applied-research': '',
					[`"This is an internal version of The Shi Institute's website. Use the live version (https://shi.institute) when sharing or distributing links."`]:
						'',
					'↗': '↗︎', // use the text presentation form of the arrow to stop it from converting to an emoji variant: https://stackoverflow.com/a/54026677
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
