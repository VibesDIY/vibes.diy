import App from './App';

// Container component that provides the background and contains <App/>
export default function Container() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <App />
    </div>
  );
}