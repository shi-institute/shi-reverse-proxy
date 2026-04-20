import type { ReverseProxyHandler } from '../common/Handler';
import { ReverseProxy } from '../common/ReverseProxy';

const ORIGIN = 'https://upstate-sc-land.shi.institute';
const BASE = '/research/upstate-sc-land';

export default {
	async fetch({ request, requestUrl }, env, ctx) {
		if (!requestUrl.pathname.startsWith(BASE)) {
			return;
		}

		const proxy = new ReverseProxy({ originServer: new URL(BASE, ORIGIN) });
		return proxy.fetch(request.current);
	},
} satisfies ReverseProxyHandler;
