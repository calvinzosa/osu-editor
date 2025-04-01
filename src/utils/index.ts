export function clamp(x: number, min: number, max: number): number {
	return Math.max(Math.min(x, max), min);
}

export function reverseArr<T>(arr: Array<T>): Array<T> {
	return arr.map((_, i, arr) => arr[arr.length - i - 1]);
}
