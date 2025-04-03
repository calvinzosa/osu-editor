import { PropsWithChildren, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { convertFileSrc } from '@tauri-apps/api/core';

import './index.scss';
import Section1 from './Section1';
import Section2 from './Section2';
import Section3 from './Section3';
import Section4 from './Section4';
import { useEditor } from '../Provider';

import { joinPaths } from '@/utils/File';
import { EditMode } from '@/utils/Types';

const ManiaEditor: React.FC<PropsWithChildren> = () => {
	const { beatmap, setPlaying, setMode, musicRef } = useEditor();
	const navigate = useNavigate();
	
	const [forceCrash, setForceCrash] = useState<boolean>(false);
	
	useEffect(() => {
		const keyListener = (event: KeyboardEvent) => {
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
				case 'KeyS': {
					if (event.ctrlKey) {
						if (event.shiftKey) {
							console.log('Save as...');
						} else {
							console.log('Save');
						}
					}
					
					break;
				}
				default: {
					return;
				}
			}
			
			event.preventDefault();
		};
		
		window.addEventListener('keydown', keyListener);
		return () => {
			window.removeEventListener('keydown', keyListener);
		}
	}, []);
	
	useEffect(() => {
		console.log('musicRef.current =', musicRef.current);
	}, [musicRef]);
	
	useEffect(() => {
		if (!forceCrash) {
			return;
		}
		
		throw new Error('Force crash triggered (CTRL+ALT+SHIFT+C)');
	}, [forceCrash]);
	
	return (
		<>
			<div className={'maniaEditor'}>
				<audio ref={musicRef} src={convertFileSrc(joinPaths(beatmap.songPath, beatmap.general.audioFilename))} />
				<Section1 />
				<Section2 />
				<Section3 />
				<Section4 />
			</div>
		</>
	);
};

export default ManiaEditor;
