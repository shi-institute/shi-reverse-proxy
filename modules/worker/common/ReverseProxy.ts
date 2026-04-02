import 'core-js/proposals/array-buffer-base64';
import { ServerTimingHelper } from '../../custom-elements/utils';
import type { ReverseProxyHandler } from './Handler';
import { ReverseProxyCache, type ReverseProxyCacheOptions } from './ReverseProxyCache';
import type { RewritableRequest } from './RewritableRequest';

interface ReverseProxyOptions {
	originServer: URL;
	notFoundPaths?: string[];
	stringReplacements?: Record<string, string>;
	removePath?: boolean;
	spoofOrigin?: boolean;
	spoofHost?: boolean;
	/**
	 * Whether to inject a sttyle in the head that opts into view transitions for navigation.
	 * @default true
	 */
	injectViewTransition?: boolean;
	/**
	 * Runs after the proxy has performed its built-in URL replacements on the response body and
	 * has applied the string replacements, allowing you to perform any additional custom replacements.
	 *
	 * The function receives the response body after the built-in replacements have been applied,
	 * the request URL, and the content type of the response. You can return a new body with additiona
	 *  replacements or return void (undefined) to keep the body unchanged.
	 */
	afterBodyReplacements?: (
		body: string | ArrayBuffer | ReadableStream<Uint8Array> | null,
		requestUrl: URL,
		contentType: string,
	) => Promise<void | string | ArrayBuffer | ReadableStream<Uint8Array> | null> | string | ArrayBuffer | ReadableStream<Uint8Array> | null;
}

export class ReverseProxy {
	private proxyOriginServer: URL;
	private notFoundPaths: string[];
	private stringReplacements: Record<string, string>;
	private removePath: boolean;
	private spoofOrigin: boolean;
	private spoofHost: boolean;
	private injectViewTransition: boolean;
	private afterBodyReplacements?: ReverseProxyOptions['afterBodyReplacements'];

	constructor({
		originServer,
		notFoundPaths = [],
		stringReplacements = {},
		removePath = false,
		spoofOrigin = true,
		spoofHost = true,
		injectViewTransition = true,
		afterBodyReplacements,
	}: ReverseProxyOptions) {
		if (!originServer) {
			throw new Error('originServer must be defined');
		}

		if (!originServer.origin.startsWith('http://') && !originServer.origin.startsWith('https://')) {
			throw new Error('originServer must start with http:// or https://');
		}

		if (originServer.pathname.endsWith('/') && originServer.pathname !== '/') {
			throw new Error('originServer must not end with a slash');
		}

		this.proxyOriginServer = originServer;
		this.notFoundPaths = notFoundPaths;
		this.stringReplacements = stringReplacements;
		this.removePath = removePath;
		this.spoofOrigin = spoofOrigin;
		this.spoofHost = spoofHost;
		this.injectViewTransition = injectViewTransition;
		this.afterBodyReplacements = afterBodyReplacements;
	}

	async fetch(request: Request): Promise<Response> {
		const startMs = performance.now();
		const requestUrl = new URL(request.url);

		if (this.notFoundPaths.includes(requestUrl.pathname)) {
			return new Response(null, {
				status: 404,
			});
		}

		// fetch the resource from the origin server
		const originUrl = new URL(
			this.proxyOriginServer.origin + (this.removePath ? this.proxyOriginServer.pathname : '') + requestUrl.pathname + requestUrl.search,
		);
		const requestHeaders = cloneHeaders(request.headers);
		if (this.spoofOrigin) {
			requestHeaders.set('Origin', this.proxyOriginServer.origin);
		}
		if (this.spoofHost) {
			requestHeaders.set('Host', this.proxyOriginServer.host);
		}

		// We always want the latest version of the resource from the origin server.
		// Cloudflare will handle cahcing on the worker side.
		const cacheBustDateString = Date.now().toString();
		originUrl.searchParams.set('_cache-bust', cacheBustDateString);
		requestHeaders.set('Cache-Control', 'no-cache');
		requestHeaders.set('Pragma', 'no-cache');

		if (!request.headers.get('User-Agent')) {
			requestHeaders.set('User-Agent', 'Cloudflare-Worker/1.0');
		}

		const xForwardedFor =
			request.headers.get('X-Forwarded-For') || request.headers.get('CF-Connecting-IP') || request.headers.get('X-Real-IP');
		const xForwardedProto = request.headers.get('X-Forwarded-Proto') || requestUrl.protocol.replace(':', '');
		const xForwardedHost = request.headers.get('X-Forwarded-Host') || requestUrl.host;
		if (xForwardedFor) {
			requestHeaders.set('X-Forwarded-For', xForwardedFor);
		}
		requestHeaders.set('X-Forwarded-Proto', xForwardedProto);
		requestHeaders.set('X-Forwarded-Host', xForwardedHost);
		requestHeaders.set('X-Shi-Forwarded-Host', xForwardedHost);
		requestHeaders.set('X-Shi-Forwarded-Proto', xForwardedProto);
		requestHeaders.set('Forwarded', `for=${xForwardedFor || ''};proto=${xForwardedProto};host=${xForwardedHost}`);

		const originStartTime = performance.now();
		const originResponse = await fetch(originUrl, {
			headers: requestHeaders,
			method: request.method,
			...(request.method !== 'GET' && request.method !== 'HEAD' ? { body: request.body as any } : {}),
			// duplex: 'half',
			credentials: request.credentials,
			integrity: request.integrity,
			keepalive: request.keepalive,
			mode: request.mode,
			redirect: request.redirect,
			referrer: request.referrer,
			referrerPolicy: request.referrerPolicy,
			signal: request.signal,
			window: null,
		}).catch((error) => {
			console.error(`Failed to fetch from ${originUrl.href}: `, error);
			throw new Error(`Failed to fetch from ${originUrl.href}: ${error}`);
		});
		const originDuration = performance.now() - originStartTime;

		// follow redirects
		if ([301, 302, 303, 307, 308].includes(originResponse.status)) {
			const location = originResponse.headers.get('Location');
			if (location === null) {
				throw new Error(`Received ${originResponse.status} response without Location header`);
			}

			const proxiedLocation = this.toProxyServerUrl(location, requestUrl);

			// Remove the cache-bust search param from the Location header
			// if it from the one we added to the request URL. If we do not
			// remove it, the client will see a URL with the cache-bust param.
			// It is for internal use only.
			const cacheBustValue = proxiedLocation.searchParams.get('_cache-bust')!;
			if (cacheBustValue === cacheBustDateString) {
				proxiedLocation.searchParams.delete('_cache-bust');
			}

			const headers = cloneHeaders(originResponse.headers);
			headers.set('Location', proxiedLocation.toString());
			headers.set(
				'Server-Timing',
				ServerTimingHelper.asTimingString('reverse-proxy', performance.now() - startMs, 'Reverse Proxy Duration'),
			);

			return new Response(null, {
				status: originResponse.status,
				headers,
				statusText: originResponse.statusText,
			});
		}

		// replace all URLs in the response body that point to the WordPress server with URLs that point to the proxy
		const bodyReadStartMs = performance.now();
		const body = await this.readBodyWithReplacements(originResponse, requestUrl);
		const bodyReadDuration = performance.now() - bodyReadStartMs;

		const headers = cloneHeaders(originResponse.headers);
		const timings = new ServerTimingHelper(headers);
		timings.setTiming('reverse-proxy', performance.now() - startMs, 'Reverse Proxy Duration');
		timings.setTiming('origin', originDuration, 'Origin Response Time');
		timings.setTiming('read-body', bodyReadDuration, 'Read and Replace Body Duration');
		headers.set('Server-Timing', timings.toString());
		headers.set('Link', `<${requestUrl.href}>; rel="canonical"`);
		headers.set('Content-Security-Policy', 'upgrade-insecure-requests');

		return new Response(body, {
			status: originResponse.status,
			headers,
			statusText: originResponse.statusText,
		});
	}

	/**
	 * Fetches the resource from the origin server, applying stale-while-revalidate caching with the specified max age.
	 * If a cached response is available and not stale, it is returned immediately while a revalidation request is made
	 * in the background to update the cache. If no cached response is available or if the cached response is stale, a
	 * request is made to the origin server, the response is sent to the client, and then the response is cached for
	 * future use.
	 *
	 * `maxStaleAge` is the the maximum age in seconds that a cached stale response can be used while revalidating in the background.
	 * The default value is 43200 seconds (12 hours), which means that if a cached response is up to 12 hours old,
	 * it can be returned immediately while a revalidation request is made in the background to update the cache
	 * If the cached response is older than 12 hours, it will be considered stale, and a request will be made to
	 * the origin server to fetch a fresh response before returning it to the client.
	 */
	async fetchStaleWhileRevalidate<Props>(
		request: Request,
		ctx: ExecutionContext<Props>,
		{ maxStaleAge = 43200, cacheOptions = {} }: { maxStaleAge?: number; cacheOptions?: ReverseProxyCacheOptions } = {},
	): Promise<Response> {
		const requestUrl = new URL(request.url);
		const cache = await ReverseProxyCache.open(ctx, cacheOptions);

		const cached = await cache.match(request);
		if (cached.type === 'HIT') {
			// start to refresh the cache in the background
			const cachedClone = cached.clone();
			ctx.waitUntil(
				(async () => {
					const newResponse = await this.fetch(request);
					if (!newResponse.ok) {
						if (process.env.DEVELOPMENT) {
							console.debug(
								`Not updating cache for ${requestUrl.href} since the origin response was not successful (status: ${newResponse.status})`,
							);
						}
						return;
					}

					return await cache.putIfChanged(request, newResponse, {
						cached: cachedClone, // pass the cached value so that it does not need to check the cache again
						cacheDirectives: [`s-maxage=${maxStaleAge}`],
					});
				})(),
			);

			return cached.response;
		}

		const response = await this.fetch(request);

		// if the response is successful, store it in the cache for future use
		if (response.ok) {
			ReverseProxyCache.setHeadersForMissOrBypass(response.headers, cached.headersToSet);
			const responseToCache = response.clone();
			const cachedClone = cached.clone();
			ctx.waitUntil(cache.putIfChanged(request, responseToCache, { cached: cachedClone, cacheDirectives: [`s-maxage=${maxStaleAge}`] }));
		}

		return response;
	}

	/**
	 * Converts a URL that points to the WordPress blog into a URL that points to the proxy.
	 */
	private toProxyServerUrl(url: string | URL, requestUrl: URL): URL {
		const parsedUrl = new URL(url, requestUrl.origin);

		// if the URL doesn't point to the WordPress server, return it unchanged
		if (parsedUrl.origin !== this.proxyOriginServer.origin) {
			return parsedUrl;
		}

		const proxyUrl = new URL(
			requestUrl.origin +
				(this.removePath ? parsedUrl.pathname.slice(this.proxyOriginServer.pathname.length) : parsedUrl.pathname) +
				parsedUrl.search,
		);
		return proxyUrl;
	}

	private async readBodyWithReplacements(response: Response, requestUrl: URL) {
		let body: string | ArrayBuffer | ReadableStream<Uint8Array> | null = null;

		const replaceText = (text: string, options?: { isJsonString?: boolean }) => {
			// When the text is from a JSON string, we need to escape the search values so
			// that they match the escaped URLs in the JSON string. When the text is from
			// HTML, JavaScript, or CSS, we can use the unescaped URLs.
			const escaped = (string: string) => (options?.isJsonString ? JSON.stringify(string).slice(1, -1) : string);

			// replace all instances of the full origin server server URL with a relative URL
			text = text.replaceAll(escaped(this.proxyOriginServer.origin + (this.removePath ? this.proxyOriginServer.pathname : '')), '');

			if (this.removePath) {
				// remove instances of strings that start with the origin server path and are followed by a slash, a question mark, or the end of the string
				text = text.replaceAll(escaped(this.proxyOriginServer.pathname + '/'), escaped('/'));
				text = text.replaceAll(escaped(this.proxyOriginServer.pathname + '?'), escaped('?'));
				text = text.replaceAll(escaped(this.proxyOriginServer.pathname), escaped(''));
			}

			if (this.injectViewTransition) {
				// inject a style that opts into view transitions for navigation
				text = text.replace('<head>', '<head><style>@view-transition { navigation: auto; }</style>');
			}

			// also perform any additional string replacements
			for (const [searchValue, replaceValue] of Object.entries(this.stringReplacements)) {
				text = text.replaceAll(escaped(searchValue), escaped(replaceValue));
			}

			return text;
		};

		const TEXT_CONTENT_TYPES = ['text/html', 'text/css', 'application/javascript'];

		const contentType = response.headers.get('Content-Type') || '';
		if (TEXT_CONTENT_TYPES.some((type) => contentType.includes(type))) {
			body = await response.text().then(replaceText);
		} else if (contentType.includes('application/json')) {
			body = await response.json().then((json) => {
				const jsonString = JSON.stringify(json);
				const replacedJsonString = replaceText(jsonString, { isJsonString: true });
				return replacedJsonString;
			});
		} else {
			body = await response.arrayBuffer();
		}

		if (this.afterBodyReplacements) {
			const response = await this.afterBodyReplacements(body, requestUrl, contentType);
			if (response !== undefined) {
				body = response;
			}
		}

		return body;
	}
}

export class ReverseProxyHandlerQueue<ExecutionContextProps> {
	private queue: Set<ReverseProxyHandler<ExecutionContextProps>>;

	constructor() {
		this.queue = new Set();
	}

	/**
	 * Adds a proxy handler to the queue.
	 */
	enqueue(proxy: ReverseProxyHandler<ExecutionContextProps>) {
		this.queue.add(proxy);
	}

	/**
	 * Removes a proxy handler from the front of the queue and returns it.
	 * @returns The removed proxy handler. If the queue is empty, this value will be undefined.
	 */
	dequeue() {
		return this.queue.values().next().value;
	}

	/**
	 * Deletes a specified proxy handler from the queue.
	 * @param proxy The proxy handler to delete from the queue.
	 * @returns true if the proxy handler was found and deleted; otherwise, false.
	 */
	delete(proxy: ReverseProxyHandler<ExecutionContextProps>) {
		return this.queue.delete(proxy);
	}

	/**
	 * Returns the number of proxy handlers in the queue.
	 */
	size(): number {
		return this.queue.size;
	}

	/**
	 * Clears all proxy handlers from the queue.
	 */
	clear() {
		this.queue.clear();
	}

	/**
	 * Process each proxy handler in the queue with the given request, environment,
	 * and execution context until a handler returns a response. If a handler returns
	 * a response, that response is returned, and the remaining handlers
	 * in the queue are not processed. If no handlers return a response, this method
	 * returns void (undefined).
	 */
	async flush(
		request: RewritableRequest<Request<unknown, IncomingRequestCfProperties>>,
		env: Env,
		ctx: ExecutionContext<ExecutionContextProps>,
	): Promise<Response | void> {
		let response: Response | undefined = undefined;

		const timings = new ServerTimingHelper(new Headers());
		for await (const [handler, index] of Array.from(this.queue).map((handler, index) => [handler, index] as const)) {
			const handlerStartTime = performance.now();

			const maybeResponse = await handler.fetch(request, env, ctx);

			const handlerDuration = performance.now() - handlerStartTime;
			if (handlerDuration > 1) {
				timings.setTiming(`handler-${index + 1}`, handlerDuration, `Handler ${index + 1} Duration`);
			}

			if (maybeResponse) {
				response = maybeResponse;
				break;
			}
		}

		this.queue.clear();

		if (response) {
			const headers = cloneHeaders(response.headers);
			headers.set('Server-Timing', ServerTimingHelper.merge(timings, response.headers).toString());
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		}
	}
}

function cloneHeaders(headers: Headers): Headers {
	const clonedHeaders = new Headers();
	headers.forEach((value, key) => {
		clonedHeaders.set(key, value);
	});
	return clonedHeaders;
}
