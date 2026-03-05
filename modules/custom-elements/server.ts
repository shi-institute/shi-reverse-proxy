import { uneval } from 'devalue';
import type { Component } from 'svelte';
import { SvelteURL } from 'svelte/reactivity';
import { render as renderComponent } from 'svelte/server';
import { fetchStorage } from '../worker';
import * as components from './components';
import { pascalCaseToKebabCase } from './utils';
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
