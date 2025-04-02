import { memo } from 'react';

import { DefaultUserOptions, ReactSet, UserOptions } from '@/utils/Types';

interface Section3Props {
	userOptions: UserOptions;
	setUserOptions: ReactSet<UserOptions>;
}

const Section3: React.FC<Section3Props> = ({ userOptions, setUserOptions }) => {
	return (
		<div className={'section s3'}>
			<div className={'userOption'}>
				<p title={'The speed at which the hit objects scroll'}>ScrollSpeed:&nbsp;{userOptions.scrollSpeed}</p>
				<input
					type={'range'}
					min={1}
					max={70}
					step={1}
					value={userOptions.scrollSpeed}
					onChange={(event) => {
						const scrollSpeed = parseInt(event.currentTarget.value);
						if (isNaN(scrollSpeed) || !isFinite(scrollSpeed)) {
							return;
						}
						
						setUserOptions((userOptions) => ({ ...userOptions, scrollSpeed }));
					}}
				/>
				<button
					disabled={userOptions.scrollSpeed === DefaultUserOptions.scrollSpeed}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, scrollSpeed: DefaultUserOptions.scrollSpeed }))}
					title={`Default: ${DefaultUserOptions.scrollSpeed}`}
				>
					Reset&nbsp;to&nbsp;default&nbsp;
				</button>
			</div>
			<div className={'userOption'}>
				<p title={'Beat snap divisor'}>BeatSnapDivisor:&nbsp;1/{userOptions.beatSnapDivisor}</p>
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
						
						setUserOptions((userOptions) => ({ ...userOptions, beatSnapDivisor }));
					}}
				/>
				<button
					disabled={userOptions.beatSnapDivisor === DefaultUserOptions.beatSnapDivisor}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, beatSnapDivisor: DefaultUserOptions.beatSnapDivisor }))}
					title={`Default: ${DefaultUserOptions.beatSnapDivisor}`}
				>
					Reset&nbsp;to&nbsp;default&nbsp;
				</button>
			</div>
			<div className={'userOption'}>
				<p title={'The hit position of the receptors'}>
					HitPosition:&nbsp;{userOptions.hitPosition}/480&nbsp;({(userOptions.hitPosition / 480 * 100).toFixed(2)}%)
				</p>
				<input
					type={'range'}
					min={0}
					max={480}
					step={1}
					value={userOptions.hitPosition}
					onChange={(event) => {
						const hitPosition = parseInt(event.currentTarget.value);
						if (isNaN(hitPosition) || !isFinite(hitPosition)) {
							return;
						}
						
						setUserOptions((userOptions) => ({ ...userOptions, hitPosition }));
					}}
				/>
				<button
					disabled={userOptions.hitPosition === DefaultUserOptions.hitPosition}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, hitPosition: DefaultUserOptions.hitPosition }))}
					title={`Default: ${DefaultUserOptions.hitPosition}`}
				>
					Reset&nbsp;to&nbsp;default&nbsp;
				</button>
			</div>
			<div className={'userOption'}>
				<p title={'The playback speed of the music and video'}>PlaybackSpeed:&nbsp;{userOptions.playBackSpeed.toFixed(2)}x</p>
				<input
					type={'range'}
					min={0.1}
					max={2}
					step={0.05}
					value={userOptions.playBackSpeed}
					onChange={(event) => {
						const playBackSpeed = parseFloat(event.currentTarget.value);
						if (isNaN(playBackSpeed) || !isFinite(playBackSpeed)) {
							return;
						}
						
						setUserOptions((userOptions) => ({ ...userOptions, playBackSpeed }));
					}}
				/>
				<button
					disabled={userOptions.playBackSpeed === DefaultUserOptions.playBackSpeed}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, playBackSpeed: DefaultUserOptions.playBackSpeed }))}
					title={`Default: ${DefaultUserOptions.playBackSpeed}`}
				>
					Reset&nbsp;to&nbsp;default&nbsp;
				</button>
			</div>
			<div className={'userOption'}>
				<p title={'Whether the speed adjusts the pitch of the music'}>SpeedAdjustsPitch:</p>
				<input
					type={'checkbox'}
					checked={userOptions.speedAdjustsPitch}
					onChange={(event) => {
						setUserOptions((userOptions) => ({ ...userOptions, speedAdjustsPitch: event.target.checked }));
					}}
				/>
				<button
					disabled={userOptions.speedAdjustsPitch === DefaultUserOptions.speedAdjustsPitch}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, speedAdjustsPitch: DefaultUserOptions.speedAdjustsPitch }))}
					title={`Default: ${DefaultUserOptions.speedAdjustsPitch}`}
				>
					Reset&nbsp;to&nbsp;default&nbsp;
				</button>
			</div>
			<div className={'userOption'}>
				<p title={'Width of each lane in percent'}>LaneWidthPercent:&nbsp;{userOptions.laneWidthPercent.toFixed(1)}%</p>
				<input
					type={'range'}
					min={10}
					max={40}
					step={0.5}
					value={userOptions.laneWidthPercent}
					onChange={(event) => {
						const laneWidthPercent = parseFloat(event.currentTarget.value);
						if (isNaN(laneWidthPercent) || !isFinite(laneWidthPercent)) {
							return;
						}
						
						setUserOptions((userOptions) => ({ ...userOptions, laneWidthPercent }));
					}}
				/>
				<button
					disabled={userOptions.laneWidthPercent === DefaultUserOptions.laneWidthPercent}
					onClick={() => setUserOptions((userOptions) => ({ ...userOptions, laneWidthPercent: DefaultUserOptions.laneWidthPercent }))}
					title={`Default: ${DefaultUserOptions.laneWidthPercent}`}
				>
					Reset&nbsp;to&nbsp;default&nbsp;
				</button>
			</div>
		</div>
	);
};

export default memo(Section3);
