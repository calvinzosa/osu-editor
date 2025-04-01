import React from 'react';

interface ItemProps {
	action: () => void;
	children?: React.ReactNode | Array<React.ReactNode>;
}

const DropdownItem: React.FC<ItemProps> = ({ action, children }) => {
	return (
		<button
			className={'item'}
			onClick={action}
		>
			{children}
		</button>
	);
};

export default DropdownItem;
