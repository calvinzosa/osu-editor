import React from 'react';

import * as opener from '@tauri-apps/plugin-opener';

interface BrowserLinkProps extends React.PropsWithChildren {
	url: string;
}

const BrowserLink: React.FC<BrowserLinkProps> = ({ url, children }) => {
	return (
		<a
			onClick={(event) => {
				event.preventDefault();
				opener.openUrl(url);
			}}
		>
			{children}
		</a>
	);
};

export default BrowserLink;
