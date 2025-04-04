import { useEffect, useRef } from 'react';

import { useEditor } from '../Provider';

const Section4: React.FC = () => {
	const { timestamp, musicRef, isPlaying } = useEditor();
	
	const fpsLabelRef = useRef<HTMLParagraphElement>(null);
	
	useEffect(() => {
		const fpsLabel = fpsLabelRef.current;
		if (fpsLabel === null) {
			return;
		}
		
		const fpsValues = new Array<number>();
		
		let shouldUpdate = true;
		let lastTimestamp: DOMHighResTimeStamp | null = null;
		const update: FrameRequestCallback = (timestamp) => {
			if (lastTimestamp !== null && fpsLabel) {
				const dt = timestamp - lastTimestamp;
				fpsValues.push(1_000 / dt);
				if (fpsValues.length > 30) {
					fpsValues.splice(0, 1);
				}
				
				fpsLabel.innerText = `FPS: ${(fpsValues.reduce((total, n) => total + n, 0) / fpsValues.length).toFixed(2)}`;
			}
			
			if (shouldUpdate) {
				lastTimestamp = timestamp;
				requestAnimationFrame(update);
			}
		};
		
		requestAnimationFrame(update);
		
		return () => {
			shouldUpdate = false;
			lastTimestamp = null;
		}
	}, [fpsLabelRef]);
	
	return (
		<div className={'section s4'}>
			<p>
				{Math.floor(timestamp / 60_000).toString().padStart(2, '0')}:
				{Math.floor(timestamp % 60_000 / 1_000).toString().padStart(2, '0')}.
				{Math.round(timestamp % 1_000).toString().padStart(3, '0')}
				&nbsp;/&nbsp;
				{Math.floor((musicRef.current?.duration ?? 0) / 60).toString().padStart(2, '0')}:
				{Math.floor((musicRef.current?.duration ?? 0) % 60).toString().padStart(2, '0')}.
				{Math.round((musicRef.current?.duration ?? 0) % 1 * 1_000).toString().padStart(3, '0')}
				&nbsp;-&nbsp;
				{isPlaying ? 'Playing' : 'Paused'}
			</p>
			<p ref={fpsLabelRef}>FPS: --</p>
		</div>
	);
};

export default Section4;
