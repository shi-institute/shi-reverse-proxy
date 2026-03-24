import { parseHTML } from 'linkedom';
import z from 'zod';
import customElementsCss from '../custom-elements/components/custom-elements.css';
import type { NavigationListItem } from '../custom-elements/components/navigation-bar-parts/NavigationList.svelte';
import { render } from '../custom-elements/server.js';

type NavigationTier = 'secondaryLeft' | 'secondaryRight' | 'desktopNavbar' | 'sideMenu' | 'footerMenu';

const BLOG = 'https://blogs.furman.edu/jbtest';
const BLOG_API_NAVIGATION = BLOG + '/wp-json/wp/v2/navigation';

/**
 * Gets the navigation menu items by querying the WordPress REST API.
 *
 * The menu items are cached for 1 minute to reduce the number of requests to the WordPress site.
 */
async function getNavigationMenuItems(
	ctx: ExecutionContext<{ adminBarHref?: string }>,
): Promise<Record<NavigationTier, z.infer<typeof navigationMenuSchema>> | null> {
	const url = new URL(`${BLOG_API_NAVIGATION}`);
	const cacheKey = new Request(url);

	// if the menu items are in the cache, use them instead of querying the WordPress REST API again
	const cache = await caches.open('navigation-cache');
	const cached = await cache.match(cacheKey);
	if (cached) {
		return cached.json();
	}

	// 5-second timeout to prevent hanging if the WordPress site is slow to respond
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 5000);

	try {
		const navigationMenusResponse = await fetch(cacheKey.url, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'Cloudflare-Worker/1.0',
				Host: 'blogs.furman.edu',
			},
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!navigationMenusResponse.ok) {
			console.error(`Failed to fetch menu items: ${navigationMenusResponse.status} ${navigationMenusResponse.statusText}`);
			return null;
		}

		// parse the JSON response and extract the menu items
		const navigationData = await navigationMenusResponse.json().then((data) => navigationMenuSchema.array().parse(data));
		const get = (id: number) => navigationData.find((menu) => menu.id === id) ?? ([] as unknown as z.infer<typeof navigationMenuSchema>);
		const menuItems = {
			secondaryLeft: get(371),
			secondaryRight: get(375),
			desktopNavbar: get(23),
			sideMenu: get(78),
			footerMenu: get(847),
		};

		// create a new response with the cache headers
		const responseToCache = new Response(JSON.stringify(menuItems), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=60', // cache for 1 minute
			},
		});

		// store the response in the cache without blocking the response to the client
		ctx.waitUntil(cache.put(cacheKey, responseToCache));

		return menuItems;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			console.error('Request timed out');
			throw new Error('Request timed out while fetching navigation menu items');
		}
		throw error;
	}
}

function toNavigationListItem(item: z.infer<typeof navigationMenuSchema>['items'][number]): NavigationListItem {
	if (item.tagName === 'spacer') {
		return { type: 'spacer', size: item.attributes.size };
	}

	return {
		label: item.text,
		href: item.attributes.href,
	};
}

/**
 * Gets the HTML and script for the Shi Institute custom menus. The HTML uses declarative shadow DOM to ensure that
 * the menu HTML is available immedeiately on page load. The menu is upgraded to a custom element on the client side
 * once the custom elements script is loaded.
 */
export async function getInjectableNavigation(ctx: ExecutionContext<{ adminBarHref?: string }>, currentUrl: URL) {
	const menuData = await getNavigationMenuData(ctx);

	function transformHref(href: string) {
		// if (href === '/') {
		// 	return '/shi-institute';
		// }
		return href;
	}

	const primaryMenuBarHtml = render(
		'PrimaryNavigationBar',
		{ props: { bar: menuData.primary, menu: menuData.menu, transformHref } },
		{ url: currentUrl },
	);

	const secondaryMenuBarHtml = render(
		'SecondaryNavigationBar',
		{ props: { left: menuData.secondaryLeft, right: menuData.secondaryRight, transformHref } },
		{ url: currentUrl },
	);

	const adminBarHtml = render(
		'AdminBar',
		{ props: { adminHref: ctx.props.adminBarHref || 'https://blogs.furman.edu/jbtest/wp-admin' } },
		{ url: currentUrl },
	);

	return `
		${await adminBarHtml}
		${await secondaryMenuBarHtml}
		${await primaryMenuBarHtml}
		<script src="/custom-elements.js" type="module"></script>
		<style>${customElementsCss}</style>
		<style>
			@view-transition {
				navigation: auto;
			}
		</style>
		<style>
			/* hide the old menus */
			header > div:nth-child(1),
			header > div:nth-child(2) {
				display: none;
			}

			/* stop WordPress from adding margin before our menu items */
			header > * {
				margin: 0 !important;
			}
		</style>
		<script type="module">
			// on Alt + Shift + E, launch the WordPress editor for current page or post if it exists
			window.addEventListener('keydown', async (event) => {
				if (event.altKey && event.shiftKey && (event.key.toLowerCase() === 'e' || event.code === 'KeyE')) {
					event.preventDefault();
					window.open(\`/.api/editor\${window.location.pathname}\`, '_blank', 'width=1600,height=1000');
				}
			});
			// on Alt + Shift + A, show the admin bar if it's hidden, or hide it if it's visible
			window.addEventListener('keydown', async (event) => {
				if (event.altKey && event.shiftKey && (event.key.toLowerCase() === 'a' || event.code === 'KeyA')) {
					event.preventDefault();
					const isVisible = localStorage.getItem('adminBarVisible') === 'true';
					localStorage.setItem('adminBarVisible', String(!isVisible));
					window.dispatchEvent(new CustomEvent('adminBarVisibleChanged', { detail: !isVisible }));
				}
			});
			console.log(\`
                         ░░░░░░░░░░░░░                                    
                     ░░░░░░░░░░░░░░░░░           ░░░░░                    
                  ░░░░░░░░░░░░░░░░              ░░░░░░░░░░                
                   ░░░░░░░                     ░░░░░░░░░░░░░              
            ░░░░     ░      ░░░░░░░░░░        ░░░░░░░░░░░░░░░░░           
          ░░░░░░░░      ░░░░░░░░░░░░░░        ░░░░░░░░░░░░░░░░░░          
        ░░░░░░░░░       ░░░░░░░░░░           ░░░░░░░░░░░░░░░░░            
       ░░░░░░░░   ░░     ░░░                 ░░░░░░░░░░░░░░░              
     ░░░░░░░░   ░░░░░░        ░░░░░░░░      ░░░░░░░░░░░░░░                
      ░░░░░░  ░░░░░░░░      ░░░░░░░░░░     ░░░░░░░░░░░░░                  
             ░░░░░░░   ░░    ░░░░░░░░     ░░░░░░░░░░░░               ░░░  
   ░░         ░░░░   ░░░░░                 ░░░░░░░░░             ░░░░░░░  
  ░░░░░░░          ░░░░░░░░░                   ░░            ░░░░░░░░░░░░ 
 ░░░░░░░  ░░░░         ░░░                               ░░░░░░░░░░░░░░░░░
 ░░░░░░   ░░░░░░                                     ░░░░░░░░░░░░░░░░░░░░░
 ░░░░░░  ░░░░░░  ░░░░░                             ░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░  ░░░░░░  ░░░░░░                            ░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░   ░░░░░   ░░░░░░                             ░░░░░░░░░░░░░░░░░░░░░░
░░░░░   ░░░                                                               
                                                                          
            ░░░  ░░░░░░░                                                  
 ░░░░░░   ░░░░░░  ░░░░░░░                         ░░░░░░░░                
 ░░░░░░░  ░░░░░░   ░░░                           ░░░░░░░░░░░░░░░          
  ░░░░░░░  ░░░░░░         ░░                    ░░░░░░░░░░░░░░░░░░░░░     
   ░░░░░░░  ░░░░░      ░░░░░░░░░                  ░░░░░░░░░░░░░░░░░░░░░░  
   ░░░░░░░   ░         ░░░░░░░░░      ░░░░░░        ░░░░░░░░░░░░░░░░░░░   
     ░░░░░░       ░░░░   ░░░░░░░      ░░░░░░░        ░░░░░░░░░░░░░░░░░    
     ░░░░       ░░░░░░░░░    ░░       ░░░░░░░░         ░░░░░░░░░░░░░░     
            ░░░   ░░░░░░░░░░          ░░░░░░░░░          ░░░░░░░░░░░      
          ░░░░░░░    ░░░░░░░░░        ░░░░░░░░░░           ░░░░░░░        
          ░░░░░░░░░░    ░░░░░         ░░░░░░░░░░░            ░░░░         
            ░░░░░░░░░░                ░░░░░░░░░░░░                        
              ░░░░░░░░░░░░░           ░░░░░░░░░░░░░                       
                 ░░░░░░░░░░           ░░░░░░░░░░░░░░                      
                     ░░░░░            ░░░░░░░░░░░░░░░                     
                                      ░░░░░░░░░░░░                        

               The Shi Institute for Sustainable Communties               
                            Furman University                             

                          https://shi.institute                       \`);
		</script>
	`;
}

export async function getNavigationMenuData(ctx: ExecutionContext<{ adminBarHref?: string }>) {
	const menuItems = await getNavigationMenuItems(ctx);
	if (!menuItems) {
		return {
			primary: [],
			secondaryLeft: [],
			secondaryRight: [],
			menu: [],
		};
	}

	const { secondaryLeft, secondaryRight, desktopNavbar: primary, sideMenu: menu } = menuItems;

	return {
		primary: primary.items.map(toNavigationListItem).flatMap((item, index, array) => {
			// add a divider before services and after projects
			if (index === array.length - 3 || index === array.length - 1) {
				return [item, { type: 'divider' } as NavigationListItem];
			}

			return item;
		}),
		secondaryLeft: secondaryLeft.items.map(toNavigationListItem),
		secondaryRight: secondaryRight.items.map(toNavigationListItem),
		menu: menu.items.map(toNavigationListItem),
	};
}

const navigationMenuSchema = z
	.object({
		id: z.number(),
		slug: z.string(),
		title: z.object({ rendered: z.string() }),
		content: z.object({ rendered: z.string() }),
	})
	.transform((item) => {
		const { id, slug, title, content } = item;

		// parse the rendered content to extract the menu items and their URLs
		const { document, HTMLAnchorElement, HTMLElement } = parseHTML(content.rendered);
		const listItems = Array.from(document.querySelectorAll(':where(a, div)'));

		const menuItems = listItems
			.map((elem) => {
				if (elem instanceof HTMLAnchorElement) {
					const text = elem.textContent || '';

					let href = elem.getAttribute('href') || '';
					if (href.startsWith(BLOG)) {
						href = href.substring(BLOG.length);
						if (!href.startsWith('/')) {
							href = '/' + href;
						}
					}

					const shouldOpenInNewTab = elem.getAttribute('target') === '_blank' || text.endsWith(' ↗');
					const target = shouldOpenInNewTab ? '_blank' : '_self';

					const rel = shouldOpenInNewTab ? 'noopener noreferrer' : elem.getAttribute('rel') || undefined;

					return { tagName: 'a' as const, text, attributes: { href, target, rel } };
				}

				if (elem instanceof HTMLElement && elem.classList.contains('wp-block-spacer')) {
					const spacerSize = elem.style.flexBasis || elem.style.height || elem.style.width || '1rem';
					return { tagName: 'spacer' as const, attributes: { size: spacerSize } };
				}
			})
			.filter((x) => !!x);

		return {
			id,
			slug,
			title: title.rendered,
			items: menuItems,
		};
	});
