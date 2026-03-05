<svelte:options customElement={{}} />

<script lang="ts" module>
	import { url } from '../../utils/navigation';

	export interface NavigationListProps {
		items: NavigationListItem[];
		transformHref?: (href: string) => string;
		direction?: 'horizontal' | 'vertical';
		onItemClick?: () => void;
	}

	export type NavigationListItem = NavigationListLinkItem | NavigationListDividerItem;

	export interface NavigationListLinkItem {
		type?: 'link';
		label: string;
		href?: string;
	}

	export type NavigationListDividerItem = {
		type: 'divider';
	};
</script>

<script lang="ts">
	let { items, transformHref = (href) => href, direction = 'horizontal', onItemClick }: NavigationListProps = $props();

	function doUrlsMatch(toCheck: string, reference: string) {
		try {
			const urlToCheck = new URL(toCheck, $url.origin);
			const referenceUrl = new URL(reference, $url.origin);
			return urlToCheck.origin === referenceUrl.origin && urlToCheck.pathname === referenceUrl.pathname;
		} catch (error) {
			return false;
		}
	}
</script>

<ul class:vertical={direction === 'vertical'} class="nav-list">
	{#each items as item}
		{#if item.type === 'divider'}
			<hr />
		{:else}
			<li>
				{#if item.href}
					{@const useNewTab = item.label.endsWith('↗')}
					<a
						href={transformHref(item.href)}
						class:current={doUrlsMatch(transformHref(item.href), $url.href)}
						target={useNewTab ? '_blank' : '_self'}
						rel="noopener noreferrer"
						onclick={onItemClick}
					>
						<span>{item.label}</span>
					</a>
				{:else}
					<span>{item.label}</span>
				{/if}
			</li>
		{/if}
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		display: flex;
		align-items: center;
		margin: 0;
		padding: 0;
		gap: calc(4 / 3 * 1rem);
	}

	ul.vertical {
		flex-direction: column;
		align-items: stretch;
	}

	li {
		display: flex;
		align-items: center;
	}

	a span {
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
	a.current span {
		border-bottom-color: #582c83;
		color: #582c83;
	}
	a:hover span {
		border-bottom-color: hsla(268, 47%, 44%, 1);
		color: hsla(268, 47%, 34%, 1);
	}
	a:active span {
		border-bottom-color: hsla(268, 47%, 34%, 1);
		color: hsla(268, 47%, 24%, 1);
	}

	hr {
		border: none;
		border-style: solid;
		border-color: #d8d8d8;
		border-width: 0;
		border-left-width: 1px;
		height: 30px;
		background-color: transparent;
		opacity: 1;
		margin: 0;
	}

	ul.vertical hr {
		border-left-width: 0;
		border-top-width: 1px;
		width: 100%;
		height: 0;
	}
</style>
