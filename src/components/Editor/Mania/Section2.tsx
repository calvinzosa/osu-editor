import { OsuBeatmap } from '@/utils/Beatmap';

interface Section2Props {
	beatmap: OsuBeatmap;
	timestamp: number;
	renderedHitObjects: BeatmapInfo['renderedHitObjects'];
}

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

const Section2: React.FC<Section2Props> = ({ beatmap, timestamp, renderedHitObjects }) => {
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
			<p>BPM: {beatmapInfo.bpm.toFixed(2)}</p>
			<p>SliderVelocity: {beatmapInfo.sliderVelocity.toFixed(2)}x</p>
			<p>
				Rendered HitObjects:&nbsp;
				{beatmapInfo.renderedHitObjects.normal.toString().padStart(3, '.')} Normal / {beatmapInfo.renderedHitObjects.long.toString().padStart(3, '.')} Long
			</p>
			<p>Keys/s: {beatmapInfo.keysPerSecond.toString().padStart(3, '.')}</p>
			<p>KiaiMode: {beatmapInfo.kiai ? 'true' : 'false'}</p>
		</div>
	);
};

export default Section2;
