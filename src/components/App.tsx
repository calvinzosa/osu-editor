import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import './App.scss';
import BeatmapListPage from '@/components/SongListPage';
import BeatmapEditPage from '@/components/SongEditPage';
import NotFound from '@/components/NotFound';

const App: React.FC = () => {
	const location = useLocation();
	
	useEffect(() => {
		console.clear();
	}, [location.pathname]);
	
	useEffect(() => {
		document.getElementById('loading')?.remove();
	}, []);
	
	return (
		<Routes>
			<Route path={'/'} element={<BeatmapListPage />} />
			<Route path={'/edit'} element={<BeatmapEditPage />} />
			<Route path={'*'} element={<NotFound />} />
		</Routes>
	);
};

export default App;
