import terser from '@rollup/plugin-terser';

export default [
    // Build para browser (ESM)
    {
        input: 'src/index.js',
        output: {
            file: 'dist/fv-schema.js',
            format: 'esm',
        }
    },

    // Build minificado
    {
        input: 'src/index.js',
        output: {
            file: 'dist/fv-schema.min.js',
            format: 'esm',
            plugins: [terser()]
        }
    },

    // UMD
    {
        input: 'src/index.js',
        output: {
            file: 'dist/fv-schema.umd.js',
            format: 'umd',
            name: 'FVSchema',
            plugins: [terser()] // minificado
        }
    }
];
