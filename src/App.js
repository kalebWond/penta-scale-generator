import { useEffect, useState } from 'react';
import './App.css';
import Piano from './Piano';
import { loadSounds } from './_helpers';

function App() {
  const [sounds, setSounds] = useState(false);

  useEffect(() => {
    loadSounds().then(data => {
      setSounds(data)
      // console.log(data)
    }).catch(e => console.log(e))
  }, [])
  
  return (
      sounds ? <Piano /> : <div className="w-full h-full centered column">
        <div className="spinner"></div>
        <h2 className="text-white">Loading sounds</h2>
      </div>
  );

}

export default App;
