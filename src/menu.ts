import { env } from 'cloudflare:workers';
import z from 'zod';
import { ssrCustomElement } from './elements-loader.js';

const NAVIGATION_TIERS = {
	/**
	 * The main menu bar that appears at the top of the page on desktop.
	 */
	primary: 2,
	/**
	 * The small menu that appears at the top-right of the page on desktop.
	 */
	secondaryRight: 3,
	/**
	 * The small menu that appears at the top-left of the page on desktop.
	 */
	secondaryLeft: 4,
	/**
	 * The navigation menu that opens from the hamburger icon.
	 */
	menu: 5,
};

const BLOG_HOME = 'https://blogs.furman.edu/shi-applied-research';

/**
 * Gets the navigation menu items from the Shi Institute WordPress API.
 */
async function getNavigationMenuItems(ctx: ExecutionContext): Promise<Array<z.infer<typeof partialMenuItemSchema>>> {
	const url = new URL(`${BLOG_HOME}/wp-json/wp/v2/menu-items`);
	const cacheKey = new Request(url);

	// if the menu items are in the cache, use them instead of re-fetching from the API
	const cache = await caches.open('navigation-cache');
	const cached = await cache.match(cacheKey);
	if (cached) {
		return cached.json();
	}

	// grab the menu items from the API
	const response = await fetch(cacheKey.url, {
		headers: {
			Authorization: 'Basic ' + btoa(`${env.WP_API_USERNAME}:${env.WP_API_TOKEN}`),
			'User-Agent': 'Cloudflare-Worker/1.0',
			Host: 'blogs.furman.edu',
		},
	});
	if (!response.ok) {
		try {
			const errorData = await response.json();
			console.error(`Failed to fetch menu items: ${response.status} ${response.statusText}`, errorData);
		} catch {
			console.error(`Failed to fetch menu items: ${response.status} ${response.statusText}`);
		}
		return [];
	}

	const menuItems = await response.json();
	if (!Array.isArray(menuItems)) {
		throw new Error('Invalid response from menu-items endpoint');
	}

	const validMenuItems = partialMenuItemSchema
		.array()
		.parse(menuItems)
		.map((item) => ({
			...item,
			url: item.url.replace(BLOG_HOME, ''), // convert absolute URLs to relative URLs
		}));

	// create a new response with the cache headers
	const responseToCache = new Response(JSON.stringify(validMenuItems), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=60', // cache for 1 minute
		},
	});

	// store the response in the cache without blocking the response to the client
	ctx.waitUntil(cache.put(cacheKey, responseToCache));

	return validMenuItems;
}

const partialMenuItemSchema = z.object({
	id: z.number(),
	title: z.object({
		rendered: z.string(),
	}),
	status: z.string(),
	url: z.string(),
	menu_order: z.number(),
	menus: z.array(z.number()).or(z.number()),
	parent: z.number(),
});

/**
 * Gets the navigation elements for a given menu tier (e.g. primary, secondaryRight, etc.)
 * by fetching the menu items from the WordPress API and filtering/sorting them based on
 * their menu order and which menu(s) to which they belong.
 */
export async function getNavigationElements(menu: keyof typeof NAVIGATION_TIERS, ctx: ExecutionContext) {
	const menuItems = await getNavigationMenuItems(ctx);

	return (
		menuItems
			// limit to the selected menu tier
			.filter((item) => {
				const menus = Array.isArray(item.menus) ? item.menus : [item.menus];
				return menus.includes(NAVIGATION_TIERS[menu]);
			})
			// sort by menu order
			.sort((a, b) => (a.menu_order > b.menu_order ? 1 : -1))
	);
}

export function toLabelHrefPair(element: z.infer<typeof partialMenuItemSchema>) {
	return {
		label: element.title.rendered,
		href: element.url,
	};
}

const shiFontFaces = `
@font-face {
	font-family: 'Epilogue';
	font-style: normal;
	font-weight: 100 900;
	font-display: swap;
	src: url(/wp-content/themes/cpschool/fonts/epilogue/fonts/Epilogue-VariableFont_wght.ttf) format('woff2');
}
`;

/**
 * Gets the HTML and script for the Shi Institute custom menus. The HTML uses declarative shadow DOM to ensure that
 * the menu HTML is available immedeiately on page load. The menu is upgraded to a custom element on the client side
 * once the custom elements script is loaded.
 */
export async function getInjectableNavigation(ctx: ExecutionContext) {
	const menuData = await getNavigationMenuData(ctx);

	const primaryMenuBarHtml = ssrCustomElement(
		'shi-primary-menu-bar',
		() => import('../static/custom-elements/shi-primary-menu-bar.js').then((mod) => mod.ShiPrimaryNavigationBar),
		{
			items: menuData.primary,
			'side-nav-items': menuData.menu,
		},
	);

	const secondaryMenuBarHtml = ssrCustomElement(
		'shi-secondary-menu-bar',
		() => import('../static/custom-elements/shi-secondary-menu-bar.js').then((mod) => mod.ShiSecondaryNavigationBar),
		{
			'left-items': menuData.secondaryLeft,
			'right-items': menuData.secondaryRight,
		},
	);

	return `
		${await secondaryMenuBarHtml}
		${await primaryMenuBarHtml}
		<script type="module">
			import '/custom-elements/define.js';
		</script>
		<style>
			@view-transition {
				navigation: auto;
			}
			${shiFontFaces}
		</style>
	`;
}

export async function getNavigationMenuData(ctx: ExecutionContext) {
	const [primary, secondaryLeft, secondaryRight, menu] = await Promise.all([
		getNavigationElements('primary', ctx),
		getNavigationElements('secondaryLeft', ctx),
		getNavigationElements('secondaryRight', ctx),
		getNavigationElements('menu', ctx),
	]);

	return {
		primary: primary.map(toLabelHrefPair).flatMap((item, index, array) => {
			// add a divider before services and after projects
			if (index === array.length - 3 || index === array.length - 1) {
				return [item, { label: 'divider', href: '' }];
			}

			return item;
		}),
		secondaryLeft: secondaryLeft.map(toLabelHrefPair),
		secondaryRight: secondaryRight.map(toLabelHrefPair),
		menu: menu.map(toLabelHrefPair),
	};
}
