/**
 * Handoff-manifest validation for VIP partner integrations.
 *
 * The handoff manifest (`vip-handoff.yaml`) is the single file a partner fills
 * in so VIP can register and load their integration from the manifest alone —
 * without reading the plugin's code. VIP uses it to wire up the constant-backed
 * loader, the integration service registration + secret sync, and the
 * Integration Center catalog entry and config form.
 *
 * This module reads that file and checks that every field VIP needs for that
 * registration is present and well-formed. It is deliberately a presence and
 * shape check — it does not verify the values are correct (that a URL resolves,
 * a secret is real), only that the manifest gives VIP everything it must have
 * to register the integration without the plugin source.
 */

import { load } from 'js-yaml';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Accepted manifest file names, checked at the integration root in order. */
export const MANIFEST_FILENAMES = [ 'vip-handoff.yaml', 'vip-handoff.yml' ];

/** The `manifest_kind` value that identifies a handoff manifest. */
const MANIFEST_KIND = 'vip-integration-handoff';

/** `runtime.wordpress_plugin.scope` values VIP knows how to load. */
const VALID_SCOPES = [ 'site', 'network' ];

export interface ManifestInspection {
	/** The manifest file name found at the root, or null when none exists. */
	file: string | null;
	/** Set when the file exists but is not parseable / not a mapping. */
	parseError: string | null;
	/** Required fields VIP consumes that are absent or empty. */
	missing: string[];
	/** Fields that are present but malformed (wrong shape or value). */
	problems: string[];
}

/** Required scalar paths, as dotted keys into the parsed manifest. */
const REQUIRED_FIELDS = [
	'manifest_version',
	'manifest_kind',
	'integration.slug',
	'integration.display_name',
	'integration.summary',
	'integration.partner.name',
	'integration.partner.support_contact',
	'runtime.wordpress_plugin.folder',
	'runtime.wordpress_plugin.entry_file',
	'runtime.wordpress_plugin.php_namespace',
	'runtime.wordpress_plugin.scope',
	'runtime_config.constant_name',
];

function isRecord( value: unknown ): value is Record< string, unknown > {
	return typeof value === 'object' && value !== null && ! Array.isArray( value );
}

/** Read a dotted path out of a parsed manifest, or undefined if any hop misses. */
function getPath( root: Record< string, unknown >, path: string ): unknown {
	let current: unknown = root;
	for ( const key of path.split( '.' ) ) {
		if ( ! isRecord( current ) ) {
			return undefined;
		}
		current = current[ key ];
	}
	return current;
}

/** A scalar counts as present only when it is not null/undefined and, for
 * strings, not blank. */
function isPresent( value: unknown ): boolean {
	if ( value === undefined || value === null ) {
		return false;
	}
	return typeof value === 'string' ? value.trim() !== '' : true;
}

function findManifestFile( root: string ): string | null {
	for ( const name of MANIFEST_FILENAMES ) {
		if ( existsSync( join( root, name ) ) ) {
			return name;
		}
	}
	return null;
}

/** Check the shape of `runtime_config.fields`, appending any issues found. */
function inspectConfigFields( manifest: Record< string, unknown >, problems: string[] ): void {
	const fields = getPath( manifest, 'runtime_config.fields' );
	if ( fields === undefined ) {
		problems.push( 'runtime_config.fields is missing — declare at least one config field.' );
		return;
	}
	if ( ! Array.isArray( fields ) || fields.length === 0 ) {
		problems.push( 'runtime_config.fields must be a non-empty list of config fields.' );
		return;
	}

	fields.forEach( ( field, index ) => {
		const label = `runtime_config.fields[${ index }]`;
		if ( ! isRecord( field ) ) {
			problems.push( `${ label } is not a mapping.` );
			return;
		}
		for ( const key of [ 'key', 'label', 'type' ] as const ) {
			if ( ! isPresent( field[ key ] ) ) {
				problems.push( `${ label } is missing "${ key }".` );
			}
		}
		// An enum field is unusable in the Integration Center form without its
		// allowed values, so require them explicitly.
		if ( field.type === 'enum' ) {
			const values = field.values;
			if ( ! Array.isArray( values ) || values.length === 0 ) {
				problems.push( `${ label } is an enum but declares no "values".` );
			}
		}
	} );
}

/**
 * Read and validate the handoff manifest at `root`. Returns what was found so
 * the caller can render a conformance verdict; it never throws.
 */
export function inspectManifest( root: string ): ManifestInspection {
	const file = findManifestFile( root );
	if ( ! file ) {
		return { file: null, parseError: null, missing: [], problems: [] };
	}

	let parsed: unknown;
	try {
		parsed = load( readFileSync( join( root, file ), 'utf8' ) );
	} catch ( error ) {
		const reason = error instanceof Error ? error.message.split( '\n' )[ 0 ] : String( error );
		return { file, parseError: reason, missing: [], problems: [] };
	}
	if ( ! isRecord( parsed ) ) {
		return { file, parseError: 'manifest is not a YAML mapping', missing: [], problems: [] };
	}

	const missing = REQUIRED_FIELDS.filter( path => ! isPresent( getPath( parsed, path ) ) );

	const problems: string[] = [];
	const kind = getPath( parsed, 'manifest_kind' );
	if ( isPresent( kind ) && kind !== MANIFEST_KIND ) {
		problems.push( `manifest_kind must be "${ MANIFEST_KIND }" (got "${ String( kind ) }").` );
	}
	const scope = getPath( parsed, 'runtime.wordpress_plugin.scope' );
	if ( isPresent( scope ) && ! VALID_SCOPES.includes( String( scope ) ) ) {
		problems.push(
			`runtime.wordpress_plugin.scope must be one of ${ VALID_SCOPES.join( '/' ) } (got "${ String(
				scope
			) }").`
		);
	}
	const constant = getPath( parsed, 'runtime_config.constant_name' );
	if ( isPresent( constant ) && ! /^VIP_[A-Z0-9_]+_CONFIG$/.test( String( constant ) ) ) {
		problems.push(
			`runtime_config.constant_name must match VIP_*_CONFIG (got "${ String( constant ) }").`
		);
	}
	inspectConfigFields( parsed, problems );

	return { file, parseError: null, missing, problems };
}
