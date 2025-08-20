// 앱 루트 컴포넌트: 좌측은 캔버스, 우측은 인스펙터(오버레이)입니다.
// - 선택된 노드가 있을 때만 인스펙터를 표시해 화면을 깔끔하게 유지합니다.
import './App.css'
import Canvas from './Canvas'
import Inspector from './Inspector'

function App() {
  return (
    <div className="app-container">
      <Canvas />
      <Inspector />
    </div>
  )
}

export default App
