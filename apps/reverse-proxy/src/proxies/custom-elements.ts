import customElementsCssRaw from '@shi-institute/custom-elements/custom-elements.css?raw';
import customElementsJsMapRaw from '@shi-institute/custom-elements/custom-elements.js.map?raw';
import customElementsJsRaw from '@shi-institute/custom-elements/custom-elements?raw';
import type { ReverseProxyHandler } from '../common/Handler';

const dataMap = {
  '/custom-elements.css': {
    content: customElementsCssRaw,
    contentType: 'text/css',
  },
  '/custom-elements.js': {
    content: customElementsJsRaw,
    contentType: 'application/javascript',
  },
  '/custom-elements.js.map': {
    content: customElementsJsMapRaw,
    contentType: 'application/json',
  },
};

export default {
  /**
   * Serves the custom elements JavaScript and CSS files.
   */
  async fetch({ request, requestUrl }, env, ctx) {
    if (!(requestUrl.pathname in dataMap)) {
      return;
    }

    if (!request.current.method || !['GET', 'HEAD', 'OPTIONS'].includes(request.current.method)) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          Allow: 'GET, HEAD, OPTIONS',
        },
      });
    }

    const { content, contentType } = dataMap[requestUrl.pathname as keyof typeof dataMap];
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'stale-while-revalidate=31536000, public, max-age=0',
      },
    });
  },
} satisfies ReverseProxyHandler;
