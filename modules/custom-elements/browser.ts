import { tick } from 'svelte';
import * as components from './components';
import { autohydrate, pascalCaseToKebabCase } from './utils';

autohydrate();
await tick();

for (const Component of Object.values(components)) {
	if (Component.element) {
		const customElementName = pascalCaseToKebabCase(CUSTOM_ELEMENT_NAMESPACE + Component.name);
		if (!customElements.get(customElementName)) {
			customElements.define(customElementName, class CustomElement extends Component.element {});
		}
	}
}
