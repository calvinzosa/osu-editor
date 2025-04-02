const pathSeperator = '\\';

export function getExtension(filePath: string) {
	return filePath.split(pathSeperator).at(-1)?.split('.').at(-1) ?? '';
}

export function getFileName(filePath: string) {
	return filePath.split(pathSeperator).at(-1)?.split('.').at(0) ?? '';
}

export function joinPaths(...args: Array<string>) {
	return args.join(pathSeperator);
}

//await path.extname(filePath) - does not work with files named like ".png" without an actual name, and also i dont like that it returns a Promise

export function dirName(path: string) {
	return path.split(pathSeperator).slice(0, -2).join(pathSeperator);
}
