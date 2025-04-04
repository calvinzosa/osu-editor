import { Choose, When, Otherwise } from 'tsx-control-statements/components';

import './index.scss';

import { GameMode, OsuBeatmap } from '@/utils/Beatmap';
import EditorProvider from './Provider';
import ManiaEditor from './Mania';

interface EditorProps {
	beatmap: OsuBeatmap | null;
}

const Editor: React.FC<EditorProps> = ({ beatmap }) => {
	if (!beatmap) {
		return (
			<div className={'loadingBeatmap'}>
				<h2>Loading beatmap...</h2>
				<div className={'loadingGif'} />
			</div>
		);
	}
	
	return (
		<EditorProvider beatmap={beatmap}>
			<Choose>
				<When condition={beatmap.mode === GameMode.Mania}>
					<ManiaEditor />
				</When>
				<Otherwise>
					<h2>osu! game mode not supported: osu!{GameMode[beatmap.mode].toLowerCase()}</h2>
				</Otherwise>
			</Choose>
		</EditorProvider>
	);
};

export default Editor;
