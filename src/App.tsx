import './App.css'
import Canvas from './Canvas'
import Inspector from './Inspector'
import { useSelectedNode } from './store'

function App() {
  const selected = useSelectedNode()
  return (
    <div className="app-container">
  <Canvas />
  {selected && <Inspector />}
    </div>
  )
}

export default App
