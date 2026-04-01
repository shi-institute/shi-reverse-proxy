export {};

declare global {
	const CUSTOM_ELEMENT_NAMESPACE: string;

	interface Uint8Array {
		toBase64(options?: { alphabet?: 'base64' | 'base64url' }): string;
		toHex(): string;
	}

	interface Uint8ArrayConstructor {
		fromBase64(
			base64: string,
			options?: { alphabet?: 'base64' | 'base64url'; lastChunkHandling?: 'loose' | 'strict' | 'stop-before-partial' },
		): Uint8Array;
		fromHex(hex: string): Uint8Array;
	}
}
