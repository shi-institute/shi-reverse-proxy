import sha256 from 'fast-sha256';

export async function hash(str: string, algorithm = 'SHA-256') {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);

	const hash = await crypto.subtle.digest(algorithm, data);
	const hex = uint8ToHex(new Uint8Array(hash));

	return hex;
}

export function uint8ToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function hashSync(str: string, algorithm = 'SHA-256') {
	if (algorithm !== 'SHA-256') {
		throw new Error(`Unsupported algorithm: ${algorithm}. Only SHA-256 is supported in hashSync.`);
	}

	const encoder = new TextEncoder();
	const data = encoder.encode(str);

	const hash = sha256(data);
	const hex = uint8ToHex(hash);

	return hex;
}
