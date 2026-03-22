<svelte:options
	customElement={{
		props: {
			minColumnWidth: { reflect: true, type: 'String', attribute: 'min-column-width' },
			maxColumnWidth: { reflect: true, type: 'String', attribute: 'max-column-width' },
			gap: { reflect: true, type: 'String', attribute: 'gap' },
			type: { reflect: true, type: 'String', attribute: 'type' },
			taxonomies: { reflect: true, type: 'Object', attribute: 'taxonomies' },
			design: { reflect: true, type: 'String', attribute: 'design' },
			page: { reflect: true, type: 'Number', attribute: 'page' },
			pageSize: { reflect: true, type: 'Number', attribute: 'page-size' },
		},
	}}
/>

<script lang="ts" module>
	import type { ProjectBriefs } from '../../worker/api';
	import { fetchWithHydration, with_previous } from '../utils';
	import { url } from '../utils/navigation';
	import PostCard, { type PostCardProps } from './PostCard.svelte';
	import ProgressRing from './ProgressRing.svelte';

	export interface PostCardGridProps {
		minColumnWidth?: string;
		maxColumnWidth?: string;
		gap?: string;
		type: 'project-briefs';
		taxonomies?: Record<string, number[]>;
		page?: number;
		pageSize?: number;
		/** The design of the post cards. See PostCard for more information. */
		design?: PostCardProps['design'];
	}
</script>

<script lang="ts">
	let {
		minColumnWidth = '250px',
		maxColumnWidth = '1fr',
		gap = '1rem',
		type = 'project-briefs',
		taxonomies = {},
		page = 1,
		pageSize = 10,
		design,
	}: PostCardGridProps = $props();

	const isBlog = $derived($url.origin.includes('https://blogs.furman' + '.edu'));
	const prefix = $derived(isBlog ? `/${$url.pathname.split('/')[0] || ''}` : '');

	// memoize taxonomies to avoid unnecessary fetches when the taxonomies object reference changes but the contents are the same
	const stableTaxonomies = $derived.by(
		with_previous(
			(prev) => {
				const prevKeys = Object.keys(prev);
				const newKeys = Object.keys(taxonomies);
				if (
					prevKeys.length === newKeys.length &&
					prevKeys.every((key) => newKeys.includes(key)) &&
					prevKeys.every((key) => {
						const prevIds = prev[key];
						const newIds = taxonomies[key];
						return (
							Array.isArray(prevIds) &&
							Array.isArray(newIds) &&
							prevIds.length === newIds.length &&
							prevIds.every((id) => newIds.includes(id))
						);
					})
				) {
					return prev;
				}
				return taxonomies;
			},
			// svelte-ignore state_referenced_locally
			taxonomies,
		),
	);

	const queryUrl = $derived.by(() => {
		const queryUrl = new URL(isBlog ? `https://shi.institute/.api/${type}` : `/.api/${type}`, $url.origin);
		for (const [taxonomy, ids] of Object.entries(stableTaxonomies)) {
			if (ids.length > 0) {
				queryUrl.searchParams.set(`taxonomy__${taxonomy}`, ids.join(','));
			}
		}
		if (page !== undefined) {
			queryUrl.searchParams.set('page', page.toString());
		}
		if (pageSize !== undefined) {
			queryUrl.searchParams.set('per_page', pageSize.toString());
		}
		console.log('Query URL for PostCardGrid:', queryUrl.href, stableTaxonomies);
		return queryUrl;
	});

	const fetcher = await fetchWithHydration<ProjectBriefs>('project-brief-data', () => queryUrl);
</script>

<div class="grid" style:--min-column-width={minColumnWidth} style:--max-column-width={maxColumnWidth} style:--gap={gap}>
	{#if fetcher.data}
		<div class="loading loading-overlay" class:visible={fetcher.loading}>
			<ProgressRing />
			Please wait…
		</div>
		{#if fetcher.data.length === 0}
			<p>No posts found.</p>
		{:else}
			{#each fetcher.data as post}
				{#key post.id}
					<div data-post-id={post.id}>
						<PostCard
							title={post.title.rendered}
							excerpt={post.excerpt.rendered}
							href={prefix + post.link}
							image={post.media
								? {
										alt_text: post.media.alt_text,
										source_url: prefix + post.media.source_url,
										credit: post.media.caption.rendered.slice(
											3,
											(post.media.caption.rendered.indexOf('&#8230;') + 1 || post.media.caption.rendered.indexOf('</') + 1) - 1,
										),
										media_details: {
											...post.media.media_details,
											sizes: Object.fromEntries(
												Object.entries(post.media.media_details.sizes || {}).map(([key, value]) => [
													key,
													{
														...value,
														source_url: prefix + value.source_url,
													},
												]),
											),
										},
									}
								: undefined}
							{design}
						/>
					</div>
				{/key}
			{/each}
		{/if}
	{:else if fetcher.loading}
		<div class="loading">
			<ProgressRing />
			<p>Loading posts…</p>
		</div>
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
		font-size: 1.25rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.loading-overlay {
		position: absolute;
		top: 20px;
		left: 50%;
		transform: translate(-50%, -0);
		background: light-dark(rgba(255, 255, 255, 0.8), rgba(0, 0, 0, 0.8));
		box-shadow: inset 0 0 0 1px var(--shi-divider-color);
		backdrop-filter: blur(4px);
		padding: 1rem 2rem;
		border-radius: 0px;
		z-index: 1;
		opacity: 0;
		visibility: hidden;
		transition: all var(--shi-transition-120ms) ease-out;
	}
	.loading-overlay.visible {
		opacity: 1;
		visibility: visible;
	}

	div[data-post-id] {
		display: contents;
	}
</style>
