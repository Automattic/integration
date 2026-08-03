import { parseLatestReleaseTag } from '../src/commands/init';

const SOURCE = 'https://github.com/Automattic/vip-integrations-starter-kit.git';

describe( 'parseLatestReleaseTag', () => {
	it( 'takes the bare name of the first (newest) tag', () => {
		const output = [
			'abc123\trefs/tags/1.0.2',
			'def456\trefs/tags/1.0.1',
			'ghi789\trefs/tags/1.0.0',
		].join( '\n' );
		expect( parseLatestReleaseTag( output, SOURCE ) ).toBe( '1.0.2' );
	} );

	it( 'trims trailing whitespace from the tag name', () => {
		expect( parseLatestReleaseTag( 'abc123\trefs/tags/2.3.0\n', SOURCE ) ).toBe( '2.3.0' );
	} );

	it( 'throws when the remote lists no tags', () => {
		expect( () => parseLatestReleaseTag( '', SOURCE ) ).toThrow( /no release tags/ );
	} );

	it( 'throws when a line carries no tag ref', () => {
		expect( () => parseLatestReleaseTag( 'abc123\trefs/heads/trunk', SOURCE ) ).toThrow(
			/no release tags/
		);
	} );
} );
