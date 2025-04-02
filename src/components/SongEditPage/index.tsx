import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readFile } from '@tauri-apps/plugin-fs';

import './index.scss';
import DropdownContainer, { DropdownItem } from '@/components/Dropdown';
import Editor from '@/components/Editor';

import { beatmapDecoder, initializeBeatmap, OsuBeatmap } from '@/utils/Beatmap';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

interface TopbarProps {
	beatmapPath: string | undefined;
}

const Topbar: React.FC<TopbarProps> = ({ beatmapPath }) => {
	const navigate = useNavigate();
	
	return (
		<div className={'topbar'}>
			<div className={'buttons'}>
				<DropdownContainer label={'File'} openTo={'south'}>
					<DropdownItem action={() => {}}>Save... [ctrl+s]</DropdownItem>
					<DropdownItem action={() => {}}>Save as... [ctrl+shift+s]</DropdownItem>
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
	const [beatmap, setBeatmap] = useState<OsuBeatmap | null>(null);
	const location = useLocation();
	const navigate = useNavigate();
	
	const difficultyPath = location.state?.difficultyPath as string | undefined;
	const beatmapPath = location.state?.beatmapPath as string | undefined;
	
	useEffect(() => {
		if (!difficultyPath || !beatmapPath) {
			navigate('/');
			return;
		}
		
		console.log(`Beatmap path: ${difficultyPath}`);
		
		readFile(difficultyPath)
			.then((contents) => {
				const beatmap = beatmapDecoder.decodeFromBuffer(contents) as OsuBeatmap;
				initializeBeatmap(beatmap, difficultyPath, beatmapPath);
				setBeatmap(beatmap);
			})
			.catch(() => navigate('/'));
	}, [location]);
	
	return (
		<>
			<Topbar beatmapPath={difficultyPath} />
			<main className={'beatmapEditPage'}>
				<Editor beatmap={beatmap} />
			</main>
		</>
	);
};

export default BeatmapEditPage;
