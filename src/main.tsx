import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ErrorBoundary>
	</React.StrictMode>
);

const mouseListener = (event: MouseEvent) => {
	if (event.button === 3 || event.button === 4) {
		event.preventDefault();
		event.stopPropagation();
	}
};

window.addEventListener('mousedown', mouseListener);
window.addEventListener('mouseup', mouseListener);
