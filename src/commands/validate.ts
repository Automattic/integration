/**
 * `vip-integration validate [path]` — run the conformance checker against an
 * integration directory and print a human or JSON report. Exit code is 1 when
 * the integration is not conformant, so it gates CI.
 */

import { resolve } from 'node:path';

import { red } from '../lib/colors';
import { formatHumanReport, formatJsonReport } from '../lib/validate/report';
import { looksLikeIntegration, validateIntegration } from '../lib/validate/validate';

export interface ValidateOptions {
	format?: string;
}

export function validateCommand( pathArg: string | undefined, opts: ValidateOptions = {} ): void {
	const root = resolve( pathArg ?? process.cwd() );

	const format = opts.format ?? 'human';
	if ( format !== 'human' && format !== 'json' ) {
		console.error( red( `Unknown --format "${ format }". Use "human" or "json".` ) );
		process.exitCode = 1;
		return;
	}
	const asJson = format === 'json';

	if ( ! looksLikeIntegration( root ) ) {
		const message = `No integration found at ${ root } (expected a composer.json or a plugin entry file).`;
		if ( asJson ) {
			console.log( JSON.stringify( { path: root, error: message }, null, 2 ) );
		} else {
			console.error( red( message ) );
		}
		process.exitCode = 1;
		return;
	}

	const report = validateIntegration( root );
	console.log( asJson ? formatJsonReport( report ) : formatHumanReport( report ) );

	if ( ! report.conformant ) {
		process.exitCode = 1;
	}
}
