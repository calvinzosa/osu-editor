import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readFile } from '@tauri-apps/plugin-fs';

import './SongEditPage.scss';

import DropdownContainer, { DropdownItem } from './Dropdown';
import Editor from './Editor';

import { beatmapDecoder, initializeBeatmap, OsuBeatmap } from '@/utils/Beatmap';

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
					<DropdownItem action={() => navigate('/')}>Exit [ctrl+esc]</DropdownItem>
				</DropdownContainer>
			</div>
			<div className={'info'}>
				<span>{beatmapPath}</span>
			</div>
		</div>
	);
};

const SongEditPage: React.FC = () => {
	const [beatmap, setBeatmap] = useState<OsuBeatmap | null>(null);
	const location = useLocation();
	const navigate = useNavigate();
	
	const beatmapPath = location.state?.beatmapPath as string | undefined;
	const songPath = location.state?.songPath as string | undefined;
	
	useEffect(() => {
		if (!beatmapPath || !songPath) {
			navigate('/');
			return;
		}
		
		console.log(`Beatmap path: ${beatmapPath}`);
		
		readFile(beatmapPath)
			.then((contents) => {
				const beatmap = beatmapDecoder.decodeFromBuffer(contents) as OsuBeatmap;
				initializeBeatmap(beatmap, beatmapPath, songPath);
				setBeatmap(beatmap);
			})
			.catch(() => navigate('/'));
	}, [location]);
	
	return (
		<>
			<Topbar beatmapPath={beatmapPath} />
			<main className={'songEditPage'}>
				<Editor beatmap={beatmap} />
			</main>
		</>
	);
};

export default SongEditPage;
