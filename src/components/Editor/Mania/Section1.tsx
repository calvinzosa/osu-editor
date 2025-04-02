import { useEffect, useRef, useState } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';
import { exists, readDir } from '@tauri-apps/plugin-fs';
import { DifficultyPoint, HitObject, HitSound, HitType, TimingPoint } from 'osu-classes';
import { HoldableObject, HittableObject } from 'osu-parsers';

import { clamp, intToBits } from '@/utils';
import { yPositionFromMillisecond, yPositionFromMillisecondEditor, OsuBeatmap, useHitsound, millisecondFromYPositionEditor } from '@/utils/Beatmap';
import { getExtension, getFileName, joinPaths } from '@/utils/File';
import { EditMode, ReactSet, UserOptions } from '@/utils/Types';

import normalHitSound from '@/assets/normal-hitnormal.ogg';
import clapHitSound from '@/assets/normal-hitclap.ogg';
import finishHitSound from '@/assets/normal-hitfinish.ogg';
import whistleHitSound from '@/assets/normal-hitwhistle.ogg';

import editorModeSelectionIcon from '@/assets/EditorIcon_ModeSelection.png';
import editorModeNormalIcon from '@/assets/EditorIcon_ModeNormalNote.png';
import editorModeLongIcon from '@/assets/EditorIcon_ModeLongNote.png';
import maniaNote1Src from '@/assets/mania-note1.png';
import maniaLongNote1Src from '@/assets/mania-note1L-0.png';
import maniaNote2Src from '@/assets/mania-note2.png';
import maniaLongNote2Src from '@/assets/mania-note2L-0.png';

const maniaNote1 = new Image();
maniaNote1.src = maniaNote1Src;

const maniaLongNote1 = new Image();
maniaLongNote1.src = maniaLongNote1Src;

const maniaNote2 = new Image();
maniaNote2.src = maniaNote2Src;

const maniaLongNote2 = new Image();
maniaLongNote2.src = maniaLongNote2Src;

function renderPreviewContext(
	offscreenContext: OffscreenCanvasRenderingContext2D,
	laneWidth: number,
	laneHeight: number,
	hitPosition: number,
	timestamp: number,
	columnCount: number,
	columnIndex: number,
	scrollSpeed: number,
	bpm: number,
	sliderVelocity: number,
	nextTimings: Array<TimingPoint>,
	nextDiffs: Array<DifficultyPoint>,
	nextHitObjects: Array<HitObject>,
): [number, number] {
	const offscreenCanvas = offscreenContext.canvas;
	const circleRadius = Math.round(laneWidth / 2);
	const circleX = circleRadius;
	const outlineWidth = Math.round(laneWidth * 0.15);
	const halfOutline = Math.round(outlineWidth / 2);
	const receptorRadius = circleRadius - halfOutline;
	const snap = 60_000 / bpm;
	const totalLines = Math.min(Math.ceil((timestamp + 5_000) / snap), 400);
	
	offscreenContext.fillStyle = 'hsl(0, 0%, 0%)';
	offscreenContext.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
	offscreenContext.fillStyle = 'hsl(0, 0%, 50%)';
	offscreenContext.beginPath();
	for (let i = 0; i < totalLines; i++) {
		const lineTime = i * snap;
		
		const yPosition = yPositionFromMillisecond(timestamp, lineTime, scrollSpeed, bpm, sliderVelocity, laneHeight, hitPosition, nextTimings, nextDiffs);
		if (yPosition <= 0) {
			break;
		}
		
		if (yPosition <= laneHeight) {
			offscreenContext.rect(0, yPosition, laneWidth, 2);
		}
	}
	
	offscreenContext.closePath();
	offscreenContext.fill();
	
	offscreenContext.strokeStyle = 'hsl(0, 0%, 50%)';
	offscreenContext.lineWidth = outlineWidth;
	offscreenContext.beginPath();
	offscreenContext.ellipse(circleX, Math.round(laneHeight * (hitPosition / 480)), receptorRadius, receptorRadius, 0, 0, Math.PI * 2);
	offscreenContext.closePath();
	offscreenContext.stroke();
	
	let renderedNormalObjects = 0;
	let renderedLongObjects = 0;
	
	for (const hitObject of nextHitObjects) {
		const objectColumn = Math.floor(hitObject.startX * columnCount / 512);
		if (columnIndex !== objectColumn) {
			continue;
		}
		
		const colors = {
			normal: 'hsl(230, 94%, 79%)',
			head: 'hsl(230, 94%, 79%)',
			body: 'hsl(229, 44%, 63%)',
		};
		
		if (columnCount === 4 && (columnIndex === 1 || columnIndex === 2)) {
			colors.normal = 'hsl(0, 0%, 78%)';
			colors.head = 'hsl(0, 0%, 78%)';
			colors.body = 'hsl(0, 0%, 63%)';
		}
		
		if ((hitObject.hitType & HitType.Normal) !== 0) {
			if (hitObject.startTime < timestamp) {
				continue;
			}
			
			const yPosition = yPositionFromMillisecond(
				timestamp,
				hitObject.startTime,
				scrollSpeed,
				bpm,
				sliderVelocity,
				laneHeight,
				hitPosition,
				nextTimings,
				nextDiffs,
			);
			
			if (yPosition < 0) {
				continue;
			}
			
			offscreenContext.fillStyle = colors.normal;
			offscreenContext.beginPath();
			offscreenContext.ellipse(circleX, yPosition, circleRadius, circleRadius, 0, 0, Math.PI * 2);
			offscreenContext.closePath();
			offscreenContext.fill();
			renderedNormalObjects++;
		} else if ((hitObject.hitType & HitType.Hold) !== 0) {
			const holdObject = hitObject as HoldableObject;
			if (holdObject.endTime < timestamp) {
				continue;
			}
			
			const yPositionHead = Math.min(
				laneHeight * (hitPosition / 480),
				yPositionFromMillisecond(
					timestamp,
					holdObject.startTime,
					scrollSpeed,
					bpm,
					sliderVelocity,
					laneHeight,
					hitPosition,
					nextTimings,
					nextDiffs,
				),
			);
			
			const yPositionTail = yPositionFromMillisecond(
				timestamp,
				holdObject.endTime,
				scrollSpeed,
				bpm,
				sliderVelocity,
				laneHeight,
				hitPosition,
				nextTimings,
				nextDiffs,
			);
			
			if (yPositionHead < 0) {
				continue;
			}
			
			const bodyGap = laneWidth * 0.15;
			offscreenContext.fillStyle = colors.body;
			offscreenContext.beginPath();
			if (yPositionTail >= 0) {
				offscreenContext.ellipse(circleX, yPositionTail, circleRadius - bodyGap, circleRadius - bodyGap, 0, Math.PI, Math.PI * 2);
				offscreenContext.rect(bodyGap, yPositionTail, laneWidth - bodyGap * 2, yPositionHead - yPositionTail);
			} else {
				offscreenContext.rect(bodyGap, 0, laneWidth - bodyGap * 2, yPositionHead);
			}
			offscreenContext.closePath();
			offscreenContext.fill();
			
			offscreenContext.fillStyle = colors.head;
			offscreenContext.beginPath();
			offscreenContext.ellipse(circleX, yPositionHead, circleRadius, circleRadius, 0, 0, Math.PI * 2);
			offscreenContext.closePath();
			offscreenContext.fill();
			
			renderedLongObjects++;
		}
	}
	
	return [renderedNormalObjects, renderedLongObjects];
}

function renderEditContext(
	offscreenContext: OffscreenCanvasRenderingContext2D,
	laneWidth: number,
	laneHeight: number,
	hitPosition: number,
	timestamp: number,
	columnIndex: number,
	nextHitObjects: Array<HitObject>,
	beatmap: OsuBeatmap,
	userOptions: UserOptions,
	canvas: HTMLCanvasElement,
	mouseX: number,
	mouseY: number,
	mode: EditMode,
	dragStartPosition: [number, number] | null,
	currentSelectedHitObjects: Set<HitObject> | null,
): Set<HitObject> {
	const scrollSpeed = userOptions.scrollSpeed;
	const beatSnapDivisor = userOptions.beatSnapDivisor;
	const columnCount = beatmap.difficulty.circleSize;
	const offscreenCanvas = offscreenContext.canvas;
	
	const barHeight = Math.round(laneWidth * (maniaNote1.height / maniaNote1.width));
	const barX = 0;
	const fontColor = 'hsl(0, 0%, 100%)';
	const fontOutlineColor = 'hsl(0, 0%, 0%)';
	const fontOutlineThickness = 2;
	const fontSize = barHeight - 10;
	const fontFamily = 'Arial';
	const fontPadding = 5;
	
	offscreenContext.font = `${fontSize}px '${fontFamily}'`;
	offscreenContext.textAlign = 'left';
	offscreenContext.textBaseline = 'middle';
	
	offscreenContext.fillStyle = 'hsl(0, 0%, 0%)';
	offscreenContext.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
	
	offscreenContext.strokeStyle = 'hsl(0, 100%, 100%)';
	offscreenContext.lineWidth = 1;
	
	offscreenContext.beginPath();
	offscreenContext.moveTo(0.5, 0);
	offscreenContext.lineTo(0.5, laneHeight - 1);
	offscreenContext.closePath();
	offscreenContext.stroke();
	
	offscreenContext.beginPath();
	offscreenContext.moveTo(laneWidth - 0.5, 0);
	offscreenContext.lineTo(laneWidth - 0.5, laneHeight - 1);
	offscreenContext.closePath();
	offscreenContext.stroke();
	
	offscreenContext.fillStyle = 'hsl(84, 100%, 59%)';
	offscreenContext.fillRect(0, Math.round(laneHeight * (hitPosition / 480)), laneWidth, 9);
	
	const currentTimingPoint = beatmap.controlPoints.timingPointAt(timestamp);
	const bpm = Math.max(currentTimingPoint.bpmUnlimited, 0);
	const timeSignature = currentTimingPoint.timeSignature;
	const startingPoint = currentTimingPoint.startTime < timestamp ? currentTimingPoint.startTime : 0;
	let beatStep = 60_000 / bpm;
	let lineIndex = 0;
	
	offscreenContext.fillStyle = 'hsl(0, 0%, 74%)';
	offscreenContext.beginPath();
	while (true) {
		const lineTimestamp = startingPoint + lineIndex * beatStep;
		const yPosition = yPositionFromMillisecondEditor(timestamp, lineTimestamp, scrollSpeed, laneHeight, hitPosition);
		if (yPosition < 0) {
			break;
		}
		
		if (yPosition < laneHeight) {
			offscreenContext.rect(0, yPosition, laneWidth, lineIndex % timeSignature === 0 ? 7 : 2);
		}
		
		lineIndex++;
	}
	
	offscreenContext.closePath();
	offscreenContext.fill();
	
	if (beatSnapDivisor > 1) {
		let fillPattern: Array<string>;
		switch (beatSnapDivisor) {
			case 2: fillPattern = ['', 'hsl(0, 100%, 50%)']; break;
			case 3: fillPattern = ['', 'hsl(300, 100%, 30%)']; break;
			case 4: fillPattern = ['', 'hsl(0, 100%, 50%)', 'hsl(217, 67%, 46%)', 'hsl(0, 100%, 50%)']; break;
			case 5: fillPattern = ['', 'hsl(0, 0%, 49%)']; break;
			case 6: fillPattern = ['', 'hsl(300, 100%, 30%)', 'hsl(0, 100%, 50%)', 'hsl(217, 67%, 46%)', 'hsl(0, 100%, 50%)', 'hsl(300, 100%, 30%)']; break;
			case 7: fillPattern = ['', 'hsl(0, 0%, 49%)']; break;
			case 8: fillPattern = ['', 'hsl(60, 100%, 39%)', 'hsl(0, 100%, 50%)', 'hsl(60, 100%, 39%)', 'hsl(217, 67%, 46%)', 'hsl(60, 100%, 39%)', 'hsl(0, 100%, 50%)', 'hsl(60, 100%, 39%)']; break;
			case 9: fillPattern = ['', 'hsl(0, 0%, 49%)', 'hsl(0, 0%, 49%)', 'hsl(300, 100%, 30%)', 'hsl(0, 0%, 49%)', 'hsl(0, 0%, 49%)', 'hsl(300, 100%, 30%)', 'hsl(0, 0%, 49%)', 'hsl(0, 0%, 49%)']; break;
			case 12: fillPattern = ['', 'hsl(0, 0%, 49%)', 'hsl(300, 38%, 32%)', 'hsl(217, 67%, 46%)', 'hsl(300, 100%, 30%)', 'hsl(0, 0%, 49%)', 'hsl(0, 100%, 39%)', 'hsl(0, 0%, 49%)', 'hsl(300, 100%, 30%)', 'hsl(217, 67%, 46%)', 'hsl(300, 38%, 32%)', 'hsl(0, 0%, 49%)']; break;
			case 16: fillPattern = ['', 'hsl(0, 0%, 49%)']; break;
			default: fillPattern = ['', 'hsl(0, 0%, 80%)']; break;
		}
		
		const rectsByColor: Record<string, Array<number>> = {};
		beatStep /= beatSnapDivisor;
		
		let lineIndex = 0;
		while (true) {
			const lineTimestamp = startingPoint + lineIndex * beatStep;
			const yPosition = yPositionFromMillisecondEditor(timestamp, lineTimestamp, scrollSpeed, laneHeight, hitPosition);
			if (yPosition < 0) {
				break;
			}
			
			if (yPosition < laneHeight && lineIndex % beatSnapDivisor !== 0) {
				const fillStyle = fillPattern[lineIndex % fillPattern.length];
				if (!rectsByColor[fillStyle]) {
					rectsByColor[fillStyle] = [];
				}
				
				rectsByColor[fillStyle].push(yPosition);
			}
			
			lineIndex++;
		}
		
		for (const [fillStyle, rects] of Object.entries(rectsByColor)) {
			offscreenContext.fillStyle = fillStyle;
			offscreenContext.beginPath();
			for (const yPosition of rects) {
				offscreenContext.rect(0, yPosition, laneWidth, 2);
			}
			
			offscreenContext.closePath();
			offscreenContext.fill();
		}
	}
	
	const laneRect = canvas.getBoundingClientRect();
	const [startX, dragTimestamp] = dragStartPosition ?? [Infinity, Infinity];
	const dragY = isFinite(dragTimestamp) ? yPositionFromMillisecondEditor(timestamp, dragTimestamp, scrollSpeed, laneHeight, hitPosition) : Infinity;
	
	const minX = Math.min(startX, mouseX) - laneRect.left;
	const maxX = Math.max(startX, mouseX) - laneRect.left;
	const minY = Math.min(dragY, mouseY - laneRect.top);
	const maxY = Math.max(dragY, mouseY - laneRect.top);
	
	const dragAffectsLane = 0 < maxX && minX < laneRect.width;
	const selectedHitObjects = new Set<HitObject>();
	for (const hitObject of nextHitObjects) {
		const objectColumn = Math.floor(hitObject.startX * columnCount / 512);
		if (columnIndex !== objectColumn) {
			continue;
		}
		
		let yPosition: number | null = null;
		if ((hitObject.hitType & HitType.Normal) !== 0) {
			yPosition = yPositionFromMillisecondEditor(timestamp, hitObject.startTime, scrollSpeed, laneHeight, hitPosition);
			if (yPosition >= 0) {
				let image = maniaNote1;
				if (columnCount === 4 && (columnIndex === 1 || columnIndex === 2)) {
					image = maniaNote2;
				}
				
				offscreenContext.drawImage(image, barX, yPosition - barHeight, laneWidth, barHeight);
				
				if ((mode === EditMode.Selection && dragStartPosition !== null && dragAffectsLane && minY < yPosition && yPosition - barHeight < maxY)
				|| (currentSelectedHitObjects !== null && currentSelectedHitObjects.has(hitObject))) {
					const selectionY = yPosition - barHeight;
					const selectionHeight = barHeight;
					
					offscreenContext.strokeStyle = 'hsla(204, 60%, 50%, 0.3)';
					offscreenContext.fillStyle = 'hsla(204, 60%, 50%, 0.5)';
					offscreenContext.lineWidth = 10;
					offscreenContext.fillRect(barX, selectionY, laneWidth, selectionHeight);
					offscreenContext.strokeRect(barX, selectionY, laneWidth, selectionHeight);
					selectedHitObjects.add(hitObject);
				}
			} else {
				yPosition = null;
			}
		} else if ((hitObject.hitType & HitType.Hold) !== 0) {
			const holdObject = hitObject as HoldableObject;
			const yPositionHead = yPositionFromMillisecondEditor(timestamp, holdObject.startTime, scrollSpeed, laneHeight, hitPosition);
			const yPositionTail = yPositionFromMillisecondEditor(timestamp, holdObject.endTime, scrollSpeed, laneHeight, hitPosition);
			
			if (yPositionHead >= 0) {
				yPosition = yPositionHead;
				
				let imageHead = maniaNote1;
				if (columnCount === 4 && (columnIndex === 1 || columnIndex === 2)) {
					imageHead = maniaNote2;
				}
				
				let imageBody = maniaLongNote1;
				if (columnCount === 4 && (columnIndex === 1 || columnIndex === 2)) {
					imageBody = maniaLongNote2;
				}
				
				offscreenContext.drawImage(imageHead, barX, yPositionHead - barHeight, laneWidth, barHeight);
				offscreenContext.drawImage(imageHead, barX, yPositionTail - barHeight, laneWidth, barHeight);
				offscreenContext.drawImage(imageBody, barX, yPositionTail, laneWidth, yPositionHead - yPositionTail - barHeight);
				
				if ((mode === EditMode.Selection && dragStartPosition !== null && dragAffectsLane && minY < yPositionHead && yPositionTail - barHeight < maxY)
				|| (currentSelectedHitObjects !== null && currentSelectedHitObjects.has(hitObject))) {
					const selectionY = yPositionTail - barHeight;
					const selectionHeight = yPositionHead - yPositionTail + barHeight;
					
					offscreenContext.strokeStyle = 'hsla(204, 60%, 50%, 0.3)';
					offscreenContext.fillStyle = 'hsla(204, 60%, 50%, 0.5)';
					offscreenContext.lineWidth = 10;
					offscreenContext.fillRect(barX, selectionY, laneWidth, selectionHeight);
					offscreenContext.strokeRect(barX, selectionY, laneWidth, selectionHeight);
					selectedHitObjects.add(hitObject);
				}
			}
		}
		
		if (hitObject.hitSound > 0 && yPosition !== null) {
			const hitSounds = new Array<string>();
			const [, whistle, finish, clap] = intToBits(hitObject.hitSound, 4);
			
			if (whistle) {
				hitSounds.push('W');
			}
			
			if (finish) {
				hitSounds.push('F');
			}
			
			if (clap) {
				hitSounds.push('C');
			}
			
			if (hitSounds.length > 0) {
				const text = hitSounds.join('|');
				offscreenContext.fillStyle = fontColor;
				offscreenContext.strokeStyle = fontOutlineColor;
				offscreenContext.lineWidth = fontOutlineThickness;
				offscreenContext.strokeText(text, barX + fontPadding, yPosition - Math.round(barHeight / 2), laneWidth - fontPadding * 2);
				offscreenContext.fillText(text, barX + fontPadding, yPosition - Math.round(barHeight / 2), laneWidth - fontPadding * 2);
			}
		}
	}
	
	switch (mode) {
		case EditMode.HitObject: {
			if (laneRect.left < mouseX && mouseX < laneRect.right && laneRect.top < mouseY && mouseY < laneRect.bottom) {
				const yPosition = mouseY - laneRect.top;
				let image = maniaNote1;
				if (columnCount === 4 && (columnIndex === 1 || columnIndex === 2)) {
					image = maniaNote2;
				}
				
				offscreenContext.globalAlpha = 0.5;
				offscreenContext.drawImage(image, barX, yPosition - barHeight, laneWidth, barHeight);
				offscreenContext.globalAlpha = 0;
			}
			
			break;
		}
		case EditMode.Selection: {
			if (dragStartPosition === null) {
				break;
			}
			
			offscreenContext.strokeStyle = 'hsla(204, 60%, 50%, 0.3)';
			offscreenContext.fillStyle = 'hsla(204, 60%, 50%, 0.5)';
			offscreenContext.lineWidth = 10;
			
			offscreenContext.fillRect(minX, minY, maxX - minX, maxY - minY);
			offscreenContext.strokeRect(minX, minY, maxX - minX, maxY - minY);
			
			break;
		}
	}
	
	return selectedHitObjects;
}

interface Section1Props {
	beatmap: OsuBeatmap;
	sectionRef: React.MutableRefObject<HTMLDivElement | null>;
	musicRef: React.MutableRefObject<HTMLAudioElement | null>;
	userOptions: UserOptions;
	isPlaying: boolean;
	setPlaying: ReactSet<boolean>;
	timestamp: number;
	setTimestamp: ReactSet<number>;
	setRenderedHitObjects: ReactSet<{ normal: number, long: number }>;
	mode: EditMode;
	setMode: ReactSet<EditMode>;
}

const Section1: React.FC<Section1Props> = ({
	beatmap,
	sectionRef,
	musicRef,
	userOptions,
	isPlaying,
	setPlaying,
	timestamp,
	setTimestamp,
	setRenderedHitObjects,
	mode,
	setMode,
}) => {
	const [normalUrl, setNormalUrl] = useState<string>(normalHitSound);
	const [clapUrl, setClapUrl] = useState<string>(clapHitSound);
	const [finishUrl, setFinishUrl] = useState<string>(finishHitSound);
	const [whistleUrl, setWhistleUrl] = useState<string>(whistleHitSound);
	const [changedBeatmap, setChangedBeatmap] = useState<string>('');
	const playHitSound = useHitsound(normalUrl, clapUrl, finishUrl, whistleUrl);
	
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [laneWidth, setLaneWidth] = useState<number | null>(null);
	const [laneHeight, setLaneHeight] = useState<number | null>(null);
	const [mouseX, setMouseX] = useState<number>(0);
	const [mouseY, setMouseY] = useState<number>(0);
	const [dragStartPosition, setDragStartPosition] = useState<[number, number] | null>(null);
	// ^ this is NOT (mouseX, mouseY), it is (mouseX, timestamp) where timestamp is in milliseconds
	const [selectedHitObjects, setSelectedHitObjects] = useState<Set<HitObject> | null>(null);
	
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const editCanvasRefs = useRef<Map<number, [HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D]>>(new Map());
	const previewCanvasRefs = useRef<Map<number, [HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D]>>(new Map());
	const keyCount = beatmap.difficulty.circleSize;
	
	useEffect(() => {
		const previewCanvases = previewCanvasRefs.current; // TIL plural of canvas is canvases, its so stupid
		const editCanvases = editCanvasRefs.current;
		if (previewCanvases.size !== keyCount || editCanvases.size !== keyCount || laneWidth === null || laneHeight === null) {
			return;
		}
		
		const hitPosition = userOptions.hitPosition;
		const timingPoints = beatmap.controlPoints.timingPoints;
		const difficultyPoints = beatmap.controlPoints.difficultyPoints;
		const hitObjects = beatmap.hitObjects;
		let nextHitObjects = new Array<HitObject>();
		
		const currentTimingPoint = beatmap.controlPoints.timingPointAt(timestamp);
		const bpm = Math.max(currentTimingPoint.bpmUnlimited, 0);
		const currentDifficultyPoint = beatmap.controlPoints.difficultyPointAt(timestamp);
		const sliderVelocity = currentDifficultyPoint.sliderVelocityUnlimited;
		const nextTimings = timingPoints.slice(timingPoints.indexOf(currentTimingPoint) + 1);
		const nextDiffs = difficultyPoints.slice(difficultyPoints.indexOf(currentDifficultyPoint) + 1);
		
		for (let i = 0; i < hitObjects.length; i++) {
			const hitObject = hitObjects[i];
			if (hitObject.startTime > timestamp + 10_000) {
				break;
			}
			
			if ((hitObject.hitType & HitType.Normal) !== 0) {
				if (hitObject.startTime < timestamp - 2_000) {
					continue;
				}
				
				nextHitObjects.push(hitObject);
			} else if ((hitObject.hitType & HitType.Hold) !== 0) {
				const holdObject = hitObject as HoldableObject;
				if (holdObject.endTime < timestamp - 2_000) {
					continue;
				}
				
				nextHitObjects.push(hitObject);
			}
		}
		
		const renderedHitObjects = {
			normal: 0,
			long: 0,
		};
		
		for (const [i, [, context, offscreenCanvas, offscreenContext]] of previewCanvases) {
			offscreenCanvas.width = laneWidth;
			offscreenCanvas.height = laneHeight;
			
			// const hitPosition = (Math.sin((timestamp / Math.PI) / 100 + (i / Math.PI) * 5) + 1) / 2 * (Math.cos(timestamp / Math.PI / 100 + i * 3) * 50) + 400;
			// ^ lol
			
			const [renderedNormalObjects, renderedLongObjects] = renderPreviewContext(
				offscreenContext,
				laneWidth,
				laneHeight,
				hitPosition,
				timestamp,
				keyCount,
				i,
				userOptions.scrollSpeed,
				bpm,
				sliderVelocity,
				nextTimings,
				nextDiffs,
				nextHitObjects,
			);
			
			context.drawImage(offscreenCanvas, 0, 0);
			
			renderedHitObjects.normal += renderedNormalObjects;
			renderedHitObjects.long += renderedLongObjects;
		}
		
		setRenderedHitObjects(renderedHitObjects);
		
		const totalSelectedHitObjects = new Set<HitObject>();
		for (const [columnIndex, [canvas, context, offscreenCanvas, offscreenContext]] of editCanvases) {
			offscreenCanvas.width = laneWidth;
			offscreenCanvas.height = laneHeight;
			
			const newSelectedHitObjects = renderEditContext(
				offscreenContext,
				laneWidth,
				laneHeight,
				hitPosition,
				timestamp,
				columnIndex,
				nextHitObjects,
				beatmap,
				userOptions,
				canvas,
				mouseX,
				mouseY,
				mode,
				dragStartPosition,
				selectedHitObjects,
			);
			
			context.drawImage(offscreenCanvas, 0, 0);
			for (const newHitObject of newSelectedHitObjects) {
				totalSelectedHitObjects.add(newHitObject);
			}
		}
		
		if (mode === EditMode.Selection) {
			setSelectedHitObjects((selectedHitObjects) => {
				if (selectedHitObjects !== null) {
					for (const hitObject of selectedHitObjects) {
						totalSelectedHitObjects.add(hitObject);
					}
				}
				
				return totalSelectedHitObjects;
			});
		}
	}, [previewCanvasRefs, editCanvasRefs, laneWidth, laneHeight, timestamp, userOptions, mouseX, mouseY, changedBeatmap, mode, dragStartPosition]);
	useEffect(() => {
		const video = videoRef.current;
		if (!video || isPlaying) {
			return;
		}
		
		video.currentTime = timestamp / 1_000;
	}, [videoRef, isPlaying, timestamp]);
	
	useEffect(() => {
		if (!sectionRef.current) {
			return;
		}
		
		console.log('Loaded HitObject editor for Mania:', beatmap);
		
		const observer = new ResizeObserver(() => {
			if (!sectionRef.current) {
				setLaneWidth(null);
				setLaneHeight(null);
				return;
			}
			
			const boundingRect = sectionRef.current.getBoundingClientRect();
			const laneWidth = Math.round(boundingRect.width * userOptions.laneWidthPercent * 0.01) / keyCount;
			const laneHeight = Math.round(boundingRect.height);
			setLaneWidth(laneWidth);
			setLaneHeight(laneHeight);
		});
		
		observer.observe(sectionRef.current);
		return () => observer.disconnect();
	}, [sectionRef, userOptions]);
	
	useEffect(() => {
		const music = musicRef.current;
		const video = videoRef.current;
		if (!music) {
			return;
		}
		
		music.pause();
		video?.pause();
		if ('mediaSession' in navigator) {
			navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'none';
		}
		
		if (!isPlaying) {
			return;
		}
		
		let nextHitObject: number = 0;
		let shouldUpdate = true;
		const update = () => {
			if (shouldUpdate) {
				requestAnimationFrame(update);
			}
			
			const newTimestamp = music.currentTime * 1_000;
			setTimestamp(newTimestamp);
			
			while (nextHitObject < beatmap.hitObjects.length) {
				const hitObject = beatmap.hitObjects[nextHitObject];
				if (hitObject.startTime > newTimestamp) {
					break;
				}
				
				playHitSound(0.2, hitObject.hitSound);
				nextHitObject++;
			}
		};
		
		music.currentTime = timestamp / 1_000;
		music.volume = 0.4;
		music.play();
		music.onended = () => setPlaying(false);
		if (video !== null) {
			video.currentTime = music.currentTime;
			video.volume = 0;
			video.play();
		}
		
		nextHitObject = beatmap.hitObjects.findIndex((hitObject) => hitObject.startTime >= timestamp);
		if (nextHitObject === -1) {
			nextHitObject = beatmap.hitObjects.length;
		}
		
		requestAnimationFrame(update);
		return () => {
			shouldUpdate = false;
			
			music.onended = null;
			music.pause();
			video?.pause();
		};
	}, [isPlaying, musicRef, videoRef]);
	
	useEffect(() => {
		const music = musicRef.current;
		if (music !== null) {
			music.playbackRate = userOptions.playBackSpeed;
			music.preservesPitch = !userOptions.speedAdjustsPitch;
		}
		
		const video = videoRef.current;
		if (video !== null) {
			video.playbackRate = userOptions.playBackSpeed;
		}
	}, [musicRef, videoRef, userOptions.playBackSpeed, userOptions.speedAdjustsPitch]);
	
	useEffect(() => {
		const video = videoRef.current;
		if (video === null) {
			return;
		}
		
		const fadeDuration = 1;
		let opacity = 1;
		const seconds = timestamp / 1_000;
		if (seconds < fadeDuration) {
			opacity = seconds / fadeDuration;
		} else if (seconds > video.duration - fadeDuration) {
			opacity = Math.max((video.duration - seconds) / fadeDuration, 0);
		}
		
		video.style.opacity = opacity.toString();
	}, [timestamp, videoRef]);
	
	useEffect(() => {
		setVideoPath(null);
		
		const videoBackground = beatmap.events.storyboard?.getLayerByName('Video');
		if (videoBackground?.elements && videoBackground.elements[0] !== undefined) {
			const filePath = joinPaths(beatmap.songPath, videoBackground.elements[0].filePath);
			
			exists(filePath)
				.then((doesExist) => {
					if (doesExist) {
						setVideoPath(filePath);
					}
				})
		}
		
		readDir(beatmap.songPath)
			.then(async (entries) => {
				const hitSounds = {
					'normal-hitnormal': HitSound.Normal,
					'normal-hitclap': HitSound.Clap,
					'normal-hitfinish': HitSound.Finish,
					'normal-hitwhistle': HitSound.Whistle,
				};
				
				const audioFiles = new Set(['mp3', 'ogg', 'wav']);
				
				for (const entry of entries) {
					if (!entry.isFile || entry.isSymlink) {
						continue;
					}
					
					const fileName = entry.name;
					const name = getFileName(fileName);
					const extension = getExtension(fileName);
					if (!audioFiles.has(extension) || !(name in hitSounds)) {
						continue;
					}
					
					const url = joinPaths(beatmap.songPath, entry.name);
					const appliedHitSound = hitSounds[name as keyof typeof hitSounds];
					
					switch (appliedHitSound) {
						case HitSound.Normal: {
							setNormalUrl(convertFileSrc(url));
							break;
						}
						case HitSound.Clap: {
							setClapUrl(convertFileSrc(url));
							break;
						}
						case HitSound.Finish: {
							setFinishUrl(convertFileSrc(url));
							break;
						}
						case HitSound.Whistle: {
							setWhistleUrl(convertFileSrc(url));
							break;
						}
					}
					
					console.log('Custom hit sound found in beatmap');
					console.log('> url =', url);
					console.log('> appliedHitSound =', HitSound[appliedHitSound]);
				}
			});
	}, [beatmap]);
	
	useEffect(() => {
		const columnCount = beatmap.difficulty.circleSize;
		const editCanvases = editCanvasRefs.current;
		const section = sectionRef.current;
		if (editCanvases.size !== columnCount || section === null) {
			return;
		}
		
		const onMouseEvent = (event: MouseEvent) => {
			switch (event.button) {
				case 0: {
					switch (mode) {
						case EditMode.HitObject: {
							if (event.type !== 'mousedown') {
								break;
							}
							
							for (const [columnIndex, [laneCanvas]] of editCanvasRefs.current) {
								if (event.target === laneCanvas) {
									const { scrollSpeed, hitPosition, beatSnapDivisor } = userOptions;
									
									const laneRect = laneCanvas.getBoundingClientRect();
									const laneHeight = laneRect.height;
									const yPosition = event.clientY - laneRect.top;
									let targetMillisecond = millisecondFromYPositionEditor(timestamp, yPosition, scrollSpeed, laneHeight, hitPosition);
									
									const currentTimingPoint = beatmap.controlPoints.timingPointAt(timestamp);
									const startingPoint = currentTimingPoint.startTime < timestamp ? currentTimingPoint.startTime : 0;
									let beatStep = 60_000 / Math.max(currentTimingPoint.bpmUnlimited, 0) / beatSnapDivisor;
									let lineIndex = 0;
									
									let closestTime = targetMillisecond;
									let closestDistance = Infinity;
									while (true) {
										const lineTime = startingPoint + lineIndex * beatStep;
										const yPosition = yPositionFromMillisecondEditor(timestamp, lineTime, scrollSpeed, laneHeight, hitPosition);
										if (yPosition < -laneHeight) {
											break;
										}
										
										if (yPosition < laneHeight * 2) {
											const distance = Math.abs(lineTime - targetMillisecond);
											if (distance < closestDistance) {
												closestTime = lineTime;
												closestDistance = distance;
											}
										}
										
										lineIndex++;
									}
									
									const hittableObject = new HittableObject();
									hittableObject.hitType = HitType.Normal;
									hittableObject.startTime = closestTime;
									hittableObject.startX = columnIndex * 128 + 64;
									hittableObject.startY = 192;
									
									beatmap.hitObjects.push(hittableObject);
									beatmap.hitObjects.sort((a, b) => a.startTime - b.startTime);
									console.log('added hitObject at', closestTime);
									
									setChangedBeatmap(crypto.randomUUID());
									
									break;
								}
							}
							break;
						}
						case EditMode.Selection: {
							if (event.type === 'mousedown') {
								for (const [, [laneCanvas]] of editCanvasRefs.current) {
									if (event.target === laneCanvas) {
										const laneRect = laneCanvas.getBoundingClientRect();
										const millisecond = millisecondFromYPositionEditor(
											timestamp,
											event.clientY - laneRect.top,
											userOptions.scrollSpeed,
											laneRect.height,
											userOptions.hitPosition,
										);
										
										setDragStartPosition([event.clientX, millisecond]);
										setSelectedHitObjects(null);
										
										return;
									}
								}
							}
							
							setDragStartPosition(null);
							
							break;
						}
					}
					
					break;
				}
				case 2: {
					break;
				}
			}
		};
		
		const onContextMenu = (event: MouseEvent) => {
			event.preventDefault();
		};
		
		section.addEventListener('mousedown', onMouseEvent);
		section.addEventListener('mouseup', onMouseEvent);
		section.addEventListener('contextmenu', onContextMenu);
		
		return () => {
			section.removeEventListener('mousedown', onMouseEvent);
			section.removeEventListener('mouseup', onMouseEvent);
			section.removeEventListener('contextmenu', onContextMenu);
		}
	}, [editCanvasRefs, sectionRef, timestamp, userOptions.scrollSpeed, userOptions.hitPosition, userOptions.beatSnapDivisor, mode]);
	
	useEffect(() => {
		const columnCount = beatmap.difficulty.circleSize;
		const editCanvases = editCanvasRefs.current;
		const section = sectionRef.current;
		if (editCanvases.size !== columnCount || section === null) {
			return;
		}
		
		const onMouseMove = (event: MouseEvent) => {
			setMouseX(event.clientX);
			setMouseY(event.clientY);
		};
		
		window.addEventListener('mousemove', onMouseMove);
		
		return () => {
			window.removeEventListener('mousemove', onMouseMove);
		};
	}, [editCanvasRefs, sectionRef]);
	
	useEffect(() => {
		setSelectedHitObjects(null);
		setDragStartPosition(null);
	}, [mode]);
	
	useEffect(() => {
		const keyPressListener = (event: KeyboardEvent) => {
			switch (event.code) {
				case 'Digit1': {
					setMode(EditMode.Selection);
					break;
				}
				case 'Digit2': {
					setMode(EditMode.HitObject);
					break;
				}
				case 'Digit3': {
					setMode(EditMode.Delete);
					break;
				}
				case 'Escape': {
					setSelectedHitObjects(null);
					break;
				}
			}
		};
		
		window.addEventListener('keydown', keyPressListener);
		return () => {
			window.removeEventListener('keydown', keyPressListener);
		};
	}, []);
	
	return (
		<>
			<div
				className={'section s1'}
				ref={sectionRef}
				onWheel={(event) => {
					const music = musicRef.current;
					if (music === null) {
						return;
					}
					
					const direction = Math.sign(event.deltaY);
					const newTimestamp = clamp(timestamp + 1_000 * direction, 0, 1_000 * music.duration);
					
					if (isPlaying) {
						setPlaying(false);
						setTimeout(() => {
							setTimestamp(newTimestamp);
							
							setTimeout(setPlaying, 50, true);
						}, 50);
					} else {
						setTimestamp(newTimestamp);
					}
				}}
			>
				{beatmap.events.backgroundPath && (
					<img
						className={'imgBackground'}
						src={convertFileSrc(joinPaths(beatmap.songPath, beatmap.events.backgroundPath))}
						draggable={false}
						/>
					)}
				{videoPath && (
					<video
						ref={videoRef}
						className={'videoBackground'}
						muted={true}
						playsInline={true}
						controls={false}
						src={convertFileSrc(videoPath)}
						draggable={false}
					/>
				)}
				<div className={'hitObjectEditor preview'}>
					{new Array(keyCount).fill(undefined).map((_value, i) => {
						return (
							<canvas
								className={'lane'}
								key={i}
								width={laneWidth ?? 1}
								height={laneHeight ?? 1}
								style={{
									width: `${laneWidth}px`,
									height: `${laneHeight}px`,
								}}
								ref={(element) => {
									previewCanvasRefs.current.delete(i);
									
									const context = element?.getContext('2d');
									if (element === null || !context) {
										return;
									}
									
									const offscreenCanvas = new OffscreenCanvas(1, 1);
									const offscreenContext = offscreenCanvas.getContext('2d');
									if (!offscreenContext) {
										return;
									}
									
									previewCanvasRefs.current.set(i, [element, context, offscreenCanvas, offscreenContext]);
								}}
							/>
						);
					})}
				</div>
				<div className={'hitObjectEditor edit'}>
					{new Array(keyCount).fill(undefined).map((_value, i) => {
						return (
							<canvas
								className={'lane'}
								key={i}
								width={laneWidth ?? 1}
								height={laneHeight ?? 1}
								style={{
									width: `${laneWidth}px`,
									height: `${laneHeight}px`,
									cursor: mode === EditMode.Selection ? 'crosshair' : mode === EditMode.Delete ? 'default' : 'cell',
								}}
								ref={(element) => {
									editCanvasRefs.current.delete(i);
									
									const context = element?.getContext('2d');
									if (element === null || !context) {
										return;
									}
									
									const offscreenCanvas = new OffscreenCanvas(1, 1);
									const offscreenContext = offscreenCanvas.getContext('2d');
									if (!offscreenContext) {
										return;
									}
									
									editCanvasRefs.current.set(i, [element, context, offscreenCanvas, offscreenContext]);
								}}
							/>
						);
					})}
				</div>
				<div className={'modeSelector'}>
					<button
						onClick={(event) => {
							if (event.detail === 0) {
								return;
							}
							
							setMode(EditMode.Selection);
						}}
						className={'mode' + (mode === EditMode.Selection ? ' selected' : '')}
						tabIndex={-1}
					>
						<img className={'icon'} src={editorModeSelectionIcon} />
						<p className={'label'}>Selection</p>
					</button>
					<button
						onClick={(event) => {
							if (event.detail === 0) {
								return;
							}
							
							setMode(EditMode.HitObject);
						}}
						className={'mode' + (mode === EditMode.HitObject ? ' selected' : '')}
						tabIndex={-1}
					>
						<img className={'icon'} src={editorModeNormalIcon} />
						<p className={'label'}>HitObject</p>
					</button>
					<button
						onClick={(event) => {
							if (event.detail === 0) {
								return;
							}
							
							setMode(EditMode.Delete);
						}}
						className={'mode' + (mode === EditMode.Delete ? ' selected' : '')}
						tabIndex={-1}
					>
						<img className={'icon'} src={editorModeLongIcon} />
						<p className={'label'}>Delete</p>
					</button>
				</div>
			</div>
		</>
	);
};

export default Section1;
