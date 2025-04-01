import { bitsToInt, intToBits } from './Utils';

import type { Integer, HitObjectTypeBits, HitSoundBits, String, CurveType, Point2D, Decimal } from './Types';

/** See [this page](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#hit-objects) for more information */
export class HitObject {
	/** Position in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) of the object. */
	public x: Integer;
	/** Position in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) of the object. */
	public y: Integer;
	/** Time when the object is to be hit, in milliseconds from the beginning of the beatmap's audio. */
	public time: Integer;
	/**
	 * Bit flags indicating the type of the object.
	 * ## Type
	 * The hit object's type parameter is an 8-bit integer where each bit is a flag with special meaning.
	 * 
	 * Bit index `0` - Marks the object as a hit circle
	 * 
	 * Bit index `1` - Marks the object as a slider
	 * 
	 * Bit index `2` - Marks the start of a new combo
	 * 
	 * Bit index `3` - Marks the object as a spinner
	 * 
	 * Bit indices `4`, `5`, `6` - A 3-bit integer specifying how many combo colours to skip, a practice referred to as "colour hax". *Only relevant if the object starts a new combo*.
	 * 
	 * Bit index `7` - Marks the object as an osu!mania hold note.
	*/
	public type: HitObjectTypeBits;
	/**
	 * Bit flags indicating the hitsound applied to the object.
	 * ## Hitsound
	 * The `hitSound` bit flags determine which sounds will play when the object is hit:
	 * 
	 * Bit index `0` - Normal
	 * 
	 * Bit index `1` - Whistle
	 * 
	 * Bit index `2` - Finish
	 * 
	 * Bit index `3` - Clap
	 * 
	 * If no bits are set, the normal hitsound is used by default.
	 * 
	 * In every mode except osu!mania, the `LayeredHitSounds` skin property forces the normal sound to be included regardless of bit `0`'s setting. It is enabled by default.
	*/
	public hitSound: HitSoundBits;
	/** **(Comma-separated list):** Extra parameters specific to the object's type. */
	public objectParams: Array<String>;
	/** **(Colon-separated list):** Information about which samples are played when the object is hit. It is closely related to `hitSound`; see [the hitsounds section](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#hitsounds). If it is not written, it defaults to `0:0:0:0:`. */
	public hitSample: Array<string>;
	
	public static intToType(int: Integer): HitObjectTypeBits {
		const bits = intToBits(int, 8);
		
		return {
			hitCircle: bits[0],
			slider: bits[1],
			newCombo: bits[2],
			spinner: bits[3],
			colourHax: bitsToInt([bits[4], bits[5], bits[6]]),
			maniaHoldNote: bits[7],
		};
	}
	
	public static intToHitSound(int: Integer): HitSoundBits {
		const bits = intToBits(int, 8);
		
		return {
			normal: bits[0],
			whistle: bits[1],
			finish: bits[2],
			clap: bits[3],
		};
	}
	
	constructor(x: Integer, y: Integer, time: Integer, type: HitObjectTypeBits, hitSound: HitSoundBits, objectParams: Array<String>, hitSample: Array<String>);
	constructor(data: String);
	constructor(data: String | Integer, y?: Integer, time?: Integer, type?: HitObjectTypeBits, hitSound?: HitSoundBits, objectParams?: Array<String>, hitSample?: Array<String>) {
		if (typeof data === 'number' && y !== undefined && time !== undefined && type !== undefined && hitSound !== undefined && objectParams !== undefined && hitSample !== undefined) {
			this.x = data;
			this.y = y;
			this.time = time;
			this.type = type;
			this.hitSound = hitSound;
			this.objectParams = objectParams;
			this.hitSample = hitSample;
		} else if (typeof data === 'string') {
			const split = data.split(',');
			
			this.x = parseInt(split[0] ?? '');
			this.y = parseInt(split[1] ?? '');
			this.time = parseInt(split[2] ?? '');
			this.type = HitObject.intToType(parseInt(split[3] ?? ''));
			this.hitSound = HitObject.intToHitSound(parseInt(split[4] ?? ''));
			this.objectParams = split.slice(5, -2);
			this.hitSample = split.slice(-1)[0].split(':');
		} else {
			throw new Error(`Failed to construct HitObject - invalid data "${data}"`);
		}
	}
	
	/** Gets the `HitObject`'s type as an `Integer` */
	public get typeInt(): Integer {
		return bitsToInt([
			this.type.hitCircle,
			this.type.slider,
			this.type.newCombo,
			this.type.spinner,
			...intToBits(this.type.colourHax, 3),
			this.type.maniaHoldNote,
		]);
	}
	
	/** Gets the `HitObject`'s hit sounds as an `Integer` */
	public get hitSoundInt(): Integer {
		return bitsToInt([
			this.hitSound.normal,
			this.hitSound.whistle,
			this.hitSound.finish,
			this.hitSound.clap,
		]);
	}
	
	/** Convert to string (`x,y,time,type,hitSound,objectParams,normalSet:additionSet:index:volume:filename`) */
	public get string() {
		if (this.objectParams.length > 0) {
			return `${this.x},${this.y},${this.time},${this.typeInt},${this.hitSoundInt},${this.objectParams.join(',')},${this.hitSample.join(':')}`;
		}
		
		return `${this.x},${this.y},${this.time},${this.typeInt},${this.hitSoundInt},${this.objectParams.join(',')},`;
	}
	
	public static create(data: String): HitCircle | Slider {
		const split = data.split(',');
		
		const x = parseInt(split[0] ?? '');
		const y = parseInt(split[1] ?? '');
		const time = parseInt(split[2] ?? '');
		const type = HitObject.intToType(parseInt(split[3] ?? ''));
		const hitSound = HitObject.intToHitSound(parseInt(split[4] ?? ''));
		const objectParams = split.slice(5, -2);
		const hitSample = split.slice(-1)[0].split(':');
		
		if (type.hitCircle) {
			return new HitCircle(x, y, time, type, hitSound, objectParams, hitSample);
		} else if (type.slider) {
			const curve = objectParams[0].split('|');
			const points = new Array<Point2D>();
			
			
			
			return new Slider(x, y, time, type, hitSound, hitSample, curve[0], points);
		}
	}
}

/**
 * See [this page](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#hit-circles) for more information
 * 
 * No additional `objectParams`
 */
export class HitCircle extends HitObject { }

/**
 * See [this page](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#sliders) for more information
 * 
 * ## `objectParams`
 * - `curveType` (`Character`): Type of curve used to construct this slider (`B` = bézier, `C` = centripetal catmull-rom, `L` = linear, `P` = perfect circle)
 * - `curvePoints` (`Pipe-separated list of strings`): Anchor points used to construct the slider. Each point is in the format `x:y`.
 * - `slides` (`Integer`): Amount of times the player has to follow the slider's curve back-and-forth before the slider is complete. It can also be interpreted as the repeat count plus one.
 * - `length` (`Decimal`): Visual length in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) of the slider.
 * - `edgeSounds` (`Pipe-separated list of integers`): Hitsounds that play when hitting edges of the slider's curve. The first sound is the one that plays when the slider is first clicked, and the last sound is the one that plays when the slider's end is hit.
 * - `edgeSets` (`Pipe-separated list of strings`): Sample sets used for the `edgeSounds`. Each set is in the format `normalSet:additionSet`, with the same meaning as in the [hitsounds section](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#hitsounds).
 * 
 * ## Slider curves
 * When constructing curves for a slider, `x` and `y` are used for the first point, and `curvePoints` supply the rest.
 * 
 * There are four types of slider curves in osu!:
 * - Bézier (B): [Bézier curves](https://en.wikipedia.org/wiki/B%C3%A9zier_curve) of arbitrary degree can be made. Multiple bézier curves can be joined into a single slider by repeating their points of intersection.
 * - Centripetal catmull-rom (C): [Catmull curves](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline) are an interpolating alternative to bézier curves. They are rarely used today due to their lack of visual appeal.
 * - Linear (L): These curves form a straight path between all of their points.
 * - Perfect circle (P): Perfect circle curves are limited to three points (including the hit object's position) that define the boundary of a circle. Using more than three points will result in the curve type being switched to bézier.
 * 
 * If the slider's `length` is longer than the defined curve, the slider will extend in a straight line from the end of the curve until it reaches the target length.
 * 
 * Notice: The slider's `length` can be used to determine the time it takes to complete the slider. `length / (SliderMultiplier * 100 * SV) * beatLength` tells how many milliseconds it takes to complete one slide of the slider (where `SV` is the slider velocity multiplier given by the effective inherited timing point, or `1` if there is none).
 */
export class Slider extends HitObject {
	/** Type of curve used to construct this slider (`B` = bézier, `C` = centripetal catmull-rom, `L` = linear, `P` = perfect circle) */
	public curveType: CurveType;
	/** Anchor points used to construct the slider. Each point is in the format `x:y`. */
	public curvePoints: Array<Point2D>;
	/** Amount of times the player has to follow the slider's curve back-and-forth before the slider is complete. It can also be interpreted as the repeat count plus one. */
	public slides: Integer;
	/** Visual length in [osu! pixels](https://osu.ppy.sh/wiki/en/Client/Playfield) of the slider. */
	public length: Decimal;
	/** Hitsounds that play when hitting edges of the slider's curve. The first sound is the one that plays when the slider is first clicked, and the last sound is the one that plays when the slider's end is hit. */
	public edgeSounds: Array<Integer>;
	/** Sample sets used for the `edgeSounds`. Each set is in the format `normalSet:additionSet`, with the same meaning as in the [hitsounds section](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#hitsounds). */
	public edgeSets: Array<String>;
	
	constructor(x: Integer, y: Integer, time: Integer, type: HitObjectTypeBits, hitSound: HitSoundBits, hitSample: Array<String>, curveType: CurveType, curvePoints: Array<Point2D>, slides: Integer, length: Integer, edgeSounds: Array<Integer>, edgeSets: Array<String>) {
		super(x, y, time, type, hitSound, [curveType], hitSample);
		
		this.curveType = curveType;
		this.curvePoints = curvePoints;
		this.slides = slides;
		this.length = length;
		this.edgeSounds = edgeSounds;
		this.edgeSets = edgeSets;
	}
}
