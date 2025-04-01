import React from 'react';

import { BeatmapInfo } from '@/utils/Beatmap';
import { ReactSet, DefaultUserOptions, UserOptions } from '@/utils/Types';

interface Section2Props extends BeatmapInfo {
	keysPerSecond: number;
	userOptions: UserOptions;
	setUserOptions: ReactSet<UserOptions>;
}

const Section2: React.FC<Section2Props> = ({ bpm, sliderVelocity, renderedNormalObjects, renderedHoldObjects, userOptions, setUserOptions, keysPerSecond }) => {
	return (
		<div className={'section s2'}>
			<p>BPM: {bpm.toFixed(2)}</p>
			<p>SliderVelocity: {sliderVelocity.toFixed(2)}x</p>
			<p>Rendered HitObjects: {renderedNormalObjects.toString().padStart(3, '.')} Normal / {renderedHoldObjects.toString().padStart(3, '.')} Hold</p>
			<p>Keys/s: {keysPerSecond.toString().padStart(3, '.')}</p>
			<div className={'scrollSpeedChanger'}>
				<p>ScrollSpeed: {userOptions.scrollSpeed}</p>
				<input
					type={'range'}
					min={1}
					max={40}
					step={1}
					value={userOptions.scrollSpeed}
					onChange={(event) => {
						const scrollSpeed = parseInt(event.currentTarget.value);
						if (isNaN(scrollSpeed) || !isFinite(scrollSpeed)) {
							return;
						}
						
						setUserOptions((userOptions) => ({ ...userOptions, scrollSpeed: scrollSpeed }));
					}}
				/>
				<button
					disabled={userOptions.scrollSpeed === DefaultUserOptions.scrollSpeed}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, scrollSpeed: DefaultUserOptions.scrollSpeed }))}
				>
					Reset to default ({DefaultUserOptions.scrollSpeed})
				</button>
			</div>
			<div className={'beatSnapDivisorChanger'}>
				<p>BeatSnapDivisor: {userOptions.beatSnapDivisor}</p>
				<input
					type={'range'}
					min={1}
					max={16}
					step={1}
					value={userOptions.beatSnapDivisor}
					onChange={(event) => {
						const beatSnapDivisor = parseInt(event.currentTarget.value);
						if (isNaN(beatSnapDivisor) || !isFinite(beatSnapDivisor)) {
							return;
						}
						
						setUserOptions((userOptions) => ({ ...userOptions, beatSnapDivisor: beatSnapDivisor }));
					}}
				/>
				<button
					disabled={userOptions.beatSnapDivisor === DefaultUserOptions.beatSnapDivisor}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, beatSnapDivisor: DefaultUserOptions.beatSnapDivisor }))}
				>
					Reset to default ({DefaultUserOptions.beatSnapDivisor})
				</button>
			</div>
		</div>
	);
};

export default Section2;
