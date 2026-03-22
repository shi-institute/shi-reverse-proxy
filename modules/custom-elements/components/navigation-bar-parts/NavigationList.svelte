<svelte:options customElement={{}} />

<script lang="ts" module>
	import { url } from '../../utils/navigation';

	export interface NavigationListProps {
		items: NavigationListItem[];
		transformHref?: (href: string) => string;
		direction?: 'horizontal' | 'vertical';
		onItemClick?: () => void;
	}

	export type NavigationListItem = NavigationListLinkItem | NavigationListDividerItem | NavigationListSpacerItem;

	export interface NavigationListLinkItem {
		type?: 'link';
		label: string;
		href?: string;
	}

	export type NavigationListDividerItem = {
		type: 'divider';
	};

	export type NavigationListSpacerItem = {
		type: 'spacer';
		size: string;
	};
</script>

<script lang="ts">
	let { items, transformHref: _transformHref = (href) => href, direction = 'horizontal', onItemClick }: NavigationListProps = $props();

	function doUrlsMatch(toCheck: string, reference: string) {
		try {
			const urlToCheck = new URL(toCheck, $url.origin);
			const referenceUrl = new URL(reference, $url.origin);
			return urlToCheck.origin === referenceUrl.origin && urlToCheck.pathname === referenceUrl.pathname;
		} catch (error) {
			return false;
		}
	}

	const isBlog = $derived($url.origin.includes('https://blogs.furman' + '.edu'));
	const prefix = $derived(isBlog ? `/${$url.pathname.split('/')[1] || ''}` : '');

	function transformHref(href: string) {
		const transformed = _transformHref(href);

		// If the transformed href is a relative path and the current origin is the blogs subdomain,
		// we need to prepend the first segment of the current path to the href.
		// This allows links to work correctly when the site is accessed from the subpath
		// instead of the root domain.
		if (transformed.startsWith('/') && prefix) {
			return prefix + transformed;
		}
		return transformed;
	}
</script>

<ul class:vertical={direction === 'vertical'} class="nav-list">
	{#each items as item}
		{#if item.type === 'divider'}
			<hr />
		{:else if item.type === 'spacer'}
			<div style={direction === 'vertical' ? `height: ${item.size};` : `width: ${item.size};`}></div>
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
		color: var(--shi-navlist-color);
		text-decoration: none;
		font-weight: 500;
		font-variation-settings: 'wght' 560;
		padding: calc(0.5rem - 2px) 0 0.5rem 0;
		text-box: trim-both text alphabetic;
		border-bottom-width: 2px;
		border-bottom-style: solid;
		border-bottom-color: transparent;
		display: inline-block;
		transition: var(--shi-transition-120ms);
		user-select: none;
	}
	a.current span {
		border-bottom-color: var(--shi-navbar-color--current);
		color: var(--shi-navbar-color--current);
	}
	a:hover span {
		border-bottom-color: var(--shi-navbar-color--hover);
		color: var(--shi-navbar-color--hover);
	}
	a.current:hover:not(:active) span {
		border-bottom-color: var(--shi-navbar-color--current--hover);
		color: var(--shi-navbar-color--current--hover);
	}
	a:active span {
		border-bottom-color: var(--shi-navbar-color--active);
		color: var(--shi-navbar-color--active);
	}

	hr {
		border: none;
		border-style: solid;
		border-color: var(--shi-divider-color);
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
