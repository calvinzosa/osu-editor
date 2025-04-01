import { defineConfig } from 'vite';
import React from '@vitejs/plugin-react';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
	plugins: [React()],
	resolve: {
		alias: {
			'@': path.join(__dirname, 'src'),
		},
	},
	build: {
		assetsInlineLimit: 0,
	},
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: ['**/src-tauri/**'],
		},
	},
}));
