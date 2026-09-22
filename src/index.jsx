import React from 'react';
import ReactDOM from 'react-dom';
// All four families are picked in App.css; nothing here names them again.
// The variable builds ship every weight in one file, so asking for 600 or 700
// gets the real thing instead of a browser-synthesised bold.
import '@fontsource-variable/cinzel';            // display: wordmark and note chips
import '@fontsource-variable/source-sans-3';     // text: everything else
import '@fontsource-variable/source-code-pro';   // the computer-key labels on the keys
import '@fontsource/noto-music';                 // supplies the ♭ no text face carries
import './index.css';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
