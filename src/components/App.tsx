import React, { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import './App.scss';

import SongListPage from './SongListPage';
import SongEditPage from './SongEditPage';
import NotFound from './NotFound';

const App: React.FC = () => {
	const location = useLocation();
	
	useEffect(() => {
		console.clear();
	}, [location.pathname]);
	
	return (
		<Routes>
			<Route path={'/'} element={<SongListPage />} />
			<Route path={'/edit'} element={<SongEditPage />} />
			<Route path={'*'} element={<NotFound />} />
		</Routes>
	);
};

export default App;
