<svelte:options
	customElement={{
		props: {
			title: { reflect: true, type: 'String', attribute: 'title' },
			excerpt: { reflect: true, type: 'String', attribute: 'excerpt' },
			href: { reflect: true, type: 'String', attribute: 'href' },
			image: { reflect: true, type: 'Object', attribute: 'image' },
			design: { reflect: true, type: 'String', attribute: 'design' },
		},
	}}
/>

<script lang="ts" module>
	import type { PostMediaDetails } from '../../worker/api';
	import { sanitizeInlineHtml } from '../utils';

	export interface PostCardProps {
		title?: string;
		excerpt?: string;
		href?: string;
		image?: {
			alt_text: string;
			source_url: string;
			credit?: string;
			media_details: PostMediaDetails;
		};
		/**
		 * The design of the post card.
		 *
		 * When set to default, the title will be purple and the button will be purple with white text.
		 *
		 * When set to neutral, the title will be black instead of purple, and the button will
		 * be white with a gray outline instead of purple.
		 *
		 */
		design?: 'default' | 'neutral';
	}
</script>

<script lang="ts">
	let { title = '', excerpt = '', href, image, design = 'default' }: PostCardProps = $props();
</script>

<article class:design-neutral={design === 'neutral'}>
	{#if image}
		<figure>
			<a {href}>
				<img src={image.source_url} alt={image.alt_text} />
			</a>
			{#if image.credit}
				<figcaption>
					<svg width="24" height="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M12 1.999c5.524 0 10.002 4.478 10.002 10.002 0 5.523-4.478 10.001-10.002 10.001-5.524 0-10.002-4.478-10.002-10.001C1.998 6.477 6.476 1.999 12 1.999Zm0 1.5a8.502 8.502 0 1 0 0 17.003A8.502 8.502 0 0 0 12 3.5Zm-.004 7a.75.75 0 0 1 .744.648l.007.102.003 5.502a.75.75 0 0 1-1.493.102l-.007-.101-.003-5.502a.75.75 0 0 1 .75-.75ZM12 7.003a.999.999 0 1 1 0 1.997.999.999 0 0 1 0-1.997Z"
							fill="#ffffff"
						/>
					</svg>
					<span class="image-credit" aria-label="Photo credit: {image.credit}">{image.credit}</span>
				</figcaption>
			{/if}
		</figure>
	{/if}

	<h1>
		<a {href}>
			{@html sanitizeInlineHtml(title)}
		</a>
	</h1>

	{#if excerpt}
		<p>{@html sanitizeInlineHtml(excerpt.replaceAll('…', '').replaceAll('&#8230;', ''))}</p>
	{/if}
</article>

<style>
	:host {
		display: block;
	}

	article {
		display: block;
		box-shadow: inset 0 0 0 1px var(--shi-divider-color);
		background-color: var(--shi-surface-background-color);
		color: var(--shi-surface-color);
		--padding: 24px;
		padding: var(--padding);
	}

	h1 {
		margin-block: 0 16px !important;
		font-family: 'Oswald', sans-serif;
		font-optical-sizing: auto;
		font-style: normal;
		font-weight: 500;
		font-size: 1.575em;
		line-height: 1.15;
	}
	@media (min-width: 992px) {
		h1 {
			font-size: 1.75em;
		}
	}

	h1 a {
		color: light-dark(var(--shi-color-purple), var(--shi-surface-color));
	}
	.design-neutral h1 a {
		color: var(--shi-surface-color);
	}
	h1 a:not(:hover):not(:active) {
		text-decoration: none;
	}
	h1 a:hover,
	h1 a:active {
		text-decoration: underline;
	}

	figure {
		margin: 0 0 var(--padding) 0;
		position: relative;
	}
	figure a {
		display: contents;
	}
	figure:not(:hover) figcaption {
		opacity: 0;
	}
	figcaption svg {
		background-color: rgba(0, 0, 0, 0.4);
		color: #aaa;
		padding: 1px;
		border-radius: 50%;
		block-size: 20px;
		inline-size: 20px;
	}
	figcaption {
		position: absolute;
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
		gap: 0.5rem;
		top: calc(-1 * var(--padding) + 8px);
		right: calc(-1 * var(--padding) + 4px);
		font-size: 0.75em;
		text-align: right;
		padding: 4px 8px;
		transition: opacity 200ms ease;
	}
	figcaption .image-credit {
		opacity: 0;
		transition:
			opacity 200ms ease,
			visibility 200ms ease,
			background-color 200ms ease,
			color 200ms ease,
			backdrop-filter 200ms ease;
	}
	figcaption:hover .image-credit,
	figcaption:focus .image-credit {
		opacity: 1;
	}
	figcaption:hover,
	figcaption:focus {
		background-color: rgba(0, 0, 0, 0.8);
		color: #fff;
		backdrop-filter: blur(4px);
		border-radius: 24px;
	}

	img {
		aspect-ratio: 3 / 2;
		object-fit: cover;
		background-color: #000000;
		width: calc(100% + var(--padding) * 2);
		margin-left: calc(var(--padding) * -1);
		margin-top: calc(var(--padding) * -1);
	}

	p {
		margin-block: 16px 4px;
		font-size: 0.9em;
	}
	@media (min-width: 782px) {
		p {
			font-size: 1em;
		}
	}

	article :global(span.sr-only) {
		display: none;
	}

	article :global(.btn) {
		padding: 0.375rem 0.75rem;
		font-size: 1em;
		line-height: 1.5;
		text-decoration: none;
		text-transform: uppercase;
		font-weight: 600;
		user-select: none;
		box-sizing: border-box;
		transition:
			background-color 120ms ease,
			box-shadow 120ms ease;
		min-height: 38px;
		display: inline-flex;
		align-items: center;
		background-color: var(--shi-color-purple);
		--box-shadow-color: var(--shi-color-purple);
		box-shadow: inset 0 0 0 1px var(--box-shadow-color);
		color: var(--shi-color--on-purple);
	}
	article :global(.btn:hover) {
		background-color: var(--shi-color-yellow);
		--box-shadow-color: var(--shi-color-yellow);
		color: var(--shi-color--on-yellow);
		text-decoration: none;
	}
	article :global(.btn:active) {
		background-color: var(--shi-color-blue);
		--box-shadow-color: var(--shi-color-blue);
		color: var(--shi-color--on-blue);
	}

	article.design-neutral :global(.btn:not(:hover):not(:active)) {
		background-color: var(--shi-surface-background-color);
		--box-shadow-color: var(--shi-divider-color);
		color: var(--shi-surface-color);
	}

	article :global(span.cpschool-read-more-link-holder) {
		display: block;
		margin-top: 12px;
	}
</style>
