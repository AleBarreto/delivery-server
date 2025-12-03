import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MotoboyApp from './components/Motoboy/MotoboyApp';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

const isMotoboyRoute = window.location.pathname.startsWith('/motoboy');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {isMotoboyRoute ? <MotoboyApp /> : <App />}
  </React.StrictMode>
);
