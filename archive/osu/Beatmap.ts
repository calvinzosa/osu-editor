import { BeatmapEvent } from './Event';
import { TimingPoint } from './TimingPoint';
import { BeatmapData, SectionName } from './Types';

export const NullBeatmap: BeatmapData = {
	General: {
		AudioFilename: null,
		AudioLeadIn: null,
		AudioHash: null,
		PreviewTime: null,
		Countdown: null,
		SampleSet: null,
		StackLeniency: null,
		Mode: null,
		LetterboxInBreaks: null,
		StoryFireInFront: null,
		UseSkinSprites: null,
		AlwaysShowPlayfield: null,
		OverlayPosition: null,
		SkinPreference: null,
		EpilepsyWarning: null,
		CountdownOffset: null,
		SpecialStyle: null,
		WidescreenStoryboard: null,
		SamplesMatchPlaybackRate: null,
	},
	Editor: {
		Bookmarks: null,
		DistanceSpacing: null,
		BeatDivisor: null,
		GridSize: null,
		TimelineZoom: null,
	},
	Metadata: {
		Title: null,
		TitleUnicode: null,
		Artist: null,
		ArtistUnicode: null,
		Creator: null,
		Version: null,
		Source: null,
		Tags: null,
		BeatmapID: null,
		BeatmapSetID: null,
	},
	Difficulty: {
		HPDrainRate: null,
		CircleSize: null,
		OverallDifficulty: null,
		ApproachRate: null,
		SliderMultiplier: null,
		SliderTickRate: null,
	},
	Events: [],
	TimingPoints: [],
	Colours: [],
	HitObjects: [],
};

export class Beatmap {
	readonly hasLoaded: boolean = false;
	public data: BeatmapData | null = null;
	
	static parseProperty(key: string, value: string) {
		switch (key) {
			case 'OverlayPosition': // OverlayPosition (Enum String)
			case 'SkinPreference': // String
			case 'AudioFilename': // String
			case 'ArtistUnicode': // String
			case 'TitleUnicode': // String
			case 'AudioHash': // String
			case 'SampleSet': // String
			case 'Bookmarks': // String
			case 'Version': // String
			case 'Creator': // String
			case 'Artist': // String
			case 'Source': // String
			case 'Title': // String
			case 'Tags': { // String
				return value.trim();
			}
			case 'OverallDifficulty': // Decimal
			case 'SliderMultiplier': // Decimal
			case 'DistanceSpacing': // Decimal
			case 'SliderTickRate': // Decimal
			case 'StackLeniency': // Decimal
			case 'ApproachRate': // Decimal
			case 'TimelineZoom': // Decimal
			case 'HPDrainRate': // Decimal
			case 'CircleSize': { // Decimal
				return parseFloat(value);
			}
			case 'LetterboxInBreaks': // NBool
			case 'StoryFireInFront': // NBool
			case 'UseSkinSprites': // NBool
			case 'AlwaysShowPlayfield': // NBool
			case 'EpilepsyWarning': // NBool
			case 'SpecialStyle': // NBool
			case 'WidescreenStoryboard': // NBool
			case 'SamplesMatchPlaybackRate': { // NBool
				return value === '1';
			}
			case 'Mode': // GameMode (Enum Integer)
			case 'CountdownOffset': // Integer
			case 'BeatmapSetID': // Integer
			case 'AudioLeadIn': // Integer
			case 'PreviewTime': // Integer
			case 'BeatDivisor': // Integer
			case 'BeatmapID': // Integer
			case 'Countdown': // Integer
			case 'GridSize': { // Integer
				return parseInt(value, 10);
			}
			default:
				console.warn(`Beatmap warning: Unknown key: ${key}`);
				return value;
		}
	}
	
	public fromString(contents: string) {
		const lines = contents.split('\n');
		
		if (lines[0].trim() !== 'osu file format v14') {
			throw new Error(`Failed to create Beatmap: Format is not supported "${lines[0]}"`);
		}
		
		const sectionHeader = /^\[([^\[\]]+)\]$/;
		let currentSection: SectionName | null = null;
		
		this.data = {
			General: null,
			Editor: null,
			Metadata: null,
			Difficulty: null,
			Events: null,
			TimingPoints: null,
			Colours: null,
			HitObjects: null,
		};
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();
			const [, sectionName] = trimmedLine.match(sectionHeader) ?? [];
			
			if (!trimmedLine || line.startsWith('//')) {
				continue;
			}
			
			if (sectionName) {
				currentSection = sectionName as SectionName;
			} else if (currentSection !== null) {
				const format1 = /^(\w+):\s+(.+)$/ // `key: value`
				const format2 = /^(\w+):(.+)$/ // `key:value`
				
				if (this.data[currentSection] === null) {
					this.data[currentSection] = NullBeatmap[currentSection];
				}
				
				switch (currentSection) {
					case 'General':
					case 'Editor': {
						const [, key, value] = trimmedLine.match(format1) ?? [];
						if (key === undefined || value === undefined) {
							console.trace(`Beatmap warning: Line #${i} does not have a proper format - line "${line}", expected format "key: value"`);
							break;
						}
						
						(this.data as any)[currentSection][key] = Beatmap.parseProperty(key, value);
						
						break;
					}
					case 'Metadata':
					case 'Difficulty': {
						const [, key, value] = trimmedLine.match(format2) ?? [];
						if (key === undefined || value === undefined) {
							console.trace(`Beatmap warning: Line #${i} does not have a proper format - line "${line}", expected format "key:value"`);
							break;
						}
						
						(this.data as any)[currentSection][key] = Beatmap.parseProperty(key, value);
						
						break;
					}
					case 'Colours': {
						console.trace(`Beatmap warning: Colours section is not supported!`);
						break;
					}
					case 'Events': {
						this.data.Events!.push(BeatmapEvent.create(trimmedLine));
						break;
					}
					case 'TimingPoints': {
						this.data.TimingPoints!.push(TimingPoint.create(trimmedLine));
						break;
					}
					case 'HitObjects': {
						this.data.TimingPoints!.push(TimingPoint.create(trimmedLine));
						break;
					}
				}
			}
		}
	}
}
