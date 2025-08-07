import './FloorSizePanel.css'

function FloorSizePanel({ floorWidth, floorDepth, onFloorSizeChange }) {
  const handleWidthChange = (e) => {
    const value = Math.max(1, Math.min(200, Number(e.target.value) || 1));
    onFloorSizeChange(value, floorDepth);
  };

  const handleDepthChange = (e) => {
    const value = Math.max(1, Math.min(200, Number(e.target.value) || 1));
    onFloorSizeChange(floorWidth, value);
  };

  return (
    <div className="panel-section floor-size-section">
      <h3>바닥 크기</h3>
      <div className="floor-size-inputs">
        <div className="input-group">
          <label>폭</label>
          <input 
            type="number"
            min="1"
            max="200"
            value={floorWidth}
            onChange={handleWidthChange}
            className="size-input"
          />
          <span className="unit">m</span>
        </div>
        <div className="input-group">
          <label>깊이</label>
          <input 
            type="number"
            min="1"
            max="200"
            value={floorDepth}
            onChange={handleDepthChange}
            className="size-input"
          />
          <span className="unit">m</span>
        </div>
      </div>
    </div>
  )
}

export default FloorSizePanel
