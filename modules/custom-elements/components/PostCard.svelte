<svelte:options
	customElement={{
		props: {
			title: { reflect: true, type: 'String', attribute: 'title' },
			excerpt: { reflect: true, type: 'String', attribute: 'excerpt' },
			href: { reflect: true, type: 'String', attribute: 'href' },
			image: { reflect: true, type: 'Object', attribute: 'image' },
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
	}
</script>

<script lang="ts">
	let { title = '', excerpt = '', href, image }: PostCardProps = $props();
</script>

<article>
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
		box-shadow: inset 0 0 0 1px #d8d8d8;
		background-color: #fff;
		color: #000;
		padding: 16px;
	}

	h1 {
		margin-block: 0 16px !important;
		font-family: 'Oswald', sans-serif;
		font-optical-sizing: auto;
		font-style: normal;
		font-weight: 500;
		font-size: 1.575em;
		line-height: 1.15;
		margin-top: 2.625rem;
		margin-bottom: 1.75rem;
	}
	@media (min-width: 992px) {
		h1 {
			font-size: 1.75em;
		}
	}

	h1 a {
		color: #582c83;
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
		margin-bottom: 16px;
		background-color: #000000;
		width: calc(100% + 32px);
		margin-left: -16px;
		margin-top: -16px;
	}

	p {
		margin-bottom: 0;
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
		background-color: #582c83;
		border-color: #582c83;
		color: #fff;
	}
	article :global(.btn:hover) {
		background-color: #f1bf40;
		color: black;
		text-decoration: none;
	}
	article :global(.btn:active) {
		background-color: #acddea;
		color: black;
	}

	article :global(span.cpschool-read-more-link-holder) {
		display: block;
		margin-top: 12px;
	}
</style>
