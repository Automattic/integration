/**
 * JSON Schema for the VIP integration handoff manifest (`a8c-manifest.yaml`).
 *
 * This is the single source of truth for what a manifest may contain and the
 * constraints on each field. `manifest.ts` compiles it with Ajv and validates a
 * parsed manifest against it, so adding or tightening a rule means editing the
 * schema here — not hand-written checks. The Starter Kit ships an identical
 * `a8c-manifest.schema.json` so partners get the same contract in their editor.
 *
 * `additionalProperties: false` is set on every defined object on purpose: VIP
 * registers the integration from this file alone, so an unexpected or
 * mistyped key (`entryfile` for `entry_file`) is a mistake worth failing on, not
 * silently ignoring.
 *
 * The `documentation`, `telemetry`, and `release` sections mirror the shapes in
 * the draft VIP Integration Handoff spec, so this schema converges toward it
 * rather than forking a third variant.
 */

/** The `manifest_kind` value that identifies a handoff manifest. */
export const MANIFEST_KIND = 'vip-integration-handoff';

/**
 * Sentinel `vip-integration init` leaves in the manifest fields a partner must
 * fill by hand (contact, docs URLs). It is a valid value for its field so the
 * schema still passes — `validate` fails separately while any field's value
 * still contains it, forcing the partner to replace it before submitting.
 */
export const MANIFEST_PLACEHOLDER = 'REPLACE_ME';

/** Field types the Integration Center config form understands. */
export const FIELD_TYPES = [
	'string',
	'text',
	'url',
	'email',
	'number',
	'boolean',
	'secret',
	'enum',
] as const;

const SLUG_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';
const KEY_PATTERN = '^[a-z0-9]+(_[a-z0-9]+)*$';
// snake_case identifier used for telemetry event and property names.
const SNAKE_PATTERN = '^[a-z][a-z0-9_]*$';
// An absolute http(s) URL. A pattern (not `format: uri`) so it is enforced
// without pulling in ajv-formats.
const HTTP_URL_PATTERN = '^https?://.+';
// Semantic version matching the plugin header, with optional pre-release/build.
const SEMVER_PATTERN = '^[0-9]+\\.[0-9]+\\.[0-9]+([-+][A-Za-z0-9.-]+)?$';

export const MANIFEST_SCHEMA = {
	$id: 'https://automattic.github.io/vip-integration/a8c-manifest.schema.json',
	title: 'WordPress VIP Integration Handoff Manifest',
	description:
		'The single file a partner fills in so VIP can register and load their integration without reading the plugin source.',
	type: 'object',
	additionalProperties: false,
	required: [
		'manifest_version',
		'manifest_kind',
		'integration',
		'documentation',
		'runtime',
		'runtime_config',
		'release',
	],
	properties: {
		manifest_version: {
			const: 1,
			description: 'Manifest format version. Only "1" exists today.',
		},
		manifest_kind: {
			const: MANIFEST_KIND,
			description: 'Fixed discriminator identifying this file as a handoff manifest.',
		},
		integration: {
			type: 'object',
			additionalProperties: false,
			required: [ 'slug', 'display_name', 'summary', 'partner' ],
			properties: {
				slug: {
					type: 'string',
					pattern: SLUG_PATTERN,
					minLength: 3,
					maxLength: 63,
					description: 'Stable kebab-case identifier, unique across the Integration Center.',
				},
				display_name: {
					type: 'string',
					minLength: 1,
					maxLength: 60,
					description: 'Human-readable name shown in the Integration Center.',
				},
				summary: {
					type: 'string',
					minLength: 1,
					maxLength: 200,
					description: 'One-line description shown on the catalog card.',
				},
				partner: {
					type: 'object',
					additionalProperties: false,
					required: [ 'name', 'support_contact' ],
					properties: {
						name: {
							type: 'string',
							minLength: 1,
							description: 'Partner / vendor name.',
						},
						support_contact: {
							type: 'string',
							minLength: 1,
							description: 'Email address or support URL VIP can reach the partner at.',
						},
					},
				},
			},
		},
		documentation: {
			type: 'object',
			additionalProperties: false,
			required: [ 'public_url' ],
			description: 'Where VIP and customers find documentation for the integration.',
			properties: {
				public_url: {
					type: 'string',
					pattern: HTTP_URL_PATTERN,
					description: 'Customer- or administrator-facing documentation URL.',
				},
				support_url: {
					type: 'string',
					pattern: HTTP_URL_PATTERN,
					description: 'Optional troubleshooting / partner-support documentation URL.',
				},
			},
		},
		runtime: {
			type: 'object',
			additionalProperties: false,
			required: [ 'wordpress_plugin' ],
			properties: {
				wordpress_plugin: {
					type: 'object',
					additionalProperties: false,
					required: [ 'folder', 'entry_file', 'php_namespace', 'scope' ],
					properties: {
						folder: {
							type: 'string',
							pattern: SLUG_PATTERN,
							description: 'Plugin folder name VIP installs the integration into.',
						},
						entry_file: {
							type: 'string',
							pattern: '^[A-Za-z0-9._-]+\\.php$',
							description: 'Root plugin file (with the "Plugin Name:" header) VIP loads.',
						},
						php_namespace: {
							type: 'string',
							pattern: '^[A-Za-z_][A-Za-z0-9_]*(\\\\[A-Za-z_][A-Za-z0-9_]*)*$',
							description: 'Root PHP namespace the plugin autoloads under.',
						},
						scope: {
							enum: [ 'site', 'network' ],
							description: 'Whether the plugin loads per-site or network-wide.',
						},
					},
				},
			},
		},
		runtime_config: {
			type: 'object',
			additionalProperties: false,
			required: [ 'constant_name', 'fields' ],
			properties: {
				constant_name: {
					type: 'string',
					pattern: '^VIP_[A-Z0-9_]+_CONFIG$',
					description: 'The VIP-defined config constant the plugin reads, e.g. VIP_ACME_CONFIG.',
				},
				fields: {
					type: 'array',
					minItems: 1,
					description: 'The config fields the Integration Center renders and stores.',
					items: { $ref: '#/$defs/configField' },
				},
			},
		},
		telemetry: {
			type: 'object',
			additionalProperties: false,
			required: [ 'prefix', 'default_properties', 'events' ],
			description:
				'VIP Tracks events the integration records. Omit this section entirely if it records none.',
			properties: {
				prefix: {
					type: 'string',
					pattern: '^[a-z0-9_]+_$',
					description: 'Event name prefix, ending in an underscore, e.g. acme_widget_.',
				},
				default_properties: {
					type: 'array',
					uniqueItems: true,
					items: { type: 'string', pattern: SNAKE_PATTERN },
					description: 'Property names attached to every event.',
				},
				events: {
					type: 'array',
					minItems: 1,
					items: { $ref: '#/$defs/telemetryEvent' },
					description: 'The individual Tracks events. Declares names only, never captured values.',
				},
			},
		},
		release: {
			type: 'object',
			additionalProperties: false,
			required: [ 'plugin_version', 'version_strategy', 'migration_required', 'changelog' ],
			description: 'Metadata about the submitted plugin version.',
			properties: {
				plugin_version: {
					type: 'string',
					pattern: SEMVER_PATTERN,
					description: 'Semantic version matching the plugin header.',
				},
				version_strategy: {
					type: 'string',
					pattern: SNAKE_PATTERN,
					description: 'Release strategy identifier, e.g. latest or semantic_versioning.',
				},
				migration_required: {
					type: 'boolean',
					description: 'Whether this release requires migration work.',
				},
				changelog: {
					type: 'string',
					minLength: 1,
					description: 'Short description of what this release contains.',
				},
			},
		},
	},
	$defs: {
		configField: {
			type: 'object',
			additionalProperties: false,
			required: [ 'key', 'label', 'type' ],
			properties: {
				key: {
					type: 'string',
					pattern: KEY_PATTERN,
					description: 'snake_case key this value is stored under in the config array.',
				},
				label: {
					type: 'string',
					minLength: 1,
					description: 'Field label shown in the Integration Center form.',
				},
				type: {
					enum: [ ...FIELD_TYPES ],
					description: 'Input type. Use "secret" for values VIP must encrypt at rest.',
				},
				required: {
					type: 'boolean',
					description: 'Whether the field must be filled before the integration can activate.',
				},
				help: {
					type: 'string',
					description: 'Optional helper text shown under the field.',
				},
				default: {
					type: [ 'string', 'number', 'boolean' ],
					description: 'Optional default value pre-filled in the form.',
				},
				values: {
					type: 'array',
					minItems: 1,
					items: { type: 'string' },
					description: 'Allowed values. Required when "type" is "enum".',
				},
				autogen: {
					type: 'boolean',
					description: 'Whether the field is autogenerated and not editable by the customer.',
				},
				note: {
					type: 'string',
					minLength: 1,
					description: "Optional note on the field's purpose or usage. For internal use.",
				},
			},
			allOf: [
				{
					if: { properties: { type: { const: 'enum' } } },
					then: { required: [ 'values' ] },
				},
			],
		},
		telemetryEvent: {
			type: 'object',
			additionalProperties: false,
			required: [ 'name', 'type', 'trigger', 'properties' ],
			properties: {
				name: {
					type: 'string',
					pattern: SNAKE_PATTERN,
					description: 'Full event name, including the telemetry prefix.',
				},
				type: {
					enum: [ 'tracks' ],
					description: 'Telemetry channel. VIP integrations use Tracks only.',
				},
				trigger: {
					type: 'string',
					minLength: 1,
					description: 'What causes the event to fire.',
				},
				properties: {
					type: 'array',
					uniqueItems: true,
					items: { type: 'string', pattern: SNAKE_PATTERN },
					description: 'Property names recorded with the event (names only, no values).',
				},
				note: {
					type: 'string',
					minLength: 1,
					description: 'Optional note on why the event exists.',
				},
			},
		},
	},
} as const;
