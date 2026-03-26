import type { ReverseProxyHandler } from './Handler';
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
	 * Includes a stale-while-revalidate directive in the Cache-Control header of the response
	 * with the specified max age in seconds, allowing browsers and other clients to use a
	 * stale cached response while they revalidate it in the background. This can help improve
	 * performance and reduce load on the origin server for resources that don't change frequently.
	 */
	staleWhileRevalidate?: number;
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
	private staleWhileRevalidate?: number;
	private afterBodyReplacements?: ReverseProxyOptions['afterBodyReplacements'];

	constructor({
		originServer,
		notFoundPaths = [],
		stringReplacements = {},
		removePath = false,
		spoofOrigin = true,
		spoofHost = true,
		injectViewTransition = true,
		staleWhileRevalidate,
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
		this.staleWhileRevalidate = staleWhileRevalidate;
		this.afterBodyReplacements = afterBodyReplacements;
	}

	async fetch(request: Request): Promise<Response> {
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
		if (request.headers.get('Cache-Control') === 'no-cache') {
			originUrl.searchParams.set('_cache-bust', Date.now().toString());
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

		const originResponse = await fetch(originUrl, {
			headers: requestHeaders,
			method: request.method,
			body: request.body as any,
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

		// follow redirects
		if ([301, 302, 303, 307, 308].includes(originResponse.status)) {
			const location = originResponse.headers.get('Location');
			if (location === null) {
				throw new Error(`Received ${originResponse.status} response without Location header`);
			}

			const proxiedLocation = this.toProxyServerUrl(location, requestUrl);

			const headers = cloneHeaders(originResponse.headers);
			headers.set('Location', proxiedLocation.toString());

			return new Response(null, {
				status: originResponse.status,
				headers,
				statusText: originResponse.statusText,
			});
		}

		// replace all URLs in the response body that point to the WordPress server with URLs that point to the proxy
		const body = await this.readBodyWithReplacements(originResponse, requestUrl);

		const headers = cloneHeaders(originResponse.headers);
		headers.set('Link', `<${requestUrl.href}>; rel="canonical"`);
		headers.set('Content-Security-Policy', 'upgrade-insecure-requests');
		if (this.staleWhileRevalidate !== undefined) {
			const cacheControl = headers.get('Cache-Control');
			const directives = cacheControl ? cacheControl.split(',').map((dir) => dir.trim()) : [];
			directives.push(`stale-while-revalidate=${this.staleWhileRevalidate}`);
			headers.set('Cache-Control', directives.join(', '));
		}
		return new Response(body, {
			status: originResponse.status,
			headers,
			statusText: originResponse.statusText,
		});
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

		for await (const handler of this.queue) {
			const maybeResponse = await handler.fetch(request, env, ctx);
			if (maybeResponse) {
				response = maybeResponse;
				break;
			}
		}

		this.queue.clear();

		if (response) {
			return response;
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
