/**
 * Scaffolding transforms for `a8c-integration init`.
 *
 * Ports the Starter Kit's `composer setup` rewrite (bin/setup.php) into
 * TypeScript so scaffolding needs no PHP. It rewrites the example prefix set
 * ("ExampleVendor", "example-integration", "VIP_EXAMPLE_INTEGRATION", …) to the
 * partner's own names across the laid-down skeleton, then renames the entry
 * file. Kept as pure fs functions so the rewrite is unit-testable on its own,
 * separate from cloning the skeleton.
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/** Everything from this heading onward in a file is left un-rewritten: it is a
 * token table that must keep the example prefix so its mapping stays readable. */
const PRESERVE_MARKER = '## Making it your own';

/** Paths (relative, forward-slash) that must not be rewritten. Mirrors the
 * skip set in bin/setup.php: dependencies, lockfiles, the scaffolder itself,
 * and binary assets. */
const SKIP_PATTERN =
	/^(vendor\/|node_modules\/|bin\/setup\.php|composer\.lock|package-lock\.json|\.playwright\/)|\.(png|jpg|jpeg|gif|webp)$/;

export interface PrefixSet {
	vendorPascal: string;
	namePascal: string;
	vendorKebab: string;
	nameKebab: string;
	nameSnake: string;
	nameUpper: string;
	configConstant: string;
}

export function pascalCase( value: string ): string {
	return value
		.replace( /[^a-zA-Z0-9]+/g, ' ' )
		.toLowerCase()
		.split( ' ' )
		.filter( Boolean )
		.map( word => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
		.join( '' );
}

export function kebabCase( value: string ): string {
	return value
		.replace( /[^a-zA-Z0-9]+/g, '-' )
		.toLowerCase()
		.replace( /^-+|-+$/g, '' );
}

function wordsCase( kebab: string ): string {
	return kebab
		.split( '-' )
		.filter( Boolean )
		.map( word => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
		.join( ' ' );
}

/**
 * Derive the full prefix set from a vendor and integration name. Throws if
 * either would produce an invalid PHP namespace identifier (must start with a
 * letter or underscore), matching the guard in bin/setup.php.
 */
export function derivePrefixSet( vendor: string, name: string ): PrefixSet {
	if ( vendor.trim() === '' || name.trim() === '' ) {
		throw new Error( 'Vendor and integration name are both required.' );
	}

	const vendorPascal = pascalCase( vendor );
	const namePascal = pascalCase( name );

	for ( const [ label, identifier ] of [
		[ 'Vendor', vendorPascal ],
		[ 'Integration', namePascal ],
	] as const ) {
		if ( ! /^[A-Za-z_][A-Za-z0-9_]*$/.test( identifier ) ) {
			throw new Error(
				`${ label } name must start with a letter to produce a valid PHP namespace (got "${ identifier }").`
			);
		}
	}

	const nameKebab = kebabCase( name );
	const nameSnake = nameKebab.replace( /-/g, '_' );

	return {
		vendorPascal,
		namePascal,
		vendorKebab: kebabCase( vendor ),
		nameKebab,
		nameSnake,
		nameUpper: nameSnake.toUpperCase(),
		configConstant: `VIP_${ nameSnake.toUpperCase() }_CONFIG`,
	};
}

/** The ordered example-token → replacement map for a prefix set. */
export function buildReplacements( prefix: PrefixSet ): Array< [ string, string ] > {
	return [
		[ 'example-vendor/example-integration', `${ prefix.vendorKebab }/${ prefix.nameKebab }` ],
		[ 'ExampleVendor', prefix.vendorPascal ],
		[ 'ExampleIntegration', prefix.namePascal ],
		[ 'VIP_EXAMPLE_INTEGRATION', `VIP_${ prefix.nameUpper }` ],
		[ 'example_integration', prefix.nameSnake ],
		[ 'example-integration', prefix.nameKebab ],
		[ 'Example Integration', wordsCase( prefix.nameKebab ) ],
		[ 'Example Vendor', wordsCase( prefix.vendorKebab ) ],
	];
}

/**
 * Simultaneous, non-overlapping string replacement — PHP's `strtr` semantics.
 * At each position the longest matching key wins and its replacement is not
 * re-scanned, so an earlier substitution can never cascade into a later key.
 */
export function strtr( input: string, replacements: Array< [ string, string ] > ): string {
	const sorted = [ ...replacements ].sort(
		( first, second ) => second[ 0 ].length - first[ 0 ].length
	);
	let out = '';
	let pos = 0;

	outer: while ( pos < input.length ) {
		for ( const [ from, to ] of sorted ) {
			if ( from.length > 0 && input.startsWith( from, pos ) ) {
				out += to;
				pos += from.length;
				continue outer;
			}
		}
		out += input[ pos ];
		pos += 1;
	}

	return out;
}

/** Rewrite one file's contents, preserving everything from the marker onward. */
export function rewriteContents(
	contents: string,
	replacements: Array< [ string, string ] >
): string {
	const marker = contents.indexOf( PRESERVE_MARKER );
	if ( marker === -1 ) {
		return strtr( contents, replacements );
	}
	return strtr( contents.slice( 0, marker ), replacements ) + contents.slice( marker );
}

function listFiles( root: string ): string[] {
	const found: string[] = [];

	const walk = ( dir: string ): void => {
		for ( const entry of readdirSync( dir ) ) {
			if ( entry === '.git' ) {
				continue;
			}
			const full = join( dir, entry );
			if ( statSync( full ).isDirectory() ) {
				walk( full );
			} else {
				found.push( full );
			}
		}
	};

	walk( root );
	return found;
}

export interface ScaffoldResult {
	changed: number;
	entryFile: string | null;
	prefix: PrefixSet;
}

/**
 * Rewrite the example prefix set to the partner's names across the laid-down
 * skeleton at `root`, then rename the example entry file. Returns how many
 * files changed and the new entry file name.
 */
export function scaffoldTree( root: string, vendor: string, name: string ): ScaffoldResult {
	const prefix = derivePrefixSet( vendor, name );
	const replacements = buildReplacements( prefix );

	let changed = 0;
	for ( const file of listFiles( root ) ) {
		const relative = file
			.slice( root.length + 1 )
			.split( '\\' )
			.join( '/' );
		if ( SKIP_PATTERN.test( relative ) ) {
			continue;
		}

		const contents = readFileSync( file, 'utf8' );
		const updated = rewriteContents( contents, replacements );
		if ( updated !== contents ) {
			writeFileSync( file, updated );
			changed += 1;
		}
	}

	let entryFile: string | null = null;
	const exampleEntry = join( root, 'example-integration.php' );
	if ( existsSync( exampleEntry ) ) {
		entryFile = `${ prefix.nameKebab }.php`;
		renameSync( exampleEntry, join( root, entryFile ) );
	}

	removeRedundantScaffolder( root );

	return { changed, entryFile, prefix };
}

/**
 * `a8c-integration init` replaces the Starter Kit's own `composer setup`, so the
 * `bin/setup.php` scaffolder and its composer script are dead weight in a
 * generated integration — and re-running them would re-mangle the prefix set.
 * Drop both, leaving nothing that dangles.
 */
function removeRedundantScaffolder( root: string ): void {
	rmSync( join( root, 'bin', 'setup.php' ), { force: true } );

	const composerPath = join( root, 'composer.json' );
	if ( ! existsSync( composerPath ) ) {
		return;
	}

	type ComposerScripts = {
		scripts?: Record< string, unknown >;
		'scripts-descriptions'?: Record< string, unknown >;
	};
	let composer: ComposerScripts;
	try {
		composer = JSON.parse( readFileSync( composerPath, 'utf8' ) ) as ComposerScripts;
	} catch {
		// A malformed composer.json is the integration's problem, not ours to
		// rewrite; leave it untouched.
		return;
	}

	let touched = false;
	for ( const section of [ 'scripts', 'scripts-descriptions' ] as const ) {
		const bag = composer[ section ];
		if ( bag && Object.hasOwn( bag, 'setup' ) ) {
			delete bag.setup;
			touched = true;
		}
	}
	if ( touched ) {
		writeFileSync( composerPath, `${ JSON.stringify( composer, null, 2 ) }\n` );
	}
}
