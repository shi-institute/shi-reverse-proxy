import customElementsCss from '@shi-institute/custom-elements/custom-elements.css?raw';
import { navigationListItemSchema, render } from '@shi-institute/custom-elements/server';
import { entraStaticTenantBranding, wordpressMediaSchema, wordpressProjectSchema, wpDate } from '@shi-institute/schemas';
import { isJSON } from '@shi-institute/utils';
import { parseHTML } from 'linkedom';
import z from 'zod';
import { getInjectableNavigation, getNavigationMenuData } from './menu';
import { rewrites } from './redirects';

const BLOG = 'https://blogs.furman.edu/jbtest';
const FUWEB = 'https://www.furman.edu/shi-institute';
const FUWEBROOT = 'https://www.furman.edu';
const MOODLE_SSO_LOGIN_URL =
  'https://login.microsoftonline.com/f862f7d9-f146-4518-a6fb-9f2ea82d3c80/saml2?SAMLRequest=jVLbbhshEP2VFe97Y%2B29INuSEyuqpbS1YrcPfYkwDDHSLmwZ6OXvi3cTNZXaqG8wzLnMYVbIh35k2%2BAv5gG%2BBkCf%2FBh6g2x6WJPgDLMcNTLDB0DmBTtu398zmhVsdNZbYXvyCvI2giOC89oakux3a%2FIoueRUFlwsVV3RRsV7WbayappFI2nT1YulrJbnoutI8hkcRuSaRKIIRwywN%2Bi58bFU0Dot6pTSE61YUbKi%2B0KSXZxGG%2B4n1MX7EVme9%2FZJm2zQwlm0ylvTawOZsEOu2pqqRnapKhd1uliWbcprdU47RYG3VFaiLfLrjJQk25dBbq3BMIA7gvumBXx6uP8tJWxwCJip4AZuMpAh5zHomSPHcT6kXGA2Xsa%2FtJPk8BzxjTZSm6e30z3PTcjenU6H9PDxeCKb1VWDTWm5zX8bG8DHn%2FH86muVv6ZYzQvzIYrvdwfba%2FEzubORxv%2FbW5mVU0XLVE2tLBgcQWilQcYs%2B95%2Bv3XAPayJdwFIvplF%2F1zMzS8%3D';

export default {
  async fetch(
    request: Request<unknown, IncomingRequestCfProperties<unknown>>,
    env: Env,
    ctx: ExecutionContext<{ adminBarHref?: string }>
  ): Promise<Response | void> {
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
          }
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

    if (url.pathname === '/.api/navigation-html') {
      const passedUrlStr = url.searchParams.get('url');
      const contextUrl = passedUrlStr ? new URL(passedUrlStr) : url;

      const includeFonts = url.searchParams.get('includeFonts') === 'true';

      let navigationHtml = await getInjectableNavigation(ctx, contextUrl);

      if (includeFonts) {
        navigationHtml += `
				<style>
					@font-face {
						font-family: "Epilogue";
						src: url("https://shi.institute/files/fonts/Epilogue-VariableFont_wght.ttf")
							format("truetype");
						font-weight: 100 900;
						font-style: normal;
						font-display: swap;
					}
					@font-face {
						font-family: 'Oswald';
						font-style: normal;
						font-weight: 200 700;
						font-display: swap;
						src: url(https://fonts.gstatic.com/s/oswald/v57/TK3iWkUHHAIjg752Fz8Ghe4.woff2) format('woff2');
						unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
					}
					@font-face {
						font-family: 'Oswald';
						font-style: normal;
						font-weight: 200 700;
						font-display: swap;
						src: url(https://fonts.gstatic.com/s/oswald/v57/TK3iWkUHHAIjg752GT8G.woff2) format('woff2');
						unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
					}
				</style>
				`;
      }

      return new Response(navigationHtml, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200,
        statusText: 'OK',
      });
    }

    if (url.pathname === '/.api/navigation-json') {
      const menuData = await getNavigationMenuData(ctx);
      return new Response(JSON.stringify(menuData), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200,
        statusText: 'OK',
      });
    }

    if (url.pathname === '/.api/navigation-html/external') {
      const passedUrlStr = url.searchParams.get('url');
      const contextUrl = passedUrlStr ? new URL(passedUrlStr) : url;

      const includeFonts = url.searchParams.get('includeFonts') === 'true';

      const providedMenuItemsJson = url.searchParams.get('menuItems');
      const parsedProvidedMenuItems = navigationListItemSchema
        .array()
        .safeParse(isJSON(providedMenuItemsJson) ? JSON.parse(providedMenuItemsJson) : []);

      const menuData = await getNavigationMenuData(ctx);
      const primaryMenuBarHtml = await render(
        'ExternalNavigationBar',
        {
          props: {
            bar:
              parsedProvidedMenuItems.success && parsedProvidedMenuItems.data.length > 0
                ? parsedProvidedMenuItems.data
                : [
                    { label: 'Research & Consulting Services', href: '/services/' },
                    { label: 'All Projects', href: '/projects/' },
                  ],
            menu: menuData.menu,
          },
        },
        { url: contextUrl }
      );

      let navigationHtml = `
				<style>${customElementsCss}</style>
				<style>:root { --external-navigation-bar-height: 30px; }</style>
				${primaryMenuBarHtml}
				<script src="/custom-elements.js" type="module"></script>
			`;

      if (includeFonts) {
        navigationHtml += `
				<style>
					@font-face {
						font-family: "Epilogue";
						src: url("https://shi.institute/files/fonts/Epilogue-VariableFont_wght.ttf")
							format("truetype");
						font-weight: 100 900;
						font-style: normal;
						font-display: swap;
					}
					@font-face {
						font-family: 'Oswald';
						font-style: normal;
						font-weight: 200 700;
						font-display: swap;
						src: url(https://fonts.gstatic.com/s/oswald/v57/TK3iWkUHHAIjg752Fz8Ghe4.woff2) format('woff2');
						unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
					}
					@font-face {
						font-family: 'Oswald';
						font-style: normal;
						font-weight: 200 700;
						font-display: swap;
						src: url(https://fonts.gstatic.com/s/oswald/v57/TK3iWkUHHAIjg752GT8G.woff2) format('woff2');
						unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
					}
				</style>
				`;
      }

      return new Response(navigationHtml, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200,
        statusText: 'OK',
      });
    }

    if (url.pathname === '/.api/entra/static-tenant-branding') {
      return fetch(MOODLE_SSO_LOGIN_URL)
        .then((res) => res.text())
        .then((html) => {
          const { document } = parseHTML(html);

          const scriptTags = document.querySelectorAll('script');
          const configScriptElement = Array.from(scriptTags).find((script) => script.textContent.includes(`//<![CDATA[\n$Config={"`));
          if (!configScriptElement) {
            return new Response(`Could not find $Config in the HTML response from ${MOODLE_SSO_LOGIN_URL}`, {
              headers: { 'Access-Control-Allow-Origin': '*' },
              status: 500,
              statusText: 'Internal Server Error',
            });
          }

          const configScriptContent = configScriptElement.textContent;
          const configJsonMatch = configScriptContent.match(/\$Config\s*=\s*(\{.*\});/s);
          if (!configJsonMatch) {
            return new Response(`Could not extract $Config JSON from the script content`, {
              headers: { 'Access-Control-Allow-Origin': '*' },
              status: 500,
              statusText: 'Internal Server Error',
            });
          }

          const configJsonString = configJsonMatch[1];
          let configObject;
          try {
            configObject = JSON.parse(configJsonString || '');
          } catch (error) {
            return new Response(`Error parsing $Config JSON: ${error}`, {
              headers: { 'Access-Control-Allow-Origin': '*' },
              status: 500,
              statusText: 'Internal Server Error',
            });
          }

          if (
            configObject === null ||
            typeof configObject !== 'object' ||
            !Array.isArray(configObject.staticTenantBranding) ||
            configObject.staticTenantBranding.length === 0
          ) {
            return new Response(`$Config.staticTenantBranding is missing or not an array`, {
              headers: { 'Access-Control-Allow-Origin': '*' },
              status: 500,
              statusText: 'Internal Server Error',
            });
          }

          const staticTenantBranding = entraStaticTenantBranding.safeParse(configObject.staticTenantBranding[0]);
          if (!staticTenantBranding.success) {
            return new Response(
              `$Config.staticTenantBranding does not match expected schema: ${JSON.stringify(staticTenantBranding.error.issues)}`,
              {
                headers: { 'Access-Control-Allow-Origin': '*' },
                status: 500,
                statusText: 'Internal Server Error',
              }
            );
          }

          return new Response(JSON.stringify(staticTenantBranding.data), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600', // cache for 1 hour
            },
            status: 200,
            statusText: 'OK',
          });
        });
    }

    if (url.pathname === '/.api/entra/static-tenant-branding/custom-element') {
      return new Response(
        `<head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;}</style></head><shi-entra-like-ui></shi-entra-like-ui><script type="module" src="/custom-elements.js"></script>`,
        {
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600', // cache for 1 hour
          },
          status: 200,
          statusText: 'OK',
        }
      );
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
          })()
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
  taxonomies: Record<string, number[]> = {}
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
    })
  );

  return postsWithMedia;
}

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
        (includeAttachments ? true : key !== 'attachment')
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
              })
          )

          .parse(json)
      );
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
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
