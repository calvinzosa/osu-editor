import { useCallback, useEffect, useRef, useState } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';
import { exists, readDir } from '@tauri-apps/plugin-fs';
import { DifficultyPoint, HitObject, HitSound, HitType, TimingPoint } from 'osu-classes';
import { HoldableObject } from 'osu-parsers';

import { useEditor } from '../Provider';

import { clamp, intToBits } from '@/utils';
import { yPositionFromMillisecond, yPositionFromMillisecondEditor, OsuBeatmap, useHitsound, millisecondFromYPositionEditor, isLongHitObject, isNormalHitObject, getClosestTime, addHitObject } from '@/utils/Beatmap';
import { getExtension, getFileName, joinPaths } from '@/utils/File';
import { Coordinate, Dimensions, EditMode, ReactSet, UserOptions } from '@/utils/Types';

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

interface HitSoundUrls {
	normal: string;
	clap: string;
	finish: string;
	whistle: string;
}

function renderPreviewContext(
	offscreenContext: OffscreenCanvasRenderingContext2D,
	laneSize: Dimensions,
	timestamp: number,
	columnCount: number,
	columnIndex: number,
	bpm: number,
	sliderVelocity: number,
	userOptions: UserOptions,
	nextTimings: Array<TimingPoint>,
	nextDiffs: Array<DifficultyPoint>,
	nextHitObjects: Array<HitObject>,
): [number, number] {
	const { width: laneWidth, height: laneHeight } = laneSize;
	const { hitPosition } = userOptions;
	
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
		
		const yPosition = yPositionFromMillisecond(timestamp, lineTime, bpm, sliderVelocity, laneHeight, userOptions, nextTimings, nextDiffs);
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
		
		if (isNormalHitObject(hitObject)) {
			if (hitObject.startTime < timestamp) {
				continue;
			}
			
			const yPosition = yPositionFromMillisecond(
				timestamp,
				hitObject.startTime,
				bpm,
				sliderVelocity,
				laneHeight,
				userOptions,
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
		} else if (isLongHitObject(hitObject)) {
			if (hitObject.endTime < timestamp) {
				continue;
			}
			
			const yPositionHead = Math.min(
				laneHeight * (hitPosition / 480),
				yPositionFromMillisecond(
					timestamp,
					hitObject.startTime,
					bpm,
					sliderVelocity,
					laneHeight,
					userOptions,
					nextTimings,
					nextDiffs,
				),
			);
			
			const yPositionTail = yPositionFromMillisecond(
				timestamp,
				hitObject.endTime,
				bpm,
				sliderVelocity,
				laneHeight,
				userOptions,
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
	laneSize: Dimensions,
	timestamp: number,
	columnIndex: number,
	nextHitObjects: Array<HitObject>,
	beatmap: OsuBeatmap,
	userOptions: UserOptions,
	canvas: HTMLCanvasElement,
	mouse: Coordinate,
	mode: EditMode,
	dragPosition: { x: number, millisecond: number } | null,
	currentSelectedHitObjects: Set<HitObject> | null,
	setHoveredState: ReactSet<{ hitObject: HitObject, side: 'head' | 'tail' } | null>,
	isGrabbing: boolean,
): Set<HitObject> {
	const { width: laneWidth, height: laneHeight } = laneSize;
	const { beatSnapDivisor, hitPosition } = userOptions;
	
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
		const yPosition = yPositionFromMillisecondEditor(timestamp, lineTimestamp, laneHeight, userOptions);
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
			const yPosition = yPositionFromMillisecondEditor(timestamp, lineTimestamp, laneHeight, userOptions);
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
	const { x: dragX, millisecond: dragMillisecond } = dragPosition ?? { x: Infinity, millisecond: Infinity };
	const dragY = isFinite(dragMillisecond) ? yPositionFromMillisecondEditor(timestamp, dragMillisecond, laneHeight, userOptions) : Infinity;
	
	const minX = Math.min(dragX, mouse.x) - laneRect.left;
	const maxX = Math.max(dragX, mouse.x) - laneRect.left;
	const minY = Math.min(dragY, mouse.y - laneRect.top);
	const maxY = Math.max(dragY, mouse.y - laneRect.top);
	
	const dragAffectsLane = 0 < maxX && minX < laneRect.width;
	const selectedHitObjects = new Set<HitObject>();
	const renderedHitObjects = new Set<[HitObject, number, number]>();
	for (const hitObject of nextHitObjects) {
		const objectColumn = Math.floor(hitObject.startX * columnCount / 512);
		if (columnIndex !== objectColumn) {
			continue;
		}
		
		let yPosition: number | null = null;
		if (isNormalHitObject(hitObject)) {
			yPosition = yPositionFromMillisecondEditor(timestamp, hitObject.startTime, laneHeight, userOptions);
			if (yPosition >= 0) {
				let image = maniaNote1;
				if (columnCount === 4 && (columnIndex === 1 || columnIndex === 2)) {
					image = maniaNote2;
				}
				
				offscreenContext.drawImage(image, barX, yPosition - barHeight, laneWidth, barHeight);
				renderedHitObjects.add([hitObject, yPosition, NaN]);
				
				if ((mode === EditMode.Selection && dragPosition !== null && dragAffectsLane && minY < yPosition && yPosition - barHeight < maxY)
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
		} else if (isLongHitObject(hitObject)) {
			const yPositionHead = yPositionFromMillisecondEditor(timestamp, hitObject.startTime, laneHeight, userOptions);
			const yPositionTail = yPositionFromMillisecondEditor(timestamp, hitObject.endTime, laneHeight, userOptions);
			
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
				renderedHitObjects.add([hitObject, yPositionHead, yPositionTail]);
				
				if ((mode === EditMode.Selection && dragPosition !== null && dragAffectsLane && minY < yPositionHead && yPositionTail - barHeight < maxY)
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
	
	const isMouseOnLane = laneRect.left < mouse.x && mouse.x < laneRect.right && laneRect.top < mouse.y && mouse.y < laneRect.bottom;
	switch (mode) {
		case EditMode.HitObject: {
			canvas.style.cursor = 'cell';
			if (isGrabbing) {
				canvas.style.cursor = 'grabbing';
				break;
			}
			
			if (!isMouseOnLane) {
				break;
			}
			
			let canAddHitObject = true;
			let hoveredHitObject: HitObject | null = null;
			let hoveredSide: 'head' | 'tail' = 'head';
			for (const data of renderedHitObjects) {
				const [hitObject] = data;
				
				if (isNormalHitObject(hitObject)) {
					const [, yPosition] = data;
					
					if (mouse.y < yPosition + barHeight && mouse.y > yPosition) {
						hoveredHitObject = hitObject;
						break;
					}
				} else if (isLongHitObject(hitObject)) {
					const [, yPositionHead, yPositionTail] = data;
					
					if (mouse.y < yPositionTail + barHeight && mouse.y > yPositionTail) {
						hoveredHitObject = hitObject;
						hoveredSide = 'tail';
						break;
					} else if (mouse.y < yPositionHead + barHeight && mouse.y > yPositionHead) {
						hoveredHitObject = hitObject;
						hoveredSide = 'head';
						break;
					} else if (mouse.y < yPositionHead + barHeight && mouse.y > yPositionTail + barHeight) {
						canAddHitObject = false;
						break;
					}
				}
			}
			
			if (!canAddHitObject) {
				canvas.style.cursor = 'not-allowed';
				break;
			}
			
			if (hoveredHitObject !== null) {
				setHoveredState({ hitObject: hoveredHitObject, side: hoveredSide });
				
				canvas.style.cursor = 'grab';
				if (isLongHitObject(hoveredHitObject) && hoveredSide === 'tail') {
					canvas.style.cursor = 'n-resize';
				}
			} else {
				setHoveredState(null);
				
				const yPosition = mouse.y - laneRect.top;
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
			canvas.style.cursor = 'crosshair';
			
			if (dragPosition === null) {
				break;
			}
			
			offscreenContext.strokeStyle = 'hsla(204, 60%, 50%, 0.3)';
			offscreenContext.fillStyle = 'hsla(204, 60%, 50%, 0.5)';
			offscreenContext.lineWidth = 10;
			
			offscreenContext.fillRect(minX, minY, maxX - minX, maxY - minY);
			offscreenContext.strokeRect(minX, minY, maxX - minX, maxY - minY);
			
			break;
		}
		case EditMode.Delete: {
			canvas.style.cursor = 'default';
			
			if (!isMouseOnLane) {
				break;
			}
			
			let isHovering = false;
			
			offscreenContext.strokeStyle = 'hsla(0, 100%, 50%, 0.3)';
			offscreenContext.fillStyle = 'hsla(0, 100%, 50%, 0.5)';
			offscreenContext.lineWidth = 10;
			for (const data of renderedHitObjects) {
				const [hitObject] = data;
				
				if (isNormalHitObject(hitObject)) {
					const [, yPosition] = data;
					
					if (mouse.y < yPosition + barHeight && mouse.y > yPosition) {
						offscreenContext.fillRect(0, yPosition - barHeight, laneWidth, barHeight);
						offscreenContext.strokeRect(0, yPosition - barHeight, laneWidth, barHeight);
						setHoveredState({ hitObject, side: 'head' });
						isHovering = true;
						
						break;
					}
				} else if (isLongHitObject(hitObject)) {
					const [, yPositionHead, yPositionTail] = data;
					
					if (mouse.y < yPositionHead + barHeight && mouse.y > yPositionTail) {
						const rectY = yPositionTail - barHeight;
						const rectHeight = yPositionHead - yPositionTail + barHeight;
						offscreenContext.fillRect(0, rectY, laneWidth, rectHeight);
						setHoveredState({ hitObject, side: 'head' });
						isHovering = true;
						
						break;
					}
				}
			}
			
			if (isHovering) {
				canvas.style.cursor = 'pointer';
		 	} else {
				setHoveredState(null);
			}
			
			break;
		}
	}
	
	return selectedHitObjects;
}

const Section1: React.FC = () => {
	const { beatmap, userOptions, isPlaying, setPlaying, mode, setMode, timestamp, setTimestamp, setRenderedHitObjects, musicRef } = useEditor();
	const columnCount = beatmap.difficulty.circleSize;
	
	const [hitSoundUrls, setHitSoundUrls] = useState<HitSoundUrls>({
		normal: normalHitSound,
		clap: clapHitSound,
		finish: finishHitSound,
		whistle: whistleHitSound,
	});
	
	const playHitSound = useHitsound(hitSoundUrls.normal, hitSoundUrls.clap, hitSoundUrls.finish, hitSoundUrls.whistle);
	
	const [changedBeatmap, setChangedBeatmap] = useState<string>('');
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [laneSize, setLaneSize] = useState<Dimensions | null>(null);
	const [mouse, setMouse] = useState<Coordinate>({ x: 0, y: 0 });
	const [dragPosition, setDragPosition] = useState<{ x: number, millisecond: number } | null>(null);
	const [selectedHitObjects, setSelectedHitObjects] = useState<Set<HitObject> | null>(null);
	const [hoveredState, setHoveredState] = useState<{ hitObject: HitObject, side: 'head' | 'tail' } | null>(null);
	const [grabbedState, setGrabbedState] = useState<{ hitObject: HitObject, side: 'head' | 'tail' } | null>(null);
	
	const mainSectionRef = useRef<HTMLDivElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const shortTimelineRef = useRef<HTMLCanvasElement | null>(null);
	const shortTimelineContext = useRef<CanvasRenderingContext2D | null>(null);
	const editCanvasRefs = useRef<Map<number, [HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D]>>(new Map());
	const previewCanvasRefs = useRef<Map<number, [HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D]>>(new Map());
	
	const onMouseEvent = useCallback((event: MouseEvent) => {
		if (event.type === 'mousemove') {
			setMouse({ x: event.clientX, y: event.clientY });
		} else if (event.type === 'mouseup') {
			setGrabbedState(null);
			setDragPosition(null);
			return;
		}
		
		if (event.button !== 0) {
			return;
		}
		
		for (const [columnIndex, [laneCanvas]] of editCanvasRefs.current) {
			if (event.target !== laneCanvas) {
				continue;
			}
			
			const laneRect = laneCanvas.getBoundingClientRect();
			const laneHeight = laneRect.height;
			const yPosition = event.clientY - laneRect.top;
			const targetMillisecond = millisecondFromYPositionEditor(timestamp, yPosition, laneHeight, userOptions);
			const closestMillisecond = getClosestTime(beatmap, timestamp, targetMillisecond, laneHeight, userOptions);
			if (event.type === 'mousemove' && grabbedState !== null) {
				const { hitObject, side } = grabbedState;
				const isNormal = isNormalHitObject(hitObject);
				const isLong = isLongHitObject(hitObject);
				let changed = false;
				if (isNormal || (isLong && side === 'head')) {
					if (isNormal && event.shiftKey) {
						if (closestMillisecond !== Math.round(hitObject.startTime)) {
							const index = beatmap.hitObjects.indexOf(hitObject);
							if (index !== -1) {
								const holdableObject = new HoldableObject();
								holdableObject.startX = hitObject.startX;
								holdableObject.startY = hitObject.startY;
								holdableObject.startTime = hitObject.startTime;
								holdableObject.hitType = (hitObject.hitType & ~HitType.Normal) | HitType.Hold;
								holdableObject.hitSound = hitObject.hitSound;
								holdableObject.endTime = closestMillisecond;
								
								beatmap.hitObjects.splice(index, 1, holdableObject);
								changed = true;
								setGrabbedState({ hitObject: holdableObject, side: 'tail' });
							}
						}
					} else {
						changed = grabbedState.hitObject.startTime !== closestMillisecond;
						if (isNormal) {
							hitObject.startTime = closestMillisecond;
						} else if (isLong) {
							hitObject.endTime = closestMillisecond + hitObject.duration;
							hitObject.startTime = closestMillisecond;
						}
					}
				} else if (isLong && side === 'tail') {
					changed = hitObject.endTime !== closestMillisecond;
					hitObject.endTime = closestMillisecond;
				}
				
				if (isLong && hitObject.duration < 1) {
					console.log('deleting', hitObject);
					console.log('hitObject.duration =', hitObject.duration);
					hitObject.hitType = (hitObject.hitType & ~HitType.Hold) | HitType.Normal;
					delete (hitObject as any).endTime;
					delete (hitObject as any).nodeSamples;
					delete (hitObject as any).duration;
				}
				
				if (changed) {
					setChangedBeatmap(crypto.randomUUID());
				}
				
				return;
			}
			
			const columnCount = beatmap.difficulty.circleSize;
			const isLeftButton = (event.buttons & 1) !== 0;
			const isRightButton = (event.buttons & 2) !== 0;
			if (mode === EditMode.Delete || (mode === EditMode.HitObject && isRightButton)) {
				if (event.type !== 'mousedown' && (event.type !== 'mousemove' || (!isLeftButton && !isRightButton))) {
					return;
				}
				
				if (hoveredState !== null) {
					const index = beatmap.hitObjects.indexOf(hoveredState.hitObject);
					if (index !== -1) {
						beatmap.hitObjects.splice(index, 1);
					}
				}
			} else if (mode === EditMode.HitObject) {
				if (event.type !== 'mousedown') {
					return;
				}
				
				if (hoveredState !== null) {
					setGrabbedState({ hitObject: hoveredState.hitObject, side: hoveredState.side });
				} else {
					addHitObject(beatmap, columnIndex, columnCount, closestMillisecond);
					setChangedBeatmap(crypto.randomUUID());
				}
			} else if (mode === EditMode.Selection) {
				if (event.type === 'mousemove') {
					return;
				}
				
				if (event.type === 'mousedown') {
					setDragPosition({ x: event.clientX, millisecond: targetMillisecond });
					setSelectedHitObjects(null);
				} else {
					setDragPosition(null);
				}
			}
		}
	}, [timestamp, beatmap, userOptions, mode, hoveredState, grabbedState]);
	
	const onContextMenu = useCallback((event: MouseEvent) => {
		event.preventDefault();
	}, []);
	
	const keyPressListener = useCallback((event: KeyboardEvent) => {
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
	}, []);
	
	useEffect(() => {
		const previewCanvases = previewCanvasRefs.current; // TIL plural of canvas is canvases, its so stupid
		const editCanvases = editCanvasRefs.current;
		if (previewCanvases.size !== columnCount || editCanvases.size !== columnCount || laneSize === null) {
			return;
		}
		
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
		
		for (const [columnIndex, [, context, offscreenCanvas, offscreenContext]] of previewCanvases) {
			offscreenCanvas.width = laneSize.width;
			offscreenCanvas.height = laneSize.height;
			
			// userOptions.hitPosition =
			// 	(Math.sin((timestamp / Math.PI) / 100 + (columnIndex / Math.PI) * 5) + 1) / 2
			// 	* (Math.cos(timestamp / Math.PI / 100 + columnIndex * 3) * 50)
			// 	+ 400;
			// ^ lol
			
			const [renderedNormalObjects, renderedLongObjects] = renderPreviewContext(
				offscreenContext,
				laneSize,
				timestamp,
				columnCount,
				columnIndex,
				bpm,
				sliderVelocity,
				userOptions,
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
			offscreenCanvas.width = laneSize.width;
			offscreenCanvas.height = laneSize.height;
			
			const newSelectedHitObjects = renderEditContext(
				offscreenContext,
				laneSize,
				timestamp,
				columnIndex,
				nextHitObjects,
				beatmap,
				userOptions,
				canvas,
				mouse,
				mode,
				dragPosition,
				dragPosition === null ? selectedHitObjects : null,
				setHoveredState,
				grabbedState !== null,
			);
			
			context.drawImage(offscreenCanvas, 0, 0);
			for (const newHitObject of newSelectedHitObjects) {
				totalSelectedHitObjects.add(newHitObject);
			}
		}
		
		if (mode === EditMode.Selection && dragPosition !== null) {
			setSelectedHitObjects(totalSelectedHitObjects);
		}
	}, [
		beatmap, previewCanvasRefs, editCanvasRefs, laneSize, timestamp, userOptions, mouse, changedBeatmap, mode,
		dragPosition, grabbedState,
	]);
	
	useEffect(() => {
		const canvas = shortTimelineRef.current;
		if (canvas === null || laneSize === null) {
			return;
		}
		
		const context = shortTimelineContext.current;
		if (context === null) {
			shortTimelineContext.current = canvas.getContext('2d');
			return;
		}
		
		context.fillStyle = 'hsla(0, 0%, 0%, 0.5)';
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillRect(0, 0, canvas.width, canvas.height);
		
		const currentY = yPositionFromMillisecondEditor(timestamp, timestamp, laneSize.height, userOptions);
		context.strokeStyle = 'hsla(80, 100%, 50%, 0.7)';
		context.beginPath();
		context.moveTo(0, currentY);
		context.lineTo(canvas.width - 1, currentY);
		context.closePath();
		context.stroke();
		
		context.strokeStyle = 'hsl(0, 0%, 100%)';
		context.beginPath();
		
		const millisecondAtBottom = millisecondFromYPositionEditor(timestamp, laneSize.height, laneSize.height, userOptions);
		const currentDifficultyPoint = beatmap.controlPoints.difficultyPointAt(millisecondAtBottom);
		const yPosition = yPositionFromMillisecondEditor(timestamp, currentDifficultyPoint.startTime, laneSize.height, userOptions);
		const x = currentDifficultyPoint.sliderVelocityUnlimited / 10 * laneSize.width * 2;
		context.lineTo(x, yPosition);
		let currentPosition = [x, yPosition];
		
		for (const difficultyPoint of beatmap.controlPoints.difficultyPoints) {
			if (difficultyPoint.startTime < timestamp - 1_000) {
				continue;
			}
			
			const yPosition = yPositionFromMillisecondEditor(timestamp, difficultyPoint.startTime, laneSize.height, userOptions);
			const x = difficultyPoint.sliderVelocityUnlimited / 10 * laneSize.width * 2;
			if (yPosition < 0) {
				context.lineTo(currentPosition[0], yPosition);
				context.moveTo(x, yPosition);
				break;
			}
			
			if (yPosition < laneSize.height) {
				context.lineTo(currentPosition[0], yPosition);
				context.lineTo(x, yPosition);
			}
			
			currentPosition = [x, yPosition];
		}
		
		context.closePath();
		context.stroke();
	}, [beatmap, shortTimelineRef, shortTimelineContext, laneSize, timestamp]);
	
	useEffect(() => {
		const video = videoRef.current;
		if (!video || isPlaying) {
			return;
		}
		
		video.currentTime = timestamp / 1_000;
	}, [videoRef, isPlaying, timestamp]);
	
	useEffect(() => {
		const mainSection = mainSectionRef.current;
		if (mainSection === null) {
			return;
		}
		
		console.log('Loaded HitObject editor for Mania:', beatmap);
		
		const observer = new ResizeObserver(() => {
			const mainSection = mainSectionRef.current;
			if (mainSection === null) {
				setLaneSize(null);
				return;
			}
			
			const boundingRect = mainSection.getBoundingClientRect();
			const width = Math.round(boundingRect.width * userOptions.laneWidthPercent * 0.01) / columnCount;
			const height = Math.round(boundingRect.height);
			setLaneSize({ width, height });
		});
		
		observer.observe(mainSection);
		return () => observer.disconnect();
	}, [mainSectionRef, userOptions]);
	
	useEffect(() => {
		const music = musicRef.current;
		const video = videoRef.current;
		if (!music) {
			return;
		}
		
		music.pause();
		video?.pause();
		
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
					const newHitSoundUrls: Partial<HitSoundUrls> = {};
					switch (appliedHitSound) {
						case HitSound.Normal: {
							newHitSoundUrls.normal = convertFileSrc(url);
							break;
						}
						case HitSound.Clap: {
							newHitSoundUrls.clap = convertFileSrc(url);
							break;
						}
						case HitSound.Finish: {
							newHitSoundUrls.finish = convertFileSrc(url);
							break;
						}
						case HitSound.Whistle: {
							newHitSoundUrls.whistle = convertFileSrc(url);
							break;
						}
					}
					
					setHitSoundUrls((hitSoundUrls) => ({ ...hitSoundUrls, ...newHitSoundUrls }));
					
					console.log('Custom hit sound found in beatmap');
					console.log('> url =', url);
					console.log('> appliedHitSound =', HitSound[appliedHitSound]);
				}
			});
	}, [beatmap]);
	
	useEffect(() => {
		const columnCount = beatmap.difficulty.circleSize;
		const editCanvases = editCanvasRefs.current;
		const mainSection = mainSectionRef.current;
		if (mainSection === null || editCanvases.size !== columnCount) {
			return;
		}
		
		mainSection.addEventListener('mousedown', onMouseEvent);
		mainSection.addEventListener('mouseup', onMouseEvent);
		mainSection.addEventListener('mousemove', onMouseEvent);
		mainSection.addEventListener('contextmenu', onContextMenu);
		
		return () => {
			mainSection.removeEventListener('mousedown', onMouseEvent);
			mainSection.removeEventListener('mouseup', onMouseEvent);
			mainSection.removeEventListener('mousemove', onMouseEvent);
			mainSection.removeEventListener('contextmenu', onContextMenu);
		}
	}, [onMouseEvent, onContextMenu]);
	
	useEffect(() => {
		setSelectedHitObjects(null);
		setDragPosition(null);
	}, [mode]);
	
	useEffect(() => {
		window.addEventListener('keydown', keyPressListener);
		
		return () => {
			window.removeEventListener('keydown', keyPressListener);
		};
	}, [keyPressListener]);
	
	return (
		<>
			<div
				className={'section s1'}
				ref={mainSectionRef}
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
					{new Array(columnCount).fill(undefined).map((_value, i) => {
						return (
							<canvas
								className={'lane'}
								key={i}
								width={laneSize?.width ?? 1}
								height={laneSize?.height ?? 1}
								style={{
									width: `${laneSize?.width}px`,
									height: `${laneSize?.height}px`,
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
					{new Array(columnCount).fill(undefined).map((_value, i) => {
						return (
							<canvas
								className={'lane'}
								key={i}
								width={laneSize?.width ?? 1}
								height={laneSize?.height ?? 1}
								style={{
									width: `${laneSize?.width}px`,
									height: `${laneSize?.height}px`,
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
				<div className={'shortTimelineContainer'}>
					<canvas
						className={'shortTimeline'}
						width={(laneSize?.width ?? 1) * 2}
						height={laneSize?.height ?? 1}
						style={{
							width: `${(laneSize?.width ?? 1) * 2}px`,
							height: `${laneSize?.height}px`,
						}}
						ref={shortTimelineRef}
					/>
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
