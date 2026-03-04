import xss from 'https://esm.run/xss';
import { z } from 'https://esm.run/zod';

export class CustomElement extends HTMLElement {
	store = CommentStorage.fromComment(this, this.tagName.toLowerCase());

	constructor() {
		super();
	}

	/**
	 * Helper getter to access the static attributes configuration defined on the constructor.
	 * @returns {Record<string, AttributeConfig>} The attributes configuration defined on the constructor, or an empty object if not defined or invalid.
	 */
	get #constructorAttributes() {
		if ('attributes' in this.constructor && isAttributeConfigRecord(this.constructor.attributes)) {
			return Object.fromEntries(
				Object.entries(this.constructor.attributes).map(([name, config]) => {
					// populate default values
					const { type, reflect = true, observed = false, converter } = config;
					return [name, { type, reflect, observed, converter }];
				}),
			);
		}
		return {};
	}

	/**
	 * The keys returned by this method are observed for changes.
	 * When a change occurs, the `attributeChangedCallback` method is called
	 * with the name of the changed attribute, its old value, and its new value.
	 */
	static get observedAttributes() {
		if ('attributes' in this && isAttributeConfigRecord(this.attributes)) {
			return Object.keys(this.attributes);
		}
		return [];
	}

	#attributesInstalled = false;
	installAttributes() {
		if (this.#attributesInstalled) {
			console.warn('installAttributes has already been called on this instance. Skipping reinstallation.');
			return;
		}

		this.#attributesInstalled = true;
		for (const [name, config] of Object.entries(this.#constructorAttributes)) {
			const attrValue = this.getAttribute(name);
			this.#initAttribute(name, attrValue ?? null, config);
		}
	}

	get #renderFunction() {
		return 'render' in this && typeof this.render === 'function' ? this.render : null;
	}

	/**
	 * If a render function is provided by the subclass and the element is connected to
	 * the DOM, this method will call the render function.
	 *
	 * If the `useShadow` static property is set to true on the subclass, the output of
	 * the render function will be injected into the element's shadow root; otherwise,
	 * it will be injected directly into the element itself. If `useShadow` is not defined,
	 * it will be treated as `true` by default.
	 *
	 * If a `styles` method is defined on the subclass, the output of that method will be
	 * injected as a style element into the same scope as the rendered content. When using
	 * shadow DOM, this means that styles will be scoped to the shadow root.
	 */
	#render() {
		if (this.#renderFunction && this.isConnected) {
			const root = this.#shouldUseShadow ? (this.shadowRoot ?? this.attachShadow({ mode: 'open' })) : this;
			root.innerHTML = this.#renderFunction();

			if (this.#styles) {
				// if a style element for this custom element already exists in
				// the same scope, reuse it; otherwise, create a new one
				const style = document.querySelector(`style[data-custom-element=${this.tagName.toLowerCase()}]`) ?? document.createElement('style');
				style.setAttribute('data-generated', 'true');
				style.setAttribute('data-custom-element', this.tagName.toLowerCase());
				style.textContent = this.#styles();

				if (!this.#shouldUseShadow) {
					style.textContent = style.textContent.replaceAll(':host', this.tagName.toLowerCase());
				}

				root.appendChild(style);
			}
		}
	}

	rerender() {
		this.#render();
	}

	get #styles() {
		return 'styles' in this && typeof this.styles === 'function' ? this.styles : null;
	}

	get #shouldUseShadow() {
		return 'useShadow' in this.constructor && this.constructor.useShadow === true;
	}

	/**
	 * @param {string} propertyName
	 * @return {() => boolean | void} Whether the component should re-render after this property changes. Defaults to true.
	 */
	#changed(propertyName) {
		if ('changed' in this && typeof this.changed === 'function') {
			return this.changed(propertyName);
		}
		return () => {};
	}

	connectedCallback() {
		// Inject the output from the render method into the element's shadow root
		this.#render();

		// ensure that set values are reflected as attributes if needed
		for (const name of Object.keys(this.#constructorAttributes)) {
			// @ts-expect-error
			const value = this[name];
			this.#reflectAttribute(name, value);
		}
	}

	/**
	 * Ensures that the given attribute name and value are reflected as an attribute
	 * on the element if the attribute is configured to reflect.
	 * @param {string} name
	 * @param {unknown} value
	 */
	#reflectAttribute(name, value) {
		const config = this.#constructorAttributes[name];
		if (config && config.reflect) {
			if (value === null || value === undefined) {
				this.removeAttribute(name);
				return;
			}

			this.setAttribute(name, typeof value === 'object' ? JSON.stringify(value) : String(value));
		}
	}

	/**
	 *
	 * @param {string} propertyName
	 * @param {unknown} value
	 * @returns
	 */
	#convertAttributeValue(propertyName, value) {
		const config = this.#constructorAttributes[propertyName];
		if (!config) {
			return null;
		}

		const defaultValue = config.default !== undefined ? config.default : null;
		if (value === null || value === undefined) {
			return defaultValue;
		}

		if (config.converter) {
			try {
				return config.converter(String(value));
			} catch (e) {
				console.error(`Failed to convert attribute value ${value}:`, e);
				return defaultValue;
			}
		}

		if (config.type === String) {
			return value;
		}

		if (config.type === Number) {
			const num = Number(value);
			return isNaN(num) ? null : num;
		}

		if (config.type === Date) {
			const date = new Date(String(value));
			return isNaN(date.getTime()) ? null : date;
		}

		if (config.type instanceof z.ZodObject || config.type instanceof z.ZodArray) {
			try {
				const toParse = typeof value === 'object' ? value : JSON.parse(String(value));
				if (toParse === null) {
					return defaultValue;
				}

				return config.type.parse(toParse);
			} catch (e) {
				console.error(`Failed to parse attribute value ${value}:`, e);
				return defaultValue;
			}
		}

		throw new Error(`Unsupported attribute type: ${config.type}`);
	}

	#inittedAttributes = new Set();

	/**
	 *
	 * @param {string} name
	 * @param {string | null} value
	 * @param {AttributeConfig} config
	 */
	#initAttribute(name, value, config) {
		const { type, reflect = true, observed = false, converter } = config;

		// Store existing property value if present
		let existingValue = undefined;
		if (Object.prototype.hasOwnProperty.call(this, name)) {
			// @ts-expect-error
			existingValue = this[name];
			// @ts-expect-error
			delete this[name];
		}

		// Configure getter and setter for the property with reflection
		Object.defineProperty(this, name, {
			configurable: true,
			enumerable: true,
			get() {
				if (type === String) {
					return this[`_${name}`] ?? '';
				}
				return this[`_${name}`];
			},
			set(newValue) {
				const oldValue = this[`_${name}`];
				if (JSON.stringify(newValue) === JSON.stringify(oldValue)) {
					return;
				}

				const convertedValue = this.#convertAttributeValue(name, newValue);
				if (JSON.stringify(convertedValue) === JSON.stringify(oldValue)) {
					return;
				}

				const safe = sanitizeAttributeValue(convertedValue);

				this[`_${name}`] = safe;
				this.#reflectAttribute(name, safe);
				if (this.#inittedAttributes.has(name)) {
					const shouldRerender = this.#changed(name) ?? true;
					if (shouldRerender) {
						this.#render(); // re-render on attribute change
					}
				} else {
					this.#inittedAttributes.add(name);
				}
			},
		});

		const convertedValue = this.#convertAttributeValue(name, value);
		if (convertedValue !== undefined && convertedValue !== null) {
			// @ts-expect-error
			this[name] = convertedValue;
		} else if (existingValue !== undefined && existingValue !== null) {
			// @ts-expect-error
			this[name] = existingValue;
		} else if (config.default !== undefined) {
			// @ts-expect-error
			this[name] = config.default;
		}
	}

	/**
	 * @param {string} name
	 * @param {string | null} oldValue
	 * @param {string | null} newValue
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		const config = this.#constructorAttributes[name];

		if (config && config.observed) {
			// @ts-expect-error
			this[name] = newValue; // This will trigger the setter and handle conversion and reflection
		}
	}
}

class CommentStorage {
	storageId;
	/** @type {Record<string, unknown>} */
	store = {};

	/** @param {string} storageId */
	constructor(storageId) {
		this.storageId = storageId;
	}

	/** @param {string} key */
	has(key) {
		return key in this.store;
	}

	/**
	 * @template T
	 * @param {string} key
	 * @returns {T | null}
	 */
	get(key) {
		if (this.has(key)) {
			// @ts-expect-error
			return this.store[key];
		}
		return null;
	}

	/**
	 * @param {string} key
	 * @param {unknown} value
	 */
	set(key, value) {
		this.store[key] = value;
	}

	/** @param {string} key */
	delete(key) {
		delete this.store[key];
	}

	clear() {
		this.store = {};
	}

	toComment() {
		const json = JSON.stringify(this.store);
		const encoded = btoa(unescape(encodeURIComponent(json)));
		return `<!-- COMMENT-STORE [{ ${this.storageId}: "${encoded}" }] -->`;
	}

	toString() {
		return this.toComment();
	}

	/**
	 * @param {HTMLElement} element
	 * @param {string} storageId
	 */
	static fromComment(element, storageId) {
		const commentNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.COMMENT_NODE);
		for (const commentNode of commentNodes) {
			const match = commentNode.textContent?.match(new RegExp(`COMMENT-STORE \\[{\\s*${storageId}:\\s*"([^"]+)"\\s*}\\]`));
			if (match) {
				try {
					const decoded = decodeURIComponent(escape(atob(match[1] || 'e30=')));
					const storeData = JSON.parse(decoded || '{}');
					const store = new CommentStorage(storageId);
					store.store = storeData;
					return store;
				} catch (e) {
					console.error('Failed to parse comment store data:', e);
				}
			}
		}

		return new CommentStorage(storageId);
	}
}

/** @param {string} str */
export function escapeHtml(str) {
	if (!str) return '';
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** @param {string} str */
export function unescapeHtml(str) {
	if (!str) return '';
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

/** @satisfies {import('xss').IFilterXSSOptions} */
const INLINE_ONLY_CONFIG = {
	allowList: {
		a: ['style', 'class', 'href', 'title', 'target', 'rel'],
		abbr: ['style', 'class', 'title'],
		time: ['style', 'class', 'datetime'],
		span: ['style', 'class'],
		b: ['style', 'class'],
		i: ['style', 'class'],
		em: ['style', 'class'],
		strong: ['style', 'class'],
		u: ['style', 'class'],
		s: ['style', 'class'],
		sub: ['style', 'class'],
		sup: ['style', 'class'],
		br: ['style', 'class'],
		small: ['style', 'class'],
		code: ['style', 'class'],
		kbd: ['style', 'class'],
		mark: ['style', 'class'],
	},
	// removes unrecognized tags while keeping their inner content (instead of escaping the < and > characters)
	stripIgnoreTag: true,
};

/**
 * Removes all non-inline tags from the given value and removes most attributes, leaving only a
 * small set of safe attributes on a limited set of tags. This is intended to be used for sanitizing
 * attribute values that may contain HTML, such as titles or descriptions, while still allowing
 * some basic formatting and links.
 *
 * @param {unknown} value
 */
export function sanitizeAttributeValue(value) {
	if (typeof value === 'string') {
		return xss(value, INLINE_ONLY_CONFIG).trim();
	}
	return value;
}

/**
 * @typedef {Object} AttributeConfig
 * @property {StringConstructor | NumberConstructor | DateConstructor | import('zod').z.ZodObject | import('zod').z.ZodArray} type - The type of the attribute (e.g., String, Number, Date).
 * @property {boolean} [reflect=true] - Whether to reflect the attribute to a property.
 * @property {boolean} [observed=false] - Whether to observe changes to this attribute.
 * @property {any} [default] - The default value for the attribute if not provided.
 * @property {function(string): any} [converter] - A function to convert the attribute value to the desired type.
 */

/**
 * @param {unknown} toCheck
 * @returns {toCheck is Record<string, unknown>}
 */
function isStringRecord(toCheck) {
	return (
		typeof toCheck === 'object' &&
		toCheck !== null &&
		!Array.isArray(toCheck) &&
		Object.keys(toCheck).every((key) => typeof key === 'string')
	);
}

/**
 * @param {unknown} toCheck
 * @returns {toCheck is Record<string, AttributeConfig>}
 */
function isAttributeConfigRecord(toCheck) {
	if (!isStringRecord(toCheck)) return false;

	return Object.values(toCheck).every((config) => {
		if (typeof config !== 'object' || config === null) return false;
		if (!('type' in config)) return false;

		// @ts-expect-error
		const { type, reflect, observed, converter } = config;
		const validTypes = [String, Number, Date];

		// @ts-expect-error
		if (!validTypes.includes(type) && !(type instanceof z.ZodObject) && !(type instanceof z.ZodArray)) {
			return false;
		}

		if (reflect !== undefined && typeof reflect !== 'boolean') {
			return false;
		}

		if (observed !== undefined && typeof observed !== 'boolean') {
			return false;
		}

		if (converter !== undefined && typeof converter !== 'function') {
			return false;
		}

		return true;
	});
}
