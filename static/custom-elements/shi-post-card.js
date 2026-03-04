import { z } from 'https://esm.run/zod';
import { CustomElement } from './CustomElement.js';

export const imageSchema = z.object({
	source_url: z.string(),
	alt_text: z.string(),
	media_details: z.object({
		sizes: z.record(
			z.string(),
			z.object({
				file: z.string(),
				width: z.number(),
				height: z.number(),
				filesize: z.number().optional(),
				mime_type: z.string(),
				source_url: z.string(),
			}),
		),
	}),
});

export class ShiPostCard extends CustomElement {
	/** @type {string} */ title = '';
	/** @type {string} */ excerpt = '';
	/** @type {string | null} */ href = null;
	/** @type {z.infer<typeof imageSchema> | null} */ image = null;

	static attributes = {
		title: { type: String, default: '' },
		excerpt: { type: String, default: '' },
		href: { type: String, default: null },
		image: { type: imageSchema, default: null },
	};

	static useShadow = false;

	constructor() {
		super();
		super.installAttributes();
	}

	/**
	 * @param {NonNullable<typeof this.image>['media_details']['sizes']} sizes - An object containing the different image sizes and their URLs.
	 * @returns {string} A srcset string for the img element.
	 */
	buildSrcSet(sizes, maxWidth = 800) {
		let srcset = '';

		for (const size of Object.values(sizes)) {
			if (size.width <= maxWidth) {
				srcset += `${size.source_url} ${size.width}w,`;
			}
		}

		if (srcset.endsWith(',')) {
			srcset = srcset.slice(0, -1); // remove trailing comma
		}

		return srcset.trim();
	}

	render() {
		return `
      ${
				this.image
					? `<a href="${this.href}">
            <img
              src="${this.image.source_url}"
              alt="${this.image.alt_text}"
              srcset="${this.buildSrcSet(this.image.media_details.sizes)}"
            />
          </a>`
					: ''
			}
      <h2 class="wp-block-post-title">
        ${this.href ? `<a href="${this.href}">${this.title}</a>` : this.title}
      </h2>
			${
				this.excerpt
					? `<p class="excerpt">
							${this.excerpt.replaceAll('…', '').replaceAll('&#8230;', '')}
						</p>`
					: ''
			}
      
    `;
	}

	styles() {
		return `
      :host {
        display: block;
        border: 1px solid #d8d8d8;
        padding: 16px;
      }

      :host > h2 {
        margin-block: 0 16px !important;
      }

      :host h2 a:not(:hover):not(:active) {
        text-decoration: none;
      }
      :host h2 a:hover, :host h2 a:active {
        text-decoration: underline;
      }

      :host img {
        aspect-ratio: 3 / 2;
        object-fit: cover;
        margin-bottom: 16px;
        background-color: #000000;
        width: 100%;
      }
    `;
	}
}
