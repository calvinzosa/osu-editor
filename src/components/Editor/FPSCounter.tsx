import React, { useState } from 'react';

const FPSCounter: React.FC = () => {
	const [fps, setFPS] = useState<number>(0);
	
	useState(() => {
		let shouldUpdate = true;
		let lastTimestamp: DOMHighResTimeStamp | null = null;
		const update: FrameRequestCallback = (timestamp) => {
			if (lastTimestamp !== null) {
				const dt = timestamp - lastTimestamp;
				setFPS(1_000 / dt);
			}
			
			if (shouldUpdate) {
				lastTimestamp = timestamp;
				requestAnimationFrame(update);
			}
		};
		
		requestAnimationFrame(update);
		return () => {
			shouldUpdate = false;
		};
	});
	
	return (
		<p>FPS: {fps.toFixed(2)}</p>
	);
};

export default FPSCounter;
