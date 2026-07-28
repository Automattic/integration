/**
 * Handoff-manifest validation for VIP partner integrations.
 *
 * The handoff manifest (`a8c-manifest.yaml`) is the single file a partner fills
 * in so VIP can register and load their integration from the manifest alone —
 * without reading the plugin's code. VIP uses it to wire up the constant-backed
 * loader, the integration service registration + secret sync, and the
 * Integration Center catalog entry and config form.
 *
 * This module reads that file and validates it against `MANIFEST_SCHEMA`, the
 * JSON Schema that is the single source of truth for the manifest's shape and
 * constraints. It is a presence-and-shape check — it confirms the manifest
 * gives VIP everything it must have, in the right form, to register the
 * integration; it does not verify the values are correct (that a URL resolves,
 * a secret is real).
 */

import Ajv from 'ajv';
import { load } from 'js-yaml';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MANIFEST_PLACEHOLDER, MANIFEST_SCHEMA } from './manifest.schema';

import type { ErrorObject, ValidateFunction } from 'ajv';

/** Accepted manifest file names, checked at the integration root in order. */
export const MANIFEST_FILENAMES = [ 'a8c-manifest.yaml', 'a8c-manifest.yml' ];

export interface ManifestInspection {
	/** The manifest file name found at the root, or null when none exists. */
	file: string | null;
	/** Set when the file exists but is not parseable / not a mapping. */
	parseError: string | null;
	/** Human-readable schema violations. Empty when the manifest is conformant. */
	errors: string[];
	/** The parsed manifest, or null when it was missing / unparseable. */
	parsed: Record< string, unknown > | null;
	/** Dotted paths whose string value still contains the init placeholder. */
	placeholders: string[];
}

// One compiled validator, reused across every inspection. allowUnionTypes lets
// a field `default` accept a string, number, or boolean.
const ajv = new Ajv( { allErrors: true, allowUnionTypes: true } );
const validateManifest: ValidateFunction = ajv.compile( MANIFEST_SCHEMA );

function isRecord( value: unknown ): value is Record< string, unknown > {
	return typeof value === 'object' && value !== null && ! Array.isArray( value );
}

function findManifestFile( root: string ): string | null {
	for ( const name of MANIFEST_FILENAMES ) {
		if ( existsSync( join( root, name ) ) ) {
			return name;
		}
	}
	return null;
}

/** The dotted manifest location an Ajv error points at, e.g. `integration.slug`. */
function locationOf( error: ErrorObject ): string {
	const path = error.instancePath.replace( /^\//, '' ).replace( /\//g, '.' );
	return path === '' ? 'manifest' : path;
}

/** Turn one Ajv error into a message a partner can act on. */
function describeError( error: ErrorObject ): string {
	const where = locationOf( error );
	switch ( error.keyword ) {
		case 'required':
			return `${ where } is missing required field "${ error.params.missingProperty }".`;
		case 'additionalProperties':
			return `${ where } has unknown field "${ error.params.additionalProperty }".`;
		case 'const':
			return `${ where } must be ${ JSON.stringify( error.params.allowedValue ) }.`;
		case 'enum':
			return `${ where } must be one of: ${ ( error.params.allowedValues as unknown[] ).join(
				', '
			) }.`;
		case 'pattern':
			return `${ where } is malformed (must match ${ error.params.pattern }).`;
		case 'minItems':
			return `${ where } must have at least ${ error.params.limit } item(s).`;
		default:
			return `${ where } ${ error.message ?? 'is invalid' }.`;
	}
}

/** Collect dotted paths whose string value contains the init placeholder. */
function collectPlaceholders( value: unknown, path: string, out: string[] ): void {
	if ( typeof value === 'string' ) {
		if ( value.includes( MANIFEST_PLACEHOLDER ) ) {
			out.push( path );
		}
		return;
	}
	if ( Array.isArray( value ) ) {
		value.forEach( ( item, index ) => collectPlaceholders( item, `${ path }[${ index }]`, out ) );
		return;
	}
	if ( isRecord( value ) ) {
		for ( const [ key, child ] of Object.entries( value ) ) {
			collectPlaceholders( child, path === '' ? key : `${ path }.${ key }`, out );
		}
	}
}

/**
 * Read and validate the handoff manifest at `root`. Returns what was found so
 * the caller can render a conformance verdict; it never throws.
 */
export function inspectManifest( root: string ): ManifestInspection {
	const file = findManifestFile( root );
	if ( ! file ) {
		return { file: null, parseError: null, errors: [], parsed: null, placeholders: [] };
	}

	let parsed: unknown;
	try {
		parsed = load( readFileSync( join( root, file ), 'utf8' ) );
	} catch ( error ) {
		const reason = error instanceof Error ? error.message.split( '\n' )[ 0 ] : String( error );
		return { file, parseError: reason, errors: [], parsed: null, placeholders: [] };
	}
	if ( ! isRecord( parsed ) ) {
		return {
			file,
			parseError: 'manifest is not a YAML mapping',
			errors: [],
			parsed: null,
			placeholders: [],
		};
	}

	const placeholders: string[] = [];
	collectPlaceholders( parsed, '', placeholders );

	if ( validateManifest( parsed ) ) {
		return { file, parseError: null, errors: [], parsed, placeholders };
	}

	// De-duplicate: the `enum`/`if` combo can surface the same underlying issue twice.
	const errors = [ ...new Set( ( validateManifest.errors ?? [] ).map( describeError ) ) ];
	return { file, parseError: null, errors, parsed, placeholders };
}
