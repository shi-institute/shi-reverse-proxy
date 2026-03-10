import type { AST } from 'svelte/compiler';

type CustomElementProps = NonNullable<NonNullable<AST.Root['options']>['customElement']>['props'];

type ScriptProp = {
	name: string;
	required: boolean;
	default?: string;
};

type ManifestEntry = {
	customElementProps?: CustomElementProps;
	props?: ScriptProp[];
};
