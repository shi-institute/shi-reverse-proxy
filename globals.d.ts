export {};

declare global {
	interface Window {
		wp: {
			blocks: typeof import('@wordpress/blocks');
			blockEditor: typeof import('@wordpress/block-editor');
			element: typeof import('@wordpress/element');
			data: typeof import('@wordpress/data');
			i18n: typeof import('@wordpress/i18n');
			components: typeof import('@wordpress/components');
			compose: typeof import('@wordpress/compose');
			coreData: typeof import('@wordpress/core-data');
		};
	}

	const wp: Window['wp'];
}
