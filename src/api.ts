export default {
	async fetch(request: Request<unknown, IncomingRequestCfProperties<unknown>>, env: Env, ctx: ExecutionContext): Promise<Response | void> {
		const url = new URL(request.url);
		if (!url.pathname.startsWith('/.api/')) {
			return;
		}

		if (url.pathname.startsWith('/.api/get-id/')) {
			const path = url.pathname.replace('/.api/get-id', '');
			const id = await getIdFromPathname(path);

			if (id) {
				return new Response(JSON.stringify({ id }), {
					headers: { 'Content-Type': 'application/json' },
					status: 200,
					statusText: 'OK',
				});
			} else {
				return new Response(`No post or page found for path: ${path}`, {
					status: 404,
					statusText: 'Not Found',
				});
			}
		}

		if (url.pathname.startsWith('/.api/editor/')) {
			const path = url.pathname.replace('/.api/editor', '');
			const pageOrPostId = await getIdFromPathname(path);

			if (!pageOrPostId) {
				return new Response(`No post or page found for path: ${path}`, {
					status: 404,
					statusText: 'Not Found',
				});
			}

			const isFurmanEdu = path.startsWith('/shi-institute');
			const editUrl = isFurmanEdu
				? `https://www.furman.edu/shi-institute/wp-admin/post.php?post=${pageOrPostId}&action=edit`
				: `https://blogs.furman.edu/shi-applied-research/wp-admin/post.php?post=${pageOrPostId}&action=edit`;

			return Response.redirect(editUrl, 307);
		}
	},
};

/**
 * Queries the WordPress REST API for blugs.furman.edu/shi-applied-research and
 * furman.edu/shi-institute to find a page or post with a slug matching the last
 * segment of the given path and returns its ID if found.
 *
 * @param pathname The path for which a corresponding page or post ID should be found (e.g. /projects/rcdst)
 * @returns The ID of the matching page or post or null if no match is found on either WordPress site
 */
export async function getIdFromPathname(pathname: string) {
	// try the blog API first
	let id = await getPageOrPostId('https://blogs.furman.edu/shi-applied-research', pathname);
	if (id) {
		return id;
	}

	// also try furman.edu/shi-instiute
	id = await getPageOrPostId('https://www.furman.edu/shi-institute', pathname);
	if (id) {
		return id;
	}

	return null;
}

/**
 * Queries the WordPress REST API to find a page or post with a slug matching the
 * last segment of the given path and returns its ID if found.
 *
 * @param baseUrl The base URL of the WordPress site (e.g. https://blogs.furman.edu/shi-applied-research)
 * @param path The path for which a corresponding page or post ID should be found (e.g. /projects/rcdst)
 * @returns The numeric ID of the matching page or post or null
 */
async function getPageOrPostId(baseUrl: string, path: string) {
	const slug = path
		.replace(/^\/|\/$/g, '')
		.split('/')
		.pop();
	if (!slug) {
		return null;
	}

	// try pages first
	let url = `${baseUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`;
	let res = await fetch(url, {
		headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
	});
	let data = await res.json();
	if (Array.isArray(data) && data.length > 0 && typeof data[0].id === 'number') {
		return data[0].id as number;
	}

	// if no match, try posts
	url = `${baseUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;
	console.log('Fetching URL:', url);
	res = await fetch(url, {
		headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
	});
	data = await res.json();
	if (Array.isArray(data) && data.length > 0 && typeof data[0].id === 'number') {
		return data[0].id as number;
	}

	return null;
}
