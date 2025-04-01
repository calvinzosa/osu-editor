import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { exists, readDir } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as dialog from '@tauri-apps/plugin-dialog';
import * as path from '@tauri-apps/api/path';

import './SongListPage.scss';

import OpenExplorer from '@/components/Button/OpenExplorer';

import { GameMode, OsuBeatmap, processBeatmaps } from '@/utils/Beatmap';
import { getExtension } from '@/utils/File';
import { Storage } from '@/utils/LocalStorage';

interface SongItemProps {
	songPath: string;
	difficulties: Array<OsuBeatmap>;
}

const SongItem: React.FC<SongItemProps> = ({ songPath, difficulties }) => {
	const navigate = useNavigate();
	
	const [loadAudio, setLoadAudio] = useState<boolean>(false);
	const [headerBeatmap] = useState<OsuBeatmap>(difficulties[0]);
	const [legend] = useState<string>(`${headerBeatmap.metadata.titleUnicode || headerBeatmap.metadata.title} by ${headerBeatmap.metadata.artistUnicode || headerBeatmap.metadata.artist} // ${headerBeatmap.metadata.creator}`);
	const [audioPath] = useState<string>(songPath + '\\' + headerBeatmap.general.audioFilename);
	const [backgroundImage] = useState<string | null>(
		headerBeatmap.events.backgroundPath !== null ? convertFileSrc(songPath + '\\' + headerBeatmap.events.backgroundPath) : null
	);
	
	return (
		<>
			<legend>{legend}</legend>
			<OpenExplorer filePath={songPath} />
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
								<button onClick={() => navigate('/edit', { state: { beatmapPath: beatmap.filePath, songPath } })}>Edit</button>
							</div>
						</fieldset>
					);
				})}
			</div>
		</>
	);
};

interface SongListProps {
	songsPath: string | null;
	songList: Record<string, Array<OsuBeatmap>> | null;
	filteredSongs: Record<string, Array<OsuBeatmap>> | null;
	loadingProgress: number;
	totalSongs: number;
}

const SongList: React.FC<SongListProps> = ({ songsPath, songList, filteredSongs, loadingProgress, totalSongs }) => {
	const listRef = useRef<HTMLFieldSetElement | null>(null);
	
	const seenBeatmapIds = new Set<string>();
	
	useEffect(() => {
		const list = listRef.current;
		if (list === null) {
			return;
		}
		
		list.scrollTop = 0;
	}, [listRef, filteredSongs]);
	
	return (
		<fieldset className={'list'} ref={listRef}>
			{songsPath === null || songList === null ? (
				<div className={'loading'}>
					<p className={'progressLabel'}>Loaded {loadingProgress} out of {totalSongs} songs from {songsPath} ({(loadingProgress / totalSongs * 100).toFixed(2)}%)</p>
					<div className={'loadingGif'} />
					<div className={'loadingBar'} style={{'--progress': `${loadingProgress / totalSongs * 100}%`} as any}></div>
				</div>
			) : Object.entries(filteredSongs ?? {})
			.sort(([, beatmap1], [, beatmap2]) => beatmap1[0].metadata.title.localeCompare(beatmap2[0].metadata.title)).map(([songPath, difficulties]) => {
				const headerBeatmap = difficulties[0];
				if (seenBeatmapIds.has(headerBeatmap.tempId)) {
					return undefined;
				}
				
				seenBeatmapIds.add(headerBeatmap.tempId);
				return (
					<fieldset className={'songItem'} key={headerBeatmap.tempId}>
						<SongItem songPath={songPath} difficulties={difficulties} />
					</fieldset>
				);
			})}
		</fieldset>
	);
};

const SongListPage: React.FC = () => {
	const [osuPath, setOsuPath] = useState<string | null>(null);
	const [songsPath, setSongsPath] = useState<string | null>(null);
	const [songList, setSongList] = useState<Record<string, Array<OsuBeatmap>> | null>(null);
	
	const [loadingProgress, setLoadingProgress] = useState<number>(0);
	const [totalSongs, setTotalSongs] = useState<number>(0);
	const [query, setQuery] = useState<string>('');
	
	const checkOsuPath = async (osuPath: string) => {
		setOsuPath(null);
		setSongList(null);
		
		const doesExist = await exists(await path.join(osuPath, 'osu!.exe'));
		
		if (doesExist) {
			const entries = await readDir(osuPath);
			let songsPath: string | null = null;
			
			for (const entry of entries) {
				if (entry.isDirectory && entry.name === 'Songs') {
					songsPath = await path.join(osuPath, entry.name);
				}
			}
			
			if (songsPath !== null) {
				Storage.set('osuPath', osuPath);
				setOsuPath(osuPath);
				setSongsPath(songsPath);
				processBeatmaps(songsPath, setSongList, setLoadingProgress, setTotalSongs);
			}
		}
	};
	
	useEffect(() => {
		const savedOsuPath = Storage.get('osuPath');
		if (savedOsuPath !== null) {
			checkOsuPath(savedOsuPath);
		} else {
			path.appLocalDataDir()
				.then((localAppData) => path.resolve(localAppData, '..', 'osu!'))
				.then(checkOsuPath);
		}
		
		const savedQuery = Storage.get('songQuery');
		if (savedQuery !== null) {
			setQuery(savedQuery);
		}
	}, []);
	
	useEffect(() => {
		setTotalSongs(Object.keys(songList ?? {}).length);
	}, [songList]);
	
	const filteredSongs = useMemo(() => {
		if (songList === null) {
			return null;
		}
		
		const queryLowercase = query.toLowerCase();
		const filteredSongs: NonNullable<typeof songList> = {};
		
		Object.entries(songList).forEach(([songPath, beatmaps]) => {
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
				filteredSongs[songPath] = beatmaps;
			}
		});
		
		return filteredSongs;
	}, [query, songList]);
	
	return (
		<main className={'songListPage'}>
			<h1 className={'appHeader'}>osu!editor</h1>
			<fieldset className={'appOptions'}>
				<legend>App Options</legend>
				<div className={'infoContainer'}>
					<span>osu! app data directory: </span>
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
								const osuPath = await path.dirname(directory);
								
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
					<span>Songs directory: </span>
					<input className={'code'} value={songsPath ?? '<Unset>'} readOnly />
					<OpenExplorer filePath={songsPath} />
				</div>
			</fieldset>
			<fieldset className={'songsList'}>
				<legend>Song List</legend>
				<div className={'info'}>
					<div className={'refresh'}>
						<button
							disabled={songsPath === null || songList === null}
							onClick={() => {
								if (songsPath !== null) {
									processBeatmaps(songsPath, setSongList, setLoadingProgress, setTotalSongs);
								}
							}}
						>
							Refresh songs
						</button>
					</div>
					<div className={'search'}>
						<span>
							Search {totalSongs} song{totalSongs !== 1 ? 's' : ''}
							{query.length > 0 ? ` (${Object.keys(filteredSongs ?? {}).length} shown)` : ''}
							:
						</span>
						<input
							onChange={(event) => {
								const query = event.currentTarget.value;
								setQuery(query);
								Storage.set('savedQuery', query);
							}}
							disabled={songsPath === null || songList === null}
							type={'text'}
							value={query}
						/>
					</div>
				</div>
				<SongList
					songsPath={songsPath}
					songList={songList}
					filteredSongs={filteredSongs}
					loadingProgress={loadingProgress}
					totalSongs={totalSongs}
				/>
			</fieldset>
		</main>
	);
}

export default SongListPage;
