import { z } from 'https://esm.run/zod';
import { CustomElement, escapeHtml } from './CustomElement.js';
import { ShiPostCard } from './shi-post-card.js';

export class ShiPostCardGrid extends CustomElement {
	static useShadow = false;

	/** @satisfies {Record<string, import('./CustomElement').AttributeConfig>} */
	static attributes = {
		columns: { type: Number, default: 3 },
		'min-column-width': { type: String, default: '250px' },
		'max-column-width': { type: String, default: '1fr' },
		gap: { type: String, default: '16px' },
		'category-ids': { type: z.coerce.number().array(), observed: true, default: [] },
		'tag-ids': { type: z.coerce.number().array(), observed: true, default: [] },
	};

	/** @type {number} */ columns = ShiPostCardGrid.attributes.columns.default;
	/** @type {string} */ gap = ShiPostCardGrid.attributes.gap.default;
	/** @type {string} */ ['min-column-width'] = ShiPostCardGrid.attributes['min-column-width'].default;
	/** @type {string} */ ['max-column-width'] = ShiPostCardGrid.attributes['max-column-width'].default;
	/** @type {number[]} */ ['category-ids'] = ShiPostCardGrid.attributes['category-ids'].default;
	/** @type {number[]} */ ['tag-ids'] = ShiPostCardGrid.attributes['tag-ids'].default;

	constructor() {
		super();
		super.installAttributes();
	}

	/***
	 * Fetches posts from the WordPress REST API based on the specified category and tag IDs.
	 */
	async _fetch() {
		const isBlog = window.location.origin.includes('https://blogs.furman' + '.edu');
		const queryUrl = new URL(isBlog ? '/shi-applied-research/.api/posts' : '/.api/posts', location.origin);
		if (this['category-ids'].length > 0) {
			queryUrl.searchParams.set('categories', this['category-ids'].join(','));
		}
		if (this['tag-ids'].length > 0) {
			queryUrl.searchParams.set('tags', this['tag-ids'].join(','));
		}

		const posts = await fetch(queryUrl).then(
			/** @returns {Promise<import('../../src/api.js').Posts>} */
			(res) => res.json(),
		);

		return posts;
	}

	/** @type {any} */
	_postsError = null;
	/** @type {Promise<import('../../src/api.js').Posts> | null} */
	__postsPendingFetch = null;
	get posts() {
		/** @type {import('../../src/api.js').Posts | null} */
		const posts = this.store.get('posts');

		if (!posts && !this._postsError && !this.__postsPendingFetch) {
			this.__postsPendingFetch = this._fetch()
				.then((posts) => this.store.set('posts', posts))
				.catch((error) => (this._postsError = error))
				.finally(() => {
					this.__postsPendingFetch = null;
					this.dispatchEvent(new CustomEvent('posts-fetched', { detail: { posts: this.store.get('posts'), error: this._postsError } }));
					super.rerender();
				});
		}

		return {
			data: posts,
			loading: this.__postsPendingFetch !== null,
			error: this._postsError,
			refetch: () => {
				this._postsError = null;
				this.__postsPendingFetch = this._fetch()
					.then((posts) => this.store.set('posts', posts))
					.catch((error) => (this._postsError = error))
					.finally(() => {
						this.__postsPendingFetch = null;
						this.dispatchEvent(new CustomEvent('posts-fetched', { detail: { posts: this.store.get('posts'), error: this._postsError } }));
						super.rerender();
					});
				return this.__postsPendingFetch;
			},
		};
	}

	/**
	 * @param {string} propertyName
	 * @returns {boolean | void} Whether the component should re-render after this property changes. Defaults to true.
	 */
	changed(propertyName) {
		if (propertyName === 'category-ids' || propertyName === 'tag-ids') {
			if (this.__postsPendingFetch) {
				this.__postsPendingFetch = null;
			}
			this.posts.refetch();
			return false; // refetch() will trigger a re-render when the fetch completes, so we return false here to avoid an extra render
		}
	}

	render() {
		if (typeof customElements !== 'undefined' && !customElements.get('shi-post-card')) {
			customElements.define('shi-post-card', class extends ShiPostCard {});
		}

		if (this.posts.data) {
			return `
      ${this.store}
      ${this.posts.data
				.map((post) => {
					const { title, excerpt, link } = post;

					const media =
						'media' in post && post.media
							? {
									source_url: post.media.source_url ?? null,
									alt_text: post.media.alt_text ?? '',
									media_details: {
										sizes: post.media.media_details?.sizes ?? {},
									},
								}
							: null;

					return `
              <shi-post-card
                title="${escapeHtml(title.rendered)}"
                excerpt="${escapeHtml(excerpt.rendered)}"
                href="${link}"
                ${media ? `image='${escapeHtml(JSON.stringify(media))}'` : ''}
              ></shi-post-card>
            `;
				})
				.join('')}
      `;
		}

		if (this.posts.loading) {
			return `<p>Loading...</p>`;
		}

		if (this.posts.error) {
			return `<p>Error loading posts: ${this.posts.error.message}</p>`;
		}

		return `<p>No posts found.</p>`;
	}

	styles() {
		return `
      :host {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(${this['min-column-width']}, ${this['max-column-width']}));
        gap: ${this.gap};
      }
    `;
	}
}
