import { parseLatestReleaseTag } from '../src/commands/init';

const SOURCE = 'https://github.com/Automattic/vip-integrations-starter-kit.git';

/** Build `git ls-remote --tags --refs` style output from tag names (newest first). */
function lsRemote( ...tags: string[] ): string {
	return tags.map( ( tag, idx ) => `hash${ idx }\trefs/tags/${ tag }` ).join( '\n' );
}

describe( 'parseLatestReleaseTag', () => {
	it( 'takes the newest release when all tags are final', () => {
		expect( parseLatestReleaseTag( lsRemote( '1.0.2', '1.0.1', '1.0.0' ), SOURCE ) ).toBe(
			'1.0.2'
		);
	} );

	it( 'skips a pre-release that outranks the newest final release', () => {
		// The "first RC of a new version" case: 1.1.0 has no final tag yet, so
		// 1.1.0-rc1 sorts on top — we must fall through to 1.0.2.
		expect( parseLatestReleaseTag( lsRemote( '1.1.0-rc1', '1.0.2', '1.0.1' ), SOURCE ) ).toBe(
			'1.0.2'
		);
	} );

	it( "skips -dev tags (Andrea's vip-cli case)", () => {
		expect(
			parseLatestReleaseTag(
				lsRemote( '3.25.3-dev.0', '3.25.2', '2.40.0-dev.4', '2.39.7' ),
				SOURCE
			)
		).toBe( '3.25.2' );
	} );

	it( 'accepts a v-prefixed release tag', () => {
		expect( parseLatestReleaseTag( lsRemote( 'v2.3.0', 'v2.2.0' ), SOURCE ) ).toBe( 'v2.3.0' );
	} );

	it( 'trims trailing whitespace from the tag name', () => {
		expect( parseLatestReleaseTag( 'hash\trefs/tags/2.3.0\n', SOURCE ) ).toBe( '2.3.0' );
	} );

	it( 'throws when the remote lists no tags', () => {
		expect( () => parseLatestReleaseTag( '', SOURCE ) ).toThrow( /no release tags/ );
	} );

	it( 'throws when only pre-release tags exist', () => {
		expect( () => parseLatestReleaseTag( lsRemote( '1.1.0-rc1', '1.1.0-rc2' ), SOURCE ) ).toThrow(
			/no release tags/
		);
	} );

	it( 'throws when a line carries no tag ref', () => {
		expect( () => parseLatestReleaseTag( 'hash\trefs/heads/trunk', SOURCE ) ).toThrow(
			/no release tags/
		);
	} );
} );
