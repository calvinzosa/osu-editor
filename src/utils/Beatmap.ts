import type { ReactSet } from './Types';

import { readDir, readFile } from '@tauri-apps/plugin-fs';

import * as OsuParsers from 'osu-parsers';
import { TimingPoint, HitType, DifficultyPoint, HitSound, ControlPointType, ControlPoint } from 'osu-classes';

import { getExtension, joinPaths } from './File';
import { useEffect, useRef } from 'react';

export const beatmapDecoder = new OsuParsers.BeatmapDecoder();

export enum GameMode {
	Standard = 0,
	Taiko = 1,
	Catch = 2,
	Mania = 3,
}

export interface OsuBeatmap extends ReturnType<typeof beatmapDecoder.decodeFromBuffer> {
	tempId: ReturnType<Crypto['randomUUID']>;
	filePath: string;
	songPath: string;
	maxComboStable: number;
	maxComboLazer: number;
}

export function useHitsound(normalUrl: string, clapUrl: string, finishUrl: string, whistleUrl: string) {
	const audioContextRef = useRef<AudioContext | null>(null);
	const buffersRef = useRef<{ [key in HitSound]?: AudioBuffer }>({});
	const gainRef = useRef<GainNode | null>(null);
	
	const playHitsound = (gain: number, hitSound: HitSound) => {
		if (!audioContextRef.current || !gainRef.current) return;
		
		gainRef.current.gain.value = gain;
		if (hitSound === HitSound.None) {
			hitSound = HitSound.Normal;
		}
		
		for (const sound of Object.values(HitSound)) {
			if (typeof sound !== 'number' || (sound & hitSound) === 0) {
				continue;
			}
			
			const buffer = buffersRef.current[sound];
			if (buffer === undefined) {
				continue;
			}
			
			const source = audioContextRef.current.createBufferSource();
			source.buffer = buffer;
			source.connect(gainRef.current);
			source.start();
		}
	};
	
	useEffect(() => {
		const loadSound = async (url: string, type: HitSound) => {
			if (!audioContextRef.current) {
				audioContextRef.current = new AudioContext();
				gainRef.current = audioContextRef.current.createGain();
				gainRef.current.connect(audioContextRef.current.destination);
			}
			
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			buffersRef.current[type] = await audioContextRef.current.decodeAudioData(arrayBuffer);
		};
		
		loadSound(normalUrl, HitSound.Normal);
		loadSound(clapUrl, HitSound.Clap);
		loadSound(finishUrl, HitSound.Finish);
		loadSound(whistleUrl, HitSound.Whistle);
	}, [normalUrl, clapUrl, finishUrl, whistleUrl]);
	
	return playHitsound;
}

export function isTimingPoint(controlPoint: ControlPoint): controlPoint is TimingPoint {
	return controlPoint.pointType === ControlPointType.TimingPoint;
}

export function isDifficultyPoint(controlPoint: ControlPoint): controlPoint is DifficultyPoint {
	return controlPoint.pointType === ControlPointType.DifficultyPoint;
}

export function calculateActualNoteSpeed(scrollSpeed: number, bpm: number, sliderVelocity: number): number {
	const bps = bpm / 60;
	const totalScrollSpeed = sliderVelocity * scrollSpeed;
	const pixelsPerSecond = totalScrollSpeed * bps;
	return Math.max(pixelsPerSecond * 25, 0);
}

// pretty sure this doesn't work with targetMilliseconds that are less than the current timestamp lol, this
// is probably why there are a bunch of lines under the receptors/jugdement line in the preview
export function yPositionFromMillisecond(
	timestamp: number,
	targetMillisecond: number,
	scrollSpeed: number,
	bpm: number,
	sliderVelocity: number,
	laneHeight: number,
	hitPosition: number,
	nextTimings: Array<TimingPoint>,
	nextDifficulties: Array<DifficultyPoint>,
): number {
	const movementHeight = laneHeight * (hitPosition / 480);
	let remainingTime = targetMillisecond - timestamp;
	let distanceTravelled = 0;
	let nextTimingPointIndex = 0;
	let nextDifficultyPointIndex = 0;
	while (true) {
		const currentSpeed = calculateActualNoteSpeed(scrollSpeed, bpm, sliderVelocity) * 0.001;
		const nextTimingPoint = nextTimings[nextTimingPointIndex] as TimingPoint | undefined;
		const nextDifficultyPoint = nextDifficulties[nextDifficultyPointIndex] as DifficultyPoint | undefined;
		const nextPoint = (nextTimingPoint?.startTime ?? Infinity) < (nextDifficultyPoint?.startTime ?? Infinity)
			? nextTimingPoint
			: nextDifficultyPoint;
		
		if (nextPoint === undefined || remainingTime < (nextPoint.startTime - timestamp)) {
			distanceTravelled += remainingTime * currentSpeed;
			return movementHeight - distanceTravelled;
		}
		
		const nextTime = nextPoint.startTime - timestamp;
		distanceTravelled += nextTime * currentSpeed;
		
		if (distanceTravelled > movementHeight) {
			return movementHeight - distanceTravelled;
		}
		
		if (isTimingPoint(nextPoint)) {
			bpm = nextPoint.bpmUnlimited;
			nextTimingPointIndex++;
		} else if (isDifficultyPoint(nextPoint)) {
			sliderVelocity = nextPoint.sliderVelocityUnlimited;
			nextDifficultyPointIndex++;
		}
		
		timestamp += nextTime;
		remainingTime -= nextTime;
	}
}

export function yPositionFromMillisecondEditor(timestamp: number, targetMillisecond: number, scrollSpeed: number, laneHeight: number, hitPosition: number) {
	const movementHeight = laneHeight * (hitPosition / 480);
	const currentSpeed = calculateActualNoteSpeed(scrollSpeed, 60, 1) * 2;
	return movementHeight - (targetMillisecond - timestamp) / 1_000 * currentSpeed;
}

export function millisecondFromYPositionEditor(timestamp: number, yPosition: number, scrollSpeed: number, laneHeight: number, hitPosition: number) {
	const currentSpeed = calculateActualNoteSpeed(scrollSpeed, 60, 1);
	return Math.round((1000 * ((laneHeight * hitPosition) / 480 - yPosition)) / (2 * currentSpeed) + timestamp);
	// just moved around the equation from yPositionFromTimestampEditor to get this
}

let isProcessingBeatmaps = false;

async function processSong(songPath: string, loadedSongs: Record<string, Array<OsuBeatmap>>, completed: () => void) {
	const fileEntries = await readDir(songPath);
	const beatmapFiles = new Set<string>();
	
	for (const fileEntry of fileEntries) {
		if (!fileEntry.isFile) {
			continue;
		}
		
		const filePath = joinPaths(songPath, fileEntry.name);
		const fileExtension = getExtension(filePath);
		if (fileExtension !== 'osu') {
			continue;
		}
		
		beatmapFiles.add(filePath);
	}
	
	const loadedDifficulties = new Array<OsuBeatmap>();
	for (const filePath of beatmapFiles) {
		try {
			const contents = await readFile(filePath);
			const beatmap = beatmapDecoder.decodeFromBuffer(contents, {
				parseColours: true,
				parseDifficulty: true,
				parseEditor: true,
				parseEvents: true,
				parseGeneral: true,
				parseHitObjects: true,
				parseMetadata: true,
				parseStoryboard: true,
				parseTimingPoints: true,
			}) as OsuBeatmap;
			
			initializeBeatmap(beatmap, filePath, songPath);
			loadedDifficulties.push(beatmap);
		} catch (err) {
			console.log(`Failed to load beatmap at "${filePath}" -`, err);
		}
	}
	
	loadedDifficulties.sort((a, b) => a.maxComboStable - b.maxComboStable);
	
	loadedSongs[songPath] = loadedDifficulties;
	completed();
};

export function initializeBeatmap(beatmap: OsuBeatmap, filePath: string, songPath: string) {
	beatmap.tempId = crypto.randomUUID();
	beatmap.filePath = filePath;
	beatmap.songPath = songPath;
	
	let maxComboStable = 0;
	let maxComboLazer = 0;
	for (const hitObject of beatmap.hitObjects) {
		const hitType = hitObject.hitType;
		if ((hitType & HitType.Normal) !== 0) {
			maxComboStable++;
			maxComboLazer++;
		} else if ((hitType & HitType.Hold) !== 0) {
			maxComboStable += Math.ceil((hitObject as OsuParsers.HoldableObject).duration / 100);
			maxComboLazer += 2;
		}
	}
	
	beatmap.maxComboStable = maxComboStable;
	beatmap.maxComboLazer = maxComboLazer;
	beatmap.controlPoints.timingPoints.sort((a, b) => (a.startTime - b.startTime) || (a.bpmUnlimited - b.bpmUnlimited));
	beatmap.controlPoints.effectPoints.sort((a, b) => (a.startTime - b.startTime) || (a.scrollSpeedUnlimited - b.scrollSpeedUnlimited));
	beatmap.hitObjects.sort((a, b) => a.startTime - b.startTime);
}

export async function processBeatmaps(
	beatmapsPath: string,
	setBeatmapList: ReactSet<Record<string, Array<OsuBeatmap>> | null>,
	setLoadingProgress: ReactSet<number>,
	setTotalBeatmaps: ReactSet<number>,
): Promise<void> {
	if (isProcessingBeatmaps) {
		return;
	}
	
	isProcessingBeatmaps = true;
	
	const beatmapEntries = await readDir(beatmapsPath);
	const loadedBeatmaps: Record<string, Array<OsuBeatmap>> = {};
	setBeatmapList(null);
	setLoadingProgress(0);
	setTotalBeatmaps(beatmapEntries.length);
	
	const promises = beatmapEntries
		.filter((entry) => entry.isDirectory)
		.map((entry) => {
			const beatmapPath = joinPaths(beatmapsPath, entry.name);
			return processSong(beatmapPath, loadedBeatmaps, () => setLoadingProgress((count) => count + 1));
		});
	
	await Promise.all(promises);
	
	setBeatmapList(loadedBeatmaps);
	isProcessingBeatmaps = false;
}
