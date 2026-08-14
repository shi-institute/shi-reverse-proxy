class FurmanGisHeader extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = `
      <header id='furman-gisrsc-header'>
        <nav>
          <ul>
            <a href="https://gis.furman.edu/portal/home/index.html">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.55 2.532a2.25 2.25 0 0 1 2.9 0l6.75 5.692c.507.428.8 1.057.8 1.72v9.803a1.75 1.75 0 0 1-1.75 1.75h-3.5a1.75 1.75 0 0 1-1.75-1.75v-5.5a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0-.25.25v5.5a1.75 1.75 0 0 1-1.75 1.75h-3.5A1.75 1.75 0 0 1 3 19.747V9.944c0-.663.293-1.292.8-1.72l6.75-5.692Zm1.933 1.147a.75.75 0 0 0-.966 0L4.767 9.37a.75.75 0 0 0-.267.573v9.803c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-5.5c0-.967.784-1.75 1.75-1.75h3.5c.966 0 1.75.783 1.75 1.75v5.5c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25V9.944a.75.75 0 0 0-.267-.573l-6.75-5.692Z" fill="currentColor"/>
              </svg>
              Home
            </a>
            <a href="https://gis.furman.edu/sal/index.html">
              <img src="https://gis.furman.edu/sal/sal_logo_sm.png" alt="">
              Spatial Analysis Lab
            </a>
            <a href="https://www.furman.edu/shi-institute/sustainability-research/">
            <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 36.036 36.03" fill="currentColor">
              <path d="M24.468 15.226c.369.85.575 1.787.577 2.773h10.991c-.002-2.608-.563-5.613-1.563-7.85zM24.657 20.324a7 7 0 0 1-1.764 2.754l7.564 7.97a18 18 0 0 0 4.589-7.137zM21.01 24.378c-.84.395-1.77.629-2.752.661l.026 10.99a17.9 17.9 0 0 0 7.275-1.647zM20.29 11.369a7 7 0 0 1 2.913 1.906l7.97-7.563A18 18 0 0 0 23.879.979ZM13.079 9.135l1.862 2.573a7 7 0 0 1 3.078-.717V7.809c-1.727.012-3.434.47-4.94 1.326M9.306 12.86l2.853 1.283c.336-.508.74-.965 1.193-1.368l-1.842-2.546a10.2 10.2 0 0 0-2.204 2.632M11.33 15.867 8.5 14.596a10.1 10.1 0 0 0-.593 3.39q0 .042.004.085l.004.076 3.093-.342c.021-.673.125-1.325.322-1.938M8.118 20.048c.235 1.14.678 2.24 1.316 3.27l2.494-1.826a7 7 0 0 1-.71-1.787zM14.792 27.607l1.001-2.923a7 7 0 0 1-2.708-1.669l-2.497 1.83a10.23 10.23 0 0 0 4.204 2.762M6.593 27.785l-.007-.01-2.41 1.765a18.06 18.06 0 0 0 8.054 5.541l.961-2.804a15.16 15.16 0 0 1-6.598-4.492M5.433 26.239A14.95 14.95 0 0 1 3.208 20.6l-.001-.01-2.974.328a17.9 17.9 0 0 0 2.804 7.086l2.401-1.76zM3.001 18.68l-.015-.245c-.01-.149-.02-.298-.02-.45 0-1.836.342-3.656 1.017-5.41l.004-.008-2.699-1.212A17.9 17.9 0 0 0 0 18.018c0 .337.022.667.04 1l2.962-.328zM4.78 10.814a15.1 15.1 0 0 1 3.823-4.588l.007-.005L6.9 3.858a18.1 18.1 0 0 0-4.815 5.758l2.689 1.208zM10.186 5.117a15.06 15.06 0 0 1 7.832-2.248V0a17.9 17.9 0 0 0-9.552 2.76l1.71 2.364zM9.716 25.503l-.01-.012-2.107 1.543a13.9 13.9 0 0 0 5.997 4.06l.843-2.458a11.3 11.3 0 0 1-4.723-3.133M7.034 20.168l-2.582.285c.327 1.812.999 3.51 1.998 5.051l2.103-1.54-.007-.01a11.2 11.2 0 0 1-1.51-3.772q0-.008-.002-.014M7.506 14.148 5.13 13.081a13.8 13.8 0 0 0-.913 4.904q.002.179.017.353.007.107.012.214l2.586-.286v-.013l-.007-.11q-.006-.078-.007-.158c0-1.29.23-2.577.683-3.826zM5.918 11.339l2.39 1.073q.002-.008.006-.014A11.3 11.3 0 0 1 10.86 9.35l.009-.007-1.526-2.109a13.9 13.9 0 0 0-3.425 4.105M12.452 8.242a11.24 11.24 0 0 1 5.565-1.521h.002V4.12a13.8 13.8 0 0 0-7.107 2.02l1.527 2.11z"/>
            </svg>
              Research & Consulting Services
            </a>
          </ul>
        </nav>
        <div class="meta">
          <ul>
            <a href="https://gis.furman.edu/go">
              Go
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.267 4.209a.75.75 0 0 0-1.034 1.086l6.251 5.955H3.75a.75.75 0 0 0 0 1.5h14.734l-6.251 5.954a.75.75 0 0 0 1.034 1.087l7.42-7.067a.996.996 0 0 0 .3-.58.758.758 0 0 0-.001-.29.995.995 0 0 0-.3-.578l-7.419-7.067Z" fill="currentColor"/>
              </svg>
            </a>
          </ul>
        </div>
      </header>

      <style>
          :host {
            display: block;
            position: relative;
            z-index: 1;

            --header-height: 30px;
          }

          header#furman-gisrsc-header {
            --height: var(--header-height);
            background-color: black;
            color: #e0e0e0;
            height: var(--height);
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px 0 6px;
            font-size: 13px;
            flex-grow: 0;
            flex-shrink: 0;
          }

          header#furman-gisrsc-header ul {
            height: var(--height);
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: row;
            align-items: center;
          }

          header#furman-gisrsc-header ul a {
            height: var(--height);
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            color: #e0e0e0;
            text-decoration: none;
            padding: 0 10px;
          }
          header#furman-gisrsc-header ul a:hover {
            background-color: rgba(255, 255, 255, 0.18);
          }
          header#furman-gisrsc-header ul a:active {
            background-color: rgba(255, 255, 255, 0.26);
          }
          @media (max-width: 530px) {
            header#furman-gisrsc-header ul a:not(:first-child) {
              display: none;
            }
          }

          header#furman-gisrsc-header ul a :is(svg, img) {
            block-size: 1rem;
            inline-size: 1rem;
            margin-bottom: 1px;
          }
        </style>
    `;
  }
}

customElements.define('furman-gis-header', FurmanGisHeader);

const headerNode = document.createElement('furman-gis-header');
document.body.prepend(headerNode);

const style = document.createElement('style');
style.textContent = `

/* adjustments to the area where the profile menu dropdown appears */
html {
  --header-height: 30px;
  --modified-esri-vh: calc(var(--esri-vh) - var(--header-height));
}
body {
  --esri-vh: var(--modified-esri-vh);
  margin: 0;
}

/* account for the injected header height */
.js-root > div.min-h-screen {
  min-height: calc(100vh - var(--header-height));
}

/* use Furman purple instead of Esri's default blue */
:root, calcite-shell * {
  --calcite-color-brand--parts: 271deg 49% 34% !important;
  --calcite-color-brand: hsl(var(--calcite-color-brand--parts)) !important;
  --calcite-color-brand-hover: hsl(271deg 49% 40%) !important;
  --calcite-color-brand-press: hsl(271deg 49% 26%) !important;
  --calcite-color-focus: var(--calcite-color-brand) !important;
}
calcite-shell .calcite-mode-dark * {
  --calcite-color-brand--parts: 271deg 49% 66% !important;
}
@media (min-width: 1024px) {
    .esri-header-menus-link.-is-active {
        box-shadow: inset 0 -3px 0 0 var(--calcite-color-brand);
    }
    .esri-header-menus-link:hover {
        box-shadow: inset 0 -3px 0 0 hsla(var(--calcite-color-brand--parts) / 0.625);
    }
    .esri-header-menus-link:active {
        box-shadow: inset 0 -3px 0 0 var(--calcite-color-brand-press);
    }
}

/* for map viewer */
calcite-shell {
  top: var(--header-height) !important;
  block-size: auto !important;
}
`;
document.head.append(style);
