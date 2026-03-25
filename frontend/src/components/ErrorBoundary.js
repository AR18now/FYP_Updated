import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" role="alert">
          <div className="max-w-2xl w-full bg-white rounded-xl card-shadow p-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
              <p className="text-gray-600">
                We're sorry, but something unexpected happened. Please try again.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-red-900 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 text-xs text-red-800 overflow-auto max-h-48">
                    {this.state.error.toString()}
                    {this.state.errorInfo && (
                      <div className="mt-2">
                        {this.state.errorInfo.componentStack}
                      </div>
                    )}
                  </pre>
                </details>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Try again"
              >
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
                <span>Try Again</span>
              </button>
              <Link
                to="/"
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                aria-label="Go to home page"
              >
                <Home className="h-5 w-5" aria-hidden="true" />
                <span>Go Home</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;











