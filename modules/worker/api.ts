import z from 'zod';
import { rewrites } from './redirects';

const BLOG = 'https://blogs.furman.edu/jbtest';
const FUWEB = 'https://www.furman.edu/shi-institute';
const FUWEBROOT = 'https://www.furman.edu';

export default {
	async fetch(request: Request<unknown, IncomingRequestCfProperties<unknown>>, env: Env, ctx: ExecutionContext): Promise<Response | void> {
		const url = new URL(request.url);
		if (!url.pathname.startsWith('/.api/')) {
			return;
		}

		if (url.pathname.startsWith('/.api/get-id/')) {
			const path = url.pathname.replace('/.api/get-id', '');
			const [, id, resolvedPathname] = await getIdFromPathname(path);

			if (id) {
				return new Response(JSON.stringify({ id, pathname: resolvedPathname || path }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
					status: 200,
					statusText: 'OK',
				});
			} else {
				return new Response(`No post or page found for path: ${resolvedPathname || path}`, {
					headers: { 'Access-Control-Allow-Origin': '*' },
					status: 404,
					statusText: 'Not Found',
				});
			}
		}

		if (url.pathname.startsWith('/.api/editor/')) {
			const path = url.pathname.replace('/.api/editor', '');
			const [type, id, resolvedPathname] = await getIdFromPathname(path);

			if (!id) {
				return new Response(`No post or page found for path: ${resolvedPathname || path}`, {
					status: 404,
					statusText: 'Not Found',
				});
			}

			const isFurmanEdu = resolvedPathname.startsWith('/shi-institute');
			const editUrl = isFurmanEdu
				? `${FUWEB}/wp-admin/post.php?post=${id}&action=edit`
				: type === 'pages'
					? `${BLOG}/wp-admin/site-editor.php?p=page&postId=${id}`
					: `${BLOG}/wp-admin/post.php?post=${id}&action=edit`;

			return Response.redirect(editUrl, 307);
		}

		if (url.pathname === '/.api/canonical-profile') {
			let type = url.searchParams.get('type');
			const slug = url.searchParams.get('slug');

			if (!type) {
				return new Response(`Missing 'type' query parameter`, {
					headers: { 'Access-Control-Allow-Origin': '*' },
					status: 400,
					statusText: 'Bad Request',
				});
			}

			if (!slug) {
				return new Response(`Missing 'slug' query parameter`, {
					headers: { 'Access-Control-Allow-Origin': '*' },
					status: 400,
					statusText: 'Bad Request',
				});
			}

			const allowedTypes = ['staff', 'affiliate', 'fellow', 'affiliates', 'fellows'];
			if (!allowedTypes.includes(type)) {
				return new Response(`Invalid 'type' query parameter. Allowed values are: ${allowedTypes.join(', ')}`, {
					headers: { 'Access-Control-Allow-Origin': '*' },
					status: 400,
					statusText: 'Bad Request',
				});
			}
			if (type === 'affiliates' || type === 'fellows') {
				type = type.slice(0, -1); // convert to singular for API endpoint
			}

			// check furman.edu for a matching profile
			const [, furmanProfileId] = await getPageOrPostId(FUWEBROOT, slug, ['people']);
			if (furmanProfileId) {
				return new Response(JSON.stringify({ id: furmanProfileId, source: 'furman.edu', href: `${FUWEBROOT}/people/${slug}` }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
					status: 200,
					statusText: 'OK',
				});
			}

			// otherwise, check the blog for a matching profile
			const [, blogProfileId] = await getPageOrPostId(BLOG, slug, [type]);
			if (blogProfileId) {
				return new Response(
					JSON.stringify({ id: blogProfileId, source: 'blogs.furman.edu', href: `${url.origin}/people/${type}/${slug}` }),
					{
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
						status: 200,
						statusText: 'OK',
					},
				);
			}

			return new Response(`No profile found for type '${type}' with slug '${slug}'`, {
				headers: { 'Access-Control-Allow-Origin': '*' },
				status: 404,
				statusText: 'Not Found',
			});
		}

		// TODO: generalize this to work with any post type
		if (url.pathname === '/.api/projects') {
			return createStaleWhileRevalidateResponse(async () => {
				const taxonomyArrays: Record<string, number[]> = {};
				for (const [key, value] of url.searchParams.entries()) {
					if (key.startsWith('taxonomy__')) {
						const taxonomy = key.replace('taxonomy__', '');
						const idsArray = value
							.split(',')
							.map((id) => Number(id.trim()))
							.filter((id) => Number.isInteger(id));
						if (idsArray.length > 0) {
							taxonomyArrays[taxonomy] = idsArray;
						}
					}
				}

				const pageSizeParam = url.searchParams.get('per_page');
				const pageSize =
					pageSizeParam && Number.isInteger(Number(pageSizeParam)) && Number(pageSizeParam) > 0 ? Number(pageSizeParam) : undefined;

				const pageParam = url.searchParams.get('page');
				const page = pageParam && Number.isInteger(Number(pageParam)) && Number(pageParam) > 0 ? Number(pageParam) : undefined;

				const posts = await getProjectBriefs(page, pageSize, taxonomyArrays);

				return new Response(JSON.stringify(posts).replaceAll(BLOG, ''), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
						'Cache-Control': 'public, max-age=60', // cache for 1 minute
					},
					status: 200,
					statusText: 'OK',
				});
			});
		}

		if (url.pathname === '/.api/get-modified-posts-since') {
			const since = url.searchParams.get('since');
			if (!since) {
				return new Response(`Missing 'since' query parameter`, {
					headers: { 'Access-Control-Allow-Origin': '*' },
					status: 400,
					statusText: 'Bad Request',
				});
			}

			const modifiedPosts = await getModifiedPostsSince(BLOG, since);

			return new Response(JSON.stringify(modifiedPosts), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
				status: 200,
				statusText: 'OK',
			});
		}

		/**
		 * Converts a response into a stale-while-revalidate capable response.
		 *
		 * The response will be stored into a cache with the current URL as the cache key.
		 *
		 * If a cached response already exists for the URL, it will be returned immediately
		 * and the new response will be generated in the background and replace the cached
		 * response once ready.
		 *
		 * If no cached response exists, the new response will be generated and returned as normal,
		 * and then it will be cached for future requests.
		 *
		 * To specify the cache lifetime, set the `Cache-Control` header on the response returned by
		 * `createResponse`. The cache will respect the `max-age` directive and automatically remove stale entries.
		 *
		 * @param createResponse
		 * A callback function that is responsible for creating and returning a new Response object.
		 * This function will be called on every request.
		 */
		async function createStaleWhileRevalidateResponse(createResponse: () => Promise<Response>) {
			const cache = await caches.open('.api-projects-cache');

			const cacheKey = new Request(url);
			const cached = await cache.match(cacheKey);

			if (cached) {
				ctx.waitUntil(
					(async () => {
						const freshResponse = await createResponse();
						await cache.put(cacheKey, freshResponse);
					})(),
				);
				return cached;
			}

			const firstResponse = await createResponse();
			ctx.waitUntil(cache.put(cacheKey, firstResponse.clone()));
			return firstResponse;
		}
	},
};

/**
 * Gets project briefs from the WordPress REST API with optional filtering by taxonomies.
 * Also fetches media details for posts with a featured image.
 */
async function getProjectBriefs(
	page: number = 1,
	pageSize: number = 10,
	taxonomies: Record<string, number[]> = {},
): Promise<(z.infer<typeof wordpressProjectSchema> & { media?: z.infer<typeof wordpressMediaSchema> | null })[]> {
	const postsQueryUrl = new URL(`${BLOG}/wp-json/wp/v2/projects`);
	for (const [taxonomy, ids] of Object.entries(taxonomies)) {
		if (ids.length > 0) {
			postsQueryUrl.searchParams.set(`${taxonomy}`, ids.join(','));
		}
	}
	if (page > 0) {
		postsQueryUrl.searchParams.set('page', page.toString());
	}
	if (pageSize > 0) {
		postsQueryUrl.searchParams.set('per_page', pageSize.toString());
	}

	const posts = await fetch(postsQueryUrl, {
		headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
	})
		.then((res) => res.json())
		.then((data) => wordpressProjectSchema.array().parse(data))
		.catch((err) => {
			console.error('Error fetching posts:', err);
			return [] as z.infer<typeof wordpressProjectSchema>[];
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

export type MediaDetails = z.infer<typeof wordpressMediaSchema>['media_details'];
type ProjectBrief = Awaited<ReturnType<typeof getProjectBriefs>>[number];
export type ProjectBriefs = ProjectBrief[];

/**
 * Queries the WordPress REST API for blugs.furman.edu/shi-applied-research and
 * furman.edu/shi-institute to find a page or post with a slug matching the last
 * segment of the given path and returns its ID if found.
 *
 * @param pathname The path for which a corresponding page or post ID should be found (e.g. /projects/rcdst)
 * @returns The ID of the matching page or post or null if no match is found on either WordPress site
 */
export async function getIdFromPathname(pathname: string) {
	// convert rewrite aliases back to their original paths so that we can find the correct IDs via the API
	if (Object.values(rewrites).includes(pathname)) {
		const originalPathname = Object.keys(rewrites).find((key) => rewrites[key] === pathname);
		if (originalPathname) {
			pathname = originalPathname;
		}
	}

	// try the blog API first
	let [type, id] = await getPageOrPostId(BLOG, pathname);
	if (id) {
		return [type, id, pathname] as const;
	}

	// also try furman.edu/shi-instiute
	[type, id] = await getPageOrPostId(FUWEB, pathname);
	if (id) {
		return [type, id, pathname] as const;
	}

	return [null, null, pathname] as const;
}

const DEFAULT_POST_TYPE_CASCADE = ['pages', 'posts', 'projects', 'services', 'people', 'staff', 'affiliates', 'fellows'] as const;

/**
 * Queries the WordPress REST API to find a page or post with a slug matching the
 * last segment of the given path and returns its ID if found.
 *
 * @param baseUrl The base URL of the WordPress site (e.g. https://blogs.furman.edu/shi-applied-research)
 * @param path The path for which a corresponding page or post ID should be found (e.g. /projects/rcdst)
 * @returns The numeric ID of the matching page or post or null
 */
async function getPageOrPostId(baseUrl: string, path: string, typeCascade = DEFAULT_POST_TYPE_CASCADE as unknown as string[]) {
	const slug = path
		.replace(/^\/|\/$/g, '')
		.split('/')
		.pop();
	if (!slug) {
		return [null, null] as const;
	}

	// try each type in order until a match is found
	for (const type of typeCascade) {
		let url = `${baseUrl}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}`;
		let res = await fetch(url, {
			headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
		});
		let data = await res.json();
		if (Array.isArray(data) && data.length > 0 && typeof data[0].id === 'number') {
			return [type, data[0].id] as const;
		}
	}

	return [null, null] as const;
}

const wpDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
	.or(z.string().datetime())
	.describe('WordPress datetime');

const wordpressProjectSchema = z.object({
	id: z.number(),
	date: wpDate,
	date_gmt: wpDate,
	modified: wpDate,
	modified_gmt: wpDate,
	slug: z.string(),
	status: z.string(),
	type: z.literal('projects'),
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
	template: z.string(),
	meta: z.record(z.string(), z.unknown()),
	'project-category': z.array(z.number()),
	'project-tag': z.array(z.number()),
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

/**
 * Gets the available post types from a WordPress site.
 *
 * Excludes built-in WordPress types that start with "wp_".
 */
async function getPostTypes(baseUrl: string, includeAttachments = false): Promise<string[]> {
	const url = `${baseUrl}/wp-json/wp/v2/types`;
	const data = await fetch(url, {
		headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
	})
		.then((res) => res.json())
		.then((json) => z.record(z.string(), z.object({ slug: z.string(), rest_base: z.string() })).parse(json));
	const types = Object.entries(data)
		.filter(
			([key]) =>
				!key.startsWith('wp_') &&
				!key.startsWith('nav_') &&
				!key.startsWith('coblocks_') &&
				(includeAttachments ? true : key !== 'attachment'),
		) // filter out WP and CoBlocks internal types
		.map(([key, type]) => type.rest_base);
	return types;
}

async function getModifiedPostsForTypeSince(baseUrl: string, postTypeSlug: string, since: string) {
	const url = `${baseUrl}/wp-json/wp/v2/${postTypeSlug}?modified_after=${encodeURIComponent(since)}&per_page=100`;
	try {
		const data = await fetch(url, {
			headers: { 'User-Agent': 'Cloudflare-Worker/1.0' },
		})
			.then((res) => res.json())
			.then((json) =>
				z
					.array(
						z
							.object({
								id: z.number(),
								modified: wpDate,
								modified_gmt: wpDate,
								link: z.url(),
							})
							.transform((post) => {
								return {
									...post,
									link: post.link.replace(baseUrl, ''), // convert to relative link for easier matching with incoming requests
								};
							}),
					)

					.parse(json),
			);
		return data;
	} catch (error) {
		if (process.env.DEVELOPMENT) {
			console.error(`Error fetching modified posts for type '${postTypeSlug}':`, error);
		}
		return [];
	}
}

export async function getModifiedPostsSince(baseUrl: string, since: string) {
	const postTypes = await getPostTypes(baseUrl);
	const modifiedPostsArrays = await Promise.all(postTypes.map((type) => getModifiedPostsForTypeSince(baseUrl, type, since)));
	return modifiedPostsArrays.flat();
}
