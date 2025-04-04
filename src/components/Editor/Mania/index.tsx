import { PropsWithChildren, useEffect } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';

import './index.scss';
import Section1 from './Section1';
import Section2 from './Section2';
import Section3 from './Section3';
import Section4 from './Section4';
import { useEditor } from '../Provider';

import { joinPaths } from '@/utils/File';

const ManiaEditor: React.FC<PropsWithChildren> = () => {
	const { beatmap, musicRef } = useEditor();
	
	useEffect(() => {
		console.log('musicRef.current =', musicRef.current);
	}, [musicRef]);
	
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
