export function boolToInt(bool: boolean) {
	return bool ? 1 : 0;
}

export function intToBits(int: number, totalBits: number) {
	const bits = new Array<boolean>(totalBits);
	
	for (let i = 0; i < totalBits; i++) {
		bits[i] = (int & (1 << i)) !== 0;
	}
	
	return bits;
}

export function bitsToInt(bits: Array<boolean>) {
	let n = 0;
	
	for (let i = 0; i < bits.length; i++) {
		n |= boolToInt(bits[i]) << i;
	}
	
	return n;
}
