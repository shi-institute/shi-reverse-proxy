<svelte:options
	customElement={{
		props: {
			size: { reflect: true, type: 'Number', attribute: 'size' },
			strokeColor: { reflect: true, type: 'String', attribute: 'stroke-color' },
		},
	}}
/>

<script module>
	export interface ProgressRingProps {
		size?: number;
		strokeColor?: string;
	}
</script>

<script lang="ts">
	let { size = 32, strokeColor = 'currentColor' }: ProgressRingProps = $props();
</script>

<svg class="progress-ring indeterminate" width={size} height={size} viewBox="0 0 16 16" role="status">
	<circle cx="50%" cy="50%" r="7" stroke-dasharray="3" style="stroke: {strokeColor}" />
</svg>

<style>
	:host {
		display: block;
	}

	svg circle {
		fill: none;
		stroke: light-dark(black, white);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-dasharray: 43.97;
		transform: rotate(-90deg);
		transform-origin: 50% 50%;
		transition: all var(--shi-transition-250ms) linear;
		animation: progress-ring-animation var(--shi-transition-2s) linear infinite;
	}

	@keyframes progress-ring-animation {
		0% {
			stroke-dasharray: 0.01px 43.97px;
			transform: rotate(0);
		}

		50% {
			stroke-dasharray: 21.99px 21.99px;
			transform: rotate(450deg);
		}

		100% {
			stroke-dasharray: 0.01px 43.97px;
			transform: rotate(3turn);
		}
	}
</style>
