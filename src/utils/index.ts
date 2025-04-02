export function clamp(x: number, min: number, max: number): number {
	return Math.max(Math.min(x, max), min);
}

export function reverseArr<T>(arr: Array<T>): Array<T> {
	return arr.map((_, i, arr) => arr[arr.length - i - 1]);
}

export function intToBits(n: number, totalBits: number): Array<boolean> {
	const bits = new Array<boolean>();
	for (let i = 0; i < totalBits; i++) {
		bits.push((n & (2 ** i)) !== 0);
	}
	
	return bits;
}
