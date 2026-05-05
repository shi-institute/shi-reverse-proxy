import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      afterDiagnostic(diagnostics) {
        if (diagnostics.length > 0) {
          process.exit(1);
        }
      },
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['node:async_hooks'],
      output: {
        minify: false,
      },
    },
  },
});
