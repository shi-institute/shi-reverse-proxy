import { parseHTML } from 'linkedom';
import customElementsCss from '../custom-elements/components/custom-elements.css';
import type { NavigationListItem } from '../custom-elements/components/navigation-bar-parts/NavigationList.svelte';
import { render } from '../custom-elements/server.js';

type NavigationTier = 'secondaryLeft' | 'secondaryRight' | 'desktopNavbar' | 'desktopSideMenu' | 'mobileSideMenu';

const BLOG_HOME = 'https://blogs.furman.edu/shi-applied-research';

/**
 * Gets the navigation menu items by scraping the Shi Applied Research WordPress site.
 *
 * The menu items are cached for 1 minute to reduce the number of requests to the WordPress site.
 */
async function getNavigationMenuItems(
	ctx: ExecutionContext,
): Promise<Record<NavigationTier, ReturnType<typeof interpretMenuItems>> | null> {
	const url = new URL(`${BLOG_HOME}`);
	const cacheKey = new Request(url);

	// if the menu items are in the cache, use them instead of scraping the WordPress site again
	const cache = await caches.open('navigation-cache');
	const cached = await cache.match(cacheKey);
	if (cached) {
		return cached.json();
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
			console.error(`Failed to fetch menu items: ${response.status} ${response.statusText}`);
			return null;
		}

		// parse the HTML and extract the menu items
		const homeHtml = await response.text();
		const { document } = parseHTML(homeHtml);
		const parse = interpretMenuItems.bind(null, document);

		const secondaryLeftItems = parse('#menu-secondary-left li[itemtype="https://www.schema.org/SiteNavigationElement"] a');
		const secondaryRightItems = parse('#menu-secondary-right li[itemtype="https://www.schema.org/SiteNavigationElement"] a');
		const desktopNavbarItems = parse('#menu-main-desktop li[itemtype="https://www.schema.org/SiteNavigationElement"] a');
		const desktopSideMenuItems = parse(
			'#modal-slide-in-menu nav[aria-label="Expanded"] li[itemtype="https://www.schema.org/SiteNavigationElement"] a',
		);
		const mobileSideMenuItems = parse(
			'#modal-slide-in-menu nav[aria-label="Mobile"] li[itemtype="https://www.schema.org/SiteNavigationElement"] a',
		);
		const menuItems = {
			secondaryLeft: secondaryLeftItems,
			secondaryRight: secondaryRightItems,
			desktopNavbar: desktopNavbarItems,
			desktopSideMenu: desktopSideMenuItems,
			mobileSideMenu: mobileSideMenuItems,
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

/**
 * Interprets the menu items from the given selector and returns an array of objects containing the title, link, and whether the link should open in a new tab.
 * @param selector The CSS selector to use to find the menu items in the DOM. It should resolve to a list of anchor elements.
 */
function interpretMenuItems(document: Document, selector: string) {
	const elements = Array.from(document.querySelectorAll(selector));
	return elements.map((element, index) => {
		const title = element.textContent || undefined;
		const url = element.getAttribute('href')?.replace(BLOG_HOME, '') ?? undefined;
		const shouldOpenInNewTab = element.getAttribute('target') === '_blank' || title?.endsWith(' ↗');
		return { title, url, shouldOpenInNewTab, order: index };
	});
}

export function toLabelHrefPair(element: ReturnType<typeof interpretMenuItems>[number]): NavigationListItem {
	return {
		label: element.title || '',
		href: element.url,
	};
}

/**
 * Gets the HTML and script for the Shi Institute custom menus. The HTML uses declarative shadow DOM to ensure that
 * the menu HTML is available immedeiately on page load. The menu is upgraded to a custom element on the client side
 * once the custom elements script is loaded.
 */
export async function getInjectableNavigation(ctx: ExecutionContext, currentUrl: URL) {
	const menuData = await getNavigationMenuData(ctx);

	function transformHref(href: string) {
		if (href === '/') {
			return '/shi-institute';
		}
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

	return `
		${await secondaryMenuBarHtml}
		${await primaryMenuBarHtml}
		<script src="/custom-elements.js" type="module"></script>
		<style>${customElementsCss}</style>
		<style>
			@view-transition {
				navigation: auto;
			}
		</style>
		<script type="module">
			// on Meta + Shift + E, launch the WordPress editor for current page or post if it exists
			window.addEventListener('keydown', async (event) => {
				if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'e') {
					event.preventDefault();
					window.open(\`/.api/editor\${window.location.pathname}\`, '_blank', 'width=1600,height=1000');
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

export async function getNavigationMenuData(ctx: ExecutionContext) {
	const menuItems = await getNavigationMenuItems(ctx);
	if (!menuItems) {
		return {
			primary: [],
			secondaryLeft: [],
			secondaryRight: [],
			menu: [],
		};
	}

	const { secondaryLeft, secondaryRight, desktopNavbar: primary, mobileSideMenu: menu } = menuItems;

	return {
		primary: primary.map(toLabelHrefPair).flatMap((item, index, array) => {
			// add a divider before services and after projects
			if (index === array.length - 3 || index === array.length - 1) {
				return [item, { type: 'divider' } as NavigationListItem];
			}

			return item;
		}),
		secondaryLeft: secondaryLeft.map(toLabelHrefPair),
		secondaryRight: secondaryRight.map(toLabelHrefPair),
		menu: menu.map(toLabelHrefPair),
	};
}
