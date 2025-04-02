import { useRef } from 'react';

import './index.scss';

import ManiaEditor from './Mania';
import LoadingGif from '@/assets/loading.gif';

import { GameMode, OsuBeatmap } from '@/utils/Beatmap';

interface EditorProps {
	beatmap: OsuBeatmap | null;
}

const Editor: React.FC<EditorProps> = ({ beatmap }) => {
	const sectionRef = useRef<HTMLDivElement | null>(null);
	
	switch (beatmap?.mode) {
		case GameMode.Mania: {
			return (
				<ManiaEditor beatmap={beatmap} sectionRef={sectionRef} />
			);
		}
		case GameMode.Standard:
		case GameMode.Taiko:
		case GameMode.Catch: {
			return (
				<h2>osu! game mode not supported: osu!{GameMode[beatmap?.mode].toLowerCase()}</h2>
			);
		}
		case undefined: {
			return (
				<div className={'loadingBeatmap'}>
					<h2>Loading beatmap...</h2>
					<img className={'loadingGif'} src={LoadingGif} />
				</div>
			);
		}
	}
};

export default Editor;
