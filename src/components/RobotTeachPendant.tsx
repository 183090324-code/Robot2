import React, { useState } from "react";
import { 
  Play, 
  RotateCcw, 
  Save, 
  Trash2, 
  Download, 
  Plus, 
  Info, 
  Cpu, 
  Navigation,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { SavedPoint, CoordinateSystem, ControlMode } from "../types";

interface RobotTeachPendantProps {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  j1: number;
  j2: number;
  j3: number;
  j4: number;
  j5: number;
  j6: number;
  onChange: (key: string, value: number) => void;
  onSetAll: (values: Partial<Record<string, number>>) => void;
  savedPoints: SavedPoint[];
  setSavedPoints: React.Dispatch<React.SetStateAction<SavedPoint[]>>;
}

export default function RobotTeachPendant({
  x, y, z, rx, ry, rz, j1, j2, j3, j4, j5, j6,
  onChange,
  onSetAll,
  savedPoints,
  setSavedPoints
}: RobotTeachPendantProps) {
  const [coordSys, setCoordSys] = useState<CoordinateSystem>("user");
  const [ctrlMode, setCtrlMode] = useState<ControlMode>("step");
  const [stepVal, setStepVal] = useState<number>(5);
  const [userMsg, setUserMsg] = useState<{ text: string; type: "success" | "info" | "warn" } | null>({
    text: "系统就绪：示教器已连接到虚拟六轴施工机械臂。",
    type: "info"
  });

  // Calculate coordinates to SVG schematic
  const renderRobotArmSvg = () => {
    // We visualize a 2D side projection of the J1-J2-J3 robotic arm
    // Based on actual joints: J2, J3, J4 rotations
    const baseSize = 80;
    const l1 = 60;
    const l2 = 50;
    const l3 = 30;

    // Convert joint angles (degrees) to radians
    const rad2 = (j2 * Math.PI) / 180 - Math.PI / 2;
    const rad3 = rad2 + (j3 * Math.PI) / 180;
    const rad4 = rad3 + (j4 * Math.PI) / 180;

    // Coordinates of joints
    const x0 = 120;
    const y0 = 140;

    const x1 = x0 + Math.cos(rad2) * l1;
    const y1 = y0 + Math.sin(rad2) * l1;

    const x2 = x1 + Math.cos(rad3) * l2;
    const y2 = y1 + Math.sin(rad3) * l2;

    const x3 = x2 + Math.cos(rad4) * l3;
    const y3 = y2 + Math.sin(rad4) * l3;

    return (
      <svg className="w-full h-40 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden" id="robot-svg-pendant">
        {/* Grid lines */}
        <g stroke="#1e293b" strokeWidth="1">
          <line x1="0" y1="140" x2="240" y2="140" />
          <line x1="120" y1="0" x2="120" y2="180" />
          <p></p>
        </g>

        {/* Foundation */}
        <rect x="100" y="140" width="40" height="20" fill="#475569" rx="2" />
        <circle cx={x0} cy={y0} r="6" fill="#38bdf8" />

        {/* Arm Segment 1 */}
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#f1f5f9" strokeWidth="8" strokeLinecap="round" />
        <circle cx={x1} cy={y1} r="5" fill="#0284c7" />

        {/* Arm Segment 2 */}
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
        <circle cx={x2} cy={y2} r="4" fill="#0284c7" />

        {/* Tool End Effector / Extruder */}
        <line x1={x2} y1={y2} x2={x3} y2={y3} stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
        <circle cx={x3} cy={y3} r="3" fill="#d97706" />

        {/* Decorative Sprayer mist representation if IO port 1 or 2 is active or simulation values */}
        {(Math.abs(x) > 10 || Math.abs(z - 1050) > 2) && (
          <path d={`M ${x3} ${y3} L ${x3 + 10} ${y3 + 12} M ${x3} ${y3} L ${x3 - 5} ${y3 + 14}`} stroke="#22c55e" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
        )}

        {/* Status text */}
        <text x="10" y="20" fill="#94a3b8" fontSize="10" style={{ fontFamily: 'monospace' }}>
          Z Coords: {z.toFixed(2)} mm
        </text>
        <text x="10" y="32" fill="#94a3b8" fontSize="10" style={{ fontFamily: 'monospace' }}>
          Y Coords: {y.toFixed(2)} mm
        </text>
      </svg>
    );
  };

  // Perform a step/continuous move
  const handleMove = (param: string, direction: "+" | "-") => {
    const factor = direction === "+" ? 1 : -1;
    let delta = 0;

    if (ctrlMode === "step") {
      delta = stepVal * factor;
    } else {
      // Continuous / 点动 uses default 10 units
      delta = 15 * factor;
    }

    if (["x", "y", "z"].includes(param.toLowerCase())) {
      const currentVal = param.toLowerCase() === "x" ? x : param.toLowerCase() === "y" ? y : z;
      onChange(param.toLowerCase(), currentVal + delta);
      setUserMsg({
        text: `手动移动 [${param.toUpperCase()}] ${direction} ${Math.abs(delta)} mm`,
        type: "success"
      });
    } else if (["rx", "ry", "rz"].includes(param.toLowerCase())) {
      const currentVal = param.toLowerCase() === "rx" ? rx : param.toLowerCase() === "ry" ? ry : rz;
      onChange(param.toLowerCase(), currentVal + delta);
      setUserMsg({
        text: `手动旋转 [${param.toUpperCase()}] ${direction} ${Math.abs(delta)} °`,
        type: "success"
      });
    } else {
      // Joint controls J1-J6
      const jKey = param.toLowerCase(); // j1, j2 etc
      let currentVal = 0;
      if (jKey === "j1") currentVal = j1;
      else if (jKey === "j2") currentVal = j2;
      else if (jKey === "j3") currentVal = j3;
      else if (jKey === "j4") currentVal = j4;
      else if (jKey === "j5") currentVal = j5;
      else if (jKey === "j6") currentVal = j6;

      const updated = currentVal + delta;
      // Joint thresholds safety limit
      if (updated > 185 || updated < -185) {
        setUserMsg({
          text: `【安全警告】关节 ${param.toUpperCase()} 超过安全极限位姿 (+/-185°)！`,
          type: "warn"
        });
        return;
      }

      onChange(jKey, updated);
      setUserMsg({
        text: `转动关节 ${param.toUpperCase()} 至 ${updated.toFixed(2)}°`,
        type: "success"
      });
    }
  };

  // Save current point (存点)
  const handleSavePoint = () => {
    const pointName = `P${savedPoints.length + 1}`;
    const newPoint: SavedPoint = {
      id: Math.random().toString(36).substring(2, 9),
      name: pointName,
      x, y, z, rx, ry, rz, j1, j2, j3, j4, j5, j6,
      timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false })
    };

    setSavedPoints([...savedPoints, newPoint]);
    setUserMsg({
      text: `已存点 [${pointName}]，坐标: Y=${y.toFixed(2)}, Z=${z.toFixed(2)} 加入示教点位库`,
      type: "success"
    });
  };

  // Reset to initial pose
  const handleResetPose = () => {
    onSetAll({
      x: -0.0,
      y: -247.528,
      z: 1050.5065,
      rx: -90.0,
      ry: 0.0,
      rz: 180.0,
      j1: 0.0,
      j2: 0.0,
      j3: 0.0,
      j4: 0.0,
      j5: 0.0,
      j6: 0.0
    });
    setUserMsg({
      text: "成功将砌筑示教机器人回归标准原点 InitialPose (1050, -247.5)",
      type: "info"
    });
  };

  // Export saved points as JSON
  const handleExportJson = () => {
    if (savedPoints.length === 0) {
      setUserMsg({ text: "请先添加至少一个存点再试！", type: "warn" });
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedPoints, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "BuildOnCode_Saved_Points.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setUserMsg({ text: "成功导出存点位姿数据库 (BuildOnCode_Saved_Points.json) ！", type: "success" });
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-4 text-slate-200 shadow-2xl" id="robot-teach-pendant-container">
      {/* Pendant Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h3 className="font-sans font-semibold text-sm tracking-wide text-slate-100 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-sky-400" />
            码上建 3D 虚拟示教器 (Pendant)
          </h3>
        </div>
        <button 
          onClick={handleResetPose}
          title="回零复位 (InitialPose)"
          className="text-xs text-slate-400 hover:text-sky-400 border border-slate-800 hover:border-slate-700 bg-slate-950 px-2 py-1 rounded transition flex items-center gap-1"
          id="btn-repose"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          示教回零
        </button>
      </div>

      {/* Arm schematic render */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-sky-400 font-mono px-0.5">
          <span>末端空间姿态实时渲染</span>
          <span className="text-slate-500 text-[10px]">侧投向示意</span>
        </div>
        {renderRobotArmSvg()}
      </div>

      {/* Coordinates Tabs & Settings */}
      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/70 p-2 rounded-lg border border-slate-800">
        <div>
          <span className="text-[10px] text-slate-500 block mb-1">坐标系选择</span>
          <div className="flex rounded bg-slate-900 border border-slate-800 p-0.5">
            <button 
              onClick={() => setCoordSys("user")}
              className={`flex-1 text-center py-1 rounded ${coordSys === "user" ? "bg-sky-500 text-white font-medium" : "text-slate-400 hover:text-slate-200"}`}
              id="coord-user"
            >
              用户坐标系
            </button>
            <button 
              onClick={() => setCoordSys("tool")}
              className={`flex-1 text-center py-1 rounded ${coordSys === "tool" ? "bg-sky-500 text-white font-medium" : "text-slate-400 hover:text-slate-200"}`}
              id="coord-tool"
            >
              工具坐标系
            </button>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block mb-1">点动/寸动模式</span>
          <div className="flex rounded bg-slate-900 border border-slate-800 p-0.5">
            <button 
              onClick={() => setCtrlMode("continuous")}
              className={`flex-1 text-center py-1 rounded ${ctrlMode === "continuous" ? "bg-sky-500 text-white font-medium" : "text-slate-400 hover:text-slate-200"}`}
              id="ctrl-cont"
            >
              点动(连续)
            </button>
            <button 
              onClick={() => setCtrlMode("step")}
              className={`flex-1 text-center py-1 rounded ${ctrlMode === "step" ? "bg-sky-500 text-white font-medium" : "text-slate-400 hover:text-slate-200"}`}
              id="ctrl-step"
            >
              寸动(步进)
            </button>
          </div>
        </div>
      </div>

      {/* Step size (寸动步阶) selector - only show if step mode */}
      {ctrlMode === "step" && (
        <div className="flex items-center gap-1.5 bg-slate-950/40 p-1.5 rounded border border-slate-850">
          <span className="text-[10px] text-slate-400 font-mono mr-auto">寸动步阶 (阶级):</span>
          {[0.1, 1, 5, 10].map((val) => (
            <button
              key={val}
              onClick={() => setStepVal(val)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${stepVal === val ? "bg-sky-500/20 text-sky-400 border-sky-500" : "bg-slate-900 text-slate-500 border-transparent hover:text-slate-300"}`}
              id={`step-${val}`}
            >
              {val} mm/deg
            </button>
          ))}
        </div>
      )}

      {/* Coordinates Jog Panel */}
      <div className="grid grid-cols-2 gap-3">
        {/* XYZ and RXRYRZ Linear list */}
        <div className="flex flex-col gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1 block border-b border-slate-800 pb-1 text-sky-400 flex items-center justify-between">
            <span>末端位姿直角系 (Cartesian)</span>
            <span className="text-slate-500 uppercase">{coordSys}</span>
          </span>
          
          {/* Row X */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("x", "-")} className="w-7 h-6 bg-slate-800/80 hover:bg-red-950 hover:text-red-300 rounded text-center font-bold active:scale-95 transition flex items-center justify-center text-[10px] border border-slate-700" id="btn-xm">X-</button>
            <div className="flex-1 text-center">
              <span className="text-[10px] text-slate-500 block">X</span>
              <span className="text-slate-100 font-medium">{x.toFixed(4)} <span className="text-[9px] text-slate-500">mm</span></span>
            </div>
            <button onClick={() => handleMove("x", "+")} className="w-7 h-6 bg-slate-800/80 hover:bg-green-950 hover:text-green-300 rounded text-center font-bold active:scale-95 transition flex items-center justify-center text-[10px] border border-slate-700" id="btn-xp">X+</button>
          </div>

          {/* Row Y */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("y", "-")} className="w-7 h-6 bg-slate-800/80 hover:bg-red-950 hover:text-red-300 rounded text-center font-bold active:scale-95 transition flex items-center justify-center text-[10px] border border-slate-700" id="btn-ym">Y-</button>
            <div className="flex-1 text-center">
              <span className="text-[10px] text-slate-500 block">Y</span>
              <span className="text-amber-400 font-semibold">{y.toFixed(4)} <span className="text-[9px] text-slate-500">mm</span></span>
            </div>
            <button onClick={() => handleMove("y", "+")} className="w-7 h-6 bg-slate-800/80 hover:bg-green-950 hover:text-green-300 rounded text-center font-bold active:scale-95 transition flex items-center justify-center text-[10px] border border-slate-700" id="btn-yp">Y+</button>
          </div>

          {/* Row Z */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("z", "-")} className="w-7 h-6 bg-slate-800/80 hover:bg-red-950 hover:text-red-300 rounded text-center font-bold active:scale-95 transition flex items-center justify-center text-[10px] border border-slate-700" id="btn-zm">Z-</button>
            <div className="flex-1 text-center">
              <span className="text-[10px] text-slate-500 block">Z</span>
              <span className="text-cyan-400 font-semibold">{z.toFixed(4)} <span className="text-[9px] text-slate-500">mm</span></span>
            </div>
            <button onClick={() => handleMove("z", "+")} className="w-7 h-6 bg-slate-800/80 hover:bg-green-950 hover:text-green-300 rounded text-center font-bold active:scale-95 transition flex items-center justify-center text-[10px] border border-slate-700" id="btn-zp">Z+</button>
          </div>

          {/* Row RX */}
          <div className="flex items-center justify-between text-[11px] font-mono border-t border-slate-800/80 pt-2">
            <button onClick={() => handleMove("rx", "-")} className="w-6 h-5 bg-slate-800/60 hover:bg-slate-700 rounded text-center text-[9px]" id="btn-rxm">R-</button>
            <span className="text-[10px] text-slate-400">RX: {rx.toFixed(1)}°</span>
            <button onClick={() => handleMove("rx", "+")} className="w-6 h-5 bg-slate-800/60 hover:bg-slate-700 rounded text-center text-[9px]" id="btn-rxp">R+</button>
          </div>

          {/* Row RY */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <button onClick={() => handleMove("ry", "-")} className="w-6 h-5 bg-slate-800/60 hover:bg-slate-700 rounded text-center text-[9px]" id="btn-rym">R-</button>
            <span className="text-[10px] text-slate-400">RY: {ry.toFixed(1)}°</span>
            <button onClick={() => handleMove("ry", "+")} className="w-6 h-5 bg-slate-800/60 hover:bg-slate-700 rounded text-center text-[9px]" id="btn-ryp">R+</button>
          </div>

          {/* Row RZ */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <button onClick={() => handleMove("rz", "-")} className="w-6 h-5 bg-slate-800/60 hover:bg-slate-700 rounded text-center text-[9px]" id="btn-rzm">R-</button>
            <span className="text-[10px] text-slate-400">RZ: {rz.toFixed(1)}°</span>
            <button onClick={() => handleMove("rz", "+")} className="w-6 h-5 bg-slate-800/60 hover:bg-slate-700 rounded text-center text-[9px]" id="btn-rzp">R+</button>
          </div>
        </div>

        {/* J1-J6 Joint Space List */}
        <div className="flex flex-col gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1 block border-b border-slate-800 pb-1 text-emerald-400">
            关节角系 (Joint Space J1-J6)
          </span>

          {/* J1 */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("j1", "-")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j1-">-</button>
            <div className="flex-1 text-center leading-tight">
              <span className="text-[9px] text-slate-500 block">J1</span>
              <span className="text-[11px] text-slate-200">{j1.toFixed(1)}°</span>
            </div>
            <button onClick={() => handleMove("j1", "+")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j1+">+</button>
          </div>

          {/* J2 */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("j2", "-")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j2-">-</button>
            <div className="flex-1 text-center leading-tight">
              <span className="text-[9px] text-slate-500 block">J2</span>
              <span className="text-[11px] text-slate-200">{j2.toFixed(1)}°</span>
            </div>
            <button onClick={() => handleMove("j2", "+")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j2+">+</button>
          </div>

          {/* J3 */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("j3", "-")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j3-">-</button>
            <div className="flex-1 text-center leading-tight">
              <span className="text-[9px] text-slate-500 block">J3</span>
              <span className="text-[11px] text-slate-200">{j3.toFixed(1)}°</span>
            </div>
            <button onClick={() => handleMove("j3", "+")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j3+">+</button>
          </div>

          {/* J4 */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("j4", "-")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j4-">-</button>
            <div className="flex-1 text-center leading-tight">
              <span className="text-[9px] text-slate-500 block">J4</span>
              <span className="text-[11px] text-slate-200">{j4.toFixed(1)}°</span>
            </div>
            <button onClick={() => handleMove("j4", "+")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j4+">+</button>
          </div>

          {/* J5 */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("j5", "-")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j5-">-</button>
            <div className="flex-1 text-center leading-tight">
              <span className="text-[9px] text-slate-500 block">J5</span>
              <span className="text-[11px] text-slate-200">{j5.toFixed(1)}°</span>
            </div>
            <button onClick={() => handleMove("j5", "+")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j5+">+</button>
          </div>

          {/* J6 */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button onClick={() => handleMove("j6", "-")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j6-">-</button>
            <div className="flex-1 text-center leading-tight">
              <span className="text-[9px] text-slate-500 block">J6</span>
              <span className="text-[11px] text-slate-200">{j6.toFixed(1)}°</span>
            </div>
            <button onClick={() => handleMove("j6", "+")} className="w-6 h-5.5 bg-slate-800/80 hover:bg-slate-700 rounded text-center text-[9px] font-bold" id="btn-j6+">+</button>
          </div>
        </div>
      </div>

      {/* Action to Save Position / Point List */}
      <div className="flex gap-2">
        <button
          onClick={handleSavePoint}
          className="flex-1 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs font-sans font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md hover:shadow-sky-500/20 active:scale-[0.98] transition"
          id="btn-save-point"
        >
          <Save className="w-3.5 h-3.5" />
          保存当前位姿 (存点)
        </button>
      </div>

      {/* Logs/Status Bar */}
      {userMsg && (
        <div className={`p-2 rounded-lg text-xs flex gap-2 items-start border ${
          userMsg.type === "success" 
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" 
            : userMsg.type === "warn"
            ? "bg-amber-500/10 text-amber-300 border-amber-500/25 animate-pulse"
            : "bg-slate-950/80 text-slate-300 border-slate-800"
        }`}>
          {userMsg.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {userMsg.type === "warn" && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
          {userMsg.type === "info" && <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
          <p className="font-mono text-[10.5px] leading-tight select-none">{userMsg.text}</p>
        </div>
      )}

      {/* Point Store List Container */}
      <div className="bg-slate-950/85 border border-slate-850 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800/85 pb-1.5" id="saved-points-header">
          <span className="font-sans font-semibold text-slate-100 flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-amber-500" />
            存点列表 (Point Store) ({savedPoints.length})
          </span>
          {savedPoints.length > 0 && (
            <button 
              onClick={handleExportJson}
              className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
              id="btn-export-points"
            >
              <Download className="w-2.5 h-2.5" />
              导出数据
            </button>
          )}
        </div>

        {savedPoints.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs flex flex-col items-center justify-center gap-1">
            <span className="text-[11px]">暂无已存示教点位</span>
            <span className="text-[9px] text-slate-600">点击上方的“保存当前位姿”进行记录</span>
          </div>
        ) : (
          <div className="max-h-[140px] overflow-y-auto pr-1 flex flex-col gap-1.5">
            {savedPoints.map((pt, idx) => (
              <div 
                key={pt.id} 
                className="group flex items-center justify-between bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 p-2 rounded text-xs transition"
                id={`point-row-${pt.name}`}
              >
                <div 
                  className="flex-1 cursor-pointer" 
                  onClick={() => {
                    onSetAll({
                      x: pt.x, y: pt.y, z: pt.z,
                      rx: pt.rx, ry: pt.ry, rz: pt.rz,
                      j1: pt.j1, j2: pt.j2, j3: pt.j3,
                      j4: pt.j4, j5: pt.j5, j6: pt.j6
                    });
                    setUserMsg({
                      text: `已复现点位 ${pt.name}的坐标与关节姿态`,
                      type: "info"
                    });
                  }}
                  title="点击将机器人复位到该存点轨迹"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono font-semibold text-amber-400">{pt.name}</span>
                    <span className="text-[8px] text-slate-500 font-mono">{pt.timestamp}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 font-mono text-[9px] text-slate-400">
                    <span>Y: {pt.y.toFixed(1)}</span>
                    <span>Z: {pt.z.toFixed(1)}</span>
                    <span>J1: {pt.j1.toFixed(0)}°</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSavedPoints(savedPoints.filter(p => p.id !== pt.id));
                    setUserMsg({ text: `已删除示教点 [${pt.name}]`, type: "info" });
                  }}
                  className="text-slate-500 hover:text-red-400 p-1 rounded opacity-60 group-hover:opacity-100 transition"
                  title="删除此点位"
                  id={`btn-del-pt-${pt.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
