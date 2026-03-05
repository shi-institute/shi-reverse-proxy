<svelte:options customElement={{}} />

<script lang="ts" module>
	import type { NavigationListItem, NavigationListProps } from './navigation-bar-parts/NavigationList.svelte';
	import NavigationList from './navigation-bar-parts/NavigationList.svelte';

	export interface SecondaryNavigationBarProps {
		left?: NavigationListItem[];
		right?: NavigationListItem[];
		transformHref?: NavigationListProps['transformHref'];
	}
</script>

<script lang="ts">
	let { left = [], right = [], transformHref }: SecondaryNavigationBarProps = $props();
</script>

<NavigationList items={left} {transformHref} />

<NavigationList items={right} {transformHref} />

<style>
	:host {
		height: 30px;
		background: white;
		box-shadow: inset 0 -1px 0 0 #d8d8d8;
		width: 100%;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
	}
	@media (width < 923px) {
		:host {
			display: none;
		}
	}

	:global(.nav-list) {
		gap: 0.8rem !important;
	}

	:global(.nav-list > li > a > span) {
		font-size: 13px;
		padding: 8px 0;
	}
</style>
