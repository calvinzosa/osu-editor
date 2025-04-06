import { ControlPointGroup, DifficultyPoint, HitSample, HitSound, TimingPoint } from 'osu-classes';

import { bpmToBeatLength, columnIndexToStartX, isDifficultyPoint, isLongHitObject, isNormalHitObject, isTimingPoint, OsuBeatmap, OsuHitObject, startXToColumnIndex } from '@/utils/Beatmap';
import { HittableObject, HoldableObject } from 'osu-parsers';

export type TemporaryId = ReturnType<Crypto['randomUUID']>;

export interface SerializedHitSample {
	sampleSet: string;
	hitSound: string;
	customIndex: number;
	suffix: string;
	volume: number;
	isLayered: boolean;
	filename: string;
}

export interface SerializedBaseHitObject {
	hitType: 'normal' | 'long';
	id: TemporaryId;
	startTime: number;
	hitSound: HitSound;
	samples: Array<SerializedHitSample>;
	columnIndex: number;
}

export interface SerializedNormalHitObject extends SerializedBaseHitObject {
	hitType: 'normal';
}

export interface SerializedLongHitObject extends SerializedBaseHitObject {
	hitType: 'long';
	endTime: number;
}

export type SerializedHitObject = SerializedNormalHitObject | SerializedLongHitObject;

export interface SerializedBaseControlPoint {
	pointType: 'timingPoint' | 'difficultyPoint';
	id: TemporaryId;
	startTime: number;
}

export interface SerializedTimingPoint extends SerializedBaseControlPoint {
	pointType: 'timingPoint';
	bpm: number;
	timeSignature: number;
}

export interface SerializedDifficultyPoint extends SerializedBaseControlPoint {
	pointType: 'difficultyPoint';
	sliderVelocity: number;
	generateTicks: boolean;
	isLegacy: boolean;
}

export type SerializedControlPoint = SerializedTimingPoint | SerializedDifficultyPoint;

export interface SerializedBeatmap {
	title: {
		text: string;
		unicode: string;
	};
	artist: {
		text: string;
		unicode: string;
	};
	creator: string;
	columnCount: number;
	hitObjects: Array<SerializedHitObject>;
	timingPoints: Array<SerializedTimingPoint>;
	difficultyPoints: Array<SerializedDifficultyPoint>;
}

export function generateId(): TemporaryId {
	return crypto.randomUUID();
}

export function serializeBeatmap(beatmap: OsuBeatmap): SerializedBeatmap {
	return {
		title: {
			text: beatmap.metadata.title,
			unicode: beatmap.metadata.titleUnicode,
		},
		artist: {
			text: beatmap.metadata.artist,
			unicode: beatmap.metadata.artistUnicode,
		},
		creator: beatmap.metadata.creator,
		columnCount: beatmap.difficulty.circleSize,
		hitObjects: beatmap.hitObjects.map((hitObject) => serializeHitObject(hitObject, beatmap.difficulty.circleSize)),
		timingPoints: beatmap.controlPoints.timingPoints.map((timingPoint) => serializeControlPoint(timingPoint)),
		difficultyPoints: beatmap.controlPoints.difficultyPoints.map((difficultyPoint) => serializeControlPoint(difficultyPoint)),
	};
}

export function serializeHitObject(hitObject: OsuHitObject, columnCount: number): SerializedHitObject {
	const temporaryId = generateId();
	const serializedSamples = hitObject.samples.map((sample) => ({
		sampleSet: sample.sampleSet,
		hitSound: sample.hitSound,
		customIndex: sample.customIndex,
		suffix: sample.suffix,
		volume: sample.volume,
		isLayered: sample.isLayered,
		filename: sample.filename,
	}));
	
	if (isNormalHitObject(hitObject)) {
		return {
			hitType: 'normal',
			id: temporaryId,
			startTime: hitObject.startTime,
			hitSound: hitObject.hitSound,
			samples: serializedSamples,
			columnIndex: startXToColumnIndex(hitObject.startX, columnCount),
		};
	} else if (isLongHitObject(hitObject)) {
		return {
			hitType: 'long',
			id: temporaryId,
			startTime: hitObject.startTime,
			endTime: hitObject.endTime,
			hitSound: hitObject.hitSound,
			samples: serializedSamples,
			columnIndex: startXToColumnIndex(hitObject.startX, columnCount),
		};
	}
	
	throw new Error(`Unknown HitObject type: ${hitObject}`);
}

export function serializeControlPoint(controlPoint: TimingPoint): SerializedTimingPoint;
export function serializeControlPoint(controlPoint: DifficultyPoint): SerializedDifficultyPoint;
export function serializeControlPoint(controlPoint: TimingPoint | DifficultyPoint): SerializedControlPoint {
	const temporaryId = generateId();
	if (isTimingPoint(controlPoint)) {
		return {
			pointType: 'timingPoint',
			id: temporaryId,
			startTime: controlPoint.startTime,
			bpm: controlPoint.bpmUnlimited,
			timeSignature: controlPoint.timeSignature,
		};
	} else if (isDifficultyPoint(controlPoint)) {
		return {
			pointType: 'difficultyPoint',
			id: temporaryId,
			startTime: controlPoint.startTime,
			sliderVelocity: controlPoint.sliderVelocityUnlimited,
			generateTicks: controlPoint.generateTicks,
			isLegacy: controlPoint.isLegacy,
		};
	}
	
	throw new Error(`Unknown ControlPoint type: ${controlPoint}`);
}

export function deserializeBeatmap(serializedBeatmap: SerializedBeatmap, loadedBeatmap: OsuBeatmap): OsuBeatmap {
	loadedBeatmap.metadata.title = serializedBeatmap.title.text;
	loadedBeatmap.metadata.titleUnicode = serializedBeatmap.title.unicode;
	loadedBeatmap.metadata.artist = serializedBeatmap.artist.text;
	loadedBeatmap.metadata.artistUnicode = serializedBeatmap.artist.unicode;
	loadedBeatmap.metadata.creator = serializedBeatmap.creator;
	loadedBeatmap.difficulty.circleSize = serializedBeatmap.columnCount;
	
	loadedBeatmap.hitObjects.length = 0;
	for (const serializedHitObject of serializedBeatmap.hitObjects) {
		const newSamples = serializedHitObject.samples.map((serializedSample) => {
			const sample = new HitSample();
			sample.sampleSet = serializedSample.sampleSet;
			sample.hitSound = serializedSample.hitSound;
			sample.customIndex = serializedSample.customIndex;
			sample.suffix = serializedSample.suffix;
			sample.volume = serializedSample.volume;
			sample.isLayered = serializedSample.isLayered;
			sample.filename = serializedSample.filename;
			
			return sample;
		});
		
		let hitObject: HittableObject | HoldableObject | null = null;
		if (serializedHitObject.hitType === 'normal') {
			hitObject = new HittableObject();
		} else if (serializedHitObject.hitType === 'long') {
			hitObject = new HoldableObject();
			hitObject.endTime = serializedHitObject.endTime;
		}
		
		if (hitObject !== null) {
			hitObject.startTime = serializedHitObject.startTime;
			hitObject.hitSound = serializedHitObject.hitSound;
			hitObject.samples = newSamples;
			hitObject.startX = columnIndexToStartX(serializedHitObject.columnIndex, serializedBeatmap.columnCount);
			hitObject.applyDefaults(loadedBeatmap.controlPoints, loadedBeatmap.difficulty);
			loadedBeatmap.hitObjects.push(hitObject);
		}
	}
	
	const groups = new Map<number, ControlPointGroup>();
	loadedBeatmap.controlPoints.groups.length = 0;
	loadedBeatmap.controlPoints.timingPoints.length = 0;
	loadedBeatmap.controlPoints.difficultyPoints.length = 0;
	for (const controlPoint of loadedBeatmap.controlPoints.allPoints) {
		if (!groups.has(controlPoint.startTime)) {
			groups.set(controlPoint.startTime, new ControlPointGroup(controlPoint.startTime));
		}
		
		groups.get(controlPoint.startTime)!.add(controlPoint);
	}
	
	for (const serializedTimingPoint of serializedBeatmap.timingPoints) {
		let targetGroup = groups.get(serializedTimingPoint.startTime);
		if (!targetGroup) {
			targetGroup = new ControlPointGroup(serializedTimingPoint.startTime);
			groups.set(serializedTimingPoint.startTime, targetGroup);
		}
		
		const timingPoint = new TimingPoint(targetGroup);
		timingPoint.beatLengthUnlimited = bpmToBeatLength(serializedTimingPoint.bpm);
		timingPoint.timeSignature = serializedTimingPoint.timeSignature;
		loadedBeatmap.controlPoints.timingPoints.push(timingPoint);
	}
	
	for (const serializedDifficultyPoint of serializedBeatmap.difficultyPoints) {
		let targetGroup = groups.get(serializedDifficultyPoint.startTime);
		if (!targetGroup) {
			targetGroup = new ControlPointGroup(serializedDifficultyPoint.startTime);
			groups.set(serializedDifficultyPoint.startTime, targetGroup);
		}
		
		const difficultyPoint = new DifficultyPoint(targetGroup);
		difficultyPoint.sliderVelocityUnlimited = bpmToBeatLength(serializedDifficultyPoint.sliderVelocity);
		difficultyPoint.generateTicks = serializedDifficultyPoint.generateTicks;
		difficultyPoint.isLegacy = serializedDifficultyPoint.isLegacy;
		loadedBeatmap.controlPoints.difficultyPoints.push(difficultyPoint);
	}
	
	return loadedBeatmap;
}
