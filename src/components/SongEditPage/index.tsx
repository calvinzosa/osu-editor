import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { readFile } from '@tauri-apps/plugin-fs';
import { ask } from '@tauri-apps/plugin-dialog';

import './index.scss';
import DropdownContainer, { DropdownItem } from '@/components/Dropdown';
import Editor from '@/components/Editor';

import { beatmapDecoder, initializeBeatmap, OsuBeatmap } from '@/utils/Beatmap';
import { ReactSet } from '@/utils/Types';

interface TopbarProps {
	beatmapPath: string | undefined;
	setRefreshBeatmap: ReactSet<boolean>;
}

const Topbar: React.FC<TopbarProps> = ({ beatmapPath, setRefreshBeatmap }) => {
	const navigate = useNavigate();
	
	return (
		<div className={'topbar'}>
			<div className={'buttons'}>
				<DropdownContainer label={'File'} openTo={'south'}>
					<DropdownItem action={() => {}}>Save [ctrl+s]</DropdownItem>
					<DropdownItem action={() => {}}>Save as... [ctrl+shift+s]</DropdownItem>
					<DropdownItem
						action={() => {
							ask('Are you sure you want to reload the file? You will lose ALL unsaved changes and this action is irreversible', {
								title: 'osu!editor',
								kind: 'warning',
							}).then((yes) => {
								if (!yes) {
									return;
								}
								
								setRefreshBeatmap(true);
							});
						}}
					>
						Reload File
					</DropdownItem>
					<DropdownItem
						action={() => {
							if (beatmapPath === undefined) {
								return;
							}
							
							revealItemInDir(beatmapPath);
						}}
					>
						Open beatmap folder in Explorer [ctrl+shift+e]
					</DropdownItem>
					<DropdownItem action={() => navigate('/')}>Exit [ctrl+f1]</DropdownItem>
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
			<Topbar beatmapPath={difficultyPath} setRefreshBeatmap={setRefreshBeatmap} />
			<main className={'beatmapEditPage'}>
				<Editor beatmap={beatmap} />
			</main>
		</>
	);
};

export default BeatmapEditPage;
