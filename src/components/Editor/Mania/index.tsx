import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { convertFileSrc } from '@tauri-apps/api/core';

import './index.scss';
import Section1 from './Section1';
import Section2 from './Section2';
import Section3 from './Section3';
import Section4 from './Section4';

import { DefaultUserOptions, EditMode, UserOptions } from '@/utils/Types';
import { OsuBeatmap } from '@/utils/Beatmap';
import { Storage } from '@/utils/LocalStorage';
import { joinPaths } from '@/utils/File';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

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
	const [mode, setMode] = useState<EditMode>(EditMode.Selection);
	const [forceCrash, setForceCrash] = useState<boolean>(false);
	const navigate = useNavigate();
	
	const musicRef = useRef<HTMLAudioElement | null>(null);
	
	useEffect(() => {
		const keyListener = (event: KeyboardEvent) => {
			event.preventDefault();
			
			switch (event.code) {
				case 'F1': {
					if (event.ctrlKey) {
						navigate('/');
					}
					
					break;
				}
				case 'Space': {
					setPlaying((isPlaying) => !isPlaying);
					break;
				}
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
				case 'KeyC': {
					if (event.ctrlKey && event.shiftKey && event.altKey) {
						setForceCrash(true);
					}
					
					break;
				}
				case 'KeyE': {
					if (event.ctrlKey && event.shiftKey) {
						revealItemInDir(beatmap.filePath);
					}
					
					break;
				}
				default: {
					return;
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
		window.addEventListener('keydown', keyListener);
		return () => {
			clearInterval(interval);
			window.removeEventListener('keydown', keyListener);
		}
	}, []);
	
	useEffect(() => {
		if (!forceCrash) {
			return;
		}
		
		throw new Error('Force crash triggered (CTRL+ALT+SHIFT+C)');
	}, [forceCrash]);
	
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
					mode={mode}
					setMode={setMode}
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
