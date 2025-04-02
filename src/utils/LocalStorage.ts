const namePrefix = 'osumania_Editor_';

export class Storage {
	public static set(name: string, value: any) {
		localStorage.setItem(namePrefix + name, JSON.stringify(value));
	}
	
	public static get<T extends any>(name: string, defaultValue: T): T;
	public static get<T extends any>(name: string): T | null;
	public static get<T extends any>(name: string, defaultValue?: T): T | null {
		const item = localStorage.getItem(namePrefix + name);
		if (item !== null) {
			try {
				return JSON.parse(item) as T;
			} catch (err) {
				console.log(`Failed to parse JSON in localStorage key "${name}", saved value:`, item);
			}
		}
		
		if (defaultValue !== undefined) {
			return defaultValue;
		}
		
		return null;
	}
}
