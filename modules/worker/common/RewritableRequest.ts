type AnyRequest = Request;

export class RewritableRequest<Request extends AnyRequest> {
	private requestRef: { current: Request };
	originalRequestUrl: URL;

	constructor(request: Request) {
		this.requestRef = { current: request };
		this.originalRequestUrl = new URL(request.url);
	}

	get request() {
		return this.requestRef;
	}

	get requestUrl() {
		const self = this;

		const proxy: URL = new Proxy({} as URL, {
			get(_target, prop: string | symbol) {
				const url = new URL(self.requestRef.current.url, 'http://localhost');

				if (typeof prop === 'symbol') {
					return (url as any)[prop];
				}

				const value = (url as any)[prop];

				// bind methods so `this` is correct
				if (typeof value === 'function') {
					return value.bind(url);
				}

				return value;
			},
			set(_target, prop: string | symbol, newValue: unknown) {
				if (typeof prop !== 'string' || !Reflect.has(URL.prototype, prop)) {
					return false;
				}

				const url = new URL(self.requestRef.current.url, 'http://localhost');

				// assign on the URL object
				(url as any)[prop] = newValue;

				// mirror back into the request
				self.requestRef.current = new Request(url.toString(), self.requestRef.current) as typeof self.requestRef.current;
				return true;
			},
		});

		return proxy;
	}
}
