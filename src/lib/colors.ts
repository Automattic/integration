/**
 * Tiny ANSI color helper — a chalk-shaped subset, so the report renderer stays
 * dependency-free. Colors are disabled when output is not a TTY or NO_COLOR is
 * set, which also keeps them out of piped/CI output and test assertions.
 */

const enabled = Boolean( process.stdout.isTTY ) && ! process.env.NO_COLOR;

function wrap( open: number, close: number ): ( text: string ) => string {
	return ( text: string ): string =>
		enabled ? `\x1b[${ open }m${ text }\x1b[${ close }m` : text;
}

export const green = wrap( 32, 39 );
export const red = wrap( 31, 39 );
export const yellow = wrap( 33, 39 );
export const gray = wrap( 90, 39 );
export const cyan = wrap( 36, 39 );
export const bold = wrap( 1, 22 );
