import { useEditor } from '../Provider';

interface BeatmapInfo {
	bpm: number;
	sliderVelocity: number;
	keysPerSecond: number;
	kiai: boolean;
	renderedHitObjects: {
		normal: number;
		long: number;
	};
}

const Section2: React.FC = () => {
	const { beatmap, timestamp, renderedHitObjects } = useEditor();
	
	const currentTimingPoint = beatmap.controlPoints.timingPointAt(timestamp);
	const bpm = currentTimingPoint?.bpmUnlimited ?? 60;
	
	const currentDifficultyPoint = beatmap.controlPoints.difficultyPointAt(timestamp);
	const currentEffectPoint = beatmap.controlPoints.effectPointAt(timestamp);
	const sliderVelocity = currentDifficultyPoint?.sliderVelocityUnlimited ?? 1;
	const kiai = currentEffectPoint.kiai;
	
	let keysPerSecond = 0;
	for (const hitObject of beatmap.hitObjects) {
		if (hitObject.startTime > timestamp) {
			break;
		}
		
		if (hitObject.startTime > timestamp - 1_000) {
			keysPerSecond++;
		}
	}
	
	const beatmapInfo: BeatmapInfo = { bpm, sliderVelocity, keysPerSecond, renderedHitObjects, kiai };
	
	return (
		<div className={'section s2'}>
			<p title={'Beats per minute or the tempo'}>
				BPM:&nbsp;{beatmapInfo.bpm.toFixed(2)}
			</p>
			<p title={'Velocity multiplier for hit objects (shown in preview only)'}>
				SliderVelocity:&nbsp;{beatmapInfo.sliderVelocity.toFixed(2)}x
			</p>
			<p title={'Number of rendered hit objects in the preview'}>
				Rendered&nbsp;HitObjects:&nbsp;
				{beatmapInfo.renderedHitObjects.normal.toString().padStart(3, '.')}&nbsp;Normal&nbsp;
				/&nbsp;{beatmapInfo.renderedHitObjects.long.toString().padStart(3, '.')}&nbsp;Long
			</p>
			<p title={'Keys per second (number of hit objects in the past 1,000 milliseconds)'}>
				Keys/s:&nbsp;{beatmapInfo.keysPerSecond.toString().padStart(3, '.')}
			</p>
			<p title={'Whether kiai mode is on at the current timestamp'}>
				KiaiMode:&nbsp;{beatmapInfo.kiai ? 'true' : 'false'}
			</p>
		</div>
	);
};

export default Section2;
