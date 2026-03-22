const BLOG = 'https://blogs.furman.edu/jbtest';

/**
 * Fetches the footer HTML from the WordPress blog site, extracts the styles from the
 * style tags, and returns the footer HTML with the styles as a declarative shadow
 * DOM template.
 *
 * The styles are modified to replace `:root` with `:host`, body with #body, and
 * html with #html to ensure they apply correctly within the shadow DOM. Our shadow
 * DOM content is wrapped in two divs with ids of `html` and `body` to allow styles
 * that target those elements to apply correctly.
 *
 * The response is cached for 1 minute to reduce the number of requests made to the
 * WordPress site and improve performance.
 * @param ctx
 * @returns
 */
export async function getFooterHTML(ctx: ExecutionContext) {
	const url = new URL(`${BLOG}/contact`);
	const cacheKey = new Request(url);

	const cache = await caches.open('navigation-cache');
	const cached = await cache.match(cacheKey);
	if (cached) {
		return cached.text();
	}

	// 5-second timeout to prevent hanging if the WordPress site is slow to respond
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 5000);

	try {
		// grab the home page HTML
		const response = await fetch(cacheKey.url, {
			headers: {
				Accept: 'text/html',
				'User-Agent': 'Cloudflare-Worker/1.0',
				Host: 'blogs.furman.edu',
			},
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!response.ok) {
			console.error(`Failed to fetch footer: ${response.status} ${response.statusText}`);
			return null;
		}

		const htmlResponse = (await response.text()).replaceAll(BLOG, '');

		// extract the footer HTML from the response
		const footerHTML = htmlResponse.match(/<footer[\s\S]*?<\/footer>/)?.[0] || null;
		if (!footerHTML) {
			console.error('Footer element not found in the HTML');
			return null;
		}

		// extract styles from the HTML and modify them to work within the shadow DOM
		const allStyleElements = htmlResponse.match(/<style[\s\S]*?<\/style>/g) || [];
		let allStyles = allStyleElements.map((style) => style.replace(/<style[\s\S]*?>/, '').replace(/<\/style>/, '')).join('\n');
		allStyles = allStyles
			.replace(/:root\b/g, ':host')
			.replace(/(^|[^{,])\s*body(?=[\s.{#[:#,])/g, '$1 #body')
			.replace(/(^|[^{,])\s*html(?=[\s.{#[:#,])/g, '$1 #html');

		const html = `<host-element><template shadowrootmode="open"><div id="html"><div id="body">${footerHTML}<style>${allStyles}</style></div></div></template></host-element>`;

		const responseToCache = new Response(html, {
			headers: {
				'Content-Type': 'text/html',
				'Cache-Control': 'public, max-age=60', // cache for 1 minute
			},
		});

		// store the response in the cache without blocking the response to the client
		ctx.waitUntil(cache.put(cacheKey, responseToCache));
		clearTimeout(timeoutId);

		return html;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			console.error('Request timed out');
			throw new Error('Request timed out while fetching navigation menu items');
		}
		throw error;
	}
}
