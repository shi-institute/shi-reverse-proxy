import { sveltePreprocess } from 'svelte-preprocess';

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
const config = {
  compilerOptions: {
    runes: true, // enable Svelte 5 rune syntax
    experimental: {
      async: true,
    },
    css: 'injected',
    warningFilter(warning) {
      // <slot> in a shadow DOM custom element is native HTML, not the deprecated Svelte slot API.
      if (warning.code === 'slot_element_deprecated') return false;
      if (warning.code === 'options_missing_custom_element') return false;
      return true;
    },
  },
  preprocess: sveltePreprocess({
    typescript: true,
  }),
};

export default config;
