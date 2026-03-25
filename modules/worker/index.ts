import { AsyncLocalStorage } from 'node:async_hooks';
import handleApiRequest from './api';
import { ReverseProxyHandlerQueue } from './common/ReverseProxy';
import { RewritableRequest } from './common/RewritableRequest';
import * as proxies from './proxies';
import { redirects, rewrites } from './redirects';

export default {
	async fetch(
		_request: Request<unknown, IncomingRequestCfProperties<unknown>>,
		env: Env,
		ctx: ExecutionContext<{ adminBarHref?: string }>,
	): Promise<Response> {
		try {
			const rr = new RewritableRequest(_request);
			const { request, requestUrl } = rr;

			// redirect all origins to shi.institute when in a production deployment
			if (env.PRODUCTION && requestUrl.hostname !== 'shi.institute') {
				return Response.redirect(new URL(requestUrl.pathname + requestUrl.search, 'https://shi.institute'), 307);
			}

			// if there is a redirect for the current path, follow it
			const maybeRedirectPathname = redirects[requestUrl.pathname.endsWith('/') ? requestUrl.pathname.slice(0, -1) : requestUrl.pathname];
			if (maybeRedirectPathname) {
				return Response.redirect(new URL(maybeRedirectPathname, requestUrl.origin), 302);
			}

			// if there is an alias for the current path, redirect to the alias
			if (rewrites[requestUrl.pathname]) {
				return Response.redirect(new URL(rewrites[requestUrl.pathname]!, requestUrl.origin), 302);
			}

			// if the current path is an alias, rewrite it to the original path so that
			// it can be properly handled by the reverse proxies
			if (Object.values(rewrites).includes(requestUrl.pathname)) {
				const originalPathname = Object.keys(rewrites).find((key) => rewrites[key] === requestUrl.pathname);
				if (originalPathname) {
					requestUrl.pathname = originalPathname;
				}
			}

			// handle API requests
			const maybeApiResponse = await handleApiRequest.fetch(request.current, env, ctx);
			if (maybeApiResponse) {
				return maybeApiResponse;
			}

			// proxy remaining requests to their respective destinations
			const proxyQueue = new ReverseProxyHandlerQueue<{ adminBarHref?: string }>();
			proxyQueue.enqueue(proxies.interactiveWeb);
			proxyQueue.enqueue(proxies.furmanEdu);
			proxyQueue.enqueue(proxies.sli);
			proxyQueue.enqueue(proxies.blogsFurmanEdu);

			const proxiedResponse = await proxyQueue.flush(rr, env, ctx);
			if (proxiedResponse) {
				return proxiedResponse;
			} else {
				return new Response('Not found', {
					status: 404,
					headers: {
						'Content-Type': 'text/plain; charset=utf-8',
						'Cache-Control': 'no-store',
					},
					cf: { cacheTtl: 0, cacheEverything: false },
				});
			}
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

/**
 * Gets a fetch implementation that will use env.SELF.fetch for requests
 * to the same origin as the provided requestUrl and will use the global
 * fetch for all other requests.
 *
 * To apply the resultant fetch implementation globally within a
 * request context, call fetchStorage.run() with the resultant fetch
 * implementation as the first argument. DO NOT SET globalThis.fetch
 * TO THE RESULT OF THIS FUNCTION; IT WILL AFFECT ADDITIONAL REQUESTS
 * BEYOND THE CURRENT REQUEST CONTEXT, CAUSING BUGS AND POTENTIAL SECURITY ISSUES.
 *
 * This function is necessary to avoid 522 errors when making fetch requests
 * to the same worker from within the worker, such as when rendering custom
 * elements on the blogs.furman.edu site that need to make API requests to
 * the same origin.
 */
export function prepareFetchWithSelf(env: Env, requestUrl: URL) {
	return ((input, init) => {
		const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
		if (url.hostname === requestUrl.hostname && env.SELF) {
			return env.SELF.fetch(new Request(input, init));
		}
		return originalFetch(input, init);
	}) satisfies typeof fetch;
}
