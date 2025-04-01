const prefix = 'osumania_Editor_';

export class Storage {
	public static set(name: string, value: string) {
		localStorage.setItem(prefix + name, value);
	}
	
	public static get(name: string) {
		return localStorage.getItem(prefix + name);
	}
}
