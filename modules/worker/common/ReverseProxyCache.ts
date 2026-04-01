import { env } from 'cloudflare:workers';

export interface ReverseProxyCacheOptions {
	/**
	 * If true, the key-value cache will never expire.
	 * The edge cache will still expire based on the cache-control directives.
	 * You will need to manually refresh the key-value cache. */
	neverExpireKV?: boolean;
	/**
	 * If true
	 */
	useKV?: boolean;
}

type ReverseProxyCacheMatchMissOrBypassResult = { type: 'MISS' | 'BYPASS'; headersToSet: Headers };
type ReverseProxyCacheMatchHitResult = {
	type: 'HIT';
	/**
	 * The response that should be sent to the client.
	 * If the client already has the latest version,
	 * this response might be a stub with an HTTP 304
	 * Not Modified status code.
	 */
	response: Response;
};

type ReverseProxyCacheMatchResult = ReverseProxyCacheMatchMissOrBypassResult | ReverseProxyCacheMatchHitResult;
type ReverseProxyCacheMatchResultProxied = (
	| ReverseProxyCacheMatchMissOrBypassResult
	| (ReverseProxyCacheMatchHitResult & {
			/**
			 * The resonse property might contain a stub with a
			 * HTTP 304 Not Modified status code if the client's
			 * cached version is still fresh. If you still need
			 * access to the actual cached response, you must use
			 * `actiualCachedResponse` instead of `response`.
			 *
			 * In most cases, you should be responding to the client
			 * with the response available in `response`.
			 */
			actualCachedResponse: Response;
	  })
) & { clone: () => ReverseProxyCacheMatchResultProxied };

/**
 * A helper class for using and managing the cached responses from a revser proxy.
 *
 *
 * In most cases, you want to use the `match` method. *
 * This uses a two-tier caching system. The edge cache (the cache available at the
 * location where the worker is running) is always preferred. If no cached response
 * is found in the edge cache, the key-value (KV) cache is checked. The KV cache is
 * slightly slower, but its key-value pairs are distributed by Cloudflare such that
 * they are available from any edge. If a cached response is found in the KV cache,
 * it is returned and also stored in the edge cache for faster access next time.
 *
 * If useKV is not set to true, the kev-value cache will not be used.
 *
 * This class also provides methods for putting responses directly into the edge or
 * KV cache and for purging cached responses from both caches.
 *
 * *There are Cloudflare usage limits for KV reads and writes. Be careful and efficient.*
 */
export class ReverseProxyCache<Props> {
	edgeCache: Cache;
	kvCache: KVNamespace;
	executionContext: ExecutionContext<Props>;
	options: ReverseProxyCacheOptions;

	constructor(edgeCache: Cache, kvCache: KVNamespace, ctx: ExecutionContext<Props>, options: ReverseProxyCacheOptions = {}) {
		this.edgeCache = edgeCache;
		this.kvCache = kvCache;
		this.executionContext = ctx;
		this.options = options;
	}

	static async open<Props>(ctx: ExecutionContext<Props>, options?: ReverseProxyCacheOptions) {
		const edgeCache = (caches as CacheStorage & { default: Cache }).default;
		const kvCache = env.REVERSE_PROXY_KV_CACHE;

		if (!kvCache) {
			throw new Error('REVERSE_PROXY_KV_CACHE must be defined in kv_namespaces');
		}

		return new ReverseProxyCache(edgeCache, kvCache, ctx, options);
	}

	/**
	 * Looks for a cached response for the given cache key.
	 *
	 * The edge cache will be checked first, and if a cached response is found
	 * there, it will be returned. If no cached response is found in the edge
	 * cache, the KV cache will be checked. If a cached response is found in the
	 * KV cache, it will be returned and also stored in the edge cache for faster
	 * access next time. If no cached response is found in either cache, this
	 * method will return undefined.
	 *
	 * If the incoming request includes the If-Modified-Since header and the
	 * cached response includes the Last-Modified header, and the date in the
	 * If-Modified-Since header is greater than or equal to the date in the
	 * Last-Modified header, a 304 Not Modified response will be provided instead
	 * of the actual cached response. This saves bandwith and allows the browser
	 * to use its own cache if it has a valid copy instead of downloading the same
	 * response again.
	 *
	 * The Date header will always be set to the current date and time.
	 *
	 * *This method reads the KV cache. This affects the usage limit and may
	 * cause overage fees on paid plans.*
	 *
	 * @param request
	 * The request that might have a response in the cache.
	 * Only the URL of the request will be considered.
	 */
	async match(request: Request): Promise<ReverseProxyCacheMatchResultProxied> {
		const cacheResult = await this.internal__match(request);

		// Use 304 Not Modified to save bandwidth if the cached response
		// is still fresh and the browser has a valid copy
		const actualCachedResponse = cacheResult.type === 'HIT' ? cacheResult.response : undefined;
		if (cacheResult.type === 'HIT') {
			const ifModifiedSince = request.headers.get('If-Modified-Since');
			const lastModified = cacheResult.response.headers.get('Last-Modified');
			if (ifModifiedSince && lastModified && new Date(ifModifiedSince) >= new Date(lastModified)) {
				cacheResult.response = new Response(null, {
					status: 304,
					headers: cacheResult.response.headers,
				});
			}
		}

		// Inject a clone() method on the result that will return a new
		// result with a cloned response. This is a convienience method
		// for when result.response.clone() is needed. Recall that the
		// response body can only be read once, so if the caller needs to
		// read the body multiple times, they will need to clone the response
		// first.
		const createProxy = (cacheResult: ReverseProxyCacheMatchResult, actualCachedResponse?: Response) => {
			return new Proxy(cacheResult, {
				get(target, prop, receiver) {
					if (prop === 'clone') {
						return () => {
							if (target.type === 'HIT') {
								return createProxy(
									{
										...target,
										response: target.response.clone(),
									},
									actualCachedResponse?.clone(),
								);
							}
							return target;
						};
					}

					if (prop === 'actualCachedResponse' && target.type === 'HIT') {
						return actualCachedResponse;
					}

					return Reflect.get(target, prop, receiver);
				},
			}) as ReverseProxyCacheMatchResultProxied;
		};

		return createProxy(cacheResult, actualCachedResponse);
	}

	private async internal__match(
		request: Request,
		{ useKv = this.options.useKV, useEdge = true } = {},
	): Promise<ReverseProxyCacheMatchResult> {
		const requestUrl = new URL(request.url);

		if (requestUrl.pathname.startsWith('/.well-known/')) {
			return {
				type: 'MISS',
				headersToSet: ReverseProxyCache.prepareHeaders(new Headers(), 'MISS', 'Pathname starts with /.well-known/'),
			};
		}

		const shouldBypassCache = request.headers.get('Cache-Control')?.includes('no-cache') || request.headers.get('Pragma') === 'no-cache';
		if (shouldBypassCache) {
			console.debug(`Bypassing cache for ${requestUrl} due to no-cache directive in request headers`);
			return { type: 'BYPASS', headersToSet: ReverseProxyCache.prepareHeaders(new Headers(), 'BYPASS', 'no-cache directive') };
		}

		if (useEdge) {
			const edgeCacheResponse = await this.readFromEdgeCache(request);
			console.debug(`Cache lookup for ${requestUrl}: ${edgeCacheResponse ? 'HIT' : 'MISS'} in edge cache`);
			if (edgeCacheResponse) {
				// clear a mutable version of the cached response
				const response = new Response(edgeCacheResponse.body, {
					status: edgeCacheResponse.status,
					statusText: edgeCacheResponse.statusText,
					headers: new Headers(edgeCacheResponse.headers),
				});

				ReverseProxyCache.prepareHeaders(response.headers, 'HIT');
				response.headers.set('X-Cache-Source', 'Edge');
				return { response, type: 'HIT' };
			}
		}

		if (useKv) {
			const kvCacheResponse = await this.readFromKvCache(request);
			console.debug(`Cache lookup for ${requestUrl}: ${kvCacheResponse ? 'HIT' : 'MISS'} in KV cache`);
			if (kvCacheResponse) {
				ReverseProxyCache.prepareHeaders(kvCacheResponse.headers, 'HIT');
				kvCacheResponse.headers.set('X-Cache-Source', 'KV');

				// store the response in the edge cache for faster access next time
				this.executionContext.waitUntil(this.putInEdgeCache(request, kvCacheResponse.clone()));

				return { response: kvCacheResponse, type: 'HIT' };
			}
		}

		return { type: 'MISS', headersToSet: ReverseProxyCache.prepareHeaders(new Headers(), 'MISS') };
	}

	/**
	 * Puts the given response in the edge cache and KV cache with the given cache key.
	 *
	 * *This method modifies the KV cache. This affects the usage limit and may
	 * cause overage fees on paid plans.*
	 *
	 * If you only want to put the response in the edge cache, use `this.putInEdgeCache`
	 * instead. If you only want to put the response in the KV cache, use
	 * `this.putInKvCache` instead.
	 *
	 * The Last-Modified header will be set on the response if it is not already set.
	 */
	async put(request: Request, response: Response, { cacheDirectives }: { cacheDirectives?: string[] } = {}) {
		const clonedResponse = response.clone();

		// Inject cache-control directives so that Cloudflare knows how
		// long to store the response in the cache and when to consider it stale.
		// If no directives are found, it will not be cached.
		clonedResponse.headers.set(
			'Cache-Control',
			cacheDirectives?.join(', ') || response.headers.get('Cache-Control') || 'no-cache, no-store, must-revalidate, max-age=0',
		);
		const shouldSkipCaching = cacheDirectives?.includes('no-store') || clonedResponse.headers.get('Cache-Control')?.includes('no-store');
		if (shouldSkipCaching) {
			console.debug(`Skipping caching for ${request.url} due to no-store directive`);
			return;
		}

		if (clonedResponse.headers.get('Content-Encoding') === 'gzip') {
			// Processing the body to an array buffer causes the gzip encoding to be lost.
			// Cloudflare will re-encode to gzip when it serves the cached response, but in
			// the cached response, we need to remove the Content-Encoding header to prevent
			// double gzip encoding.
			clonedResponse.headers.delete('Content-Encoding');
		}
		const body = await clonedResponse.arrayBuffer();

		const responseCopy1 = new Response(body, {
			status: clonedResponse.status,
			statusText: clonedResponse.statusText,
			headers: clonedResponse.headers,
			cf: clonedResponse.cf,
			webSocket: clonedResponse.webSocket,
		});
		const responseCopy2 = new Response(body, {
			status: clonedResponse.status,
			statusText: clonedResponse.statusText,
			headers: clonedResponse.headers,
			cf: clonedResponse.cf,
			webSocket: clonedResponse.webSocket,
		});

		await this.putInEdgeCache(request, responseCopy1);
		await this.putInKvCache(request, responseCopy2);
	}

	/**
	 * Puts the given response in the edge cache and KV cache with the given cache key
	 * only if the response body is different from the currently cached response or there
	 * is no currently cached response.
	 *
	 * *This method modifies the KV cache. This affects the usage limit and may
	 * cause overage fees on paid plans.*
	 */
	async putIfChanged(
		request: Request,
		response: Response,
		{ cacheDirectives, cached }: { cacheDirectives?: string[]; cached?: ReverseProxyCacheMatchResultProxied } = {},
	) {
		const requestUrl = new URL(request.url);

		// If the caller already has a cache match result, but it is a
		// BYPASS result, we need to check the cache again without bypassing
		// to see if there is a cached response that we can use for comparison.
		if (!cached || cached.type === 'BYPASS') {
			// use cache key so that no-cache (or similar) directives do not cause another BYPASS
			cached = await this.match(request);
		}

		if (cached.type !== 'HIT') {
			await this.put(request, response, { cacheDirectives });
			return;
		}

		// Only update the cache if the body is changed from the cached version.
		const cacheIsCurrent = await compareResponses(response.clone(), cached.actualCachedResponse.clone(), requestUrl);

		// TODO: Add an option to extend the cache expiration time even if the body is unchanged.
		if (cacheIsCurrent) {
			console.debug(`Cache for ${requestUrl.href} is still fresh. Not updating cache.`);
		}

		if (!cacheIsCurrent) {
			console.debug(`Cache for ${requestUrl.href} is stale. Updating cache.`);
			await this.purgeEdges(request); // clear all other edges so they use the KV cache
			await this.put(request, response, { cacheDirectives });
		}
	}

	/**
	 * **Use with caution.** This method purges cached responses for the given
	 * cache key from all edge caches.
	 *
	 * If you only need to remove a cached response from the current edge (datacenter)
	 * cache, use `this.edgeCache.delete(cacheKey)` instead.
	 */
	async purgeEdges(request: Request) {
		await this.edgeCache.delete(request.url);
		await this.dangerouslyPurgeAllEdgeCachesByUrls([request.url]);
	}

	/**
	 * **Use with caution.** This method purges cached responses for the given
	 * cache key from all edge caches and the KV cache.
	 *
	 * If you only need to remove a cached response from the current edge (datacenter)
	 * cache, use `this.edgeCache.delete(cacheKey)` instead.
	 *
	 * *This method modifies the KV cache. This affects the usage limit and may
	 * cause overage fees on paid plans.*
	 */
	async purge(request: Request) {
		await this.purgeEdges(request);
		await this.kvCache.delete(request.url);
	}

	/**
	 * Sets common cache-related headers on the given headers object based on the cache status.
	 *
	 * **This method is in-place.**
	 */
	private static prepareHeaders(headers: Headers, cache: 'HIT' | 'BYPASS' | 'MISS', reason?: string) {
		headers.set('Date', new Date().toUTCString());

		// remove existing X-Cache headers
		headers.forEach((value, key) => {
			if (key.toLowerCase().startsWith('x-cache')) {
				headers.delete(key);
			}
		});

		headers.set('X-Cache', cache);
		if (reason) {
			if (cache === 'BYPASS') {
				headers.set('X-Cache-Bypass-Reason', reason);
			} else if (cache === 'MISS') {
				headers.set('X-Cache-Miss-Reason', reason);
			} else {
				headers.set('X-Cache-Note', reason);
			}
		}

		return headers;
	}

	/**
	 * Sets common cache-related headers on the given headers object based on the cache status.
	 *
	 * **This method is in-place.**
	 */
	static setHeadersForMissOrBypass(headers: Headers, headersFromMatch: Headers) {
		const type = headersFromMatch.get('X-Cache');
		const reason =
			headersFromMatch.get('X-Cache-Bypass-Reason') || headersFromMatch.get('X-Cache-Miss-Reason') || headersFromMatch.get('X-Cache-Note');
		if (type === 'BYPASS' || type === 'MISS') {
			this.prepareHeaders(headers, type as 'BYPASS' | 'MISS', reason || undefined);
		}

		// ensure that the last-modified header exists
		const currentLastModified = parseDateHeaderValue(headers.get('Last-Modified') || headersFromMatch.get('Last-Modified'));
		if (!currentLastModified) {
			headers.set('Last-Modified', headers.get('Date') || headersFromMatch.get('Date') || new Date().toUTCString());
		}
	}

	/**
	 *
	 * This method sets the Last-Modified header on the response if it is not already set.
	 */
	async putInEdgeCache(request: Request, response: Response) {
		const requestUrl = new URL(request.url);

		// ensure that the last-modified header exists on the response
		const currentLastModified = parseDateHeaderValue(response.headers.get('Last-Modified'));
		if (!currentLastModified) {
			response.headers.set('Last-Modified', response.headers.get('Date') || new Date().toUTCString());
		}

		// Remove Set-Cookie header values that include cloudflare headers.
		// The Cache API refuses to store responses that have Set-Cookie
		// since cookies are user-specific. These cookies originate from the
		// upstream origin (e.g. Cloudflare Bot Management) and are not
		// meaningful when served from cache.
		const ignoredCookies = [
			// load balancing cookie
			'__cflb',
			// bot management cookies
			'__cf_bm',
			'__cfseq', // bot sequence rules
			'cf_clearance', // javascript bot detections
			// cloudflare always online
			'cf_ob_info',
			'cf_use_ob',
			// cloudflare waiting room
			'__cfwaitingroom',
			// cloudflare rate limiting rules
			'__cfruid',
			'_cfuvid',
			// internal cloudflare use
			'cf_chl_rc_i',
			'cf_chl_rc_ni',
			'cf_chl_rc_m',
		];
		const setCookieHeaders = response.headers.getSetCookie();
		if (setCookieHeaders) {
			const filteredSetCookieHeaders = setCookieHeaders.filter((setCookie) => {
				return !ignoredCookies.some((ignoredCookie) => setCookie.startsWith(ignoredCookie));
			});
			response.headers.delete('Set-Cookie');
			filteredSetCookieHeaders.forEach((setCookie) => {
				response.headers.append('Set-Cookie', setCookie);
			});
		}

		// Configure cache tags based on the request URL.
		// By tagging cached responses, we are able to purge a cached
		// response for a URL across all edges (datacenters) at once
		// by purging all cached responses with a specified tag.
		const originCacheTag = requestUrl.origin;
		const looseCacheTag = requestUrl.origin + requestUrl.pathname;
		const strictCacheTag = requestUrl.href;
		response.headers.set('Cache-Tag', [originCacheTag, looseCacheTag, strictCacheTag].join(','));

		console.debug(`Putting response for ${requestUrl.href} in edge cache.`);
		await this.edgeCache.put(request.url, response);
	}

	async readFromEdgeCache(request: Request) {
		return await this.edgeCache.match(request.url);
	}

	/**
	 * *This method modifies the KV cache. This affects the usage limit and may
	 * cause overage fees on paid plans.*
	 *
	 * This method sets the Last-Modified header on the response if it is not already set.
	 */
	async putInKvCache(request: Request, response: Response) {
		if (!this.options.useKV) {
			return;
		}

		const requestUrl = new URL(request.url);
		const responseClone = response.clone();

		// only cache HTML, CSS, and JS
		const contentType = responseClone.headers.get('Content-Type') || '';
		const isHtml = contentType.includes('text/html');
		const isCss = contentType.includes('text/css');
		const isJs = contentType.includes('application/javascript') || contentType.includes('text/javascript');
		if (!isHtml && !isCss && !isJs) {
			console.debug(`Response for ${requestUrl.href} has content type ${contentType} and will not be stored in KV cache.`);
			return;
		}

		// ensure that the last-modified header exists on the response
		const currentLastModified = parseDateHeaderValue(responseClone.headers.get('Last-Modified'));
		if (!currentLastModified) {
			responseClone.headers.set('Last-Modified', responseClone.headers.get('Date') || new Date().toUTCString());
		}

		const entry = await this.KvCacheEntry.fromResponse(responseClone);
		if (!entry) {
			console.debug(`Response for ${requestUrl.href} is not cacheable and will not be stored in KV cache.`);
			return;
		}

		console.debug(`Putting response for ${requestUrl.href} in KV cache with expiration time: ${new Date(entry.expiresAt).toISOString()}`);

		const entryJson = JSON.stringify(entry);
		await this.kvCache.put(request.url, entryJson);
	}

	/**
	 * *This method reads the KV cache. This affects the usage limit and may
	 * cause overage fees on paid plans.*
	 */
	async readFromKvCache(request: Request) {
		if (!this.options.useKV) {
			return undefined;
		}

		const entryJson = await this.kvCache.get(request.url, {
			cacheTtl: 30, // Cache at the edge for 30 seconds. This means it will take up to 30 seconds to get a new KV value. 30 is the minimum allowed value.
		});
		if (!entryJson) {
			return undefined;
		}

		try {
			const entry = this.KvCacheEntry.fromJSON(entryJson);
			return new Response(entry.body, {
				status: entry.status,
				statusText: entry.statusText,
				headers: entry.headers,
			});
		} catch (error) {
			console.warn(
				`Failed to read cache entry for ${request.url} from KV cache: ${error instanceof Error ? error.message : String(error)}.`,
			);
			return undefined;
		}
	}

	ONE_HUNDRED_YEARS = 100 * 365 * 24 * 60 * 60 * 1000; // in milliseconds

	private get KvCacheEntry() {
		const cacheThis = this;

		return class KvCacheEntry {
			body: ArrayBuffer;
			status: number;
			statusText: string;
			headers: Record<string, string>;
			expiresAt: number;

			constructor(body: ArrayBuffer, status: number, statusText: string, headers: Headers, expiresAt: number) {
				this.body = body;

				this.status = status;
				this.statusText = statusText;

				this.headers = {};
				headers.forEach((value, key) => {
					this.headers[key] = value;
				});

				this.expiresAt = cacheThis.options.neverExpireKV ? cacheThis.ONE_HUNDRED_YEARS : expiresAt;
			}

			static async fromResponse(response: Response) {
				const responseClone = response.clone();
				const body = await responseClone.arrayBuffer();

				// calculate the expiration time of the cache entry based on the cache-control directives,
				// preferring s-maxge, then max-age, and defaulting to 100 years if no relevant directives are found
				const cacheControl = responseClone.headers.get('Cache-Control');
				let maxAge: number | null = null;
				if (cacheThis.options.neverExpireKV) {
					maxAge = cacheThis.ONE_HUNDRED_YEARS / 1000; // in seconds
				} else if (cacheControl) {
					const directives = cacheControl.split(',').map((directive) => directive.trim());
					for (const directive of directives) {
						if (directive.startsWith('s-maxage=')) {
							const sMaxAgeValue = directive.substring('s-maxage='.length);
							const sMaxAgeSeconds = parseInt(sMaxAgeValue, 10);
							if (!isNaN(sMaxAgeSeconds)) {
								maxAge = sMaxAgeSeconds;
								break;
							}
						} else if (directive.startsWith('max-age=')) {
							const maxAgeValue = directive.substring('max-age='.length);
							const maxAgeSeconds = parseInt(maxAgeValue, 10);
							if (!isNaN(maxAgeSeconds)) {
								maxAge = maxAgeSeconds;
								// don't break here because s-maxage takes precedence over max-age
							}
						}
					}
				}
				if (maxAge === null) {
					return null;
				}
				const expiresAt = Date.now() + maxAge * 1000;

				return new this(body, responseClone.status, responseClone.statusText, responseClone.headers, expiresAt);
			}

			toJSON() {
				return {
					body: new Uint8Array(this.body).toBase64(),
					status: this.status,
					statusText: this.statusText,
					headers: this.headers,
					expiresAt: this.expiresAt,
				};
			}

			static fromJSON(
				json: string | { body: string; status: number; statusText: string; headers: Record<string, string>; expiresAt: number },
			) {
				let foundJson: Record<string, unknown>;
				if (typeof json === 'string') {
					try {
						foundJson = JSON.parse(json);
					} catch (error) {
						throw new Error('Invalid JSON string for cache entry');
					}
				} else {
					foundJson = json;
				}

				if (!foundJson.expiresAt || typeof foundJson.expiresAt !== 'number') {
					throw new Error('Cache entry JSON must have an expiresAt property of type number');
				}
				if (Date.now() > foundJson.expiresAt) {
					throw new Error('Cache entry has expired');
				}

				if (!foundJson.body || typeof foundJson.body !== 'string') {
					throw new Error('Cache entry JSON must have a body property of type string');
				}
				const body = new Uint8Array(Uint8Array.fromBase64(foundJson.body)).buffer;

				if (typeof foundJson.status !== 'number') {
					throw new Error('Cache entry JSON must have a status property of type number');
				}
				const status = foundJson.status;

				if (typeof foundJson.statusText !== 'string') {
					throw new Error('Cache entry JSON must have a statusText property of type string');
				}
				const statusText = foundJson.statusText;

				if (
					typeof foundJson.headers !== 'object' ||
					foundJson.headers === null ||
					Array.isArray(foundJson.headers) ||
					Object.values(foundJson.headers).some((value) => typeof value !== 'string') ||
					Object.keys(foundJson.headers).some((key) => typeof key !== 'string')
				) {
					throw new Error('Cache entry JSON must have a headers property of type object');
				}
				const headers = new Headers(foundJson.headers as Record<string, string>);

				return new this(body, status, statusText, headers, foundJson.expiresAt);
			}
		};
	}

	/**
	 * Purges cached responses across all edges by exact URLs (files).
	 * Uses Cloudflare Zone Purge API with the "files" field.
	 */
	private async dangerouslyPurgeAllEdgeCachesByUrls(urls: string[]) {
		if (env.DEVELOPMENT) {
			console.warn('Skipping cache purge by URLs in development environment');
			return;
		}

		if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN__CACHE_PURGE) {
			console.warn('CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN__CACHE_PURGE not set; skipping URL purge.');
			return;
		}

		const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN__CACHE_PURGE}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ files: urls }),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to purge cache by URLs: ${error}`);
		}
	}
}

/**
 * Gets whether the bodies of two responses are equal by comparing their array buffers.
 */
async function compareResponses(response1: Response, response2: Response, url?: URL): Promise<boolean> {
	return Promise.all([response1.arrayBuffer(), response2.arrayBuffer()]).then(([buffer1, buffer2]) => {
		const bothAreHtml =
			response1.headers.get('Content-Type')?.includes('text/html') && response2.headers.get('Content-Type')?.includes('text/html');

		// If both responses are HTML, we should strip out HTML comments and whitespace before comparing.
		// Some of furman.edu's pages add cache-related comments at the end of the HTML.
		if (bothAreHtml) {
			const stripHtmlCommentsAndWhitespace = (html: string) => {
				const removedClassNames: string[] = [];
				const removedAttributeValues: string[] = [];

				let cleaned = html
					// Remove HTML comments
					.replace(/<!--[\s\S]*?-->/g, '')
					// Remove whitespace (including newlines) and trim
					.replace(/\s+/g, ' ')
					.trim()
					// remove URL fragment after anchor href attributes
					// (furman.edu) sometimes puts random fragments at the end
					.replace(/href="([^"#]+)#([^"]*)"/g, 'href="$1"')
					// remove cloudflare email protection spans and anchors
					.replace(/<span[^>]*data-cfemail[^>]*>.*?<\/span>/gi, '')
					.replace(/<a[^>]*data-cfemail[^>]*>.*?<\/a>/gi, '')
					// ignore cookies classes
					.replace(/class="([^"]*)"/g, (match, classes: string) => {
						const filtered = classes
							.split(/\s+/)
							.filter((className) => !className.startsWith('cookies-'))
							.join(' ');
						return `class="${filtered}"`;
					})
					// remove any attribute values that end with a hyphen and any amount of numbers
					.replace(/<(\w+)\s+([^>]*)>/g, (match, tag, attrs) => {
						const updated = attrs.replace(/(\w+)="([^"]*)"/g, (match: never, attr: string, value: string) => {
							const filtered = value
								.split(/\s+/)
								.filter((v) => {
									const doesNotEndWithDynamicNumber = !/^.*-\d+$/.test(v) || v.startsWith('wp-');
									const shouldKeep = v && doesNotEndWithDynamicNumber;
									if (!shouldKeep && v) {
										if (attr === 'class') {
											removedClassNames.push(v);
										} else {
											removedAttributeValues.push(v);
										}
									}
									return shouldKeep;
								})
								.join(' ');
							return `${attr}="${filtered}"`;
						});
						return `<${tag} ${updated}>`;
					});

				// galleries may also be videos
				const classNamesGalleries = removedClassNames.filter((className) => className.startsWith('gallery-'));
				const classNamesVideos = removedClassNames.filter((className) => className.startsWith('video-'));
				if (classNamesGalleries.length) {
					classNamesGalleries.forEach((galleryClass) => {
						const correspondingVideoClass = galleryClass.replace('gallery-', 'video-');
						if (!removedClassNames.includes(correspondingVideoClass)) {
							removedClassNames.push(correspondingVideoClass);
						}
					});
				}
				if (classNamesVideos.length) {
					classNamesVideos.forEach((videoClass) => {
						const correspondingGalleryClass = videoClass.replace('video-', 'gallery-');
						if (!removedClassNames.includes(correspondingGalleryClass)) {
							removedClassNames.push(correspondingGalleryClass);
						}
					});
				}

				// remove class name values from and style or script tag contents
				if (removedClassNames.length > 0) {
					cleaned = cleaned.replace(/<(style|script)[^>]*>([\s\S]*?)<\/\1>/gi, (match, tag, content) => {
						const updatedContent = content.replace(new RegExp(removedClassNames.join('|'), 'g'), '');
						return `<${tag}>${updatedContent}</${tag}>`;
					});
				}

				return cleaned;
			};
			const strippedBuffer1 = stripHtmlCommentsAndWhitespace(new TextDecoder().decode(buffer1));
			const strippedBuffer2 = stripHtmlCommentsAndWhitespace(new TextDecoder().decode(buffer2));

			if (strippedBuffer1 === strippedBuffer2) {
				return true;
			}

			const differences = diffStrings(strippedBuffer1, strippedBuffer2);
			differences.then((diffs) => {
				if (diffs.length === 0) {
					console.debug(
						`${url ?? response1.url}: Responses differ in length but have the same text content after stripping HTML comments and whitespace.`,
					);
				} else {
					console.debug(
						`${url ?? response1.url}: Responses differ in length and have different text content even after stripping HTML comments and whitespace. Showing context around first difference:`,
						diffs[0],
					);
				}
			});
			return false;
		}

		if (buffer1.byteLength !== buffer2.byteLength) {
			console.debug(`${url ?? response1.url}: Responses differ in length: ${buffer1.byteLength} bytes vs ${buffer2.byteLength} bytes`);
			return false;
		}

		const view1 = new Uint8Array(buffer1);
		const view2 = new Uint8Array(buffer2);
		for (let i = 0; i < view1.length; i++) {
			if (view1[i] !== view2[i]) {
				const contextLength = 100;
				const start = Math.max(0, i - contextLength);
				const end = Math.min(view1.length, i + contextLength);
				const surrounding1 = view1.slice(start, end);
				const surrounding2 = view2.slice(start, end);

				console.debug(
					`${url ?? response1.url}: Responses differ at byte ${i}. Showing ${contextLength} bytes of context around the difference:`,
					{
						position: i,
						response1: surrounding1,
						response2: surrounding2,
					},
				);

				return false;
			}
		}
		return true;
	});
}

/**
 * Finds the positions where two strings differ and returns the context around those positions.
 */
async function diffStrings(
	string1: string,
	string2: string,
	contextLength = 100,
): Promise<{ position: number; context1: string; context2: string }[]> {
	if (string1 === string2) {
		return [];
	}

	const differences: { position: number; context1: string; context2: string }[] = [];
	const minLength = Math.min(string1.length, string2.length);
	for (let i = 0; i < minLength; i++) {
		if (string1[i] !== string2[i]) {
			const start = Math.max(0, i - contextLength);
			const end = Math.min(minLength, i + contextLength);
			differences.push({
				position: i,
				context1: string1.slice(start, end),
				context2: string2.slice(start, end),
			});
		}
	}

	if (string1.length !== string2.length) {
		differences.push({
			position: minLength,
			context1: string1.slice(minLength, minLength + contextLength),
			context2: string2.slice(minLength, minLength + contextLength),
		});
	}

	return differences;
}

function parseDateHeaderValue(dateValue: string | null): Date | null {
	if (!dateValue) {
		return null;
	}

	const parsedDate = new Date(dateValue);
	if (Number.isNaN(parsedDate.getTime())) {
		return null;
	}

	return parsedDate;
}
