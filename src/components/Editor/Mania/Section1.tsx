import { useCallback, useEffect, useRef, useState } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';
import { exists, readDir } from '@tauri-apps/plugin-fs';
import { DifficultyPoint, HitObject, HitSound, HitType, TimingPoint } from 'osu-classes';
import { HoldableObject } from 'osu-parsers';

import { useEditor } from '../Provider';

import { clamp, intToBits } from '@/utils';
import { yPositionFromMillisecond, yPositionFromMillisecondEditor, OsuBeatmap, useHitsound, millisecondFromYPositionEditor, isLongHitObject, isNormalHitObject, getClosestTime, addHitObject } from '@/utils/Beatmap';
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
		
		if ((hitObject.hitType & HitType.Normal) !== 0) {
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
				holdObject.endTime,
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
	laneWidth: number,
	laneHeight: number,
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
	setHoveredHitObject: ReactSet<HitObject | null>,
	setHoveredSide: ReactSet<'head' | 'tail'>,
	isGrabbing: boolean,
): Set<HitObject> {
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
	const [startX, dragTimestamp] = dragStartPosition ?? [Infinity, Infinity];
	const dragY = isFinite(dragTimestamp) ? yPositionFromMillisecondEditor(timestamp, dragTimestamp, laneHeight, userOptions) : Infinity;
	
	const minX = Math.min(startX, mouseX) - laneRect.left;
	const maxX = Math.max(startX, mouseX) - laneRect.left;
	const minY = Math.min(dragY, mouseY - laneRect.top);
	const maxY = Math.max(dragY, mouseY - laneRect.top);
	
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
			canvas.style.cursor = 'cell';
			if (isGrabbing) {
				canvas.style.cursor = 'grabbing';
				break;
			}
			
			// laneRect.left < mouseX && mouseX < laneRect.right && laneRect.top < mouseY && mouseY < laneRect.bottom
			if (laneRect.left >= mouseX || mouseX >= laneRect.right || laneRect.top >= mouseY || mouseY >= laneRect.bottom) {
				break;
			}
			
			let canAddHitObject = true;
			let hoveredHitObject: HitObject | null = null;
			let hoveredSide: 'head' | 'tail' = 'head';
			for (const data of renderedHitObjects) {
				const [hitObject] = data;
				
				if (isNormalHitObject(hitObject)) {
					const [, yPosition] = data;
					
					if (mouseY < yPosition + barHeight && mouseY > yPosition) {
						hoveredHitObject = hitObject;
						break;
					}
				} else if (isLongHitObject(hitObject)) {
					const [, yPositionHead, yPositionTail] = data;
					
					if (mouseY < yPositionHead + barHeight && mouseY > yPositionHead) {
						hoveredHitObject = hitObject;
						hoveredSide = 'head';
						break;
					} else if (mouseY < yPositionTail + barHeight && mouseY > yPositionTail) {
						hoveredHitObject = hitObject;
						hoveredSide = 'tail';
						break;
					} else if (mouseY < yPositionHead + barHeight && mouseY > yPositionTail + barHeight) {
						canAddHitObject = false;
						break;
					}
				}
			}
			
			if (!canAddHitObject) {
				canvas.style.cursor = 'not-allowed';
				break;
			}
			
			setHoveredHitObject(hoveredHitObject);
			setHoveredSide(hoveredSide);
			
			if (hoveredHitObject !== null) {
				canvas.style.cursor = 'grab';
				
				if (isLongHitObject(hoveredHitObject)) {
					canvas.style.cursor = 'n-resize';
				}
			} else {
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
			canvas.style.cursor = 'crosshair';
			
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
		case EditMode.Delete: {
			canvas.style.cursor = 'default';
			
			break;
		}
	}
	
	return selectedHitObjects;
}

const Section1: React.FC = () => {
	const { beatmap, userOptions, isPlaying, setPlaying, mode, setMode, timestamp, setTimestamp, setRenderedHitObjects, musicRef } = useEditor();
	
	const [normalUrl, setNormalUrl] = useState<string>(normalHitSound);
	const [clapUrl, setClapUrl] = useState<string>(clapHitSound);
	const [finishUrl, setFinishUrl] = useState<string>(finishHitSound);
	const [whistleUrl, setWhistleUrl] = useState<string>(whistleHitSound);
	const [changedBeatmap, setChangedBeatmap] = useState<string>('');
	const playHitSound = useHitsound(normalUrl, clapUrl, finishUrl, whistleUrl);
	
	const [mouseX, setMouseX] = useState<number>(0);
	const [mouseY, setMouseY] = useState<number>(0);
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [laneWidth, setLaneWidth] = useState<number | null>(null);
	const [laneHeight, setLaneHeight] = useState<number | null>(null);
	const [dragStartPosition, setDragStartPosition] = useState<[number, number] | null>(null);
	// ^ this is NOT (mouseX, mouseY), it is (mouseX, timestamp) where timestamp is in milliseconds
	const [selectedHitObjects, setSelectedHitObjects] = useState<Set<HitObject> | null>(null);
	const [hoveredHitObject, setHoveredHitObject] = useState<HitObject | null>(null);
	const [hoveredSide, setHoveredSide] = useState<'head' | 'tail'>('head');
	const [grabbedHitObject, setGrabbedHitObject] = useState<HitObject | null>(null);
	const [grabbedSide, setGrabbedSide] = useState<'head' | 'tail'>('head');
	
	const mainSectionRef = useRef<HTMLDivElement | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const shortTimelineRef = useRef<HTMLCanvasElement | null>(null);
	const shortTimelineContext = useRef<CanvasRenderingContext2D | null>(null);
	const editCanvasRefs = useRef<Map<number, [HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D]>>(new Map());
	const previewCanvasRefs = useRef<Map<number, [HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D]>>(new Map());
	const keyCount = beatmap.difficulty.circleSize;
	
	const onMouseEvent = useCallback((event: MouseEvent) => {
		if (event.type === 'mousemove') {
			setMouseX(event.clientX);
			setMouseY(event.clientY);
		} else if (event.type === 'mouseup') {
			setGrabbedHitObject(null);
			setDragStartPosition(null);
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
			const closestTime = getClosestTime(beatmap, timestamp, targetMillisecond, laneHeight, userOptions);
			if (event.type === 'mousemove' && grabbedHitObject !== null) {
				let changed = false;
				if (isNormalHitObject(grabbedHitObject) || (isLongHitObject(grabbedHitObject) && grabbedSide === 'head')) {
					changed = grabbedHitObject.startTime !== closestTime;
					grabbedHitObject.startTime = closestTime;
				} else if (isLongHitObject(grabbedHitObject) && grabbedSide === 'tail') {
					changed = grabbedHitObject.endTime !== closestTime;
					grabbedHitObject.endTime = closestTime;
				}
				
				if (changed) {
					setChangedBeatmap(crypto.randomUUID());
				}
				
				return;
			}
			
			const columnCount = beatmap.difficulty.circleSize;
			if (mode === EditMode.HitObject) {
				if (event.type !== 'mousedown') {
					return;
				}
				
				if (hoveredHitObject !== null) {
					setGrabbedHitObject(hoveredHitObject);
					setGrabbedSide(hoveredSide);
				} else {
					addHitObject(beatmap, columnIndex, columnCount, closestTime);
					setChangedBeatmap(crypto.randomUUID());
				}
			} else if (mode === EditMode.Selection) {
				if (event.type === 'mousemove') {
					return;
				}
				
				if (event.type === 'mousedown') {
					setDragStartPosition([event.clientX, targetMillisecond]);
					setSelectedHitObjects(null);
				} else {
					setDragStartPosition(null);
				}
			}
		}
	}, [timestamp, beatmap, userOptions, mode, hoveredHitObject, grabbedHitObject]);
	
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
		if (previewCanvases.size !== keyCount || editCanvases.size !== keyCount || laneWidth === null || laneHeight === null) {
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
			offscreenCanvas.width = laneWidth;
			offscreenCanvas.height = laneHeight;
			
			// userOptions.hitPosition =
			// 	(Math.sin((timestamp / Math.PI) / 100 + (columnIndex / Math.PI) * 5) + 1) / 2
			// 	* (Math.cos(timestamp / Math.PI / 100 + columnIndex * 3) * 50)
			// 	+ 400;
			// ^ lol
			
			const [renderedNormalObjects, renderedLongObjects] = renderPreviewContext(
				offscreenContext,
				laneWidth,
				laneHeight,
				timestamp,
				keyCount,
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
			offscreenCanvas.width = laneWidth;
			offscreenCanvas.height = laneHeight;
			
			const newSelectedHitObjects = renderEditContext(
				offscreenContext,
				laneWidth,
				laneHeight,
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
				dragStartPosition === null ? selectedHitObjects : null,
				setHoveredHitObject,
				setHoveredSide,
				grabbedHitObject !== null,
			);
			
			context.drawImage(offscreenCanvas, 0, 0);
			for (const newHitObject of newSelectedHitObjects) {
				totalSelectedHitObjects.add(newHitObject);
			}
		}
		
		if (mode === EditMode.Selection && dragStartPosition !== null) {
			setSelectedHitObjects(totalSelectedHitObjects);
		}
	}, [
		beatmap, previewCanvasRefs, editCanvasRefs, laneWidth, laneHeight, timestamp, userOptions, mouseX, mouseY, changedBeatmap, mode,
		dragStartPosition, grabbedHitObject,
	]);
	
	useEffect(() => {
		const canvas = shortTimelineRef.current;
		if (canvas === null || laneWidth === null || laneHeight === null) {
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
		
		const currentY = yPositionFromMillisecondEditor(timestamp, timestamp, laneHeight, userOptions);
		context.strokeStyle = 'hsla(80, 100%, 50%, 0.7)';
		context.beginPath();
		context.moveTo(0, currentY);
		context.lineTo(canvas.width - 1, currentY);
		context.closePath();
		context.stroke();
		
		context.strokeStyle = 'hsl(0, 0%, 100%)';
		context.beginPath();
		
		const currentDifficultyPoint = beatmap.controlPoints.difficultyPointAt(millisecondFromYPositionEditor(timestamp, laneHeight, laneHeight, userOptions));
		const yPosition = yPositionFromMillisecondEditor(timestamp, currentDifficultyPoint.startTime, laneHeight, userOptions);
		const x = currentDifficultyPoint.sliderVelocityUnlimited / 10 * laneWidth * 2;
		context.lineTo(x, yPosition);
		let currentPosition = [x, yPosition];
		
		for (const difficultyPoint of beatmap.controlPoints.difficultyPoints) {
			if (difficultyPoint.startTime < timestamp - 1_000) {
				continue;
			}
			
			const yPosition = yPositionFromMillisecondEditor(timestamp, difficultyPoint.startTime, laneHeight, userOptions);
			const x = difficultyPoint.sliderVelocityUnlimited / 10 * laneWidth * 2;
			if (yPosition < 0) {
				context.lineTo(currentPosition[0], yPosition);
				context.moveTo(x, yPosition);
				break;
			}
			
			if (yPosition < laneHeight) {
				context.lineTo(currentPosition[0], yPosition);
				context.lineTo(x, yPosition);
			}
			
			currentPosition = [x, yPosition];
		}
		
		context.closePath();
		context.stroke();
	}, [beatmap, shortTimelineRef, shortTimelineContext, laneWidth, laneHeight, timestamp]);
	
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
				setLaneWidth(null);
				setLaneHeight(null);
				return;
			}
			
			const boundingRect = mainSection.getBoundingClientRect();
			const laneWidth = Math.round(boundingRect.width * userOptions.laneWidthPercent * 0.01) / keyCount;
			const laneHeight = Math.round(boundingRect.height);
			setLaneWidth(laneWidth);
			setLaneHeight(laneHeight);
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
		setDragStartPosition(null);
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
									width: `${laneWidth ?? 1}px`,
									height: `${laneHeight ?? 1}px`,
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
						width={(laneWidth ?? 1) * 2}
						height={laneHeight ?? 1}
						style={{
							width: `${(laneWidth ?? 1) * 2}px`,
							height: `${laneHeight ?? 1}px`,
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
