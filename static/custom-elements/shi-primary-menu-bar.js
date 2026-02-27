export class ShiPrimaryNavigationBar extends HTMLElement {
	static observedAttributes = ['items', 'side-nav-items'];

	constructor() {
		super();

		// if the 'items' attribute is present at initialization, parse it and set the items
		if (this.hasAttribute('items')) {
			const attrValue = this.getAttribute('items');
			try {
				this.items = attrValue ? JSON.parse(attrValue) : [];
			} catch (e) {
				console.error('Failed to parse items attribute as JSON during initialization:', e);
			}
		}

		if (this.hasAttribute('side-nav-items')) {
			const attrValue = this.getAttribute('side-nav-items');
			try {
				this['side-nav-items'] = attrValue ? JSON.parse(attrValue) : [];
			} catch (e) {
				console.error('Failed to parse side-nav-items attribute as JSON during initialization:', e);
			}
		}
	}

	connectedCallback() {
		const root = this.attachShadow({ mode: 'open' });

		const style = document.createElement('style');
		style.textContent = `
:host {
  position: sticky;
  top: 0;
  background: white;
  box-shadow: inset 0 -1px 0 0 #d8d8d8;
  width: 100%;
  height: 60px;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 12px;
  font-size: 16px;
}

${shiNavListCSS}

.shi-navbar--primary-right {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  height: 100%;
}

.shi-navbar-search {
  display: flex;
  align-items: center;
}
.shi-navbar-search > form {
    width: 100%;
    position: relative;
}
.shi-navbar-search button {
  position: absolute;
  height: 36px;
  width: 42px;
  border-radius: 0 16px 16px 0;
  top: 0;
  right: 0;
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 120ms ease;
  color: inherit;
}
.shi-navbar-search form:hover button, .shi-navbar-search form:focus-within button {
  color: #fff;
}
.shi-navbar-search button:hover {
  background-color: #acddea;
  color: #000 !important;
}
.shi-navbar-search button:active {
  background-color: hsla(193, 60%, 70%, 1.00);
  color: #000;
}
.shi-navbar-search button svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
  margin-right: 4px;
  margin-top: -2px;
}
.shi-navbar-search input {
  background-color: #f2f2f2;
  color: black;
  padding: 1px 16px;
  height: 36px;
  border: none;
  border-radius: 24px;
  width: 112px;
  transition: width 200ms ease-in-out;
  font-family: 'Epilogue', sans-serif;
  font-size: 0.95rem;
  font-weight: 400;
  padding-right: 42px; /* space for the search button */
  box-sizing: border-box;
}
.shi-navbar-search input:hover, .shi-navbar-search input:focus {
  width: 246px;
  outline: none;
}
.shi-navbar-search input::placeholder {
  color: #000
}
.shi-navbar-search input:hover::placeholder, .shi-navbar-search input:focus::placeholder {
  color: #fff
}
.shi-navbar-search input:hover, .shi-navbar-search input:focus {
  background-color: #582c83;
  color: #fff;
}
.shi-navbar-search input:active {
  background-color: #201545;
  color: #fff;
}
@media (width < 600px) {
  .shi-navbar-search {
    display: none;
  }
}

.shi-vertical-divider {
  border: none;
  border-left: 1px solid #d8d8d8;
  height: 30px !important;
  background-color: transparent;
  opacity: 1;
}

.shi-side-menu-button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 60px;
  height: 100%;
  border: none;
  background-color: #582c83;
  color: white;
  transition: background-color 120ms ease, box-shadow 120ms ease;
  border: 0;
  font-size: 12px;
  font-family: 'Oswald', sans-serif;
  font-weight: 400;
  text-transform: uppercase;
  padding: 6px 0 0 0;
}
.shi-side-menu-button:hover {
  background-color: #201545;
}
.shi-side-menu-button:active {
  background-color: #aedce9;
  color: black;
}
    `;
		root.appendChild(style);

		const logoLink = document.createElement('a');
		logoLink.href = '/';
		logoLink.style.display = 'inline-flex';
		logoLink.style.alignItems = 'stretch';
		logoLink.style.userSelect = 'none';
		root.appendChild(logoLink);

		const logo = document.createElement('img');
		logo.src = '/files/2026/02/shi-institute-no-padding.png';
		logo.alt = 'The Shi Institute';
		logo.width = 200;
		logoLink.appendChild(logo);

		const right = document.createElement('div');
		right.classList.add('shi-navbar--primary-right');
		root.appendChild(right);

		const ul = document.createElement('ul');
		ul.classList.add('shi-navlist');
		right.appendChild(ul);

		const searchWrapper = document.createElement('div');
		searchWrapper.classList.add('shi-navbar-search');
		right.appendChild(searchWrapper);

		const searchForm = document.createElement('form');
		searchForm.method = 'GET';
		searchForm.action = '/';
		searchWrapper.appendChild(searchForm);

		const searchInput = document.createElement('input');
		searchInput.type = 'text';
		searchInput.placeholder = 'Search';
		searchInput.name = 's';
		searchForm.appendChild(searchInput);

		const searchButton = document.createElement('button');
		searchButton.type = 'submit';
		searchForm.appendChild(searchButton);

		const searchSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		searchSvg.setAttribute('viewBox', '0 0 512 512');
		searchSvg.setAttribute('aria-label', 'Search icon');
		const searchPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		searchPath.setAttribute(
			'd',
			'M500.3 443.7l-119.7-119.7c27.22-40.41 40.65-90.9 33.46-144.7C401.8 87.79 326.8 13.32 235.2 1.723C99.01-15.51-15.51 99.01 1.724 235.2c11.6 91.64 86.08 166.7 177.6 178.9c53.8 7.189 104.3-6.236 144.7-33.46l119.7 119.7c15.62 15.62 40.95 15.62 56.57 0C515.9 484.7 515.9 459.3 500.3 443.7zM79.1 208c0-70.58 57.42-128 128-128s128 57.42 128 128c0 70.58-57.42 128-128 128S79.1 278.6 79.1 208z',
		);
		searchSvg.appendChild(searchPath);
		searchButton.appendChild(searchSvg);

		const menuButton = document.createElement('button');
		menuButton.classList.add('shi-side-menu-button');
		menuButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="26" viewBox="0 0 40 14"><g transform="translate(0.397 1.088)"><line x2="40" transform="translate(-0.397 -0.088)" fill="none" stroke="currentColor" stroke-width="2"/><line x2="40" transform="translate(-0.397 5.912)" fill="none" stroke="currentColor" stroke-width="2"/><line x2="40" transform="translate(-0.397 11.912)" fill="none" stroke="currentColor" stroke-width="2"/></g></svg>
      Menu
    `;
		right.appendChild(menuButton);

		this.render();
	}

	/**
	 * @param {string} name
	 * @param {string | null} oldValue
	 * @param {string | null} newValue
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'items') {
			try {
				this.items = newValue ? JSON.parse(newValue) : [];
			} catch (e) {
				console.error('Failed to parse items attribute as JSON:', e);
			}
		}

		if (name === 'side-nav-items') {
			try {
				this.sideNavItems = newValue ? JSON.parse(newValue) : [];
			} catch (e) {
				console.error('Failed to parse side-nav-items attribute as JSON:', e);
			}
		}
	}

	/** @type {NavItem[]} */
	#items = [];
	/** @type {NavItem[]} */
	#sideNavItems = [];

	get items() {
		return this.#items;
	}

	/**
	 * @param {NavItem[]} value
	 */
	set items(value) {
		this.#items = Array.isArray(value) ? value : [];

		// reflect in the attribute as JSON string
		const json = JSON.stringify(this.#items);
		const currentAttr = this.getAttribute('items');
		if (currentAttr !== json) {
			this.setAttribute('items', json);
		}

		this.render();
	}

	get ['side-nav-items']() {
		return this.#sideNavItems;
	}

	/**
	 * @param {NavItem[]} value
	 */
	set ['side-nav-items'](value) {
		this.#sideNavItems = Array.isArray(value) ? value : [];

		// reflect in the attribute as JSON string
		const json = JSON.stringify(this.#sideNavItems);
		const currentAttr = this.getAttribute('side-nav-items');
		if (currentAttr !== json) {
			this.setAttribute('side-nav-items', json);
		}

		this.render();
	}

	render() {
		if (!this.shadowRoot) {
			return;
		}

		// overwrite the inner HTML of the nav list with the items
		const innerHTML = this.items
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
		const navList = this.shadowRoot.querySelector('.shi-navlist');
		if (navList) {
			navList.innerHTML = innerHTML;
		} else {
			console.warn('Could not find .shi-navlist element in shadow DOM to render primary navigation items.');
		}

		// re-render the side nav by removing the existing one and adding a new one with the updated items
		const sideNavElem = this.shadowRoot.querySelector('#side-nav');
		if (sideNavElem) {
			sideNavElem.remove();
		}
		const wrapper = document.createElement('div');
		wrapper.innerHTML = getSideNavInnerHTML(this['side-nav-items']);
		if (wrapper.firstElementChild) {
			this.shadowRoot.appendChild(wrapper.firstElementChild);
		}

		// add the .current class to any links in the side nav or primary nav that match the current pathname
		flagCurrentLinks('#side-nav .side-nav-content a', this.shadowRoot);
		flagCurrentLinks('.shi-navlist a', this.shadowRoot);

		// search on keyboard enter
		const input = this.shadowRoot.querySelector('.shi-navbar-search input[name="s"]');
		/** @param {Event} event   */
		function handleKeyDown(event) {
			if (event instanceof KeyboardEvent && event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.form) {
				event.target.form.submit();
			}
		}
		input?.addEventListener('keydown', handleKeyDown);

		const menuButtonElem = this.shadowRoot.querySelector('.shi-side-menu-button');
		menuButtonElem?.addEventListener('click', () => {
			const dialog = this.shadowRoot?.querySelector('#side-nav');
			if (!dialog || !(dialog instanceof HTMLDialogElement)) {
				return;
			}

			const closeDialog = () => {
				dialog.classList.add('closing');
				setTimeout(() => {
					dialog.classList.remove('closing');
					dialog.close();
				}, 200); // delay so the animation can play
			};

			if (dialog.open) {
				dialog.close();
				return;
			}

			dialog.showModal();

			// handle backdrop click to close the dialog
			dialog.addEventListener('click', (event) => {
				const rect = dialog.getBoundingClientRect();
				const clickedOutside =
					event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;

				if (clickedOutside) {
					closeDialog();
				}
			});

			// handle close button click
			const closeMenuButtonElem = dialog.querySelector('.nav-close-button');
			closeMenuButtonElem?.addEventListener('click', () => {
				closeDialog();
			});

			// since the dialog is in the shadow DOM, we need to handle keyboard events manually for accessibility
			dialog.addEventListener('keydown', (e) => {
				if (
					(e.key === 'Enter' || e.key === ' ') &&
					e instanceof KeyboardEvent &&
					e.target instanceof HTMLElement &&
					e.target.tagName === 'A'
				) {
					e.preventDefault();
					e.target.click();
				}
			});

			// close the menu whenever a link inside the menu is clicked
			dialog.querySelectorAll('a').forEach((link) => {
				link.addEventListener('click', () => {
					closeDialog();
				});
			});
		});
	}
}

export const shiNavListCSS = `
ul.shi-navlist {
  list-style: none;
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  gap: calc(4 / 3 * 1rem);
}
@media (width < 923px) {
  ul.shi-navlist {
    display: none;
  }
}
ul.shi-navlist li {
  display: flex;
  align-items: center;
}
ul.shi-navlist a {
  font-size: 0.95rem;
  font-family: 'Epilogue', sans-serif;
  color: #000;
  text-decoration: none;
  font-weight: 500;
  font-variation-settings: 'wght' 560;
  padding: calc(0.5rem - 2px) 0 0.5rem 0;
  text-box: trim-both text alphabetic;
  border-bottom-width: 2px;
  border-bottom-style: solid;
  border-bottom-color: transparent;
  display: inline-block;
  transition: 120ms;
  user-select: none;
}
ul.shi-navlist a.current {
  border-bottom-color: #582c83;
  color: #582c83;
}
ul.shi-navlist a:hover {
  border-bottom-color: hsla(268, 47%, 44%, 1.00);
  color: hsla(268, 47%, 34%, 1.00);
}
ul.shi-navlist a:active {
  border-bottom-color: hsla(268, 47%, 34%, 1.00);
  color: hsla(268, 47%, 24%, 1.00);
}
`;

/**
 * Adds the `current` class to any links in the given query selector
 * that match the current pathname and removes it from those that don't match.
 *
 * @param {string} selector
 * @param {Document | ShadowRoot} root - the document or shadow root to query within
 */
export function flagCurrentLinks(selector, root) {
	/** @type {Record<string, string>}  */
	const rewrites = {
		'/shi-institute': '/',
	};

	try {
		/** @param {string} href */
		const normalize = (href) => {
			if (!href) {
				return null;
			}

			try {
				const url = new URL(href, location.origin);

				// external links should never be marked as current
				if (url.origin !== location.origin) {
					return null;
				}

				let path = url.pathname.replace(/\/+$/, '');

				if (path === '') {
					path = '/';
				}

				return path;
			} catch (e) {
				return null;
			}
		};

		if (!globalThis.location) {
			return;
		}

		const currentPath = (location && location.pathname ? location.pathname.replace(/\/+$/, '') : '') || '/';
		const sideAnchors = root.querySelectorAll(selector);
		sideAnchors.forEach((a) => {
			const href = a.getAttribute('href');
			if (!href) {
				a.classList.remove('current');
				return;
			}
			const linkPath = normalize(href);
			if (linkPath && (linkPath === currentPath || linkPath === rewrites[currentPath])) {
				a.classList.add('current');
			} else {
				a.classList.remove('current');
			}
		});
	} catch (e) {
		console.error('Error while marking current link:', e);
	}
}

/**
 *
 * @param {{ label: string; href?: string }[]} items
 */
const getSideNavInnerHTML = (items) => {
	return `
  <dialog id="side-nav">
    <header>
      <a href="/" style="display: inline-flex; align-items: center; margin-inline: 16px 8px; user-select: none;">
        <img height="40" src="data:image/png;base64,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" alt="" />
      </a>
      <div class="side-nav-search-wrapper">
        <form method="GET" action="/" style="width: 100%;">
          <input
            type="text"
            name="s"
            placeholder="Search"
            class="side-nav-search-input"
            onkeydown="if(event.key === 'Enter') { this.form.submit(); }"
          >
          <button type="submit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-label="Search icon"><path d="M500.3 443.7l-119.7-119.7c27.22-40.41 40.65-90.9 33.46-144.7C401.8 87.79 326.8 13.32 235.2 1.723C99.01-15.51-15.51 99.01 1.724 235.2c11.6 91.64 86.08 166.7 177.6 178.9c53.8 7.189 104.3-6.236 144.7-33.46l119.7 119.7c15.62 15.62 40.95 15.62 56.57 0C515.9 484.7 515.9 459.3 500.3 443.7zM79.1 208c0-70.58 57.42-128 128-128s128 57.42 128 128c0 70.58-57.42 128-128 128S79.1 278.6 79.1 208z"></path></svg>
          </button>
        </form>
      </div>
      <button class="nav-close-button shi-side-menu-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="30" fill="#F9F5FF"/>
          <path d="M19 19 L41 41 M41 19 L19 41" stroke="#1A083D" stroke-width="4" stroke-linecap="round"/>
        </svg>
        Close
      </button>
    </header>
    <div class="side-nav-content">
      <ul>
        ${items
					.map((item) => {
						if (item.label === 'divider') {
							return `<hr>`;
						}

						if (!item.href) {
							return `<span>${item.label}</span>`;
						}

						const useNewTab = item.label.endsWith('↗');
						if (useNewTab) {
							return `<li><a href="${item.href}" target="_blank" rel="noopener noreferrer"><span>${item.label}</span></a></li>`;
						}

						return `<li><a href="${item.href}"><span>${item.label}</span></a></li>`;
					})
					.join('')}
      </ul>
    </div>
    <style>
      #side-nav header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        background-color: #201545;
      }

      .side-nav-search-wrapper {
        display: flex;
        align-items: center;
      }
      .side-nav-search-wrapper {
        flex-grow: 1;
      }
      .side-nav-search-wrapper > form {
          width: 100%;
          position: relative;
      }
      .side-nav-search-wrapper button {
        position: absolute;
        height: 36px;
        width: 42px;
        border-radius: 0 16px 16px 0;
        top: 0;
        right: 0;
        background: none;
        border: none;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: 120ms ease;
        color: inherit;
      }
      .side-nav-search-wrapper:hover:not(:focus-within) button {
        color: #000;
      }
      .side-nav-search-wrapper button:hover {
        background-color: #acddea;
        color: #000;
      }
      .side-nav-search-wrapper button:active {
        background-color: hsla(193, 60%, 70%, 1.00);
        color: #000;
      }
      .side-nav-search-wrapper button svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
        margin-right: 4px;
        margin-top: -2px;
      }
      .side-nav-search-wrapper input {
        background-color: #582c83;
        color: #fff;
        padding: 1px 16px;
        height: 36px;
        border: none;
        border-radius: 24px;
        width: 100%;
        box-sizing: border-box;
        font-family: 'Epilogue', sans-serif;
        font-size: 0.95rem;
        font-weight: 400;
        padding-right: 42px; /* same as button width */
        transition: 120ms ease;
      }
      .side-nav-search-wrapper input:focus {
        outline: none;
      }
      .side-nav-search-wrapper input::placeholder {
        color: #fff
      }
      .side-nav-search-wrapper input:hover::placeholder {
        color: #000;
      }
      .side-nav-search-wrapper input:active::placeholder {
        color: #000;
      }
      .side-nav-search-wrapper input:focus::placeholder {
        color: #fff
      }
      .side-nav-search-wrapper input:hover {
        background-color: #acddea;
        color: #000;
      }
      .side-nav-search-wrapper input:active {
        background-color: hsla(193, 60%, 70%, 1.00);
        color: #000;
      }
      .side-nav-search-wrapper input:focus {
        background-color: #201545;
        color: #fff;
        box-shadow: 0 0 0 2px #acddea;
      }

      #side-nav .nav-close-button {
        background-color: #201545;
        height: 60px;
        padding-block: 10px 6px;
        user-select: none;
      }
      #side-nav .nav-close-button:hover {
        background-color: #582c83;
      }
      #side-nav .nav-close-button:active {
        background-color: #acddea;
        color: #000;
      }
      #side-nav::backdrop {
        background: rgba(0, 0, 0, 0.5);
      }

      .side-nav-content {
        padding: 1rem;
        height: 100%;
        box-sizing: border-box;
      }

      #side-nav {
        border: none;
        padding: 0;
        overflow: auto;
        width: 420px;
        height: 100%;
        max-height: 100%;
        max-width: 100%;
        box-sizing: border-box;
        position: fixed;
        inset: 0 0 0 auto;
        background-color: #201545;
        color: #fff;
      }
      @media (width < 601px) {
        #side-nav {
          width: 100%;
        }
      }

      #side-nav[open] {
        display: flex;
        flex-direction: column;

        animation: popover-show 200ms forwards cubic-bezier(0.16, 1, 0.3, 1);
      }

      #side-nav.closing {
        animation: popover-hide 200ms forwards cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes popover-show {
        from {
          opacity: 0;
          transform: translateX(360px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes popover-hide {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(360px);
        }
      }

        #side-nav ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
        }

        #side-nav li {
          padding: 0.5rem 0;
        }

        #side-nav li a {
          display: inline-block;
          width: 100%;
          text-decoration: none;
        }

        #side-nav a span {
          color: #e0e0e0;
          text-decoration: none;
          font-size: 1.1rem;
          font-family: 'Epilogue', sans-serif;
          font-weight: 500;
          font-variation-settings: 'wght' 560;
          padding: calc(0.5rem - 2px) 0 0.5rem 0;
          border-bottom-width: 2px;
          border-bottom-style: solid;
          border-bottom-color: transparent;
          transition: 120ms;
          user-select: none;
        }

        #side-nav a.current span {
          color: #acddea;
          border-bottom-color: #acddea;
        }

        #side-nav li a:hover span {
          color: hsla(268, 47%, 84%, 1.00);
          border-bottom-color: hsla(268, 47%, 74%, 1.00);
        }

        #side-nav li a:active span {
          color: hsla(268, 47%, 74%, 1.00);
          border-bottom-color: hsla(268, 47%, 64%, 1.00);
        }
    </style>
  </dialog>
  `;
};

/**
 * @typedef {{label: string, href?: string}} NavItem
 */
