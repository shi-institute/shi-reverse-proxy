/**
 * Converts a string like "string-or-string-to-convert" to "StringOrStringToConvert".
 */
export function kebabCaseToPascalCase(string: string) {
	return string
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}
