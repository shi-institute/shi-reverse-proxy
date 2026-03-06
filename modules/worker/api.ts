import z from 'zod';

const BLOG = 'https://blogs.furman.edu/shi-applied-research';
const FUWEB = 'https://www.furman.edu/shi-institute';

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
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
					status: 200,
					statusText: 'OK',
				});
			} else {
				return new Response(`No post or page found for path: ${path}`, {
					headers: { 'Access-Control-Allow-Origin': '*' },
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

		if (url.pathname === '/.api/posts') {
			const tagIds = url.searchParams.get('tags');
			const tagIdsArray = tagIds
				? tagIds
						.split(',')
						.map((id) => Number(id.trim()))
						.filter((id) => Number.isInteger(id))
				: [];

			const categoryIds = url.searchParams.get('categories');
			const categoryIdsArray = categoryIds
				? categoryIds
						.split(',')
						.map((id) => Number(id.trim()))
						.filter((id) => Number.isInteger(id))
				: [];

			const posts = await getPosts(categoryIdsArray, tagIdsArray);
			return new Response(JSON.stringify(posts).replaceAll('https://blogs.furman.edu/shi-applied-research', ''), {
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
				status: 200,
				statusText: 'OK',
			});
		}
	},
};

/**
 * Gets posts from the WordPress REST API with optional filtering by category and tag IDs.
 * Also fetches media details for posts with a featured image.
 */
export async function getPosts(
	categoryIds: number[] = [],
	tagIds: number[] = [],
): Promise<(z.infer<typeof wordpressPostSchema> & { media?: z.infer<typeof wordpressMediaSchema> | null })[]> {
	const postsQueryUrl = new URL(`${BLOG}/wp-json/wp/v2/posts`);
	if (tagIds.length > 0) {
		postsQueryUrl.searchParams.set('tags', tagIds.join(','));
	}
	if (categoryIds.length > 0) {
		postsQueryUrl.searchParams.set('categories', categoryIds.join(','));
	}

	const posts = await fetch(postsQueryUrl, {
		headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
	})
		.then((res) => res.json())
		.then((data) => wordpressPostSchema.array().parse(data))
		.catch((err) => {
			console.error('Error fetching posts:', err);
			return [] as z.infer<typeof wordpressPostSchema>[];
		});

	const postsWithMedia = await Promise.all(
		posts.map(async (post) => {
			if (post.featured_media) {
				const media = await fetch(`${BLOG}/wp-json/wp/v2/media/${post.featured_media}`, {
					headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
				})
					.then((res) => res.json())
					.then((data) => wordpressMediaSchema.parse(data))
					.catch((err) => {
						console.error(`Error fetching media for post ${post.id}:`, err);
						return null;
					});
				return { ...post, media };
			}
			return post;
		}),
	);

	return postsWithMedia;
}

export type PostMediaDetails = z.infer<typeof wordpressMediaSchema>['media_details'];
export type Post = Awaited<ReturnType<typeof getPosts>>[number];
export type Posts = Post[];

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
	let id = await getPageOrPostId(BLOG, pathname);
	if (id) {
		return id;
	}

	// also try furman.edu/shi-instiute
	id = await getPageOrPostId(FUWEB, pathname);
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

const wpDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
	.or(z.string().datetime())
	.describe('WordPress datetime');

export const wordpressPostSchema = z.object({
	id: z.number(),
	date: wpDate,
	date_gmt: wpDate,
	modified: wpDate,
	modified_gmt: wpDate,
	slug: z.string(),
	status: z.string(),
	type: z.literal('post'),
	link: z.string().url(),
	title: z.object({ rendered: z.string() }),
	content: z.object({
		rendered: z.string(),
		protected: z.boolean(),
	}),
	excerpt: z.object({
		rendered: z.string(),
		protected: z.boolean(),
	}),
	author: z.number(),
	featured_media: z.number(),
	comment_status: z.string(),
	ping_status: z.string(),
	sticky: z.boolean(),
	template: z.string(),
	format: z.string(),
	meta: z.record(z.string(), z.unknown()),
	categories: z.array(z.number()),
	tags: z.array(z.number()),
	_links: z.record(z.string(), z.unknown()),
});

export const wordpressMediaSchema = z.object({
	id: z.number(),
	date: wpDate,
	date_gmt: wpDate,
	modified: wpDate,
	modified_gmt: wpDate,
	slug: z.string(),
	type: z.literal('attachment'),
	link: z.string().url(),
	title: z.object({ rendered: z.string() }),
	author: z.number(),
	comment_status: z.string(),
	ping_status: z.string(),
	alt_text: z.string(),
	caption: z.object({ rendered: z.string() }),
	description: z.object({ rendered: z.string() }),
	media_type: z.string(),
	mime_type: z.string(),
	post: z.number().nullable(),
	source_url: z.string().url(),
	media_details: z.object({
		width: z.number().optional(),
		height: z.number().optional(),
		file: z.string().optional(),
		filesize: z.number().optional(),
		sizes: z
			.record(
				z.string(),
				z.object({
					file: z.string().optional(),
					width: z.number().optional(),
					height: z.number().optional(),
					mime_type: z.string().optional(),
					source_url: z.url().optional(),
				}),
			)
			.optional(),
		image_meta: z
			.object({
				aperture: z.number().or(z.string()).optional(),
				credit: z.string().optional(),
				camera: z.string().optional(),
				caption: z.string().optional(),
				created_timestamp: z.string().optional(),
				copyright: z.string().optional(),
				focal_length: z.number().or(z.string()).optional(),
				iso: z.number().or(z.string()).optional(),
				shutter_speed: z.number().or(z.string()).optional(),
				title: z.string().optional(),
				orientation: z.string().optional(),
				keywords: z.array(z.string()).optional(),
			})
			.optional(),
	}),
	_links: z.record(z.string(), z.unknown()),
});
