import { customElementsManifestPlugin } from '@shi-institute/vite-plugin-custom-elements-manifest';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'path';
import { cwd } from 'process';
import type { PreprocessorGroup } from 'svelte/compiler';
import { svelte2tsx } from 'svelte2tsx';
import ts from 'typescript';
import { defineConfig, perEnvironmentPlugin, type Plugin, type PluginOption, type UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import svelteConfig from './svelte.config.js';

export default defineConfig(({}) => {
  const distDir = resolve(__dirname, 'dist');

  return {
    define: {
      CUSTOM_ELEMENT_NAMESPACE: JSON.stringify('shi'),
    },
    build: {
      minify: 'terser',
      emptyOutDir: false,
      terserOptions: {
        mangle: {
          keep_classnames: true,
          keep_fnames: true,
        },
      },
    },
    plugins: [
      ...forEnv('client', [
        svelte({
          ...svelteConfig,
          compilerOptions: {
            ...svelteConfig.compilerOptions,
            customElement: true,
          },
        }),
      ]),
      ...forEnv('ssr', [
        customElementsManifestPlugin(),
        svelte({
          ...svelteConfig,
          compilerOptions: {
            ...svelteConfig.compilerOptions,
            customElement: false,
          },
          preprocess: [stripCustomElementOptionsPreprocessor(), svelteConfig.preprocess].flat().filter((x) => !!x),
        }),
      ]),
      {
        name: 'check-svelte-files',
        applyToEnvironment: (env) => env.name === 'client',
        buildStart() {
          return new Promise<void>((resolve) => {
            const proc = spawn('./node_modules/.bin/svelte-check', ['--tsconfig', './tsconfig.json'], { stdio: 'inherit', shell: false });
            proc.on('close', (code) => {
              if (code !== 0) process.exit(code ?? 1);
              else resolve();
            });
          });
        },
      },
      perEnvironmentPlugin('type-check', (environment) => {
        const relativeOutDir = environment.config.build.outDir;
        const absoluteOutDir = resolve(__dirname, relativeOutDir);

        const tsconfig = readTypeScriptConfig();

        return dts({
          outDir: relativeOutDir,

          beforeWriteFile(filePath, content) {
            // Skip writing declaration files for the client build
            // since browsers do not usually consume them.
            // (only check types for client code)
            if (environment.name === 'client') {
              return false;
            }

            // Use svelte2tsx to generate declaration files for Svelte components,
            // since normal typescript only outputs
            // `export { SvelteComponent as default } from 'svelte';`
            // instead of actual types for the component's props, events, module, etc.
            if (filePath.endsWith('.svelte.d.ts') && content.includes(`export { SvelteComponent as default } from 'svelte';`)) {
              const svelteFilePath = 'src/' + filePath.slice(absoluteOutDir.length + 1).replace(/\.d\.ts$/, '');
              const svelteFileContent = readFileSync(svelteFilePath, 'utf8');

              const prepared = svelte2tsx(svelteFileContent, {
                filename: svelteFilePath,
                mode: 'dts',
              });

              return { filePath, content: toTypeDeclaration(prepared.code, tsconfig.options) };
            }
          },

          // Always fail the build if there are type errors.
          afterDiagnostic(diagnostics) {
            if (diagnostics.length > 0) {
              process.exit(1);
            }
          },
        });
      }),
      {
        name: 'copy-over-custom-elements-css',
        applyToEnvironment(env) {
          return env.name === 'client';
        },
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'custom-elements.css',
            source: readFileSync('./src/components/custom-elements.css', 'utf8'),
          });
        },
      },
    ],
    environments: {
      client: {
        consumer: 'client',
        build: {
          ssr: false,
          sourcemap: true,
          lib: { entry: 'src/browser.ts', formats: ['es'], fileName: 'custom-elements' },
          outDir: resolve(distDir, 'browser'),
          rollupOptions: { external: ['node:async_hooks'] },
        },
      },
      ssr: {
        consumer: 'server',
        build: {
          ssr: true,
          sourcemap: true,
          lib: { entry: 'src/server.ts', formats: ['es'], fileName: 'custom-elements-ssr' },
          outDir: resolve(distDir, 'server'),
          rollupOptions: { external: ['node:async_hooks'] },
        },
      },
    },
    builder: {
      async buildApp(builder) {
        await Promise.all([builder.build(builder.environments.client!), builder.build(builder.environments.ssr!)]);
      },
    },
  } satisfies UserConfig;
});

/**
 * Modifies a plugin or array of plugins to only apply to a specific environment.
 */
function forEnv(envName: string, plugins: PluginOption): Plugin[] {
  return ([] as PluginOption[])
    .concat(plugins)
    .flat()
    .filter((p): p is Plugin => !!p)
    .map((p) => ({ ...p, applyToEnvironment: (env) => env.name === envName }));
}

function readTypeScriptConfig(path = 'tsconfig.json') {
  const tsconfigPath = resolve(cwd(), path);
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(`TSConfig Error: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')}`);
  }

  // recursively read extended configs
  const parsedTypescriptConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(tsconfigPath) // the base path to resolve "extends" from
  );

  return parsedTypescriptConfig;
}

/**
 * Converts TypeScript code to a declaration file string by running it through the
 * TypeScript compiler API with `emitDeclarationOnly` enabled and capturing the
 * output from the `writeFile` callback.
 */
function toTypeDeclaration(code: string, options: ts.CompilerOptions = {}) {
  const resolvedOptions = {
    ...options,
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    noEmit: false,
  };

  const compilerHost = ts.createCompilerHost(resolvedOptions);

  // overwrite the writeFile method to capture the emitted declaration file content
  let dtsContent = '';
  compilerHost.writeFile = (fileName, content) => {
    if (fileName.endsWith('.d.ts')) {
      dtsContent = content;
    }
  };

  // overwrite the readFile method to provide the prepared code as input
  compilerHost.readFile = () => code;

  const program = ts.createProgram({
    options: resolvedOptions,
    rootNames: ['foo'], // the file name doesn't matter since readFile is overwritten
    host: compilerHost,
  });

  // run the program, which will populate dtsContent via the custom writeFile
  program.emit();

  const diagnostics = program.getDeclarationDiagnostics();
  if (diagnostics.length > 0) {
    const formatted = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
    throw new Error(`TypeScript declaration generation error:\n${formatted}`);
  }

  return dtsContent;
}

/**
 * Svelte markup preprocessor that strips the `customElement` attribute from
 * `<svelte:options>` before the compiler parses it, for server/SSR builds only.
 *
 * Why: the Svelte compiler always reads `customElementOptions` from the parsed
 * component's `<svelte:options>` tag, regardless of the `customElement: false`
 * compiler option.  When `analysis.custom_element` is truthy the server
 * transformer skips CSS injection (transform-server.js:303), so `head` never
 * gets `<style>` tags.  Removing the attribute here makes `customElementOptions`
 * `undefined`, so `analysis.custom_element = false`, unblocking CSS injection.
 */
function stripCustomElementOptionsPreprocessor(): PreprocessorGroup {
  /**
   * Removes a `name={...}` attribute from a string of Svelte HTML attributes,
   * correctly handling nested braces in the value.
   */
  function removeAttribute(attrs: string, name: string) {
    const start = attrs.indexOf(`${name}=`);
    if (start === -1) return attrs;

    // Walk forward from the opening `{` to the matching `}`.
    let end = start + name.length + 1; // points at `{`
    let depth = 0;
    do {
      if (attrs[end] === '{') depth++;
      else if (attrs[end] === '}') depth--;
      end++;
    } while (depth > 0 && end < attrs.length);

    return attrs.slice(0, start) + attrs.slice(end);
  }

  return {
    markup({ content }: { content: string }) {
      const code = content.replace(
        /<svelte:options\b([\s\S]*?)\/>/g,
        (match, attributesString) => `<svelte:options${removeAttribute(attributesString, 'customElement')}/>`
      );
      return { code };
    },
  };
}
