import { memo } from 'react';
import FPSCounter from '../FPSCounter';

interface Section4Props {
	timestamp: number;
	musicRef: React.MutableRefObject<HTMLAudioElement | null>;
}

const Section4: React.FC<Section4Props> = ({ timestamp, musicRef }) => {
	return (
		<div className={'section s4'}>
			<p>
				Timestamp:&nbsp;
				{Math.floor(timestamp / 60_000).toString().padStart(2, '0')}:
				{Math.floor(timestamp % 60_000 / 1_000).toString().padStart(2, '0')}.
				{Math.round(timestamp % 1_000).toString().padStart(3, '0')}
				&nbsp;/&nbsp;
				{Math.floor((musicRef.current?.duration ?? 0) / 60).toString().padStart(2, '0')}:
				{Math.floor((musicRef.current?.duration ?? 0) % 60).toString().padStart(2, '0')}.
				{Math.round((musicRef.current?.duration ?? 0) % 1 * 1_000).toString().padStart(3, '0')}
			</p>
			<FPSCounter />
		</div>
	);
};

export default memo(Section4);
