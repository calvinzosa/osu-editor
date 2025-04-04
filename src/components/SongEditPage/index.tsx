import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { readFile } from '@tauri-apps/plugin-fs';
import { ask } from '@tauri-apps/plugin-dialog';

import './index.scss';
import DropdownContainer, { DropdownItem } from '@/components/Dropdown';
import Editor from '@/components/Editor';

import { beatmapDecoder, initializeBeatmap, OsuBeatmap } from '@/utils/Beatmap';

interface TopbarProps {
	beatmapPath: string | undefined;
	save(): void;
	reloadFile(): void;
	openBeatmapInExplorer(): void;
	exit(): void;
	undo(): void;
	redo(): void;
}

const Topbar: React.FC<TopbarProps> = ({ beatmapPath, save, reloadFile, openBeatmapInExplorer, exit, undo, redo }) => {
	// TODO: customizable hotkeys (editor modes too)
	return (
		<div className={'topbar'}>
			<div className={'buttons'}>
				<DropdownContainer label={'File'} openTo={'south'}>
					<DropdownItem action={save}>Save beatmap to file [ctrl+s]</DropdownItem>
					<DropdownItem action={reloadFile}>Reload file [alt+f5]</DropdownItem>
					<DropdownItem action={openBeatmapInExplorer}>Open beatmap folder in Explorer [ctrl+shift+e]</DropdownItem>
					<DropdownItem action={exit}>Exit [ctrl+f1]</DropdownItem>
				</DropdownContainer>
				<DropdownContainer label={'Editor'} openTo={'south'}>
					<DropdownItem action={undo}>Undo [ctrl+z]</DropdownItem>
					<DropdownItem action={redo}>Redo [ctrl+y or ctrl+shift+z]</DropdownItem>
				</DropdownContainer>
			</div>
			<div className={'info'}>
				<span>{beatmapPath}</span>
			</div>
		</div>
	);
};

const BeatmapEditPage: React.FC = () => {
	const location = useLocation();
	const navigate = useNavigate();
	
	const [beatmap, setBeatmap] = useState<OsuBeatmap | null>(null);
	const [shouldRefreshBeatmap, setRefreshBeatmap] = useState<boolean>(true);
	
	const difficultyPath = location.state?.difficultyPath as string | undefined;
	const beatmapPath = location.state?.beatmapPath as string | undefined;
	
	const [forceCrash, setForceCrash] = useState<boolean>(false);
	
	const save = () => {
		console.log('TODO: Save beatmap to file');
	};
	
	const reloadFile = async () => {
		const yes = await ask('Are you sure you want to reload the file? You will lose ALL unsaved changes and this action is irreversible', {
			title: 'osu!editor',
			kind: 'warning',
		});
		
		if (!yes) {
			return;
		}
		
		setRefreshBeatmap(true);
	};
	
	const openBeatmapInExplorer = () => {
		if (beatmapPath === undefined) {
			return;
		}
		
		revealItemInDir(beatmapPath);
	};
	
	// TODO: add history & detect for changes in beatmap
	const exit = async () => {
		const yes = await ask('You have unsaved changes, are you sure you want to exit?', {
			title: 'osu!editor',
			kind: 'warning',
		});
		
		if (!yes) {
			return;
		}
		
		// for some reason you have to stop playing the song and then it actually goes back to the song list, not sure why
		// this happens
		navigate('/');
	};
	
	const undo = () => {
		console.log('TODO: Undo');
	};
	
	const redo = () => {
		console.log('TODO: Redo');
	};
	
	const onKeyDown = (event: KeyboardEvent) => {
		switch (event.code) {
			case 'KeyS': {
				if (event.ctrlKey) {
					save();
				}
				
				break;
			}
			case 'F1': {
				if (event.ctrlKey) {
					exit();
				}
				
				break;
			}
			case 'F5': {
				if (event.altKey) {
					reloadFile();
				}
				
				break;
			}
			case 'KeyE': {
				if (event.ctrlKey && event.shiftKey) {
					openBeatmapInExplorer();
				}
				break;
			}
			case 'KeyC': {
				if (event.ctrlKey && event.shiftKey && event.altKey) {
					setForceCrash(true);
				}
				
				break;
			}
			case 'KeyZ': {
				if (event.ctrlKey) {
					if (event.shiftKey) {
						redo();
					} else {
						undo();
					}
				}
				
				break;
			}
			case 'KeyY': {
				if (event.ctrlKey) {
					redo();
				}
				
				break;
			}
			default: {
				return;
			}
		}
		
		event.preventDefault();
	};
	
	useEffect(() => {
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		}
	}, []);
	
	useEffect(() => {
		if (!forceCrash) {
			return;
		}
		
		throw new Error('Force crash triggered (CTRL+ALT+SHIFT+C)');
	}, [forceCrash]);
	
	useEffect(() => {
		if (!shouldRefreshBeatmap) {
			return;
		}
		
		if (!difficultyPath || !beatmapPath) {
			navigate('/');
			return;
		}
		
		setRefreshBeatmap(false);
		
		console.log(`Beatmap path: ${difficultyPath}`);
		
		readFile(difficultyPath)
			.then((contents) => {
				const beatmap = beatmapDecoder.decodeFromBuffer(contents) as OsuBeatmap;
				initializeBeatmap(beatmap, difficultyPath, beatmapPath);
				setBeatmap(beatmap);
			})
			.catch(() => navigate('/'));
	}, [location, shouldRefreshBeatmap]);
	
	return (
		<>
			<Topbar
				beatmapPath={difficultyPath}
				save={save}
				reloadFile={reloadFile}
				openBeatmapInExplorer={openBeatmapInExplorer}
				exit={exit}
				undo={undo}
				redo={redo}
			/>
			<main className={'beatmapEditPage'}>
				<Editor beatmap={beatmap} />
			</main>
		</>
	);
};

export default BeatmapEditPage;
