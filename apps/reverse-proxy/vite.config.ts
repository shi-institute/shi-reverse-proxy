import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  const outDir = 'dist/.cloudflare/worker';

  return {
    clearScreen: false,
    publicDir: 'public',
    plugins: [
      cloudflare(),
      dts({
        afterDiagnostic(diagnostics) {
          if (diagnostics.length > 0) {
            process.exit(1);
          }
        },
      }),
    ],
    build: {
      outDir,
      sourcemap: true,
      lib: {
        entry: 'src/worker.ts',
        formats: ['es'],
        fileName: 'index',
      },
    },
  } satisfies import('vite').UserConfig;
});
