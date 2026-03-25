import type { ReverseProxyHandler } from '../common/Handler';
import { ReverseProxy } from '../common/ReverseProxy';

const INTERATIVE_WEB_ORIGIN = 'https://interactive-web.shi.institute';
const INTERATIVE_WEB_BASE = '/research';

/**
 * Proxies all /research requests to the interactive-web deployment.
 */
export default {
	async fetch({ request, requestUrl }, env, ctx) {
		if (!requestUrl.pathname.startsWith(INTERATIVE_WEB_BASE)) {
			return;
		}

		const researchProxy = new ReverseProxy({ originServer: new URL(INTERATIVE_WEB_BASE, INTERATIVE_WEB_ORIGIN) });
		return researchProxy.fetch(request.current);
	},
} satisfies ReverseProxyHandler;
