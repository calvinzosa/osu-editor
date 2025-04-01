import type { BeatmapEvent } from './Event';
import type { HitObject } from './HitObject';
import type { TimingPoint } from './TimingPoint';

/** Alias for `string` */
export type String = string;
/** Alias for `number` */
export type Integer = number;
/** Alias for `number` */
export type Decimal = number;
/** Alias for `boolean` */
export type Boolean = boolean;
/** Number boolean */
export type NBool = 0 | 1;

/** osu! Game Modes */
export enum GameMode {
	/** osu!standard */
	standard = 0,
	/** osu!taikd */
	taiko = 1,
	/** osu!catcd */
	catch = 2,
	/** osu!manid */
	mania = 3,
}

/** Overlay positions */
export enum OverlayPosition {
	/** Use skin setting */
	NoChange = 'NoChange',
	/** Draw overlays under numbers */
	Below = 'Below',
	/** Draw overlays on top of numbers */
	Above = 'Above',
}

/** `0` = `BeatmapDefault`, `1` = `Normal`, `2` = `Soft`, `3` = `Drum` */
export enum SampleSet {
	BeatmapDefault = 0,
	Normal = 1,
	Soft = 2,
	Drum = 3,
}

export type EventType = ('0') | ('1' | 'Video') | ('2' | 'Break');

export interface Point2D {
	x: number;
	y: number;
}

/** `.osu` is a human-readable file format containing information about a beatmap. */
export interface BeatmapData {
	/** General information about the beatmap */
	General: {
		/** Location of the audio file relative to the current folder */
		AudioFilename: String | null;
		/** Milliseconds of silence before the audio starts playing (default: `0`) */
		AudioLeadIn: Integer | null;
		/** @deprecated */
		AudioHash: String | null;
		/** Time in milliseconds when the audio preview should start (default: `-1`) */
		PreviewTime: Integer | null;
		/** Speed of the countdown before the first hit object (0 = no countdown, 1 = normal, 2 = half, 3 = double) (default: `1`) */
		Countdown: Integer | null;
		/** Sample set that will be used if timing points do not override it (Normal, Soft, Drum) (default: `Normal`) */
		SampleSet: String | null;
		/** Multiplier for the threshold in time where hit objects placed close together stack (0–1) (default: `0.7`) */
		StackLeniency: Decimal | null;
		/** Game mode (default: `GameMode.standard`) */
		Mode: GameMode | null;
		/** Whether or not breaks have a letterboxing effect (default: 0) */
		LetterboxInBreaks: NBool | null;
		/** @deprecated (default: `1`) */
		StoryFireInFront: NBool | null;
		/** Whether or not the storyboard can use the user's skin images (default: `0`)*/
		UseSkinSprites: NBool | null;
		/** @deprecated (default: 0)*/
		AlwaysShowPlayfield: NBool | null;
		/** Draw order of hit circle overlays compared to hit numbers (default: `NoChange`) */
		OverlayPosition: OverlayPosition | null;
		/** Preferred skin to use during gameplay (default: ` `) */
		SkinPreference: String | null;
		/** Whether or not a warning about flashing colours should be shown at the beginning of the map (default: `0`) */
		EpilepsyWarning: NBool | null;
		/** Time in beats that the countdown starts before the first hit object (default: `0`) */
		CountdownOffset: Integer | null;
		/** Whether or not the "N+1" style key layout is used for osu!mania (default: `0`) */
		SpecialStyle: NBool | null;
		/** Whether or not the storyboard allows widescreen viewing (default: `0`) */
		WidescreenStoryboard: NBool | null;
		/** Whether or not sound samples will change rate when playing with speed-changing mods (default: `0`) */
		SamplesMatchPlaybackRate: NBool | null;
	} | null;
	/** Saved settings for the beatmap editor */
	Editor: {
		/** Time in milliseconds of bookmarks (Comma-separated list of integers) */
		Bookmarks: String | null;
		/**	Distance snap multiplier */
		DistanceSpacing: Decimal | null;
		/**	Beat snap divisor */
		BeatDivisor: Integer | null;
		/**	Grid size */
		GridSize: Integer | null;
		/**	Scale factor for the object timeline */
		TimelineZoom: Decimal | null;
	} | null;
	/** [Information](https://osu.ppy.sh/wiki/en/Client/Beatmap_editor/Song_setup#general) used to identify the beatmap */
	Metadata: {
		/** Romanised song title */
		Title: String | null;
		/** Song title */
		TitleUnicode: String | null;
		/** Romanised song artist */
		Artist: String | null;
		/** Song artist */
		ArtistUnicode: String | null;
		/** Beatmap creator */
		Creator: String | null;
		/** Difficulty name */
		Version: String | null;
		/** Original media the song was produced for */
		Source: String | null;
		/** Search terms (Space-separated list of strings) */
		Tags: String | null;
		/** Difficulty ID */
		BeatmapID: Integer | null;
		/** Beatmap ID */
		BeatmapSetID: Integer | null;
	} | null;
	/** [Difficulty settings](https://osu.ppy.sh/wiki/en/Client/Beatmap_editor/Song_setup#difficulty) */
	Difficulty: {
		/** HP setting (0–10) */
		HPDrainRate: Decimal | null;
		/** CS setting (0–10) */
		CircleSize: Decimal | null;
		/** OD setting (0–10) */
		OverallDifficulty: Decimal | null;
		/** AR setting (0–10) */
		ApproachRate: Decimal | null;
		/** Base slider velocity in hundreds of osu! pixels per beat */
		SliderMultiplier: Decimal | null;
		/** Amount of slider ticks per beat */
		SliderTickRate: Decimal | null;
	} | null;
	/** Beatmap and storyboard graphic events */
	Events: Array<BeatmapEvent> | null;
	/** Timing and control points */
	TimingPoints: Array<TimingPoint> | null;
	/** Combo and skin colours */
	Colours: any | null;
	/** Hit objects */
	HitObjects: Array<HitObject> | null;
}

export type SectionName = keyof BeatmapData;

/** Bits for a `HitObject`'s type (see [this page](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#type)) */
export interface HitObjectTypeBits {
	/** Bit index `0` */
	hitCircle: Boolean;
	/** Bit index `1` */
	slider: Boolean;
	/** Bit index `2` */
	newCombo: Boolean;
	/** Bit index `3` */
	spinner: Boolean;
	/** Bit index `4`, `5`, and `6` */
	colourHax: Integer;
	/** Bit index `7` */
	maniaHoldNote: Boolean;
}

/** Bits for a `HitObject`'s hit sound (see [this page](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29#hitsounds)) */
export interface HitSoundBits {
	/** Bit index `0` */
	normal: Boolean;
	/** Bit index `1` */
	whistle: Boolean;
	/** Bit index `2` */
	finish: Boolean;
	/** Bit index `3` */
	clap: Boolean;
}

export enum CurveType {
	Bezier = 'B',
	CentripetalCatmullRom = 'C',
	Linear = 'L',
	PerfectCircle = 'P',
}
