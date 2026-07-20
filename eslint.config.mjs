import wpvip from '@automattic/eslint-plugin-wpvip';

export default [
	...wpvip.configs.recommended,
	{
		files: [ 'src/**/*.ts', 'scripts/**/*.mjs', '__tests__/**/*.ts' ],
		rules: {
			// The CLI and its release script legitimately write to stdout/stderr.
			'no-console': 'off',
			// This is a local filesystem tool: it reads and writes paths it builds
			// itself (the target directory, files under a repo it is checking). The
			// security plugin's non-literal-fs and object-injection rules assume
			// server-side untrusted input, which does not apply here and would flag
			// every fs call and computed key. `detect-non-literal-regexp` stays on —
			// dynamic regexes are worth a reviewer's eye and are disabled inline.
			'security/detect-non-literal-fs-filename': 'off',
			'security/detect-object-injection': 'off',
		},
	},
	{
		ignores: [ 'dist/', 'coverage/' ],
	},
];
