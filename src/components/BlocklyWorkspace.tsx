import React, { useState, useEffect } from "react";
import { 
  Play, 
  Square, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  GitCommit, 
  BookOpen, 
  Settings, 
  AlertTriangle 
} from "lucide-react";
import { BlocklyBlock, SavedPoint } from "../types";

interface BlocklyWorkspaceProps {
  savedPoints: SavedPoint[];
  onUpdateRobotState: (dx: number, dy: number, dz: number, actionType: string) => void;
  onSetAllRobotState: (values: Partial<Record<string, number>>) => void;
}

export default function BlocklyWorkspace({
  savedPoints,
  onUpdateRobotState,
  onSetAllRobotState
}: BlocklyWorkspaceProps) {
  const [blocks, setBlocks] = useState<BlocklyBlock[]>([
    { id: "1", type: "start", params: {} },
    { id: "2", type: "set_skin", params: { skinOn: true } },
    { id: "3", type: "move_joint", params: { targetPoint: "InitialPose" } },
    { id: "4", type: "repeat", params: { loopCount: 3 } },
    { id: "5", type: "move_linear_relative", params: { dx: 30, dy: 0, dz: 0 } }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [simLog, setSimLog] = useState<string[]>(["等待拼装积木并启动仿真项目..."]);
  const [repeatTimer, setRepeatTimer] = useState<NodeJS.Timeout | null>(null);

  // Add block helper
  const addBlock = (type: BlocklyBlock["type"]) => {
    const newId = Math.random().toString(36).substring(2, 9);
    let defaultParams: BlocklyBlock["params"] = {};

    switch (type) {
      case "repeat":
        defaultParams = { loopCount: 5 };
        break;
      case "move_joint":
        defaultParams = { targetPoint: "InitialPose" };
        break;
      case "move_linear_relative":
        defaultParams = { dx: 30, dy: 0, dz: 0 };
        break;
      case "joint_offset":
        defaultParams = { dj1: 30, dj2: 0, dj3: 0, dj4: 0, dj5: 0, dj6: 0 };
        break;
      case "set_skin":
        defaultParams = { skinOn: true };
        break;
      case "io_output":
        defaultParams = { ioPort: 1, ioVal: 1 };
        break;
      case "wait":
        defaultParams = { waitSec: 1 };
        break;
    }

    setBlocks([...blocks, { id: newId, type, params: defaultParams }]);
    pushLog(`添加了 [${getBlockLabel(type)}] 编程积木`);
  };

  // Delete block
  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  // Reorder blocks
  const moveBlock = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === blocks.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setBlocks(updated);
  };

  // Update specific block parameter
  const updateBlockParam = (id: string, newParams: BlocklyBlock["params"]) => {
    setBlocks(blocks.map((b) => b.id === id ? { ...b, params: { ...b.params, ...newParams } } : b));
  };

  // Helper block labels for UI
  const getBlockLabel = (type: BlocklyBlock["type"]) => {
    switch (type) {
      case "start": return "开始运行 (Event)";
      case "repeat": return "重复执行循环 (Control)";
      case "move_joint": return "关节运动至指定点 (Motion)";
      case "move_linear_relative": return "相对直线运动 (Motion)";
      case "joint_offset": return "关节轴偏移 (Motion)";
      case "set_skin": return "配置安全避障皮肤 (Safety)";
      case "io_output": return "设置IO数字输出 (IO)";
      case "wait": return "时间延迟等待 (Wait)";
    }
  };

  const pushLog = (msg: string) => {
    setSimLog((prev) => [ `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${msg}`, ...prev.slice(0, 15) ]);
  };

  // Simulation execution router
  const startSimulation = async () => {
    if (blocks.length === 0) return;
    setIsRunning(true);
    pushLog("▶ 仿真控制系统：开始执行当前积木逻辑链路...");

    let blockIdx = 0;
    
    const executeStep = () => {
      if (blockIdx >= blocks.length) {
        setIsRunning(false);
        setActiveBlockId(null);
        pushLog("✔ 仿真结束：轨迹数据已安全闭合，机器人停止施工。");
        return;
      }

      const activeB = blocks[blockIdx];
      setActiveBlockId(activeB.id);

      // Perform state animation logic based on block type
      switch (activeB.type) {
        case "start":
          pushLog("[积木:开始] 触发事件流，初始化硬件IO端口与看门狗电路。");
          break;
        case "set_skin":
          pushLog(`[积木:安全皮肤] 精准设置安全避障阻尼皮肤 = ${activeB.params.skinOn ? "【启用】" : "【禁用】"}`);
          break;
        case "move_joint":
          const target = activeB.params.targetPoint || "InitialPose";
          pushLog(`[积木:关节运动] 校准驱动轮... 关节平滑过渡到目标位姿: ${target}`);
          if (target === "InitialPose") {
            onSetAllRobotState({ x: 0, y: -247.528, z: 1050.5065, j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0 });
          } else {
            const foundPt = savedPoints.find(p => p.name === target);
            if (foundPt) {
              onSetAllRobotState({ x: foundPt.x, y: foundPt.y, z: foundPt.z, j1: foundPt.j1, j2: foundPt.j2 });
            }
          }
          break;
        case "move_linear_relative":
          const dx = activeB.params.dx || 0;
          const dy = activeB.params.dy || 0;
          const dz = activeB.params.dz || 0;
          pushLog(`[积木:相对直线] 读取Δ坐标：Δx=${dx}mm, Δy=${dy}mm, Δz=${dz}mm。开始拟合平滑涂抹施工路径。`);
          onUpdateRobotState(dx, dy, dz, "linear");
          break;
        case "joint_offset":
          const dj1 = activeB.params.dj1 || 0;
          pushLog(`[积木:关节偏移] 驱动电缸转动。J1 轴偏移: ${dj1}°`);
          onUpdateRobotState(0, 0, 0, "joint_offset");
          break;
        case "io_output":
          pushLog(`[积木:数字IO] 设置物理接口数字输出 Port=${activeB.params.ioPort} 为 ${activeB.params.ioVal}`);
          break;
        case "wait":
          pushLog(`[积木:延时] 暂停指令流，挂起空置中，保持 ${activeB.params.waitSec}秒 冷却。`);
          break;
        case "repeat":
          const loopCount = activeB.params.loopCount || 1;
          pushLog(`[积木:循环控制] 触发循环：连续执行内部运动块 ${loopCount} 次。`);
          // Simulating loop internal sub-task
          onUpdateRobotState(30, 0, 0, "linear");
          break;
      }

      blockIdx++;
      const timer = setTimeout(executeStep, 1100);
      setRepeatTimer(timer);
    };

    executeStep();
  };

  const stopSimulation = () => {
    if (repeatTimer) {
      clearTimeout(repeatTimer);
      setRepeatTimer(null);
    }
    setIsRunning(false);
    setActiveBlockId(null);
    pushLog("🛑 仿真中止：用户紧急停止指令，机器人紧急制动锁定，刹车处于挂起状态。");
  };

  useEffect(() => {
    return () => {
      if (repeatTimer) clearTimeout(repeatTimer);
    };
  }, [repeatTimer]);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-4 text-slate-200 shadow-2xl h-full" id="blockly-workspace-container">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1 px-1.5 rounded-md bg-amber-500/10 text-amber-400 font-mono text-[10px] border border-amber-500/20">
            Blockly
          </span>
          <h3 className="font-sans font-semibold text-sm tracking-wide text-slate-100 flex items-center gap-1.5">
            图形化施工程序拼装区
          </h3>
        </div>

        {/* Start / Stop Buttons */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={stopSimulation}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-sans font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition"
              id="btn-stop-sim"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              停止仿真
            </button>
          ) : (
            <button
              onClick={startSimulation}
              disabled={blocks.length === 0}
              className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-sans font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
              id="btn-run-sim"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              运行虚拟仿真
            </button>
          )}
        </div>
      </div>

      {/* Grid: Columns of Blocks Toolbox and Stack Editor */}
      <div className="grid grid-cols-12 gap-3 flex-1 h-[450px]">
        {/* Left column: Block Toolbox Picker */}
        <div className="col-span-4 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 h-full overflow-y-auto">
          <div className="text-xs font-sans font-semibold text-slate-400 border-b border-slate-850 pb-2 mb-1 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            工艺图块库 (Toolbox)
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => addBlock("set_skin")}
              className="w-full text-left p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-mono flex items-center justify-between transition group"
              id="tool-add-skin"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-indigo-500"></span>
                安全阻尼皮肤
              </span>
              <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => addBlock("move_joint")}
              className="w-full text-left p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 text-xs font-mono flex items-center justify-between transition group"
              id="tool-add-joint"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-sky-500"></span>
                关节极点运动
              </span>
              <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => addBlock("move_linear_relative")}
              className="w-full text-left p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-mono flex items-center justify-between transition group"
              id="tool-add-rel-linear"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-cyan-400"></span>
                相对直线运动
              </span>
              <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => addBlock("repeat")}
              className="w-full text-left p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-mono flex items-center justify-between transition group"
              id="tool-add-repeat"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-amber-500"></span>
                重复循环体
              </span>
              <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => addBlock("joint_offset")}
              className="w-full text-left p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 text-xs font-mono flex items-center justify-between transition group"
              id="tool-add-offset"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-sky-300"></span>
                关节轴偏置
              </span>
              <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => addBlock("io_output")}
              className="w-full text-left p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-mono flex items-center justify-between transition group"
              id="tool-add-io"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-emerald-500"></span>
                设置输出 IO 
              </span>
              <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => addBlock("wait")}
              className="w-full text-left p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-mono flex items-center justify-between transition group"
              id="tool-add-wait"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-purple-500"></span>
                时间延时块
              </span>
              <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            </button>
          </div>

          {/* Quick tip box */}
          <div className="mt-auto bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-[10px] text-slate-400 leading-relaxed">
            <span className="text-amber-400 font-semibold flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              老师说明 (Tips):
            </span>
            相对直线移动可以拟合连续施工作业。重复拼装可以配合循环运动减少点位存点工作量，运行前注意打开安全皮肤。
          </div>
        </div>

        {/* Right column: Blockly Canvas Stack Editor */}
        <div className="col-span-8 bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 h-full overflow-y-auto min-h-[300px]">
          <div className="text-xs font-semibold text-slate-400 border-b border-slate-850 pb-2 flex items-center justify-between mb-1" id="blockly-stack-title">
            <span>拼装栈程序流 (程序执行链)</span>
            <span className="text-[10px] text-slate-500">{blocks.length} 个积木项</span>
          </div>

          <div className="flex flex-col gap-2 flex-grow overflow-y-auto pr-1">
            {blocks.map((block, idx) => {
              const isBlockActive = activeBlockId === block.id;

              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition ${
                    isBlockActive 
                      ? "ring-2 ring-sky-400 bg-sky-950/30 border-sky-400/50" 
                      : "bg-slate-900/90 border border-slate-800 hover:border-slate-700"
                  }`}
                  id={`block-item-${block.id}`}
                >
                  {/* Blockly Connector Indent Left Accent Color Bar */}
                  <div className={`w-1.5 h-10 rounded-full shrink-0 ${
                    block.type === "start" ? "bg-amber-400" :
                    block.type === "repeat" ? "bg-amber-500" :
                    block.type === "set_skin" ? "bg-indigo-500" :
                    block.type === "io_output" ? "bg-emerald-500" :
                    block.type === "wait" ? "bg-purple-500" :
                    "bg-sky-500"
                  }`} />

                  {/* Ordering Buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button 
                      onClick={() => moveBlock(idx, "up")}
                      className="p-0.5 text-slate-550 hover:text-slate-300 transition"
                      title="上移"
                      id={`btn-up-${block.id}`}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => moveBlock(idx, "down")}
                      className="p-0.5 text-slate-550 hover:text-slate-300 transition"
                      title="下移"
                      id={`btn-down-${block.id}`}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Program Text details */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-slate-200">
                        {getBlockLabel(block.type)}
                      </span>
                      {isBlockActive && (
                        <span className="bg-sky-500 text-[8px] text-white px-1 py-0.5 rounded animate-pulse capitalize" id={`active-tag-${block.id}`}>
                          执行中...
                        </span>
                      )}
                    </div>
                    
                    {/* Render Inline Parameters */}
                    <div className="mt-1 flex items-center gap-3">
                      {block.type === "repeat" && (
                        <label className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          循环执行
                          <input 
                            type="number"
                            min="1"
                            max="50"
                            value={block.params.loopCount || 1}
                            onChange={(e) => updateBlockParam(block.id, { loopCount: parseInt(e.target.value) || 1 })}
                            className="bg-slate-950 border border-slate-800 text-amber-400 w-12 text-center rounded text-[10px] font-bold p-0.5"
                          />
                          次
                        </label>
                      )}

                      {block.type === "move_joint" && (
                        <label className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          目标示教点位:
                          <select
                            value={block.params.targetPoint || "InitialPose"}
                            onChange={(e) => updateBlockParam(block.id, { targetPoint: e.target.value })}
                            className="bg-slate-950 border border-slate-800 text-sky-400 rounded text-[10px] p-0.5"
                          >
                            <option value="InitialPose">InitialPose (标准零位)</option>
                            {savedPoints.map(p => (
                              <option key={p.id} value={p.name}>{p.name} (Z:{p.z.toFixed(0)})</option>
                            ))}
                          </select>
                        </label>
                      )}

                      {block.type === "move_linear_relative" && (
                        <div className="flex gap-2">
                          <label className="text-[9px] text-slate-400 font-mono">
                            Δx:
                            <input 
                              type="number"
                              value={block.params.dx || 0}
                              onChange={(e) => updateBlockParam(block.id, { dx: parseInt(e.target.value) || 0 })}
                              className="ml-1 bg-slate-950 border border-slate-800 text-cyan-400 w-10 text-center rounded p-0.5"
                            />
                          </label>
                          <label className="text-[9px] text-slate-400 font-mono">
                            Δy:
                            <input 
                              type="number"
                              value={block.params.dy || 0}
                              onChange={(e) => updateBlockParam(block.id, { dy: parseInt(e.target.value) || 0 })}
                              className="ml-1 bg-slate-950 border border-slate-800 text-cyan-400 w-10 text-center rounded p-0.5"
                            />
                          </label>
                          <label className="text-[9px] text-slate-400 font-mono">
                            Δz:
                            <input 
                              type="number"
                              value={block.params.dz || 0}
                              onChange={(e) => updateBlockParam(block.id, { dz: parseInt(e.target.value) || 0 })}
                              className="ml-1 bg-slate-950 border border-slate-800 text-cyan-400 w-10 text-center rounded p-0.5"
                            />
                          </label>
                        </div>
                      )}

                      {block.type === "set_skin" && (
                        <label className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 select-none">
                          运行状态:
                          <input 
                            type="checkbox"
                            checked={block.params.skinOn}
                            onChange={(e) => updateBlockParam(block.id, { skinOn: e.target.checked })}
                            className="bg-slate-950 border border-slate-800 accent-indigo-500 rounded"
                          />
                          开启阻尼防撞
                        </label>
                      )}

                      {block.type === "io_output" && (
                        <div className="flex gap-2 text-[10px] text-slate-400 font-mono">
                          <label>端口:
                            <input 
                              type="number"
                              value={block.params.ioPort}
                              onChange={(e) => updateBlockParam(block.id, { ioPort: parseInt(e.target.value) || 1 })}
                              className="ml-1 bg-slate-950 border border-slate-800 text-emerald-400 w-10 text-center rounded p-0.5"
                            />
                          </label>
                          <label>数值:
                            <select
                              value={block.params.ioVal}
                              onChange={(e) => updateBlockParam(block.id, { ioVal: parseInt(e.target.value) || 0 })}
                              className="ml-1 bg-slate-950 border border-slate-800 text-emerald-400 rounded p-0.5"
                            >
                              <option value="1">1 (打开)</option>
                              <option value="0">0 (关闭)</option>
                            </select>
                          </label>
                        </div>
                      )}

                      {block.type === "wait" && (
                        <label className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          阻尼锁置
                          <input 
                            type="number"
                            min="1"
                            value={block.params.waitSec}
                            onChange={(e) => updateBlockParam(block.id, { waitSec: parseInt(e.target.value) || 1 })}
                            className="bg-slate-950 border border-slate-800 text-purple-400 w-10 text-center rounded p-0.5"
                          />
                          秒
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {block.type !== "start" && (
                    <button
                      onClick={() => deleteBlock(block.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded transition hover:bg-slate-800/50"
                      title="废弃该积木"
                      id={`btn-del-block-${block.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Simulator Execution Real-time Console Log */}
      <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex flex-col gap-1.5" id="sim-console-container">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-900 pb-1.5" id="sim-console-header">
          <span className="font-mono text-[10.5px] uppercase tracking-wide flex items-center gap-1">
            <GitCommit className="w-3.5 h-3.5 text-sky-400" />
            仿真控制台通讯日志 (D-Bus Logging)
          </span>
          <button 
            onClick={() => setSimLog(["通讯日志清空。"])}
            className="text-[9px] text-slate-500 hover:text-slate-300"
            id="btn-clear-sim-log"
          >
            清除日志
          </button>
        </div>
        <div className="h-28 overflow-y-auto flex flex-col gap-1 font-mono text-[10px] text-emerald-400/90 leading-tight">
          {simLog.map((log, i) => (
            <div key={i} className="border-b border-slate-900/60 pb-0.5">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
