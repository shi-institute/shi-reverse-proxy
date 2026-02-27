import { parseHTML } from 'linkedom';

export default {
	async fetch(request: Request, env: Env): Promise<Response | void> {
		const url = new URL(request.url);

		if (env.ASSETS && url.pathname.startsWith('/custom-elements/')) {
			const response = await env.ASSETS.fetch(url.pathname);
			if (response.status === 200) {
				const text = await response.text();
				return new Response(text, {
					headers: {
						'Content-Type': 'text/javascript',
					},
				});
			} else {
				return new Response('Not found', { status: 404 });
			}
		}
	},
};

export async function ssrCustomElement<T extends CustomElementConstructor>(
	name: string,
	importElementClass: () => T | Promise<T>,
	props: Record<string, unknown> = {},
) {
	const { document, customElements, HTMLElement } = parseHTML('<!doctype html><html><body></body></html>');
	globalThis.HTMLElement = HTMLElement;
	globalThis.document = document;

	const CustomElement = await importElementClass();
	customElements.define(name, class extends CustomElement {});
	const element = document.createElement(name) as InstanceType<T>;
	if ('connectedCallback' in element && typeof element.connectedCallback === 'function') {
		element.connectedCallback();
	}

	for (const [key, value] of Object.entries(props)) {
		// @ts-expect-error
		element[key] = value;
	}

	if (!('shadowRoot' in element) || !element.shadowRoot) {
		return `<${name}></${name}>`;
	}

	const stringifiedAttributes = Object.entries(props)
		.map(([key, value]) => {
			const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
			return `${key}='${stringValue.replace(/'/g, '&apos;')}'`;
		})
		.join(' ');
	const html = `<${name} ${stringifiedAttributes}><template shadowrootmode="open">${(element.shadowRoot as ShadowRoot).innerHTML}</template></${name}>`;
	return html;
}
