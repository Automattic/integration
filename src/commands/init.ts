/**
 * `a8c-integration init` — start a new integration.
 *
 * Lays down the VIP Integrations Starter Kit as the project skeleton, collects
 * the same inputs `composer setup` collects (vendor + integration name), then
 * rewrites the example prefix set to the partner's names. The result is a
 * ready-to-edit integration; the developer runs `a8c-integration validate` when
 * they are ready to check conformance.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { bold, cyan, gray, green } from '../lib/colors';
import { derivePrefixSet, kebabCase, scaffoldTree } from '../lib/scaffold/scaffold';

const STARTER_KIT_URL = 'https://github.com/Automattic/vip-integrations-starter-kit.git';

/**
 * Internal offline-test override for the Starter Kit source (a local path or
 * URL). Deliberately not a CLI option: the source is never the user's choice —
 * `init` always builds from the canonical VIP Starter Kit.
 */
const STARTER_KIT_SOURCE_ENV = 'A8C_STARTER_KIT_SOURCE';

export interface InitOptions {
	vendor?: string;
	name?: string;
	dir?: string;
}

async function prompt( label: string ): Promise< string > {
	const rl = createInterface( { input: process.stdin, output: process.stdout } );
	try {
		return ( await rl.question( `${ label }: ` ) ).trim();
	} finally {
		rl.close();
	}
}

/** Resolve a required input from a flag or an interactive prompt. Errors in a
 * non-interactive shell instead of hanging on a prompt nobody can answer. */
async function resolveInput( label: string, provided: string | undefined ): Promise< string > {
	if ( typeof provided === 'string' && provided.trim() !== '' ) {
		return provided.trim();
	}
	if ( ! process.stdin.isTTY ) {
		throw new Error(
			`Missing ${ label }. Pass it as a flag (e.g. --vendor, --name) when running non-interactively.`
		);
	}
	return prompt( label );
}

function isEmptyOrMissing( dir: string ): boolean {
	return ! existsSync( dir ) || readdirSync( dir ).length === 0;
}

/**
 * Lay the canonical VIP Starter Kit down into `target` and drop its git history,
 * leaving a clean tree. Clones the repo's default branch shallowly (only the
 * tip, no history), then removes `.git`. The source is fixed to the Starter Kit
 * URL; the env override exists only so tests can run offline against a local
 * clone.
 */
function laySkeleton( target: string ): void {
	const override = process.env[ STARTER_KIT_SOURCE_ENV ];
	const source = override ?? STARTER_KIT_URL;
	const isRemote = /^[a-z]+:\/\/|^git@|\.git$/i.test( source );
	// Shallow-clone remotes so no history is pulled; a local override path is
	// cloned plainly (git ignores --depth for local paths and warns).
	const depth = isRemote ? [ '--depth', '1' ] : [];
	// `--` ends option parsing so the source can never be read as a git flag.
	execFileSync( 'git', [ 'clone', ...depth, '--quiet', '--', source, target ], {
		stdio: [ 'ignore', 'ignore', 'inherit' ],
	} );
	rmSync( resolve( target, '.git' ), { recursive: true, force: true } );
}

export async function initCommand( opts: InitOptions = {} ): Promise< void > {
	const vendor = await resolveInput( 'Vendor name (e.g. "Wordpress")', opts.vendor );
	const name = await resolveInput( 'Integration name (e.g. "Content Sync")', opts.name );

	// Validate the names before touching the filesystem, so bad input fails fast
	// instead of leaving a half-laid-down directory behind.
	derivePrefixSet( vendor, name );

	const target = resolve( opts.dir ?? kebabCase( name ) );
	if ( ! isEmptyOrMissing( target ) ) {
		throw new Error( `Target directory is not empty: ${ target }` );
	}

	console.log( gray( `Laying down the VIP Starter Kit into ${ target } …` ) );
	laySkeleton( target );

	const { entryFile, prefix } = scaffoldTree( target, vendor, name );

	// Give the fresh project its own clean git history.
	try {
		execFileSync( 'git', [ 'init', '--quiet' ], { cwd: target, stdio: 'ignore' } );
	} catch {
		// git init is a nicety; a scaffold without it is still usable.
	}

	console.log( green( `\n✓ Created ${ prefix.namePascal } integration at ${ target }` ) );
	console.log(
		gray(
			`  slug=${ prefix.nameKebab }, namespace=${ prefix.vendorPascal }\\${ prefix.namePascal }, config=${ prefix.configConstant }` +
				( entryFile ? `, entry=${ entryFile }` : '' )
		)
	);

	console.log( bold( '\nNext steps:' ) );
	for ( const step of [
		`cd ${ target }`,
		'composer install && npm install',
		'Edit the integration, then run: a8c-integration validate',
	] ) {
		console.log( `  ${ cyan( '→' ) } ${ step }` );
	}
}
