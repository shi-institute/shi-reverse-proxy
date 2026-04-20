import { AsyncLocalStorage } from 'node:async_hooks';
import { ServerTimingHelper } from '../custom-elements/utils';
import handleApiRequest, { getModifiedPostsSince } from './api';
import { ReverseProxyHandlerQueue } from './common/ReverseProxy';
import { RewritableRequest } from './common/RewritableRequest';
import * as proxies from './proxies';
import { redirects, rewrites } from './redirects';

export default {
	async fetch(_request, env, ctx): Promise<Response> {
		const startTime = performance.now();

		try {
			const rr = new RewritableRequest(_request);
			const { request, requestUrl } = rr;

			// redirect all origins to shi.institute when in a production deployment
			if (env.PRODUCTION && requestUrl.origin !== env.ORIGIN) {
				return Response.redirect(new URL(requestUrl.pathname + requestUrl.search, env.ORIGIN), 307);
			}

			// if there is a redirect for the current path, follow it
			const maybeRedirectPathname = redirects[requestUrl.pathname.endsWith('/') ? requestUrl.pathname.slice(0, -1) : requestUrl.pathname];
			if (maybeRedirectPathname) {
				return Response.redirect(new URL(maybeRedirectPathname, requestUrl.origin), 302);
			}

			// if there is an alias for the current path, redirect to the alias
			if (rewrites[requestUrl.pathname]) {
				return Response.redirect(new URL(rewrites[requestUrl.pathname]! + requestUrl.search, requestUrl.origin), 302);
			}

			// if the current path is an alias, rewrite it to the original path so that
			// it can be properly handled by the reverse proxies
			if (Object.values(rewrites).includes(requestUrl.pathname)) {
				const realPathname = Object.keys(rewrites).find((key) => rewrites[key] === requestUrl.pathname);

				// skip rewriting home page URL when it is a search page (has a ?s in the url)
				const shouldSkipRewrite = requestUrl.pathname === '/' && requestUrl.searchParams.has('s');

				if (realPathname && !shouldSkipRewrite) {
					requestUrl.pathname = realPathname;
				}
			}

			// handle API requests
			const maybeApiResponse = await handleApiRequest.fetch(request.current, env, ctx);
			if (maybeApiResponse) {
				return maybeApiResponse;
			}

			// proxy remaining requests to their respective destinations
			const proxyQueue = new ReverseProxyHandlerQueue<{ adminBarHref?: string }>();
			proxyQueue.enqueue(proxies.upstateScLulc);
			proxyQueue.enqueue(proxies.interactiveWeb);
			proxyQueue.enqueue(proxies.furmanEdu);
			proxyQueue.enqueue(proxies.sli);
			proxyQueue.enqueue(proxies.blogsFurmanEdu);

			const proxiedResponse = await proxyQueue.flush(rr, env, ctx as ExecutionContext<{ adminBarHref?: string }>);
			if (proxiedResponse) {
				proxiedResponse.headers.set(
					'Server-Timing',
					ServerTimingHelper.setTiming(proxiedResponse.headers, 'worker', performance.now() - startTime, 'Worker Duration'),
				);
				return proxiedResponse;
			}

			return new Response('Not found', {
				status: 404,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': 'no-store',
					'X-Worker-Duration': ServerTimingHelper.asTimingString('worker', performance.now() - startTime, 'Worker Duration'),
				},
				cf: { cacheTtl: 0, cacheEverything: false },
			});
		} catch (error) {
			return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, {
				status: 500,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': 'no-store',
					'X-Worker-Duration': ServerTimingHelper.asTimingString('worker', performance.now() - startTime, 'Worker Duration'),
				},
				cf: { cacheTtl: 0, cacheEverything: false },
			});
		}
	},
	async scheduled(_event, env, _ctx) {
		const ctx = _ctx as ExecutionContext<{ adminBarHref?: string | undefined }>;

		if (!env.ORIGIN) {
			console.error('ORIGIN environment variable is not set. Scheduled event cannot run without ORIGIN.');
			return;
		}

		// re-cache the website every 4 hours
		// TODO: Find a way to handle the random IDs that furman.edu injects into the HTML for some components.
		// TODO: Until then, we cannot globally refresh the cache because we cannot use the key-value store
		// TODO: until we find a way to ignore the random IDs when checking if the page has changed. Otherwise,
		// TODO: we would quickly exceed the daily KV write limit.
		if (_event.cron === '0 */4 * * *') {
			const DATE_1980 = new Date('1980-01-01').toISOString();
			const allBlogPosts = await getModifiedPostsSince('https://blogs.furman.edu/jbtest', DATE_1980);
			const allFurmanEduPosts = [] as typeof allBlogPosts;
			// const allFurmanEduPosts = await getModifiedPostsSince('https://www.furman.edu/shi-institute', DATE_1980);
			console.debug(`Re-caching ${allBlogPosts.length + allFurmanEduPosts.length} posts by fetching them with cache-busting headers...`);
			await runBatchedPromises(allBlogPosts, 10, async (post) => {
				const url = new URL(post.link, env.ORIGIN);
				const rr = new RewritableRequest(
					new Request(url, { headers: { 'Cache-Control': 'no-cache' } }) as Request<unknown, IncomingRequestCfProperties<unknown>>,
				);
				await proxies.blogsFurmanEdu.fetch(rr, env, ctx);
			});
			// await runBatchedPromises(allFurmanEduPosts, 10, async (post) => {
			// 	const url = new URL('/shi-institute' + post.link, env.ORIGIN);
			// 	const rr = new RewritableRequest(new Request(url, { headers: { 'Cache-Control': 'no-cache' } }));
			// 	await proxies.furmanEdu.fetch(rr, env, ctx);
			// });
		}

		// refresh the cache for recently modified posts every minute
		if (_event.cron === '* * * * *') {
			const NINETY_SECONDS_AGO = new Date(Date.now() - 90 * 1000).toISOString(); // include small time overlap
			const modifiedBlogPosts = await getModifiedPostsSince('https://blogs.furman.edu/jbtest', NINETY_SECONDS_AGO);
			const modifiedFurmanEduPosts = [] as typeof modifiedBlogPosts;
			// const modifiedFurmanEduPosts = await getModifiedPostsSince('https://www.furman.edu/shi-institute', NINETY_SECONDS_AGO);
			for (const post of [...modifiedBlogPosts, ...modifiedFurmanEduPosts]) {
				console.debug(`Re-caching post modified since ${NINETY_SECONDS_AGO}: ${post.link}`);
			}
			await runBatchedPromises(modifiedBlogPosts, 10, async (post) => {
				const url = new URL(post.link, env.ORIGIN);
				const rr = new RewritableRequest(new Request(url) as Request<unknown, IncomingRequestCfProperties<unknown>>);
				await proxies.blogsFurmanEdu.fetch(rr, env, ctx);
			});
			// await runBatchedPromises(modifiedFurmanEduPosts, 10, async (post) => {
			// 	const url = new URL('/shi-institute' + post.link, env.ORIGIN);
			// 	const rr = new RewritableRequest(new Request(url, { headers: { 'Cache-Control': 'no-cache' } }));
			// 	await proxies.furmanEdu.fetch(rr, env, ctx);
			// });
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

async function runBatchedPromises<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
	return await new Promise((resolve, reject) => {
		let index = 0;
		let activePromises = 0;

		function runNext() {
			while (activePromises < batchSize && index < items.length) {
				const item = items[index++];
				if (!item) {
					continue;
				}

				activePromises++;
				fn(item)
					.then(() => {
						activePromises--;
						runNext();
					})
					.catch(reject);
			}

			if (index >= items.length && activePromises === 0) {
				resolve();
			}
		}

		runNext();
	});
}

// Only show console.debug messages in development environment
if (process.env.NODE_ENV !== 'development') {
	console.debug = () => {};
}
