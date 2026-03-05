import { build } from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { sveltePreprocess } from 'svelte-preprocess';
import { Youch } from 'youch';

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
	external: ['cloudflare:workers', 'node:async_hooks'],
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

try {
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
} catch (error) {
	await reportError(error);
}

try {
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
} catch (error) {
	await reportError(error);
}

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

// copy over custom elements css
await cp('./modules/custom-elements/components/custom-elements.css', './dist/.cloudflare/public/custom-elements.css', { force: true });

/**
 * Reports an error by writing a stub worker that throws the error when invoked.
 * This allows the build to fail gracefully and still serve a worker that indicates the build error.
 *
 * This function will exit the process with exit code 0.
 *
 * @param {unknown} error
 */
async function reportError(error) {
	let html = '';

	if (error instanceof Error && 'errors' in error && Array.isArray(error.errors)) {
		const buildFailure = /** @type {import('esbuild').BuildFailure} */ (error);
		const firstError = buildFailure.errors[0];
		if (firstError) {
			const youch = new Youch();
			const errorObject = new Error(firstError.text);
			errorObject.stack =
				firstError.text +
				'\n' +
				(firstError.location ? `    at ${firstError.location.file}:${firstError.location.line}:${firstError.location.column}` : '');
			errorObject.name = 'Build Error';
			errorObject.cause = {
				message: error.message,
				stack: error.stack || '',
				name: error.name,
			};
			html = await youch.toHTML(errorObject, { ide: 'vscode', title: 'A build error has occured' });
		}
	} else {
		const youch = new Youch();
		html = await youch.toHTML(error, { ide: 'vscode', title: 'An unknown error has occured' });
	}

	await mkdir('./dist/.cloudflare/worker/', { recursive: true });
	await mkdir('./dist/.cloudflare/public/', { recursive: true });
	const workerStub = `export default {
	async fetch(request, env, ctx) {
		return new Response(\`${html.replaceAll('`', '\\`').replaceAll('$', '\\$')}\`, { 
			status: 500,
			headers: { "Content-Type": "text/html;charset=utf-8" }
		});
	}
}
`;
	await writeFile('./dist/.cloudflare/worker/index.js', workerStub);
	process.exit(0); // 0 allows wrangler dev to continue running even if the build fails
}
