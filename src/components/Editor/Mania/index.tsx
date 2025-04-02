import { useEffect, useRef, useState } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';

import './index.scss';
import Section1 from './Section1';
import Section2 from './Section2';
import Section3 from './Section3';
import Section4 from './Section4';

import { DefaultUserOptions, UserOptions } from '@/utils/Types';
import { OsuBeatmap } from '@/utils/Beatmap';
import { Storage } from '@/utils/LocalStorage';
import { joinPaths } from '@/utils/File';

interface ManiaEditorProps {
	beatmap: OsuBeatmap;
	sectionRef: React.MutableRefObject<HTMLDivElement | null>;
}

const ManiaEditor: React.FC<ManiaEditorProps> = ({ beatmap, sectionRef }) => {
	const [renderedHitObjects, setRenderedHitObjects] = useState<{ normal: number, long: number }>({ normal: 0, long: 0 });
	const [timestamp, setTimestamp] = useState<number>(0);
	const [isPlaying, setPlaying] = useState<boolean>(false);
	const [userOptions, setUserOptions] = useState<UserOptions>(DefaultUserOptions);
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
		
		const savedUserOptions = Storage.get<UserOptions>('userOptions');
		if (savedUserOptions !== null) {
			try {
				setUserOptions({ ...DefaultUserOptions, ...savedUserOptions });
			} catch (err) { }
		}
		
		const interval = setInterval(() => {
			if ('mediaSession' in navigator) {
				navigator.mediaSession.metadata = null;
				navigator.mediaSession.playbackState = 'none';
			}
		}, 500);
		
		setSaveOptions(true);
		window.addEventListener('keypress', keyPressListener);
		return () => {
			clearInterval(interval);
			window.removeEventListener('keypress', keyPressListener);
		}
	}, []);
	
	useEffect(() => {
		if (!saveOptions) {
			return;
		}
		
		Storage.set('userOptions', userOptions);
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
					setRenderedHitObjects={setRenderedHitObjects}
				/>
				<Section2
					beatmap={beatmap}
					timestamp={timestamp}
					renderedHitObjects={renderedHitObjects}
				/>
				<Section3
					userOptions={userOptions}
					setUserOptions={setUserOptions}
				/>
				<Section4
					timestamp={timestamp}
					musicRef={musicRef}
				/>
			</div>
		</>
	);
};

export default ManiaEditor;
