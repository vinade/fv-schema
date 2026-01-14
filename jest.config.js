export default {
    testEnvironment: 'node',
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    // garante que TODOS os testes rodem
    bail: false,

    // APENAS este diretório conterá testes
    roots: ['<rootDir>/tests'],

    testMatch: [
        '**/*.spec.js'
    ],

    // coleta cobertura
    collectCoverage: true,
    coverageDirectory: 'coverage',

    // arquivos alvo da cobertura
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/index.js'
    ],

    // formatos de relatório
    coverageReporters: [
        'text',
        'html',
        'lcov'
    ],

    // timeout maior para testes async / stress
    testTimeout: 10000
};
