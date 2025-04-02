import { Component, ErrorInfo, ReactNode } from 'react';

import './ErrorBoundary.scss';

import { AppName } from '@/utils/Constants';

interface ErrorBoundaryProps extends React.PropsWithChildren { }

interface ErrorBoundaryState {
	fullError: boolean;
	caughtError?: Error;
	errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		
		this.state = {
			fullError: false,
		};
	}
	
	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { fullError: false, caughtError: error };
	}
	
	componentDidCatch(caughtError: Error, errorInfo: ErrorInfo): void {
		console.log('Caught error in ErrorBoundary component:', caughtError);
		console.log('^ Info:', errorInfo);
		
		this.setState({ ...this.state, caughtError, errorInfo });
	}
	
	render(): ReactNode {
		if (this.state.caughtError !== undefined && this.state.errorInfo !== undefined) {
			return (
				<main className={'error'}>
					<h1 className={'appHeader'}>{AppName}</h1>
					<h2>uh oh, it looks like an error has occured!</h2>
					<div className={'buttons'}>
						<button onClick={() => window.location.reload()}>Reload page</button>
						<button onClick={() => history.back()}>Back to previous page</button>
					</div>
					<fieldset>
						<legend>Error Message</legend>
						<textarea value={this.state.caughtError.message} readOnly />
					</fieldset>
					<fieldset>
						<legend>More Information</legend>
						{this.state.fullError ? (
							<>
								<fieldset>
									<legend>Component Stack</legend>
									<textarea value={this.state.errorInfo.componentStack ?? '<null>'} readOnly />
								</fieldset>
								{this.state.errorInfo.digest && (
									<fieldset>
										<legend>Digest</legend>
										<textarea value={this.state.errorInfo.digest} readOnly />
									</fieldset>
								)}
							</>
						) : (
							<button onClick={() => this.setState({ ...this.state, fullError: true })}>Show</button>
						)}
					</fieldset>
				</main>
			);
		}
		
		return this.props.children;
	}
}

export default ErrorBoundary
