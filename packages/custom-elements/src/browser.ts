import { pascalCaseToKebabCase } from '@shi-institute/utils';
import { tick } from 'svelte';
import * as components from './components';
import { autohydrate } from './utils';

autohydrate();
await tick();

for (const Component of Object.values(components)) {
  if ('element' in Component && Component.element) {
    const customElementName = pascalCaseToKebabCase(CUSTOM_ELEMENT_NAMESPACE + Component.name);
    if (!customElements.get(customElementName)) {
      const SvelteComponentCustomElement = Component.element as CustomElementConstructor;
      try {
        customElements.define(customElementName, class CustomElement extends SvelteComponentCustomElement {});
      } catch (error) {
        console.error(`Failed to define custom element ${customElementName}:`, error);
      }
    }
  }
}
