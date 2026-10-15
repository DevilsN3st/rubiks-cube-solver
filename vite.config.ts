import { defineConfig, type Plugin } from 'vite';

/**
 * cubejs is CoffeeScript-compiled CommonJS wrapped in `(function(){ ... }).call(this)` and reads
 * `this.Cube` at the top level. Inside an ES module bundle `this` is undefined, so point it at globalThis.
 */
function cubejsThisFix(): Plugin {
  return {
    name: 'cubejs-this-fix',
    transform(code, id) {
      if (!/[\\/]cubejs[\\/]lib[\\/]/.test(id)) return null;
      return { code: code.replace(/\}\)\.call\(this\);/g, '}).call(globalThis);'), map: null };
    },
  };
}

export default defineConfig({
  plugins: [cubejsThisFix()],
  worker: {
    format: 'es',
    plugins: () => [cubejsThisFix()],
  },
  optimizeDeps: {
    rolldownOptions: {
      plugins: [cubejsThisFix()],
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
  },
});
