import { flagCurrentLinks, shiNavListCSS } from './shi-primary-menu-bar.js';

export class ShiSecondaryNavigationBar extends HTMLElement {
	static observedAttributes = ['left-items', 'right-items'];

	constructor() {
		super();

		if (this.hasAttribute('left-items')) {
			const attrValue = this.getAttribute('left-items');
			try {
				this.leftItems = attrValue ? JSON.parse(attrValue) : [];
			} catch (e) {
				console.error('Failed to parse left-items attribute as JSON during initialization:', e);
			}
		}

		if (this.hasAttribute('right-items')) {
			const attrValue = this.getAttribute('right-items');
			try {
				this.rightItems = attrValue ? JSON.parse(attrValue) : [];
			} catch (e) {
				console.error('Failed to parse right-items attribute as JSON during initialization:', e);
			}
		}
	}

	connectedCallback() {
		const root = this.attachShadow({ mode: 'open' });

		const style = document.createElement('style');
		style.textContent = `
:host {
  height: 30px;
  background: white;
  box-shadow: inset 0 -1px 0 0 #d8d8d8;
  width: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
}
@media (width < 923px) {
  :host {
    display: none;
  }
}

${shiNavListCSS}

:host .shi-navlist {
  gap: 0.8rem;
}
:host .shi-navlist a {
  font-size: 13px;
  padding: 4px 0;
}
    `;
		root.appendChild(style);

		const left = document.createElement('nav');
		left.classList.add('shi-navbar--secondary-left');
		root.appendChild(left);

		const leftNavList = document.createElement('ul');
		leftNavList.classList.add('shi-navlist');
		left.appendChild(leftNavList);

		const right = document.createElement('nav');
		right.classList.add('shi-navbar--secondary-right');
		root.appendChild(right);

		const rightNavList = document.createElement('ul');
		rightNavList.classList.add('shi-navlist');
		right.appendChild(rightNavList);

		this.render();
	}

	/**
	 *
	 * @param {string} name
	 * @param {string | null} oldValue
	 * @param {string | null} newValue
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'left-items') {
			try {
				this['left-items'] = newValue ? JSON.parse(newValue) : [];
			} catch (e) {
				console.error('Failed to parse left-items attribute as JSON:', e);
			}
		}

		if (name === 'right-items') {
			try {
				this['right-items'] = newValue ? JSON.parse(newValue) : [];
			} catch (e) {
				console.error('Failed to parse right-items attribute as JSON:', e);
			}
		}
	}

	/** @type {NavItem[]} */
	#leftItems = [];
	/** @type {NavItem[]} */
	#rightItems = [];

	/**
	 * @param {NavItem[]} value
	 */
	set ['left-items'](value) {
		this.#leftItems = value;

		// reflect in the attribute as JSON string
		const json = JSON.stringify(this.#leftItems);
		const currentAttr = this.getAttribute('left-items');
		if (currentAttr !== json) {
			this.setAttribute('left-items', json);
		}

		this.render();
	}

	/**
	 * @param {NavItem[]} value
	 */
	set ['right-items'](value) {
		this.#rightItems = value;

		// reflect in the attribute as JSON string
		const json = JSON.stringify(this.#rightItems);
		const currentAttr = this.getAttribute('right-items');
		if (currentAttr !== json) {
			this.setAttribute('right-items', json);
		}

		this.render();
	}

	/**
	 *
	 * @param {NavItem[]} items
	 * @returns
	 */
	#renderHTML(items) {
		return items
			.map((item) => {
				if (item.label === 'divider') {
					return `<hr class="shi-vertical-divider">`;
				}

				if (!item.href) {
					return `<span>${item.label}</span>`;
				}

				const useNewTab = item.label.endsWith('↗');
				if (useNewTab) {
					return `<li><a href="${item.href}" target="_blank" rel="noopener noreferrer">${item.label}</a></li>`;
				}

				return `<li><a href="${item.href}">${item.label}</a></li>`;
			})
			.join('');
	}

	render() {
		if (!this.shadowRoot) {
			return;
		}

		const leftInnerHTML = this.#renderHTML(this.#leftItems);
		const leftNavList = this.shadowRoot.querySelector('.shi-navbar--secondary-left .shi-navlist');
		if (leftNavList) {
			leftNavList.innerHTML = leftInnerHTML;
		} else {
			console.error('Left nav list element not found in shadow DOM');
		}

		const rightInnerHTML = this.#renderHTML(this.#rightItems);
		const rightNavList = this.shadowRoot.querySelector('.shi-navbar--secondary-right .shi-navlist');
		if (rightNavList) {
			rightNavList.innerHTML = rightInnerHTML;
		} else {
			console.error('Right nav list element not found in shadow DOM');
		}

		// add `current` class to links whose href pathname matches the current location pathname
		flagCurrentLinks('.shi-navlist a', this.shadowRoot);
	}
}

/**
 * @typedef {{label: string, href?: string}} NavItem
 */
