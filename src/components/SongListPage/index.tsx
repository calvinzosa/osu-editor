import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { exists, readDir } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as dialog from '@tauri-apps/plugin-dialog';
import * as path from '@tauri-apps/api/path';

import './index.scss';
import OpenExplorer from '@/components/Button/OpenExplorer';

import { GameMode, OsuBeatmap, processBeatmaps } from '@/utils/Beatmap';
import { dirName, getExtension, joinPaths } from '@/utils/File';
import { AppName, AppVersion } from '@/utils/Constants';
import { Storage } from '@/utils/LocalStorage';

interface BeatmapItemProps {
	beatmapPath: string;
	difficulties: Array<OsuBeatmap>;
}

const BeatmapItem: React.FC<BeatmapItemProps> = ({ beatmapPath, difficulties }) => {
	const navigate = useNavigate();
	
	const [loadAudio, setLoadAudio] = useState<boolean>(false);
	const [headerBeatmap] = useState<OsuBeatmap>(difficulties[0]);
	const [legend] = useState<string>(`${headerBeatmap.metadata.titleUnicode || headerBeatmap.metadata.title} by ${headerBeatmap.metadata.artistUnicode || headerBeatmap.metadata.artist} // ${headerBeatmap.metadata.creator}`);
	const [audioPath] = useState<string>(beatmapPath + '\\' + headerBeatmap.general.audioFilename);
	const [backgroundImage] = useState<string | null>(
		headerBeatmap.events.backgroundPath !== null ? convertFileSrc(beatmapPath + '\\' + headerBeatmap.events.backgroundPath) : null
	);
	
	return (
		<>
			<legend>{legend}</legend>
			<OpenExplorer filePath={beatmapPath} />
			<button onClick={() => setLoadAudio((loadAudio) => !loadAudio)}>{loadAudio ? 'Hide audio' : 'Show audio'}</button>
			{loadAudio && (
				<audio controls>
					<source src={convertFileSrc(audioPath)} type={`audio/${getExtension(audioPath)}`} />
					&lt;Audio playback is not supported&gt;
				</audio>
			)}
			<div className={'difficulties'}>
				{backgroundImage !== null && <img className={'background'} src={backgroundImage} />}
				{difficulties.map((beatmap, j) => {
					return (
						<fieldset className={'difficulty'} key={j}>
							<div className={'info'}>
								<h3>{beatmap.metadata.version || '<No Version>'}</h3>
								<p>BPM: {beatmap.bpm.toFixed(2)}</p>
								<p>Game Mode: osu!{GameMode[beatmap.mode].toLowerCase()}</p>
								<p>
									{beatmap.maxComboStable !== beatmap.maxComboLazer ? (
										`Max Combo: ${beatmap.maxComboStable}x in stable / ${beatmap.maxComboLazer}x in lazer`
									) : (
										`Max Combo: ${beatmap.maxComboStable}x in both versions`
									)}
								</p>
							</div>
							<div className={'buttons'}>
								<button onClick={() => navigate('/edit', { state: { difficultyPath: beatmap.filePath, beatmapPath } })}>Edit</button>
							</div>
						</fieldset>
					);
				})}
			</div>
		</>
	);
};

interface BeatmapListProps {
	beatmapsPath: string | null;
	beatmapList: Record<string, Array<OsuBeatmap>> | null;
	filteredBeatmaps: Record<string, Array<OsuBeatmap>> | null;
	loadingProgress: number;
	totalBeatmaps: number;
}

const BeatmapList: React.FC<BeatmapListProps> = ({ beatmapsPath, beatmapList, filteredBeatmaps, loadingProgress, totalBeatmaps }) => {
	const listRef = useRef<HTMLFieldSetElement | null>(null);
	const seenBeatmapIds = new Set<string>();
	
	useEffect(() => {
		const list = listRef.current;
		if (list === null) {
			return;
		}
		
		list.scrollTop = 0;
	}, [listRef, filteredBeatmaps]);
	
	return (
		<fieldset className={'list'} ref={listRef}>
			{beatmapsPath === null || beatmapList === null ? (
				<div className={'loading'}>
					<p className={'progressLabel'}>Loaded {loadingProgress} out of {totalBeatmaps} beatmaps from {beatmapsPath} ({(loadingProgress / totalBeatmaps * 100).toFixed(2)}%)</p>
					<div className={'loadingGif'} />
					<div className={'loadingBar'} style={{'--progress': `${loadingProgress / totalBeatmaps * 100}%`} as any}></div>
				</div>
			) : Object.entries(filteredBeatmaps ?? {})
			.sort(([, beatmap1], [, beatmap2]) => beatmap1[0].metadata.title.localeCompare(beatmap2[0].metadata.title)).map(([beatmapPath, difficulties]) => {
				const headerBeatmap = difficulties[0];
				if (seenBeatmapIds.has(headerBeatmap.tempId)) {
					return undefined;
				}
				
				seenBeatmapIds.add(headerBeatmap.tempId);
				return (
					<fieldset className={'beatmapItem'} key={headerBeatmap.tempId}>
						<BeatmapItem beatmapPath={beatmapPath} difficulties={difficulties} />
					</fieldset>
				);
			})}
		</fieldset>
	);
};

const BeatmapListPage: React.FC = () => {
	const [osuPath, setOsuPath] = useState<string | null>(null);
	const [beatmapsPath, setBeatmapsPath] = useState<string | null>(null);
	const [beatmapList, setBeatmapList] = useState<Record<string, Array<OsuBeatmap>> | null>(null);
	
	const [loadingProgress, setLoadingProgress] = useState<number>(0);
	const [totalBeatmaps, setTotalBeatmaps] = useState<number>(0);
	const [query, setQuery] = useState<string>('');
	
	const checkOsuPath = async (osuPath: string) => {
		setOsuPath(null);
		setBeatmapList(null);
		
		const doesExist = await exists(joinPaths(osuPath, 'osu!.exe'));
		
		if (doesExist) {
			const entries = await readDir(osuPath);
			let beatmapsPath: string | null = null;
			
			for (const entry of entries) {
				if (entry.isDirectory && entry.name === 'Songs') {
					beatmapsPath = joinPaths(osuPath, entry.name);
					break;
				}
			}
			
			if (beatmapsPath !== null) {
				Storage.set('osuPath', osuPath);
				setOsuPath(osuPath);
				setBeatmapsPath(beatmapsPath);
				processBeatmaps(beatmapsPath, setBeatmapList, setLoadingProgress, setTotalBeatmaps);
			}
		}
	};
	
	useEffect(() => {
		const savedOsuPath = Storage.get<string>('osuPath');
		if (savedOsuPath !== null) {
			checkOsuPath(savedOsuPath);
		} else {
			path.appLocalDataDir()
				.then((localAppData) => path.resolve(localAppData, '..', 'osu!'))
				.then(checkOsuPath);
		}
		
		const savedQuery = Storage.get<string>('beatmapQuery');
		if (savedQuery !== null) {
			setQuery(savedQuery);
		}
	}, []);
	
	useEffect(() => {
		setTotalBeatmaps(Object.keys(beatmapList ?? {}).length);
	}, [beatmapList]);
	
	const filteredBeatmaps = useMemo(() => {
		if (beatmapList === null) {
			return null;
		}
		
		const queryLowercase = query.toLowerCase();
		const filteredBeatmaps: NonNullable<typeof beatmapList> = {};
		
		Object.entries(beatmapList).forEach(([beatmapPath, beatmaps]) => {
			const matchesQuery = beatmaps.some((beatmap) => {
				const searchFields = [
					beatmap.metadata.title,
					beatmap.metadata.titleUnicode,
					beatmap.metadata.artist,
					beatmap.metadata.artistUnicode,
					beatmap.metadata.creator,
					...beatmap.metadata.tags,
				];
				
				return searchFields.some((field) => field.toLowerCase().includes(queryLowercase));
			});
			
			if (matchesQuery) {
				filteredBeatmaps[beatmapPath] = beatmaps;
			}
		});
		
		return filteredBeatmaps;
	}, [query, beatmapList]);
	
	return (
		<main className={'beatmapListPage'}>
			<h1 className={'appHeader'}>{AppName}</h1>
			<p className={'appVersion'}>{AppVersion}</p>
			<fieldset className={'appOptions'}>
				<legend>App Options</legend>
				<div className={'infoContainer'}>
					<span>osu! App Data Path: </span>
					<input className={'code'} value={osuPath ?? '<Unset>'} readOnly />
					<button
						onClick={async () => {
							const directory = await dialog.open({
								multiple: false,
								directory: false,
								filters: [
									{extensions: ['exe'], name: 'Executable files'}
								],
								defaultPath: 'C:\\',
								title: 'osu!editor - Select osu!.exe (STABLE VERSION)',
							});
							
							if (directory !== null) {
								const osuPath = dirName(directory);
								checkOsuPath(osuPath);
							}
						}}
					>
						Change directory
					</button>
					<button
						onClick={() => {
							path.appLocalDataDir()
								.then((localAppData) => path.resolve(localAppData, '..', 'osu!'))
								.then(checkOsuPath);
						}}
					>
						Reset to %LOCALAPPDATA%/osu!
					</button>
					<OpenExplorer filePath={osuPath} />
				</div>
				<div className={'infoContainer'}>
					<span>Beatmaps Path: </span>
					<input className={'code'} value={beatmapsPath ?? '<Unset>'} readOnly />
					<OpenExplorer filePath={beatmapsPath} />
				</div>
			</fieldset>
			<fieldset className={'beatmapList'}>
				<legend>Beatmap List</legend>
				<div className={'info'}>
					<div className={'refresh'}>
						<button
							disabled={beatmapsPath === null || beatmapList === null}
							onClick={() => {
								if (beatmapsPath !== null) {
									processBeatmaps(beatmapsPath, setBeatmapList, setLoadingProgress, setTotalBeatmaps);
								}
							}}
						>
							Refresh beatmaps
						</button>
					</div>
					<div className={'search'}>
						<span>
							Search {totalBeatmaps} beatmap{totalBeatmaps !== 1 ? 's' : ''}
							{query.length > 0 ? ` (${Object.keys(filteredBeatmaps ?? {}).length} shown)` : ''}
							:
						</span>
						<input
							onChange={(event) => {
								const query = event.currentTarget.value;
								setQuery(query);
								Storage.set('savedQuery', query);
							}}
							disabled={beatmapsPath === null || beatmapList === null}
							type={'text'}
							value={query}
						/>
					</div>
				</div>
				<BeatmapList
					beatmapsPath={beatmapsPath}
					beatmapList={beatmapList}
					filteredBeatmaps={filteredBeatmaps}
					loadingProgress={loadingProgress}
					totalBeatmaps={totalBeatmaps}
				/>
			</fieldset>
		</main>
	);
}

export default BeatmapListPage;
