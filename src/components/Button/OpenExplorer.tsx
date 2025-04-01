import React, { useState } from 'react';

import { revealItemInDir } from '@tauri-apps/plugin-opener';

import './index.scss';
import './OpenExplorer.scss';

interface OpenExplorerProps {
	filePath: string | null;
}

const OpenExplorer: React.FC<OpenExplorerProps> = ({ filePath }) => {
	const [disabled, setDisabled] = useState<boolean>(false);
	
	return (
		<button
			disabled={disabled}
			onClick={() => {
				if (filePath !== null) {
					setDisabled(true);
					
					revealItemInDir(filePath)
						.then(() => setDisabled(false));
				}
			}}
		>
			Open in explorer
		</button>
	);
};

export default OpenExplorer;
