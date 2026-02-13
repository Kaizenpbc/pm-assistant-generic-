import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    projects: [
      // Backend tests — node environment, no React aliases
      {
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          include: ['src/server/**/*.test.ts'],
          testTimeout: 30000,
        },
      },
      // Frontend tests — jsdom environment, React 18 from client
      {
        test: {
          name: 'client',
          globals: true,
          environment: 'jsdom',
          include: ['src/client/**/*.test.tsx'],
          testTimeout: 30000,
        },
        resolve: {
          alias: {
            'react': path.resolve(__dirname, 'src/client/node_modules/react'),
            'react-dom': path.resolve(__dirname, 'src/client/node_modules/react-dom'),
            'react/jsx-runtime': path.resolve(__dirname, 'src/client/node_modules/react/jsx-runtime'),
            'react/jsx-dev-runtime': path.resolve(__dirname, 'src/client/node_modules/react/jsx-dev-runtime'),
            '@tanstack/react-query': path.resolve(__dirname, 'src/client/node_modules/@tanstack/react-query'),
            'zustand': path.resolve(__dirname, 'src/client/node_modules/zustand'),
            '@testing-library/react': path.resolve(__dirname, 'src/client/node_modules/@testing-library/react'),
            '@testing-library/jest-dom': path.resolve(__dirname, 'src/client/node_modules/@testing-library/jest-dom'),
          },
        },
      },
    ],
  },
});
