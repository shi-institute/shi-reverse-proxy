interface ReverseProxyOptions {
	originServer: URL;
	notFoundPaths?: string[];
	stringReplacements?: Record<string, string>;
	removePath?: boolean;
}

export class ReverseProxy {
	private proxyOriginServer: URL;
	private notFoundPaths: string[];
	private stringReplacements: Record<string, string>;
	private removePath: boolean;

	constructor({ originServer, notFoundPaths = [], stringReplacements = {}, removePath = false }: ReverseProxyOptions) {
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
		console.log(`Fetching from origin server: ${originUrl.href}`);
		const originResponse = await fetch(originUrl, {
			headers: request.headers,
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

			// remove all instances of the full wordpress server URL
			text = text.replaceAll(
				escaped(this.proxyOriginServer.origin + (this.removePath ? this.proxyOriginServer.pathname : '')),
				escaped(requestUrl.origin),
			);

			if (this.removePath) {
				// remove instances of strings that start with the wordpress server path and are followed by a slash,	a question mark, or the end of the string
				text = text.replaceAll(escaped(this.proxyOriginServer.pathname + '/'), escaped('/'));
				text = text.replaceAll(escaped(this.proxyOriginServer.pathname + '?'), escaped('?'));
				text = text.replaceAll(escaped(this.proxyOriginServer.pathname), escaped(''));
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

		return body;
	}
}

function cloneHeaders(headers: Headers): Headers {
	const clonedHeaders = new Headers();
	headers.forEach((value, key) => {
		clonedHeaders.set(key, value);
	});
	return clonedHeaders;
}
