<svelte:options customElement={{}} />

<script lang="ts" module>
	import type { NavigationListItem } from './navigation-bar-parts/NavigationList.svelte';
	import NavigationList from './navigation-bar-parts/NavigationList.svelte';

	export interface AdminBarBarProps {
		adminHref: string;
	}
</script>

<script lang="ts">
	let { adminHref }: AdminBarBarProps = $props();

	let pageOrPostId = $state<number>();
	$effect(() => {
		if (document.body.classList.value.includes('page-id-')) {
			const match = document.body.classList.value.match(/page-id-(\d+)/);
			if (match?.[1]) {
				pageOrPostId = parseInt(match[1], 10);
			}
		}

		if (document.body.classList.value.includes('postid-')) {
			const match = document.body.classList.value.match(/postid-(\d+)/);
			if (match?.[1]) {
				pageOrPostId = parseInt(match[1], 10);
			}
		}
	});

	let visible = $state(false);
	$effect(() => {
		visible = localStorage.getItem('adminBarVisible') === 'true';

		window.addEventListener('storage', (event) => {
			if (event.key === 'adminBarVisible') {
				visible = event.newValue === 'true';
			}
		});

		// @ts-expect-error
		window.addEventListener('adminBarVisibleChanged', (event: CustomEvent) => {
			if (typeof event.detail === 'boolean') {
				visible = event.detail;
			}
		});
	});

	$effect(() => {
		if (visible) {
			document.body.classList.add('admin-bar');
			document.documentElement.style.setProperty('--wp-admin--admin-bar--height', '32px');
			document.documentElement.style.marginTop = 'var(--wp-admin--admin-bar--height)';
		} else {
			document.body.classList.remove('admin-bar');
			document.documentElement.style.removeProperty('--wp-admin--admin-bar--height');
			document.documentElement.style.removeProperty('margin-top');
		}
	});

	const items: NavigationListItem[] = $derived([
		{
			label: 'Dashboard',
			href: adminHref,
		},
		{
			label: 'Edit Site',
			href: `${adminHref}/site-editor.php`,
		},
		{
			label: 'Edit Page',
			href: pageOrPostId ? `${adminHref}/post.php?post=${pageOrPostId}&action=edit` : adminHref,
		},
	]);
</script>

<div class:visible>
	<NavigationList {items} />
</div>

<style>
	:host {
		display: contents;
	}

	div {
		height: 32px;
		position: fixed;
		top: 0;
		background: black;
		width: 100%;
		z-index: 1000;
		display: none;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		box-sizing: border-box;
		color-scheme: dark;
	}
	div.visible {
		display: flex;
	}

	:global(.nav-list) {
		gap: 1.25rem !important;
	}

	:global(.nav-list > li > a > span) {
		font-size: 13px;
		padding: 8px 0;
	}
</style>
