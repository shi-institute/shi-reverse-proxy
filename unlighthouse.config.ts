import { defineUnlighthouseConfig } from 'unlighthouse/config';

export default defineUnlighthouseConfig({
	site: 'http://localhost:8787',
	scanner: {
		device: 'desktop',
		exclude: [
			'/people/*', // Furan profile pages
			'/posts/*', // Furan blog post pages
			'/shi-institute/*', // Furman website pages
		],
		samples: 5,
		throttle: true, // Simulate 4G network
	},
	chrome: {
		useSystem: false,
	},
	lighthouseOptions: {
		skipAudits: ['deprecations', 'errors-in-console', 'inspector-issues', 'third-party-cookies', 'unused-javascript'],
	},
	puppeteerOptions: {
		// Install with:
		// 1. wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
		// 2. sudo dpkg -i google-chrome-stable_current_amd64.deb
		// 3. If you see an error: sudo apt --fix-broken install
		executablePath: '/usr/bin/google-chrome-stable',
	},
});
