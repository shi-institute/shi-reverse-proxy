/**
 * Formats the duration between startMs and endMs as a string in milliseconds or seconds,
 * depending on the length of the duration.
 *
 * You should generate the start and end time using `performance.now()`.
 */
export function formatDuration(startMs: number, endMs: number): string {
	const elapsedTime = endMs - startMs;
	const formattedElapsedTime = elapsedTime < 1000 ? `${Math.round(elapsedTime)}ms` : `${(elapsedTime / 1000).toFixed(2)}s`;
	return formattedElapsedTime;
}

/**
 * A helper class for reading Server-Timing headers from a headers object and
 * updating them with new timing information. After updating the timings,
 * get the updated header value with `toString()`.
 */
export class ServerTimingHelper {
	private headers: Headers;

	constructor(headers: Headers) {
		this.headers = headers;
	}

	get timings() {
		const currentServerTimingHeader = this.headers.get('Server-Timing');
		const timings = currentServerTimingHeader?.split(',').map((part) => part.trim()) || [];

		const parsed = new Map<string, { description?: string; duration: number }>();
		timings.forEach((timing) => {
			const parts = timing.split(';').map((part) => part.trim());
			const name = parts[0];
			const descPart = parts.find((part) => part.startsWith('desc='));
			const durPart = parts.find((part) => part.startsWith('dur='));

			const description = descPart ? descPart.split('=')[1]?.replace(/"/g, '') : '';
			const duration = durPart ? durPart.split('=')[1] : '';

			if (name && duration !== undefined) {
				const durationMs = parseFloat(duration);
				parsed.set(name, { description, duration: durationMs });
			}
		});

		return parsed;
	}

	private set timings(timingsMap: Map<string, { description?: string; duration: number }>) {
		const timingsArray = Array.from(timingsMap.entries()).map(([name, { description, duration }]) => {
			return ServerTimingHelper.asTimingString(name, duration, description);
		});
		this.headers.set('Server-Timing', timingsArray.join(', '));
	}

	setTiming(name: string, durationMs: number, description?: string) {
		const currentTimings = this.timings;
		currentTimings.set(name, { description, duration: durationMs });
		this.timings = currentTimings;
	}

	/**
	 * Adds over overwrites a timing entry in the Server-Timing header with the given name,
	 * description, and duration. Returns the updated Server-Timing header value as a string.
	 */
	static setTiming(headers: Headers, name: string, durationMs: number, description?: string) {
		const helper = new ServerTimingHelper(headers);
		helper.setTiming(name, durationMs, description);
		return helper.toString();
	}

	/**
	 * Formats a single timing entry as a string that can be included in a Server-Timing header. The
	 * name is required, but the description and duration are optional. If the description is included,
	 * it will be added with the `desc` parameter. If the duration is included, it will be added with
	 * the `dur` parameter. For example, `asTimingString('cache-lookup', 'Cache Read', 50)` would return
	 * `cache-lookup;desc="Cache Read";dur=50`.
	 */
	static asTimingString(name: string, durationMs: number, description?: string) {
		let timingString = name;
		if (description) {
			timingString += `;desc="${description}"`;
		}
		timingString += `;dur=${durationMs}`;

		return timingString;
	}

	toString() {
		return this.headers.get('Server-Timing') || '';
	}

	toJSON() {
		return this.toString();
	}

	static merge(...helpersOrHeaders: (ServerTimingHelper | Headers)[]) {
		const mergedTimings = new Map<string, { description?: string; duration: number }>();

		helpersOrHeaders.forEach((helperOrHeaders) => {
			const helper = helperOrHeaders instanceof ServerTimingHelper ? helperOrHeaders : new ServerTimingHelper(helperOrHeaders);
			helper.timings.forEach((value, key) => {
				mergedTimings.set(key, value);
			});
		});

		const mergedHelper = new ServerTimingHelper(new Headers());
		mergedHelper.timings = mergedTimings;
		return mergedHelper;
	}
}
