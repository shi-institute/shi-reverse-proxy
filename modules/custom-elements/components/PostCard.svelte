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
		<a {href}>
			<img src={image.source_url} alt={image.alt_text} />
		</a>
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
		background-color: var(--shi-color-white);
		color: #000;
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
		color: var(--shi-color-purple);
	}
	.design-neutral h1 a {
		color: var(--shi-color-black);
	}
	h1 a:not(:hover):not(:active) {
		text-decoration: none;
	}
	h1 a:hover,
	h1 a:active {
		text-decoration: underline;
	}

	img {
		aspect-ratio: 3 / 2;
		object-fit: cover;
		margin-bottom: var(--padding);
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
		background-color: var(--shi-color-white);
		--box-shadow-color: var(--shi-divider-color);
		color: var(--shi-color-black);
	}

	article :global(span.cpschool-read-more-link-holder) {
		display: block;
		margin-top: 12px;
	}
</style>
