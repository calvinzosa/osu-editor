import { createContext, memo, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';

import { DefaultUserOptions, EditMode, ReactSet, UserOptions } from '@/utils/Types';
import { OsuBeatmap } from '@/utils/Beatmap';
import { Storage } from '@/utils/LocalStorage';

interface RenderedHitObjects {
	normal: number;
	long: number;
}

interface EditorContextType {
	beatmap: OsuBeatmap;
	isPlaying: boolean;
	setPlaying: ReactSet<boolean>;
	mode: EditMode;
	setMode: ReactSet<EditMode>;
	timestamp: number;
	setTimestamp: ReactSet<number>;
	userOptions: UserOptions;
	setUserOptions: ReactSet<UserOptions>;
	renderedHitObjects: RenderedHitObjects;
	setRenderedHitObjects: ReactSet<RenderedHitObjects>;
	musicRef: React.RefObject<HTMLAudioElement>;
}

const EditorContext = createContext<EditorContextType | null>(null);

export const useEditor = () => {
	const context = useContext(EditorContext);
	if (context === null) {
		throw new Error('useEditor must be used in a component with an <EditorProvider> ancestor');
	}
	
	return context;
};

interface EditorProviderProps extends PropsWithChildren {
	beatmap: OsuBeatmap;
}

const EditorProvider: React.FC<EditorProviderProps> = ({ beatmap, children }) => {
	const [isPlaying, setPlaying] = useState<boolean>(false);
	const [mode, setMode] = useState<EditMode>(EditMode.Selection);
	const [timestamp, setTimestamp] = useState<number>(0);
	const [userOptions, setUserOptions] = useState<UserOptions>(DefaultUserOptions);
	const [renderedHitObjects, setRenderedHitObjects] = useState<RenderedHitObjects>({ normal: 0, long: 0 });
	
	const musicRef = useRef<HTMLAudioElement>(null);
	
	useEffect(() => {
		const savedUserOptions = Storage.get<UserOptions>('userOptions');
		if (savedUserOptions !== null) {
			setUserOptions(() => ({ ...DefaultUserOptions, ...savedUserOptions }));
		}
	}, []);
	
	useEffect(() => {
		Storage.set('userOptions', userOptions);
	}, [userOptions]);
	
	return (
		<EditorContext.Provider
			value={{
				beatmap,
				isPlaying, setPlaying,
				mode, setMode,
				timestamp, setTimestamp,
				userOptions, setUserOptions,
				renderedHitObjects, setRenderedHitObjects,
				musicRef,
			}}
		>
			{children}
		</EditorContext.Provider>
	);
}

export default memo(EditorProvider);
