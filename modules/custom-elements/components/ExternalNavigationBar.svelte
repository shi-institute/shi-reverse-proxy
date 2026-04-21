<svelte:options
	customElement={{
		props: {
			bar: { attribute: 'menu-items', reflect: true, type: 'Array' },
		},
	}}
/>

<script lang="ts" module>
	import Menu from './navigation-bar-parts/Menu.svelte';
	import type { NavigationListItem, NavigationListProps } from './navigation-bar-parts/NavigationList.svelte';
	import NavigationList from './navigation-bar-parts/NavigationList.svelte';

	export interface SecondaryNavigationBarProps {
		bar?: NavigationListItem[];
		menu?: NavigationListItem[];
		transformHref?: NavigationListProps['transformHref'];
		showLogo?: boolean;
	}
</script>

<script lang="ts">
	let { bar = [], menu = [], transformHref, showLogo = false }: SecondaryNavigationBarProps = $props();
</script>

<div class="left">
	{#if showLogo}
		<a href="/" aria-label="Home">
			<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 36.036 36.03" fill="currentColor">
				<path
					d="M24.468 15.226c.369.85.575 1.787.577 2.773h10.991c-.002-2.608-.563-5.613-1.563-7.85zM24.657 20.324a7 7 0 0 1-1.764 2.754l7.564 7.97a18 18 0 0 0 4.589-7.137zM21.01 24.378c-.84.395-1.77.629-2.752.661l.026 10.99a17.9 17.9 0 0 0 7.275-1.647zM20.29 11.369a7 7 0 0 1 2.913 1.906l7.97-7.563A18 18 0 0 0 23.879.979ZM13.079 9.135l1.862 2.573a7 7 0 0 1 3.078-.717V7.809c-1.727.012-3.434.47-4.94 1.326M9.306 12.86l2.853 1.283c.336-.508.74-.965 1.193-1.368l-1.842-2.546a10.2 10.2 0 0 0-2.204 2.632M11.33 15.867 8.5 14.596a10.1 10.1 0 0 0-.593 3.39q0 .042.004.085l.004.076 3.093-.342c.021-.673.125-1.325.322-1.938M8.118 20.048c.235 1.14.678 2.24 1.316 3.27l2.494-1.826a7 7 0 0 1-.71-1.787zM14.792 27.607l1.001-2.923a7 7 0 0 1-2.708-1.669l-2.497 1.83a10.23 10.23 0 0 0 4.204 2.762M6.593 27.785l-.007-.01-2.41 1.765a18.06 18.06 0 0 0 8.054 5.541l.961-2.804a15.16 15.16 0 0 1-6.598-4.492M5.433 26.239A14.95 14.95 0 0 1 3.208 20.6l-.001-.01-2.974.328a17.9 17.9 0 0 0 2.804 7.086l2.401-1.76zM3.001 18.68l-.015-.245c-.01-.149-.02-.298-.02-.45 0-1.836.342-3.656 1.017-5.41l.004-.008-2.699-1.212A17.9 17.9 0 0 0 0 18.018c0 .337.022.667.04 1l2.962-.328zM4.78 10.814a15.1 15.1 0 0 1 3.823-4.588l.007-.005L6.9 3.858a18.1 18.1 0 0 0-4.815 5.758l2.689 1.208zM10.186 5.117a15.06 15.06 0 0 1 7.832-2.248V0a17.9 17.9 0 0 0-9.552 2.76l1.71 2.364zM9.716 25.503l-.01-.012-2.107 1.543a13.9 13.9 0 0 0 5.997 4.06l.843-2.458a11.3 11.3 0 0 1-4.723-3.133M7.034 20.168l-2.582.285c.327 1.812.999 3.51 1.998 5.051l2.103-1.54-.007-.01a11.2 11.2 0 0 1-1.51-3.772q0-.008-.002-.014M7.506 14.148 5.13 13.081a13.8 13.8 0 0 0-.913 4.904q.002.179.017.353.007.107.012.214l2.586-.286v-.013l-.007-.11q-.006-.078-.007-.158c0-1.29.23-2.577.683-3.826zM5.918 11.339l2.39 1.073q.002-.008.006-.014A11.3 11.3 0 0 1 10.86 9.35l.009-.007-1.526-2.109a13.9 13.9 0 0 0-3.425 4.105M12.452 8.242a11.24 11.24 0 0 1 5.565-1.521h.002V4.12a13.8 13.8 0 0 0-7.107 2.02l1.527 2.11z"
				/>
			</svg>
		</a>
	{/if}

	<NavigationList items={bar} {transformHref} />
</div>

<Menu items={menu} popoverid="ext-primary-menu" horizontalMenuButton forceDarkModeMenuButton />

<style>
	:host {
		height: var(--external-navigation-bar-height, 30px);
		background: black;
		color: #e0e0e0;
		width: 100%;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0 0 12px;
		box-sizing: border-box;
	}

	a {
		color: inherit;
	}

	.left {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.left :global(.nav-list) {
		gap: 0.8rem !important;
		color-scheme: dark;
	}

	.left :global(.nav-list > li > a > span) {
		font-size: 13px;
		padding: 8px 0;
		font-weight: 500;
		font-variation-settings: 'wght' 460;
		text-align: center;
	}
</style>
