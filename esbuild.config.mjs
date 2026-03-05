import { build } from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { rm, writeFile } from 'node:fs/promises';
import { sveltePreprocess } from 'svelte-preprocess';

await rm('./dist/.cloudflare/', { recursive: true, force: true });

/** @satisfies {Partial<import('esbuild').BuildOptions>} */
const commonEsbuildOptions = {
	bundle: true,
	format: 'esm',
	sourcemap: true,
	target: 'esnext',
	logLevel: 'warning',
	color: true,
	// Treat platform-specific virtual imports (like `cloudflare:workers`) as externals
	// so esbuild doesn't try to resolve them while bundling for Workers.
	external: ['cloudflare:workers'],
	define: {
		CUSTOM_ELEMENT_NAMESPACE: JSON.stringify('shi'),
	},
	loader: {
		'.png': 'file',
		'.svg': 'file',
	},
};

/** @satisfies {Partial<Parameters<typeof sveltePlugin>[0]>} */
const commonSvelteOptions = {
	compilerOptions: {
		runes: true, // enable Svelte 5 rune syntax
		experimental: {
			async: true,
		},
		css: 'injected',
		warningFilter(warning) {
			if (warning.code === 'options_missing_custom_element') {
				return false;
			}
			return true;
		},
	},
	preprocess: sveltePreprocess({
		typescript: true,
	}),
};

await build({
	...commonEsbuildOptions,
	entryPoints: ['modules/worker/index.ts', 'modules/custom-elements/server.ts'],
	outdir: 'dist/.cloudflare/',
	plugins: [
		sveltePlugin({
			...commonSvelteOptions,
			compilerOptions: {
				...commonSvelteOptions.compilerOptions,
				generate: 'server',
				customElement: false,
			},
		}),
	],
});

await build({
	...commonEsbuildOptions,
	entryPoints: ['modules/custom-elements/browser.ts'],
	outfile: 'dist/.cloudflare/public/custom-elements.js',
	plugins: [
		sveltePlugin({
			...commonSvelteOptions,
			compilerOptions: {
				...commonSvelteOptions.compilerOptions,
				generate: 'client',
				customElement: true,
				hmr: true,
			},
		}),
	],
});

// enable CORS on static assets
const headersFile = `/custom-elements.js
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *

/custom-elements.js.map
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *
`;
await writeFile('./dist/.cloudflare/public/_headers', headersFile);
