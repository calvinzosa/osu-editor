import { useEffect } from 'react';

export function useRefEffect<T>(callback: () => void, ref: React.MutableRefObject<T>, deps?: React.DependencyList) {
	useEffect(() => {
		callback();
		
		let prevValue = ref.current;
		let id: number;
		
		const check = () => {
			if (prevValue !== ref.current) {
				prevValue = ref.current;
				callback();
			}
			
			id = requestAnimationFrame(check);
		};
		
		id = requestAnimationFrame(check);
		return () => {
			cancelAnimationFrame(id);
		}
	}, [ref, ...(deps ?? [])]);
}
