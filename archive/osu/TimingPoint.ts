import type { Integer, Decimal, Boolean, SampleSet} from './Types';

export class TimingPoint {
	/** Start time of the timing section, in milliseconds from the beginning of the beatmap's audio. The end of the timing section is the next timing point's time (or never, if this is the last timing point). */
	public time: Integer;
	/**
	 * This property has two meanings:
	 * - For uninherited timing points, the duration of a beat, in milliseconds.
	 * - For inherited timing points, a negative inverse slider velocity multiplier, as a percentage. For example, `-50` would make all sliders in this timing section twice as fast as `SliderMultiplier`.
	*/
	public beatLength: Decimal;
	/** Amount of beats in a measure. Inherited timing points ignore this property. */
	public meter: Integer;
	/** Default sample set for hit objects. */
	public sampleSet: SampleSet;
	/** Custom sample index for hit objects. `0` indicates osu!'s default hitsounds. */
	public sampleIndex: Integer;
	/** Volume percentage for hit objects. */
	public volume: Integer;
	/** Whether or not the timing point is ***un*inherited**. */
	public uninherited: Boolean;
	/** Bit flags that give the timing point extra effects. See [the effects section](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#effects). */
	public effects: Integer;
	
	constructor(time: Integer, beatLength: Decimal, meter: Integer, sampleSet: SampleSet, sampleIndex: Integer, volume: Integer, uninherited: Boolean, effects: Integer);
	constructor(data: String);
	constructor(data: String | Integer, beatLength?: Decimal, meter?: Integer, sampleSet?: SampleSet, sampleIndex?: Integer, volume?: Integer, uninherited?: Boolean, effects?: Integer) {
		if (typeof data === 'number' && beatLength !== undefined && meter !== undefined && sampleSet !== undefined && sampleIndex !== undefined && volume !== undefined && uninherited !== undefined && effects !== undefined) {
			this.time = data;
			this.beatLength = beatLength;
			this.meter = meter;
			this.sampleSet = sampleSet;
			this.sampleIndex = sampleIndex;
			this.volume = volume;
			this.uninherited = uninherited;
			this.effects = effects;
		} else if (typeof data === 'string') {
			const split = data.split(',');
			
			this.time = parseInt(split[0] ?? '');
			this.beatLength = parseInt(split[1] ?? '');
			this.meter = parseInt(split[2] ?? '');
			this.sampleSet = parseInt(split[3] ?? '');
			this.sampleIndex = parseInt(split[4] ?? '');
			this.volume = parseInt(split[5] ?? '');
			this.uninherited = split[6] === '1';
			this.effects = parseInt(split[7] ?? '');
		} else {
			throw new Error(`Failed to construct TimingPoint - invalid data "${data}"`);
		}
	}
	
	/** Convert to string (`time,beatLength,meter,sampleSet,sampleIndex,volume,uninherited,effects`) */
	public get string() {
		return `${this.time},${this.beatLength},${this.meter},${this.sampleSet},${this.sampleIndex},${this.volume},${this.uninherited ? 1 : 0},${this.effects}`;
	}
	
	/** Use this rather than `new TimingPoint`, this will automatically return an `InheritedTimingPoint` or an `UninheritedTimingPoint` */
	public static create(data: String): InheritedTimingPoint | UninheritedTimingPoint {
		const split = data.split(',');
		const time = parseInt(split[0] ?? '');
		const beatLength = parseInt(split[1] ?? '');
		const meter = parseInt(split[2] ?? '');
		const sampleSet = parseInt(split[3] ?? '');
		const sampleIndex = parseInt(split[4] ?? '');
		const volume = parseInt(split[5] ?? '');
		const uninherited = split[6] === '1';
		const effects = parseInt(split[7] ?? '');
		
		if (uninherited) {
			return new UninheritedTimingPoint(time, beatLength, meter, sampleSet, sampleIndex, volume, true, effects);
		} else {
			return new InheritedTimingPoint(time, beatLength, meter, sampleSet, sampleIndex, volume, false, effects);
		}
	}
}

export class InheritedTimingPoint extends TimingPoint {
	public uninherited: false;
	
	constructor(time: Integer, beatLength: Decimal, meter: Integer, sampleSet: SampleSet, sampleIndex: Integer, volume: Integer, _uninherited: false, effects: Integer) {
		super(time, beatLength, meter, sampleSet, sampleIndex, volume, false, effects);
		
		this.uninherited = false;
	}
	
	/** A negative **NON-INVERSE** slider velocity multiplier, as a percentage. For example, `200` would make all sliders in this timing section twice as fast as `SliderMultiplier`. Can be `NaN` if the timing point's beat length was `0` */
	public get sliderMultiplier() {
		return 100 / this.beatLength;
	}
	
	public makeUninherited(): TimingPoint {
		return new UninheritedTimingPoint(this.time, this.beatLength, this.meter, this.sampleSet, this.sampleIndex, this.volume, true, this.effects);
	}
}

export class UninheritedTimingPoint extends TimingPoint {
	public uninherited: true;
	
	constructor(time: Integer, beatLength: Decimal, meter: Integer, sampleSet: SampleSet, sampleIndex: Integer, volume: Integer, _uninherited: true, effects: Integer) {
		super(time, beatLength, meter, sampleSet, sampleIndex, volume, true, effects);
		
		this.uninherited = true;
	}
	
	public makeInherited(): TimingPoint {
		return new InheritedTimingPoint(this.time, this.beatLength, this.meter, this.sampleSet, this.sampleIndex, this.volume, false, this.effects);
	}
}
