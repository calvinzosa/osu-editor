import React, { useEffect, useRef, useState } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';
import { DifficultyPoint, HitObject, HitSound, HitType, TimingPoint } from 'osu-classes';
import { HoldableObject } from 'osu-parsers';

import { exists, readDir } from '@tauri-apps/plugin-fs';

import { clamp, reverseArr } from '@/utils';
import { BeatmapInfo, calculateYPosition, calculateYPositionEditor, OsuBeatmap, useHitsound } from '@/utils/Beatmap';
import { getExtension, getFileName, joinPaths } from '@/utils/File';
import { ReactSet, UserOptions } from '@/utils/Types';

import normalHitSound from '@/assets/normal-hitnormal.ogg';
import clapHitSound from '@/assets/normal-hitclap.ogg';
import finishHitSound from '@/assets/normal-hitfinish.ogg';
import whistleHitSound from '@/assets/normal-hitwhistle.ogg';

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
) {
	const offscreenCanvas = offscreenContext.canvas;
	
	const circleRadius = Math.round(laneWidth / 2);
	const circleX = circleRadius;
	const outlineWidth = 10;
	const halfOutline = Math.round(outlineWidth / 2);
	const judgementRadius = circleRadius - halfOutline;
	
	offscreenContext.fillStyle = 'hsl(0, 0%, 0%)';
	offscreenContext.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
	
	offscreenContext.strokeStyle = 'hsla(0, 0%, 100%, 0.5)';
	offscreenContext.lineWidth = outlineWidth;
	offscreenContext.beginPath();
	offscreenContext.ellipse(circleX, Math.round(laneHeight * (hitPosition / 480)), judgementRadius, judgementRadius, 0, 0, Math.PI * 2);
	offscreenContext.closePath();
	offscreenContext.stroke();
	
	const snap = 60_000 / bpm;
	const totalLines = Math.ceil((timestamp + 5_000) / snap);
	
	offscreenContext.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	for (let i = 0; i < totalLines; i++) {
		const lineTime = i * snap;
		
		const yPosition = calculateYPosition(timestamp, lineTime, scrollSpeed, bpm, sliderVelocity, laneHeight, hitPosition, nextTimings, nextDiffs);
		if (yPosition <= 0) {
			break;
		}
		
		if (yPosition <= laneHeight) {
			offscreenContext.fillRect(0, yPosition, laneWidth, 2);
		}
	}
	
	let renderedNormalObjects = 0;
	let renderedHoldObjects = 0;
	
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
		
		if (columnCount === 4 && (objectColumn === 1 || objectColumn === 2)) {
			colors.normal = 'hsl(0, 0%, 78%)';
			colors.head = 'hsl(0, 0%, 78%)';
			colors.body = 'hsl(0, 0%, 63%)';
		}
		
		if ((hitObject.hitType & HitType.Normal) !== 0) {
			if (hitObject.startTime < timestamp) {
				continue;
			}
			
			const yPosition = calculateYPosition(timestamp, hitObject.startTime, scrollSpeed, bpm, sliderVelocity, laneHeight, hitPosition, nextTimings, nextDiffs);
			if (yPosition >= 0) {
				offscreenContext.fillStyle = colors.normal;
				offscreenContext.beginPath();
				offscreenContext.ellipse(circleX, yPosition, circleRadius, circleRadius, 0, 0, Math.PI * 2);
				offscreenContext.closePath();
				offscreenContext.fill();
				
				renderedNormalObjects++;
			}
		} else if ((hitObject.hitType & HitType.Hold) !== 0) {
			const holdObject = hitObject as HoldableObject;
			if (holdObject.endTime < timestamp) {
				continue;
			}
			
			const yPositionHead = Math.min(
				laneHeight * (hitPosition / 480),
				calculateYPosition(timestamp, holdObject.startTime, scrollSpeed, bpm, sliderVelocity, laneHeight, hitPosition, nextTimings, nextDiffs),
			);
			
			const yPositionTail = calculateYPosition(timestamp, holdObject.endTime, scrollSpeed, bpm, sliderVelocity, laneHeight, hitPosition, nextTimings, nextDiffs);
			if (yPositionHead >= 0) {
				const gap = 10;
				
				offscreenContext.fillStyle = colors.body;
				offscreenContext.beginPath();
				offscreenContext.ellipse(circleX, yPositionTail, circleRadius - gap, circleRadius - gap, 0, Math.PI, Math.PI * 2);
				offscreenContext.rect(gap, yPositionTail, laneWidth - gap * 2, yPositionHead - yPositionTail);
				offscreenContext.closePath();
				offscreenContext.fill();
				
				offscreenContext.fillStyle = colors.head;
				offscreenContext.beginPath();
				offscreenContext.ellipse(circleX, yPositionHead, circleRadius, circleRadius, 0, 0, Math.PI * 2);
				offscreenContext.closePath();
				offscreenContext.fill();
				
				renderedHoldObjects++;
			}
		}
	}
	
	return [renderedNormalObjects, renderedHoldObjects];
}

function renderEditContext(
	offscreenContext: OffscreenCanvasRenderingContext2D,
	laneWidth: number,
	laneHeight: number,
	hitPosition: number,
	timestamp: number,
	columnCount: number,
	columnIndex: number,
	scrollSpeed: number,
	nextHitObjects: Array<HitObject>,
	beatmap: OsuBeatmap,
	userOptions: UserOptions,
) {
	const offscreenCanvas = offscreenContext.canvas;
	
	const barHeight = 32;
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
	
	const timingPoints = beatmap.controlPoints.timingPoints;
	const beatSnapDivisor = userOptions.beatSnapDivisor;
	let bpm = 60;
	let timeSignature = 4;
	let startingPoint = 0;
	
	if (timingPoints.length > 0) {
		bpm = timingPoints[0].bpmUnlimited;
		timeSignature = timingPoints[0].timeSignature;
	}
	
	for (const timingPoint of reverseArr(timingPoints)) {
		if (timingPoint.startTime <= timestamp) {
			bpm = timingPoint.bpmUnlimited;
			timeSignature = timingPoint.timeSignature;
			startingPoint = timingPoint.startTime;
			break;
		}
	}
	
	offscreenContext.fillStyle = 'hsl(0, 0%, 74%)';
	
	let beatStep = 60_000 / bpm;
	let lineIndex = 0;
	while (true) {
		const lineTime = startingPoint + lineIndex * beatStep;
		const yPosition = calculateYPositionEditor(timestamp, lineTime, scrollSpeed, laneHeight, hitPosition);
		if (yPosition < 0) {
			break;
		}
		
		if (yPosition < laneHeight) {
			offscreenContext.fillRect(0, yPosition, laneWidth, lineIndex % timeSignature === 0 ? 7 : 2);
		}
		
		lineIndex++;
	}
	
	if (beatSnapDivisor > 1) {
		let fillPattern: Array<string>;
		switch (beatSnapDivisor) {
			case 2: { fillPattern = ['', 'hsl(0, 100%, 50%)']; break; }
			case 3: { fillPattern = ['', 'hsl(300, 100%, 30%)']; break; }
			case 4: { fillPattern = ['', 'hsl(0, 100%, 50%)', 'hsl(217, 67%, 46%)', 'hsl(0, 100%, 50%)']; break; }
			case 5: { fillPattern = ['', 'hsl(0, 0%, 49%)']; break; }
			case 6: { fillPattern = ['', 'hsl(300, 100%, 30%)', 'hsl(0, 100%, 50%)', 'hsl(217, 67%, 46%)', 'hsl(0, 100%, 50%)', 'hsl(300, 100%, 30%)']; break; }
			case 7: { fillPattern = ['', 'hsl(0, 0%, 49%)']; break; }
			case 8: { fillPattern = ['', 'hsl(60, 100%, 39%)', 'hsl(0, 100%, 50%)', 'hsl(60, 100%, 39%)', 'hsl(217, 67%, 46%)', 'hsl(60, 100%, 39%)', 'hsl(0, 100%, 50%)', 'hsl(60, 100%, 39%)']; break; }
			case 9: { fillPattern = ['', 'hsl(0, 0%, 49%)', 'hsl(0, 0%, 49%)', 'hsl(300, 100%, 30%)', 'hsl(0, 0%, 49%)', 'hsl(0, 0%, 49%)', 'hsl(300, 100%, 30%)', 'hsl(0, 0%, 49%)', 'hsl(0, 0%, 49%)']; break; }
			case 12: { fillPattern = ['', 'hsl(0, 0%, 49%)', 'hsl(300, 38%, 32%)', 'hsl(217, 67%, 46%)', 'hsl(300, 100%, 30%)', 'hsl(0, 0%, 49%)', 'hsl(0, 100%, 39%)', 'hsl(0, 0%, 49%)', 'hsl(300, 100%, 30%)', 'hsl(217, 67%, 46%)', 'hsl(300, 38%, 32%)', 'hsl(0, 0%, 49%)']; break; }
			case 16: { fillPattern = ['', 'hsl(0, 0%, 49%)']; break; }
			default: { fillPattern = ['', 'hsl(0, 0%, 80%)']; break; }
		}
		
		beatStep /= beatSnapDivisor;
		lineIndex = 0;
		while (true) {
			const lineTime = startingPoint + lineIndex * beatStep;
			const yPosition = calculateYPositionEditor(timestamp, lineTime, scrollSpeed, laneHeight, hitPosition);
			if (yPosition < 0) {
				break;
			}
			
			if (yPosition < laneHeight && lineIndex % beatSnapDivisor !== 0) {
				let fillStyle = fillPattern[lineIndex % fillPattern.length];
				offscreenContext.fillStyle = fillStyle;
				offscreenContext.fillRect(0, yPosition, laneWidth, 2);
			}
			
			lineIndex++;
		}
	}
	
	
	for (const hitObject of nextHitObjects) {
		const objectColumn = Math.floor(hitObject.startX * columnCount / 512);
		if (columnIndex !== objectColumn) {
			continue;
		}
		
		let yPosition: number | null = null;
		
		if ((hitObject.hitType & HitType.Normal) !== 0) {
			yPosition = calculateYPositionEditor(timestamp, hitObject.startTime, scrollSpeed, laneHeight, hitPosition);
			if (yPosition >= 0) {
				let image = maniaNote1;
				if (columnCount === 4 && (columnIndex === 1 || columnIndex === 2)) {
					image = maniaNote2;
				}
				
				offscreenContext.drawImage(image, barX, yPosition - barHeight, laneWidth, barHeight);
			} else {
				yPosition = null;
			}
		} else if ((hitObject.hitType & HitType.Hold) !== 0) {
			const holdObject = hitObject as HoldableObject;
			const yPositionHead = calculateYPositionEditor(timestamp, holdObject.startTime, scrollSpeed, laneHeight, hitPosition);
			const yPositionTail = calculateYPositionEditor(timestamp, holdObject.endTime, scrollSpeed, laneHeight, hitPosition);
			
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
			}
		}
		
		if (hitObject.hitSound > 0 && yPosition !== null) {
			const hitSounds = new Array<string>();
			
			if ((hitObject.hitSound & HitSound.Whistle) !== 0) {
				hitSounds.push('W');
			}
			
			if ((hitObject.hitSound & HitSound.Finish) !== 0) {
				hitSounds.push('F');
			}
			
			if ((hitObject.hitSound & HitSound.Clap) !== 0) {
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
	setBeatmapInfo: ReactSet<BeatmapInfo>;
	setKeysPerSecond: ReactSet<number>;
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
	setBeatmapInfo,
	setKeysPerSecond,
}) => {
	const [normalUrl, setNormalUrl] = useState<string>(normalHitSound);
	const [clapUrl, setClapUrl] = useState<string>(clapHitSound);
	const [finishUrl, setFinishUrl] = useState<string>(finishHitSound);
	const [whistleUrl, setWhistleUrl] = useState<string>(whistleHitSound);
	const playHitSound = useHitsound(normalUrl, clapUrl, finishUrl, whistleUrl);
	
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [laneWidth, setLaneWidth] = useState<number | null>(null);
	const [laneHeight, setLaneHeight] = useState<number | null>(null);
	
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
		
		const hitPosition = 420;
		const scrollSpeed = userOptions.scrollSpeed;
		
		const timingPoints = beatmap.controlPoints.timingPoints;
		const diffPoints = beatmap.controlPoints.difficultyPoints;
		const hitObjects = beatmap.hitObjects;
		let nextTimings = new Array<TimingPoint>();
		let nextDiffs = new Array<DifficultyPoint>();
		let nextHitObjects = new Array<HitObject>();
		let sliderVelocity = 1;
		let bpm = 60;
		
		if (timingPoints.length > 0) {
			bpm = timingPoints[0].bpmUnlimited;
		}
		
		for (let i = 0; i < timingPoints.length; i++) {
			const timingPoint = timingPoints[i];
			if (timingPoint.startTime > timestamp) {
				nextTimings = timingPoints.slice(i);
				break;
			}
			
			bpm = timingPoint.bpmUnlimited;
		}
		
		for (let i = 0; i < diffPoints.length; i++) {
			const diffPoint = diffPoints[i];
			if (diffPoint.startTime > timestamp) {
				nextDiffs = diffPoints.slice(i);
				break;
			}
			
			sliderVelocity = diffPoint.sliderVelocityUnlimited;
		}
		
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
		
		let renderedNormalObjects = 0;
		let renderedHoldObjects = 0;
		
		for (const [i, [, context, offscreenCanvas, offscreenContext]] of previewCanvases) {
			offscreenCanvas.width = laneWidth;
			offscreenCanvas.height = laneHeight;
			
			// const hitPosition = (Math.sin((timestamp / Math.PI) / 100 + (i / Math.PI) * 5) + 1) / 2 * (Math.cos(timestamp / Math.PI / 100 + i * 3) * 50) + 400;
			// ^ lol
			
			const [normalObjects, holdObjects] = renderPreviewContext(
				offscreenContext,
				laneWidth,
				laneHeight,
				hitPosition,
				timestamp,
				keyCount,
				i,
				scrollSpeed,
				bpm,
				sliderVelocity,
				nextTimings,
				nextDiffs,
				nextHitObjects,
			);
			
			context.drawImage(offscreenCanvas, 0, 0);
			
			renderedNormalObjects += normalObjects;
			renderedHoldObjects += holdObjects;
		}
		
		for (const [i, [, context, offscreenCanvas, offscreenContext]] of editCanvases) {
			offscreenCanvas.width = laneWidth;
			offscreenCanvas.height = laneHeight;
			
			renderEditContext(
				offscreenContext,
				laneWidth,
				laneHeight,
				hitPosition,
				timestamp,
				keyCount,
				i,
				scrollSpeed,
				nextHitObjects,
				beatmap,
				userOptions,
			);
			
			context.drawImage(offscreenCanvas, 0, 0);
		}
		
		setBeatmapInfo({
			bpm,
			sliderVelocity,
			renderedHoldObjects,
			renderedNormalObjects,
		});
	}, [previewCanvasRefs, editCanvasRefs, laneWidth, laneHeight, timestamp, userOptions]);
	
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
			const laneWidth = Math.round(boundingRect.width * 0.275) / keyCount;
			const laneHeight = Math.round(boundingRect.height);
			setLaneWidth(laneWidth);
			setLaneHeight(laneHeight);
		});
		
		observer.observe(sectionRef.current);
		return () => observer.disconnect();
	}, [sectionRef]);
	
	useEffect(() => {
		const music = musicRef.current;
		const video = videoRef.current; // not returning if video doesn't exist
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
		
		if (video !== null) {
			video.currentTime = music.currentTime;
			video.volume = 0;
			video.play();
		}
		
		const onEnded = () => setPlaying(false);
		
		music.onended = onEnded;
		
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
		setVideoPath(null);
		
		const videoBackground = beatmap.events.storyboard?.getLayerByName('Video');
		if (videoBackground?.elements) {
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
		let kps = 0;
		for (const hitObject of beatmap.hitObjects) {
			if (hitObject.startTime > timestamp) {
				break;
			}
			
			if (hitObject.startTime > timestamp - 1_000) {
				kps++;
			}
		}
		
		setKeysPerSecond(kps);
	}, [timestamp, beatmap]);
	
	// useEffect(() => {
	// 	setKeysPerSecond(keyPressTimes.length);
	// }, [keyPressTimes]);
	
	return (
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
				/>
			)}
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
		</div>
	);
};

export default Section1;
