export function isJSON(toCheck: unknown): toCheck is string {
	if (typeof toCheck !== 'string') {
		return false;
	}

	try {
		JSON.parse(toCheck);
		return true;
	} catch (e) {
		return false;
	}
}
