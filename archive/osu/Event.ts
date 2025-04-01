import type { EventType, Integer, String } from './Types';

/**
 * Recommended to use `BeatmapBackgroundEvent`, `BeatmapVideoEvent`, or `BeatmapBreakEvent`
 * 
 * ## Storyboards
 * For information about storyboard syntax, see [Storyboard Scripting](https://osu.ppy.sh/wiki/en/Storyboard/Scripting).
 * 
 * Storyboards can be defined in a separate optional storyboard file with the `.osb` extension. External storyboards are shared between all difficulties in a beatmap.
 * 
 * Each beatmap may contain its own difficulty-specific storyboard, either in conjunction with the external storyboard or by itself.
*/
export class BeatmapEvent {
	/** Type of the event. Some events may be referred to by either a name or a number (To process different storyboard event names, use `eventType as string`) */
	public eventType: EventType;
	/** Start time of the event, in milliseconds from the beginning of the beatmap's audio. For events that do not use a start time, the default is `0`. */
	public startTime: Integer;
	/** Extra parameters specific to the event's type */
	public eventParams: Array<String>;
	
	constructor(eventType: typeof this.eventType, startTime: Integer, eventParams: Array<String>);
	constructor(data: String);
	constructor(data: String, startTime?: Integer, eventParams?: Array<String>) {
		if (startTime !== undefined && eventParams !== undefined) {
			this.eventType = data as any;
			this.startTime = startTime;
			this.eventParams = eventParams;
		} else {
			const split = data.split(',');
			this.eventType = split[0] as any;
			this.startTime = parseInt(split[1]);
			this.eventParams = split.slice(2);
		}
	}
	
	/** Convert to string (`eventType,startTime,...eventParams`) */
	public get string() {
		return `${this.eventType},${this.startTime},${this.eventParams.join(',')}`;
	}
	
	/** Use this rather than `new TimingPoint`, this will automatically return an `BeatmapBackgroundEvent`, `BeatmapVideoEvent`, `BeatmapBreakEvent`, or `BeatmapEvent` for different `EventType`s */
	public static create(data: String): BeatmapBackgroundEvent | BeatmapVideoEvent | BeatmapBreakEvent | BeatmapEvent {
		const split = data.split(',');
		const eventType = split[0] as EventType;
		const startTime = parseInt(split[1]);
		const eventParams = split.slice(2);
		
		switch (eventType) {
			case '0': {
				return new BeatmapBackgroundEvent(eventType, startTime, eventParams);
			}
			case 'Video':
			case '1': {
				return new BeatmapVideoEvent(eventType, startTime, eventParams);
			}
			case 'Break':
			case '2': {
				return new BeatmapBreakEvent(eventType, startTime, eventParams);
			}
			default: {
				return new BeatmapEvent(data);
			}
		}
	}
}

export class BeatmapBackgroundEvent extends BeatmapEvent {
	public eventType: '0';
	/** Location of the background image relative to the beatmap directory. Double quotes are usually included surrounding the filename, but they are not required. */
	public filename: String;
	/** Offset in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) from the centre of the screen. For example, an offset of `50,100` would have the background shown 50 osu! pixels to the right and 100 osu! pixels down from the centre of the screen. If the offset is `0,0`, writing it is optional. */
	public xOffset: Integer;
	/** Offset in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) from the centre of the screen. For example, an offset of `50,100` would have the background shown 50 osu! pixels to the right and 100 osu! pixels down from the centre of the screen. If the offset is `0,0`, writing it is optional. */
	public yOffset: Integer;
	
	constructor(eventType: '0', startTime: Integer, eventParams: Array<String>) {
		super(eventType, startTime, eventParams);
		
		this.eventType = eventType;
		this.filename = this.eventParams[0];
		this.xOffset = parseInt(this.eventParams[1] ?? '');
		this.yOffset = parseInt(this.eventParams[2] ?? '');
	}
	
	/** Convert to string (`0,startTime,filename,xOffset,yOffset`) */
	public get string() {
		return `0,${this.startTime},${this.filename},${this.xOffset},${this.yOffset}`;
	}
}

export class BeatmapVideoEvent extends BeatmapEvent {
	public eventType: '1' | 'Video';
	/** Location of the background video relative to the beatmap directory. Double quotes are usually included surrounding the filename, but they are not required. */
	public filename: String;
	/** Offset in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) from the centre of the screen. For example, an offset of `50,100` would have the background shown 50 osu! pixels to the right and 100 osu! pixels down from the centre of the screen. If the offset is `0,0`, writing it is optional. */
	public xOffset: Integer;
	/** Offset in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) from the centre of the screen. For example, an offset of `50,100` would have the background shown 50 osu! pixels to the right and 100 osu! pixels down from the centre of the screen. If the offset is `0,0`, writing it is optional. */
	public yOffset: Integer;
	
	constructor(eventType: '1' | 'Video', startTime: Integer, eventParams: Array<String>) {
		super(eventType, startTime, eventParams);
		
		this.eventType = eventType;
		this.filename = this.eventParams[0];
		this.xOffset = parseInt(this.eventParams[1] ?? '');
		this.yOffset = parseInt(this.eventParams[2] ?? '');
	}
	
	/** Convert to string (`1|Video,startTime,filename,xOffset,yOffset`) */
	public get string() {
		return `${this.eventType},${this.startTime},${this.filename},${this.xOffset},${this.yOffset}`;
	}
}

export class BeatmapBreakEvent extends BeatmapEvent {
	public eventType: '2' | 'Break';
	/** End time of the break, in milliseconds from the beginning of the beatmap's audio. */
	public endTime: Integer;
	
	constructor(eventType: '2' | 'Break', startTime: Integer, eventParams: Array<String>) {
		super(eventType, startTime, eventParams);
		
		this.eventType = eventType;
		this.endTime = parseInt(this.eventParams[0] ?? '');
	}
	
	/** Convert to string (`2|Break,startTime,filename,xOffset,yOffset`) */
	public get string() {
		return `${this.eventType},${this.startTime},${this.endTime}`;
	}
}
