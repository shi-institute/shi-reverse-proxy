<svelte:options
	customElement={{
		props: {
			minColumnWidth: { reflect: true, type: 'String', attribute: 'min-column-width' },
			maxColumnWidth: { reflect: true, type: 'String', attribute: 'max-column-width' },
			gap: { reflect: true, type: 'String', attribute: 'gap' },
			categoryIds: { reflect: true, type: 'Array', attribute: 'category-ids' },
			tagIds: { reflect: true, type: 'Array', attribute: 'tag-ids' },
		},
	}}
/>

<script lang="ts" module>
	import type { Posts, wordpressPostSchema } from '../../worker/api';
	import { fetchWithHydration } from '../utils';
	import { url } from '../utils/navigation';
	import PostCard from './PostCard.svelte';

	export interface PostCardGridProps {
		minColumnWidth?: string;
		maxColumnWidth?: string;
		gap?: string;
		categoryIds?: number[];
		tagIds?: number[];
	}
</script>

<script lang="ts">
	let { minColumnWidth = '250px', maxColumnWidth = '1fr', gap = '1rem', categoryIds = [], tagIds = [] }: PostCardGridProps = $props();

	const queryUrl = $derived.by(() => {
		const isBlog = $url.origin.includes('https://blogs.furman' + '.edu');
		const queryUrl = new URL(isBlog ? '/shi-applied-research/.api/posts' : '/.api/posts', $url.origin);
		if (categoryIds.length > 0) {
			queryUrl.searchParams.set('categories', categoryIds.join(','));
		}
		if (tagIds.length > 0) {
			queryUrl.searchParams.set('tags', tagIds.join(','));
		}
		return queryUrl;
	});

	type F = typeof wordpressPostSchema;

	const fetcher = await fetchWithHydration<Posts>('post-data', () => queryUrl);
</script>

<div class="grid" style:--min-column-width={minColumnWidth} style:--max-column-width={maxColumnWidth} style:--gap={gap}>
	{#if fetcher.data}
		{#if fetcher.loading}
			<div class="loading">Please wait…</div>
		{/if}
		{#if fetcher.data.length === 0}
			<p>No posts found.</p>
		{:else}
			{#each fetcher.data as post}
				<div data-post-id={post.id}>
					<PostCard
						title={post.title.rendered}
						excerpt={post.excerpt.rendered}
						href={post.link}
						image={post.media
							? {
									alt_text: post.media.alt_text,
									source_url: post.media.source_url,
									media_details: post.media.media_details,
								}
							: undefined}
					/>
				</div>
			{/each}
		{/if}
	{:else if fetcher.loading}
		<p>Loading posts...</p>
	{:else if fetcher.error}
		<p>Error loading posts: {fetcher.error.message}</p>
	{/if}
</div>

<style>
	:host {
		display: block;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--min-column-width), var(--max-column-width)));
		gap: var(--gap);
		position: relative;
	}

	.loading {
		position: absolute;
		top: 20px;
		left: 50%;
		transform: translate(-50%, -0);
		background: rgba(255, 255, 255, 0.8);
		padding: 1rem 2rem;
		border-radius: 4px;
		font-size: 1.25rem;
		font-weight: 600;
	}
</style>
