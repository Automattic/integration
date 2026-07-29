/**
 * vip-integration — CLI to scaffold and validate WordPress VIP Integration
 * Center add-ons. Two commands: `init` (start a new integration from the
 * Starter Kit) and `validate` (check an integration for conformance).
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { red } from './lib/colors';

import type { InitOptions } from './commands/init';
import type { ValidateOptions } from './commands/validate';

function version(): string {
	try {
		const pkg = JSON.parse( readFileSync( join( __dirname, '..', 'package.json' ), 'utf8' ) ) as {
			version?: string;
		};
		return pkg.version ?? '0.0.0';
	} catch {
		return '0.0.0';
	}
}

export function run( argv: string[] = process.argv ): void {
	const program = new Command();

	program
		.name( 'vip-integration' )
		.description( 'Scaffold and validate WordPress VIP Integration Center add-ons.' )
		.version( version(), '-v, --version' )
		// Drop the built-in `help <command>` subcommand — `<command> --help` covers it.
		.helpCommand( false );

	program
		.command( 'init' )
		.description( 'Start a new integration by scaffolding from the VIP Integrations Starter Kit.' )
		.option( '--vendor <vendor>', 'Vendor name (e.g. "WordPress").' )
		.option( '--name <name>', 'Integration name (e.g. "Content Sync").' )
		.option( '--dir <dir>', 'Target directory (defaults to the integration slug).' )
		.action( async ( opts: InitOptions ) => {
			try {
				await initCommand( opts );
			} catch ( error ) {
				console.error( red( error instanceof Error ? error.message : String( error ) ) );
				process.exitCode = 1;
			}
		} );

	program
		.command( 'validate' )
		.argument( '[path]', 'Integration directory (defaults to the current directory).' )
		.description( 'Check a VIP integration for conformance before submitting it.' )
		.option( '--format <format>', 'Output format: "human" (default) or "json".', 'human' )
		.action( ( pathArg: string | undefined, opts: ValidateOptions ) =>
			validateCommand( pathArg, opts )
		);

	void program.parseAsync( argv );
}
