// Format: original location: new location
// If the client requests the original location, they will be redirected to the new location.
export const redirects: Record<string, string> = {
	'/rcdst': '/research/rural-change-diagnostic-screen',

	// sterling-24 storymaps
	'/sterling/portal': '/sterling',
	'/sterling/online': '/sterling',
	'/sterling': '/research/sterling-24',
	'/sterling/transportation/portal': '/sterling/transportation',
	'/sterling/transportation/online': '/sterling/transportation',
	'/sterling/transportation': 'https://gis.furman.edu/portal/apps/storymaps/stories/399e1df1f0104fb69ce9f7260e4b1a0c',
	'/sterling/methods': 'https://gis.furman.edu/portal/apps/storymaps/stories/e3392a2035684ac697d178cc8755751a',

	// northside-24 storymap
	'/northside': '/research/northside-24',
	'/northside/transportation': 'https://gis.furman.edu/portal/apps/storymaps/stories/17bf269c02af45679fbcaaecbef77c87',
	'/northside/methods': 'https://gis.furman.edu/portal/apps/storymaps/stories/e20e06f7043743a9bc8f4d74bf9adecc',

	// pages
	'/pages/rent-affordability-calculator/index.html': '/research/pages/rent-affordability-calculator/index.html',
	'/pages/rent-affordability-calculator': '/research/pages/rent-affordability-calculator/index.html',

	// filestore
	'/filestore/Kolb%20-%20Measuring%20and%20Mapping%20Rural%20Gentrification%20-%20Research%20Brief.pdf':
		'/research/filestore/Kolb%20-%20Measuring%20and%20Mapping%20Rural%20Gentrification%20-%20Research%20Brief.pdf',

	// wordpress
	'/admin': '/wp-login.php',
	'/login': '/wp-login.php',
	'/sign-in': '/wp-login.php',

	// overrides for furman.edu/shi-institute -> shi.institute
	'/shi-institute/wp-content/themes/furman/assets/favicon.png': '/favicon.svg',
	'/favicon.ico': '/favicon.svg',
	'/favicon.svg': '/files/2026/03/shi-favicon.svg',
	'/shi-institute': '/',
};

// Format: original: alias
// If a client requests the original path, they will be redirected to the alias path.
// If a client requests the alias path, it will be internally rewritten to the original path,
// but the client will still see the alias path in the browser.
export const rewrites: Record<string, string> = {
	'/shi-institute/new-home/': '/', // replace home page with furman.edu/shi-institute
	'/shi-institute/sustainability/student-experiences/': '/students/',
	'/shi-institute/sustainability/student-fellows/': '/students/fellowships/',
	'/shi-institute/sustainability/community-conservation-corps/': '/community-conservation-corps/',
};
