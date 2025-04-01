import React, { useEffect, useRef, useState } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';

import './index.scss';
import FPSCounter from '../FPSCounter';
import Section1 from './Section1';
import Section2 from './Section2';

import { DefaultUserOptions, UserOptions } from '@/utils/Types';
import { BeatmapInfo, OsuBeatmap } from '@/utils/Beatmap';
import { Storage } from '@/utils/LocalStorage';
import { joinPaths } from '@/utils/File';

interface ManiaEditorProps {
	beatmap: OsuBeatmap;
	sectionRef: React.MutableRefObject<HTMLDivElement | null>;
}

const ManiaEditor: React.FC<ManiaEditorProps> = ({ beatmap, sectionRef }) => {
	const [timestamp, setTimestamp] = useState<number>(0);
	const [isPlaying, setPlaying] = useState<boolean>(false);
	const [userOptions, setUserOptions] = useState<UserOptions>(DefaultUserOptions);
	const [beatmapInfo, setBeatmapInfo] = useState<BeatmapInfo>({ bpm: 60, sliderVelocity: 1, renderedNormalObjects: 0, renderedHoldObjects: 0 });
	const [keysPerSecond, setKeysPerSecond] = useState<number>(0);
	const [saveOptions, setSaveOptions] = useState<boolean>(false);
	
	const musicRef = useRef<HTMLAudioElement | null>(null);
	
	useEffect(() => {
		const keyPressListener = (event: KeyboardEvent) => {
			switch (event.code) {
				case 'Space': {
					setPlaying((isPlaying) => !isPlaying);
					break;
				}
			}
		};
		
		const savedUserOptions = Storage.get('userOptions');
		if (savedUserOptions !== null) {
			try {
				setUserOptions((prev) => ({ ...prev, ...JSON.parse(savedUserOptions) }));
			} catch (err) { }
		}
		
		setSaveOptions(true);
		
		if ('mediaSession' in navigator) {
			navigator.mediaSession.playbackState = 'none';
		}
		
		window.addEventListener('keypress', keyPressListener);
		return () => {
			window.removeEventListener('keypress', keyPressListener);
		}
	}, []);
	
	useEffect(() => {
		if (!saveOptions) {
			return;
		}
		
		Storage.set('userOptions', JSON.stringify(userOptions));
	}, [userOptions, saveOptions]);
	
	return (
		<>
			<div className={'maniaEditor'}>
				<audio ref={musicRef} src={convertFileSrc(joinPaths(beatmap.songPath, beatmap.general.audioFilename))} />
				<Section1
					beatmap={beatmap}
					sectionRef={sectionRef}
					musicRef={musicRef}
					userOptions={userOptions}
					isPlaying={isPlaying}
					setPlaying={setPlaying}
					timestamp={timestamp}
					setTimestamp={setTimestamp}
					setBeatmapInfo={setBeatmapInfo}
					setKeysPerSecond={setKeysPerSecond}
				/>
				<Section2
					{...beatmapInfo}
					keysPerSecond={keysPerSecond}
					userOptions={userOptions}
					setUserOptions={setUserOptions}
				/>
				<div className={'section s3'}>
				</div>
				<div className={'section s4'}>
					<p>
						Timestamp:&nbsp;
						{Math.floor(timestamp / 60_000).toString().padStart(2, '0')}:
						{Math.floor(timestamp % 60_000 / 1_000).toString().padStart(2, '0')}.
						{Math.round(timestamp % 1_000).toString().padStart(3, '0')}
						&nbsp;/&nbsp;
						{Math.floor((musicRef.current?.duration ?? 0) / 60).toString().padStart(2, '0')}:
						{Math.floor((musicRef.current?.duration ?? 0) % 60).toString().padStart(2, '0')}.
						{Math.round((musicRef.current?.duration ?? 0) % 1 * 1_000).toString().padStart(3, '0')}
					</p>
					<FPSCounter />
				</div>
			</div>
		</>
	);
};

export default ManiaEditor;
