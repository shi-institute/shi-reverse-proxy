import { glob, readFile } from 'fs/promises';
import { basename } from 'path';
import { parse } from 'svelte/compiler';

export function customElementsManifestPlugin() {
	const FILTER = /^virtual:custom-elements-manifest$/;
	const NAMESPACE = 'custom-elements-manifest';

	/** @satisfies {import('esbuild').Plugin} */
	const plugin = {
		name: 'custom-elements-manifest',
		setup(build) {
			build.onResolve({ filter: FILTER }, (args) => {
				return { path: args.path, namespace: 'custom-elements-manifest' };
			});

			build.onLoad({ filter: FILTER, namespace: NAMESPACE }, async (args) => {
				const manifest = await generateManifest();
				return {
					contents: `const manifests = new Map(${JSON.stringify(Object.entries(manifest), null, 2)});
          export default manifests;

          export function attributesToProps(name, attributes) {
            const manifest = manifests.get(name);
            if (!manifest) {
              return undefined;
            }

            const props = {};
            for (const [propName, { attribute, reflect, type }] of Object.entries(manifest.customElementProps ?? {})) {
              if (attribute in attributes) {
                const value = attributes[attribute];

                if (value === undefined || value === null) {
                  props[propName] = undefined;
                }

                else if (type === 'Boolean') {
                  props[propName] = value.toLowerCase() === 'true';
                }

                else if (type === 'Number') {
                  props[propName] = Number(value);
                }

                else if (type === 'Array') {
                  try {
                    props[propName] = JSON.parse(value);
                  } catch (error) {
                    console.warn(\`Failed to parse attribute "\${attribute}" for prop "\${propName}" as JSON array:\`, error);
                    props[propName] = undefined;
                  }
                }

                else if (type === 'Object') {
                  try {
                    props[propName] = JSON.parse(value);
                  } catch (error) {
                    console.warn(\`Failed to parse attribute "\${attribute}" for prop "\${propName}" as JSON object:\`, error);
                    props[propName] = undefined;
                  }
                }

                else {
                  props[propName] = value;
                }
              }
            }

            return props;
          };
          `,
					loader: 'js',
				};
			});
		},
	};
	return plugin;
}

/**
 * @param {string} source
 * @param {import('svelte/compiler').AST.Root} ast
 * @returns {import('./types').ScriptProp[] | null | undefined}
 **/
function extractScriptProps(source, ast) {
	const instance = ast.instance;
	if (!instance) {
		console.warn(`[custom-elements-manifest] No <script> tag found. Skipping extraction of props with default values.`);
		return null;
	}

	for (const node of instance.content.body) {
		if (node.type !== 'VariableDeclaration') {
			continue;
		}

		for (const declaration of node.declarations) {
			const isProps =
				declaration.id.type === 'ObjectPattern' &&
				'properties' in declaration.id &&
				declaration.init?.type === 'CallExpression' &&
				'name' in declaration.init.callee &&
				declaration.init.callee.name === '$props';
			if (!isProps) {
				continue;
			}

			const properties = /** @type {import('estree').ObjectExpression} */ (/** @type {unknown} */ (declaration.id)).properties;

			return properties
				.map((prop) => {
					if (prop.type !== 'Property') {
						return null;
					}

					if (!('key' in prop) || prop.key.type !== 'Identifier') {
						console.warn(
							`[custom-elements-manifest] Unsupported prop key: only identifier keys are supported. Skipping default value for this prop.`,
						);
						return undefined;
					}

					const hasDefaultValue = 'value' in prop && prop.value.type === 'AssignmentPattern' && 'right' in prop.value;
					const defaultValue = (() => {
						if (!hasDefaultValue) {
							return undefined;
						}

						if (prop.value.type !== 'AssignmentPattern') {
							console.warn(
								`[custom-elements-manifest] Unsupported default value for prop "${prop.key.name}": only assignment patterns are supported (Found: "${prop.value.type}"). Skipping default value.`,
							);
							return undefined;
						}

						if (
							!('start' in prop.value.right) ||
							!('end' in prop.value.right) ||
							typeof prop.value.right.start !== 'number' ||
							typeof prop.value.right.end !== 'number'
						) {
							console.warn(
								`[custom-elements-manifest] Unable to determine source location for default value of prop "${prop.key.name}". \`start\` and \`end\` must exist on the literal. Skipping default value.`,
							);
							return undefined;
						}

						return source.slice(prop.value.right.start, prop.value.right.end);
					})();

					return {
						name: prop.key.name,
						required: !hasDefaultValue,
						default: defaultValue,
					};
				})
				.filter((x) => !!x);
		}
	}
}

async function generateManifest() {
	const allSvelteFiles = glob('modules/custom-elements/components/**/*.svelte');

	/** @type {Record<string, import('./types').ManifestEntry>} */
	const manifest = {};

	for await (const filename of allSvelteFiles) {
		const source = await readFile(filename, 'utf-8');

		/** @type {import('svelte/compiler').AST.Root} */
		let ast;
		try {
			ast = parse(source, { filename, modern: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`[custom-elements-manifest] Failed to parse ${filename} for custom elements manifest generation:`, message);
			continue;
		}

		const customElementProps = ast.options?.customElement?.props || {};
		const scriptProps = extractScriptProps(source, ast);

		manifest[basename(filename, '.svelte')] = {
			...(customElementProps ? { customElementProps } : {}),
			...(scriptProps ? { props: scriptProps } : {}),
		};
	}

	return manifest;
}
