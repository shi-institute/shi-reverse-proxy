import { parseHTML } from 'linkedom';

interface AdditionalOptions {
	wait?: (element: HTMLElement) => Promise<void>;
	polyfills?: {
		location?: string & Location;
	};
}

export async function ssrCustomElement<T extends CustomElementConstructor>(
	name: string,
	importElementClass: () => T | Promise<T>,
	props: Record<string, unknown> = {},
	{ wait = (element: HTMLElement) => Promise.resolve(), polyfills = {} }: AdditionalOptions = {},
) {
	const { window, document, customElements, HTMLElement, CustomEvent } = parseHTML('<!doctype html><html><body></body></html>');
	globalThis.HTMLElement = HTMLElement;
	globalThis.document = document;
	globalThis.window = window;
	globalThis.CustomEvent = CustomEvent;
	globalThis.customElements = customElements;
	if (polyfills.location) {
		globalThis.window.location = polyfills.location;
	}

	const CustomElement = await importElementClass();
	customElements.define(name, class extends CustomElement {});
	const element = document.createElement(name) as InstanceType<T>;

	for (const [key, value] of Object.entries(props)) {
		if (key === 'style') {
			element.style.cssText = String(value);
			continue;
		}

		// @ts-expect-error
		element[key] = value;
	}

	if ('connectedCallback' in element && typeof element.connectedCallback === 'function') {
		Object.defineProperty(element, 'isConnected', {
			get() {
				return true;
			},
		});
		element.connectedCallback();
	}

	await wait(element);

	// attempt to activate any children custom elements
	for await (const child of Array.from(element.querySelectorAll('*'))) {
		if (customElements.get(child.tagName.toLowerCase())) {
			child.outerHTML = await ssrCustomElement(
				child.tagName.toLowerCase(),
				() => Promise.resolve(customElements.get(child.tagName.toLowerCase()) as CustomElementConstructor),
				Object.fromEntries(Object.entries(child.attributes).map(([_, attr]) => [attr.name, attr.value])),
			);
		}
	}

	const stringifiedAttributes = Object.entries(props)
		.map(([key, value]) => {
			const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
			if (stringValue === undefined) {
				return '';
			}
			return `${key}='${stringValue.replace(/'/g, '&apos;')}'`;
		})
		.join(' ');

	if (!('shadowRoot' in element) || !element.shadowRoot) {
		const html = `<${name} ${stringifiedAttributes}>${element.innerHTML}</${name}>`;
		delete globalThis.window;
		return element.outerHTML;
		return html;
	}

	const html = `<${name} ${stringifiedAttributes}><template shadowrootmode="open">${(element.shadowRoot as ShadowRoot).innerHTML}</template></${name}>`;
	delete globalThis.window;
	return html;
}
