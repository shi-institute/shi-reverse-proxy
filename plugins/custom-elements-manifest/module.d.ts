declare module 'virtual:custom-elements-manifest' {
	const manifest: Map<string, import('./types').ManifestEntry>;

	/**
	 * Converts a custom element's attributes to props based on the manifest.
	 *
	 * This function will convert attribute names to their corresponding prop
	 * names (e.g., \`my-attribute\` to \`myAttribute\`) and will attempt to parse
	 * attribute values based on the type information in the manifest (e.g.,
	 * converting \`"true"\` to \`true\` for boolean props).
	 *
	 * @param name - The name of the custom element.
	 * @param attributes - The attributes of the custom element instance.
	 */
	export const attributesToProps: (
		name: string,
		attributes: Record<string, string>,
	) => Record<string, string | number | boolean | undefined | (string | number | boolean)[] | Record<unknown, unknown>>;

	export default manifest;
}
