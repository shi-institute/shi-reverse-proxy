export default {
	// These config options are used for the language server.
	// The options used during building are in esbuild.config.mjs.
	compilerOptions: {
		runes: true,
		experimental: {
			async: true,
		},
	},
};
