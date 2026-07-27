/**
 * Rendering for the integration conformance report — a human-readable summary
 * for developers and a machine-readable JSON payload for CI.
 */

import { bold, cyan, gray, green, red, yellow } from '../colors';

import type { CheckResult, CheckStatus, ValidationReport } from './validate';

const STATUS_LABEL: Record< CheckStatus, string > = {
	pass: 'PASS',
	fail: 'FAIL',
	warn: 'WARN',
	not_applicable: 'N/A ',
};

function colorForStatus( status: CheckStatus, text: string ): string {
	switch ( status ) {
		case 'pass':
			return green( text );
		case 'fail':
			return red( text );
		case 'warn':
			return yellow( text );
		default:
			return gray( text );
	}
}

function formatCheck( result: CheckResult ): string {
	const label = colorForStatus( result.status, STATUS_LABEL[ result.status ] );
	const details = ( result.details ?? [] ).map( detail => gray( `        - ${ detail }` ) );
	return [
		`  ${ label }  Rule ${ result.rule }: ${ result.title }`,
		`        ${ result.message }`,
		...details,
	].join( '\n' );
}

export function formatHumanReport( report: ValidationReport ): string {
	const counts = report.results.reduce< Record< CheckStatus, number > >(
		( acc, result ) => {
			acc[ result.status ] += 1;
			return acc;
		},
		{ pass: 0, fail: 0, warn: 0, not_applicable: 0 }
	);

	const humanReviewLines = report.humanReview.flatMap( item => [
		`  ${ cyan( '•' ) } ${ item.title }`,
		gray( `    ${ item.reason }` ),
	] );

	const verdict = report.conformant
		? bold( green( '✓ Conformant — no automated checks failed.' ) )
		: bold( red( '✗ Not conformant — one or more automated checks failed.' ) );

	// A clean verdict must not hide that the config-safety rules never ran. When
	// no config constant was detected, rules 4-6 (including "missing/invalid
	// config won't fatal the site") are skipped, so a partner reading only the
	// summary would otherwise mistake a skip for a pass.
	const configWarning = report.configChecksSkipped
		? [
				bold(
					yellow(
						'⚠ Config checks (rules 4-6) did NOT run — no runtime config constant was detected.'
					)
				),
				yellow( '  If this integration uses runtime config, this is not a clean pass: adopt the' ),
				yellow(
					'  `Config::CONSTANT_NAME` / `VIP_*_CONFIG` convention so config safety can be verified.'
				),
		  ]
		: [];

	return [
		'',
		bold( `Integration conformance check: ${ report.path }` ),
		'',
		...report.results.map( formatCheck ),
		'',
		bold( 'Human review required (not automated):' ),
		...humanReviewLines,
		'',
		`Summary: ${ counts.pass } passed, ${ counts.fail } failed, ${ counts.warn } warnings, ${ counts.not_applicable } n/a.`,
		verdict,
		...configWarning,
		'',
	].join( '\n' );
}

export function formatJsonReport( report: ValidationReport ): string {
	return JSON.stringify( report, null, 2 );
}
