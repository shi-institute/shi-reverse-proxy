import { uneval } from 'devalue';
import type { Component } from 'svelte';
import { SvelteURL } from 'svelte/reactivity';
import { render as renderComponent } from 'svelte/server';
import { attributesToProps } from 'virtual:custom-elements-manifest';
import * as allCustomElementComponents from '../custom-elements/components';
import { fetchStorage } from '../worker';
import * as components from './components';
import { kebabCaseToPascalCase, pascalCaseToKebabCase } from './utils';
import { setUrlForSsr } from './utils/navigation';

type Components = typeof components;
type ComponentName = keyof Components;

type RenderOptions<C extends Component<any>> = Parameters<typeof renderComponent<C>>[1];

interface Globals {
	/** The URL that will be exposed as the current URL for any component that uses the $url store. */
	url: URL;
	/** An optional alternative fetch implentation. */
	fetch?: typeof fetch;
}

/**
 * Renders an approved component into a custom element with
 * declarative shadow DOM. You should use the client-side
 * script at '/custom-elements.js' to hydrate.
 */
export async function render<N extends ComponentName>(
	componentName: N,
	options: RenderOptions<Components[N]>,
	globals: Partial<Globals> = {},
) {
	const component = components[componentName] as Component<any>;
	const uuid = crypto.randomUUID();

	setUrlForSsr(new SvelteURL(globals.url ?? 'https://localhost:8787/'));

	let renderOutput: Awaited<ReturnType<typeof renderComponent>>;
	if (globals.fetch) {
		renderOutput = await new Promise((resolve) => {
			fetchStorage.run(globals.fetch!, async () => {
				// @ts-expect-error
				resolve(await renderComponent(component, options));
			});
		});
	} else {
		// @ts-expect-error
		renderOutput = await renderComponent(component, options);
	}

	const { body, hashes, head } = renderOutput;
	const tag = pascalCaseToKebabCase(CUSTOM_ELEMENT_NAMESPACE + component.name);
	const data =
		`<script type="application/json" data-hydration-pack data-for="${uuid}">` +
		unevalProps(options?.props || {}).replace(/</g, '\\u003c') +
		'</script>';

	const returnValue = new String(`${data}<${tag} id="${uuid}"><template shadowrootmode="open">${head}${body}</template></${tag}>`);
	Object.defineProperty(returnValue, 'hashes', { value: hashes });
	Object.defineProperty(returnValue, 'head', { value: head });
	Object.defineProperty(returnValue, 'rawBody', { value: body });
	Object.defineProperty(returnValue, 'tag', { value: tag });
	Object.defineProperty(returnValue, 'data', { value: data });
	return returnValue as string & { hashes: typeof hashes; head: typeof head; rawBody: typeof body; tag: typeof tag; data: typeof data };
}

function unevalProps(props: Record<string, unknown>) {
	const data = {};
	for (const [key, value] of Object.entries(props)) {
		if (typeof value === 'function') {
			// @ts-expect-error
			data[key] = `__FUNCTION__${value.toString()}__END_FUNCTION__`;
		} else {
			// @ts-expect-error
			data[key] = value;
		}
	}
	return uneval(data);
}

interface RenderCustomElements {
	/**
	 * The prefix used to identify custom elements (e.g. "shi-").
	 */
	prefix: string;
	/**
	 * An object containing global values that may be needed during rendering, such as the
	 * current URL and a fetch implementation.
	 */
	globals: Partial<Globals> & { document: Document };
	/**
	 * An optional function that allows you to adjust the props before rendering.
	 * This function receives the initial props (converted from the custom element's
	 * attributes), the component name, and the custom element node.
	 * It should return the adjusted props.
	 */
	adjustPropsBeforeRender?: (
		props: ReturnType<typeof attributesToProps>,
		componentName: string,
	) => void | ReturnType<typeof attributesToProps>;
}

/**
 * Searches for unrendered custom elements in the provided document, attempts to find
 * the corresponding component for each custom element, and then server-side renders
 * the component and replaces the custom element with the rendered html.
 *
 * **CAUTION: This operation occurs in-place on the provided document.**
 *
 * @remarks
 * Custom elements are identified as any element whose tag name starts with the provided
 * prefix (e.g. "shi-") and that has not already been server-rendered (indicated by the
 * presence of a shadow root or a template with a shadowrootmode attribute).
 *
 * The corresponding component for each custom element is determined by removing the
 * prefix from the tag name, converting the remaining kebab-case string to PascalCase,
 * and then looking for a component with that name in the list of all custom element components.
 *
 * The custom element's attributes are converted to props based on the component's
 * prop types in the svelte:options tag using the attributesToProps function from
 * the custom elements manifest plugin. Finally, the component is rendered to html
 * using Svelte's server-side rendering and the custom element is replaced with the rendered html.
 *
 * @returns
 * The outer HTML of the modified document after rendering the custom elements.
 */
export async function renderCustomElements({ prefix, globals, adjustPropsBeforeRender }: RenderCustomElements) {
	const customElements = Array.from(globals.document.querySelectorAll('*')).filter((el) =>
		el.tagName.toLowerCase().startsWith(prefix + '-'),
	);

	for await (const element of customElements) {
		// server-rendered custom elements will have either a shadow root or a template with a shadowrootmode attribute
		const isAlreadyServerRendered = element.shadowRoot || element.querySelector('template[shadowrootmode]');
		if (isAlreadyServerRendered) {
			continue;
		}

		// normalize the tag name
		const tagName = element.tagName.toLowerCase();

		// attempt to find a corresponding component for the custom element (e.g. shi-post-card-grid -> post-card-grid -> PostCardGrid)
		const _componentName = kebabCaseToPascalCase(tagName.replace(/^shi-/, ''));
		if (!(_componentName in allCustomElementComponents)) {
			console.warn(`Found custom element <${tagName}> but no corresponding component ${_componentName} was found`);
			continue;
		}
		const componentName = _componentName as keyof typeof allCustomElementComponents;

		// convert the element's stringified attributes to a props object based on the component's prop types in the svelte:options tag
		const elementAttributes = Object.fromEntries(Array.from(element.attributes).map((attr) => [attr.name, attr.value]));
		let props = attributesToProps(componentName, elementAttributes);
		if (process.env.DEVELOPMENT) {
			console.debug(`Rendering <${tagName}> with props:`, props);
		}

		if (adjustPropsBeforeRender) {
			const adjustedProps = adjustPropsBeforeRender(props, componentName);
			if (adjustedProps) {
				props = adjustedProps;
			}
		}

		// render to html and replace the custom element with the rendered html
		const html = await render(componentName, { props }, { url: globals.url, fetch: globals.fetch });
		element.outerHTML = html;
	}

	return globals.document.documentElement.outerHTML;
}
