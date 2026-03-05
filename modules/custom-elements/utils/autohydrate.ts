/**
 * Searches for existing scripts with `data-hydration-pack`,
 * which are scripts that contain a JSON representation of the
 * props that were used for a server-side rendered custom
 * element.
 *
 * When the custom element is registed in the browser, the
 * browser removes the declarative shadow DOM used by the
 * server-side render. We need to inject the props back into
 * the browser's representation of the component so that the
 * newly-gnerated shadow DOM matches what was originally
 * created by the server.
 *
 * For more details, refer to `hydrateExistingPacks` and
 * `setUpMutationOverservors` in the `autohydrate.ts` file.
 */
export function autohydrate() {
	hydrateExistingPacks(document);
	setUpMutationObservers();
}

/**
 * Hydrates a custom element with a "hydration pack", which is
 * a JSON object containing the props that need to be restored
 * on the custom element.
 *
 * If this function is called on a server-side-rendered custom
 * element that has a declarative shadow DOM (because a
 * custom element with the correct name has not yet been registered
 * in the browser), the function will also preserve a copy of the
 * shadow DOM's innerHTML. Once the custom element is registed
 * in the browser, the innerHTML will be inserted into the new
 * shadow DOM so that Svelte can attempt to hydrate instead
 * of newly mounting the component that powers the custom element.
 */
function hydrateWithHydrationPack(scriptEl: HydrationPack) {
	// The `data-for` attribute contains the id of the element to prepare for hydration.
	const target = document.getElementById(scriptEl.dataset.for) as HydrationTarget | null;
	if (!target) {
		return;
	}

	// Prevent double processing by exiting if we have already recording the props.
	if (target.__hydration_propsToSet) {
		return;
	}

	// Store the innerHTML that was present from server-side rendering
	// before the browser resets the shadow root.
	target.__hydration_ssrInnerHTML = target.shadowRoot?.innerHTML || undefined;

	try {
		// The script contains JSON with the props that were used when server-side
		// rendering the custom element.
		target.__hydration_propsToSet = parseUnevalProps(scriptEl.textContent.trim());

		// If element already defined, assign immediately.
		// Otherwise, wait until definition completes.
		const tag = target.tagName.toLowerCase();
		const assign = () => {
			for (const [propertyName, value] of Object.entries(target.__hydration_propsToSet)) {
				// Property names are often reflected in kebab-case, but internally, they are usually camelCase.
				const camelCasePropertyName = propertyName.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());

				// If the kebab-case property exists, assign to it.
				if (Object.getOwnPropertyDescriptor(target, propertyName)) {
					target[propertyName] = value;
				}

				// Otherwise, check for the camelCase version.
				else if (Object.getOwnPropertyDescriptor(target, camelCasePropertyName)) {
					target[camelCasePropertyName] = value;
				}

				// If the property does not exist in either form, set it as
				// a new property on the element using the camelCase version of the name.
				else {
					Object.defineProperty(target, camelCasePropertyName, {
						configurable: true,
						enumerable: true,
						writable: true,
						value: value,
					});
				}
			}

			// If we can insert the inner HTML from when the custom element was
			// server-side rendered, we want to insert it. If the inner HTML is
			// present and compatable, svelte can re-use it. This is especially
			// important for components with top-level await; it allows svelte
			// to showing empty space while it re-evaluates the top-level await
			// conditions.
			if (target.shadowRoot && !target.shadowRoot.innerHTML && target.__hydration_ssrInnerHTML) {
				target.shadowRoot.innerHTML = target.__hydration_ssrInnerHTML;
			}
		};

		if (customElements.get(tag)) {
			// Since the custom element is already defined, we can immediately
			// assign props.
			assign();
		} else {
			// We cannot assign props until the custom element class is
			// registered, so we must wait until that occurs. Before the
			// custom element is registered, the content of the template
			// from server-side rendering (if present) will still appear.
			customElements.whenDefined(tag).then(assign);
		}

		// Remove the script with the "hydration pack" JSON since we
		// not longer need it post-hydration or post-hydration-queue.
		scriptEl.remove();
	} catch (err) {
		console.warn('Invalid hydration pack JSON for', scriptEl.dataset.for, err);
	}
}

function parseUnevalProps(unevaled: string) {
	try {
		const evaled = (0, eval)(`(${unevaled})`);
		const props: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(evaled)) {
			if (typeof value === 'string' && value.startsWith('__FUNCTION__') && value.endsWith('__END_FUNCTION__')) {
				props[key] = (0, eval)(`(${value.slice('__FUNCTION__'.length, -'__END_FUNCTION__'.length)})`);
			} else {
				props[key] = value;
			}
		}

		return props;
	} catch (error) {
		console.warn('Error parsing hydration pack props', { error, unevaled });
		return {};
	}
}

/**
 * Searches for existing scripts with `data-hydration-pack`,
 * which are scripts that contain a JSON representation of the
 * props that were used for a server-side rendered custom
 * element.
 *
 * When the custom element is registed in the browser, the
 * browser removes the declarative shadow DOM used by the
 * server-side render. We need to inject the props back into
 * the browser's representation of the component so that the
 * newly-gnerated shadow DOM matches what was originally
 * created by the server.
 */
function hydrateExistingPacks(root = document) {
	const maybeHydrationPacks = Array.from(root.querySelectorAll('script[data-hydration-pack][data-for]'));
	const hydrationPacks = maybeHydrationPacks.filter(isHydrationPack);
	for (const hydrationPack of hydrationPacks) {
		hydrateWithHydrationPack(hydrationPack);
	}
}

type HydrationPack = HTMLScriptElement & { dataset: DOMStringMap & { dataset: ''; for: ReturnType<typeof crypto.randomUUID> } };
type HydrationTarget = HTMLElement & { __hydration_propsToSet: Record<string, unknown>; __hydration_ssrInnerHTML?: string } & Record<
		string,
		unknown
	>;

/**
 * Type guard for whether a node in a document is a script
 * element that is a hydration pack.
 */
function isHydrationPack(node: Node): node is HydrationPack {
	return node instanceof HTMLScriptElement && 'hydrationPack' in node.dataset && !!node.dataset.for;
}

/**
 * Watches the DOM for changes. If there are ever new nodes
 * that represent hydration packs for server-side-rendered
 * custom elements, we run `hydrateWithHydrationPack` to restore
 * the props included in the hydration pack.
 */
function setUpMutationObservers() {
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of Array.from(record.addedNodes)) {
				if (isHydrationPack(node)) {
					hydrateWithHydrationPack(node);
				}
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });
}
