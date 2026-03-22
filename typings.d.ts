declare module 'https://esm.run/zod' {
	import z from 'zod';
	export { z };
}

declare module 'https://esm.run/xss' {
	import xss from 'xss';
	export default xss;
}

declare module '*.css' {
	const content: string;
	export default content;
}

declare module '*.html' {
	const content: string;
	export default content;
}
