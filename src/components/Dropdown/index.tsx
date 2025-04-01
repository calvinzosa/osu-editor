import React, { useEffect, useRef, useState } from 'react';

import DropdownItem from './Item';

import './index.scss';

type Direction = 'north' | 'east' | 'south' | 'west';

interface DropdownProps {
	label: string;
	openTo: Direction;
	children?: React.ReactElement | Array<React.ReactElement>;
}

const DropdownContainer: React.FC<DropdownProps> = ({ label, openTo, children }) => {
	const [open, setOpen] = useState<boolean>(false);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const contentsRef = useRef<HTMLDivElement | null>(null);
	
	const onClick = (event: MouseEvent) => {
		if (event.target instanceof HTMLButtonElement && contentsRef.current?.contains(event.target) && event.target !== buttonRef.current) {
			if (event.target.classList.contains('item') && event.type === 'mouseup') {
				setOpen(false);
			}
			
			return;
		}
		
		if (event.target === buttonRef.current) {
			if (event.type === 'mousedown') {
				setOpen((open) => !open);
			}
		} else {
			setOpen(false);
		}
	};
	
	useEffect(() => {
		document.addEventListener('mousedown', onClick);
		document.addEventListener('mouseup', onClick);
		
		return () => {
			document.removeEventListener('mousedown', onClick);
			document.removeEventListener('mouseup', onClick);
		}
	}, []);
	
	return (
		<div className={`dropdown ${openTo} ${open ? 'open' : ''}`}>
			<button className={'button'} ref={buttonRef}>{label}</button>
			<div className={'contents'} ref={contentsRef}>{children}</div>
		</div>
	);
};

export default DropdownContainer;

export { DropdownItem };
