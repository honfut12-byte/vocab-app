import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('SW registered!');
        // Если найден новый SW, перезагружаем страницу при его активации
        reg.onupdatefound = () => {
          const newWorker = reg.installing;
          newWorker.onstatechange = () => {
            if (newWorker.state === 'activated') window.location.reload();
          };
        };
      })
      .catch(err => console.log('SW failed!', err));
  });
}
