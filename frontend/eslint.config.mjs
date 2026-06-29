import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
    ...nextVitals,
    {
        rules: {
            // React Hooks v7 enables React Compiler-oriented rules by default.
            // Keep the existing lint contract focused on Next/core-web-vitals for this upgrade.
            'react-hooks/immutability': 'off',
            'react-hooks/refs': 'off',
            'react-hooks/set-state-in-effect': 'off',
        },
    },
    {
        ignores: [
            '.next/**',
            'out/**',
            'build/**',
            'next-env.d.ts',
            'tsconfig.tsbuildinfo',
        ],
    },
];

export default eslintConfig;
