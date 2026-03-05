/**
 * Converts a string like "StringOrSTRINGToConvert" to
 * "string-or-string-to-convert".
 */
export function pascalCaseToKebabCase(string: string) {
	return string
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
		.toLowerCase();
}
