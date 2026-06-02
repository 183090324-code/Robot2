import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Square, RefreshCw, Save, ArrowLeft, ArrowRight, Trash2, 
  Bot, FileText, Settings, Shield, Sliders, Cpu, Plus, 
  Send, HelpCircle, HardDrive, Download, AlertTriangle, Image as ImageIcon, Zap
} from 'lucide-react';

// Types for Point
interface RobotPoint {
  id: string;
  name: string;
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
}

// Types for Blockly Blocks
interface CodeBlock {
  id: string;
  type: 'start' | 'movej' | 'movel' | 'circle' | 'loop' | 'set_io' | 'safeskin';
  params: {
    pointName?: string;
    dx?: number;
    dy?: number;
    dz?: number;
    speed?: number;
    loopCount?: number;
    ioPort?: number;
    ioValue?: 'HIGH' | 'LOW';
    safeSkinEnabled?: boolean;
    obstacleAvoidEnabled?: boolean;
  };
}

// Preset Screenshots for AI tutor analysis
const AI_SCREENSHOT_TEMPLATES = [
  {
    id: 'control_panel',
    title: '示教与关节状态',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop&q=60',
    description: '对应截图1：显示机器人位姿坐标 (X, Y, Z, RX, RY, RZ) 与关节角 J1-J6。',
    prompt: '你好，我现在正处于机器人的示教控制界面，当前末端坐标位于 Z=1050 mm 附近。我的关节角度全部为0。请问我现在该如何通过[寸动]模式完成末端向Y坐标增加50mm的微调，并将其[存点]？'
  },
  {
    id: 'block_program',
    title: '图块编程循环任务',
    url: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=300&auto=format&fit=crop&q=60',
    description: '对应截图2：工作空间内包含【重复执行】及【相对直线运动】等指令组合。',
    prompt: '导师，我设计了一个如图所示的重复10次循环运动。其中每次相对直线运动设为了 Delta X = 30。但是在实际模拟中发生了奇异点超限报错，如何配置[平滑过渡比例]以及关节速度来避开轨迹死角？'
  },
  {
    id: 'lua_scripting',
    title: '底层 Lua 安全脚本',
    url: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=300&auto=format&fit=crop&q=60',
    description: '对应截图4：展示底层代码编辑，安全皮肤 `SetSafeSkin(1)` 与避障。',
    prompt: '请根据我当前的图块设计自动生成一段符合安全规范的 Lua 脚本。必须包含安全皮肤 SetSafeSkin(1) 以及避障设置 SetObstacleAvoid(1)，并用中文注释详尽解释每行运动点。'
  }
];

export default function App() {
  // --- 1. State Store ---
  const [robot, setRobot] = useState<RobotPoint>({
    id: 'cur',
    name: '当前点',
    x: 0,
    y: -247.528,
    z: 1050.506,
    rx: -90,
    ry: 0,
    rz: 180,
    j1: 0,
    j2: 0,
    j3: 0,
    j4: 0,
    j5: 0,
    j6: 0,
  });

  const [points, setPoints] = useState<RobotPoint[]>([
    { id: '1', name: 'InitialPose', x: 0, y: -247.528, z: 1050.506, rx: -90, ry: 0, rz: 180, j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0 },
    { id: '2', name: 'SprayStart', x: 100, y: -200, z: 900, rx: -90, ry: 0, rz: 180, j1: 15, j2: -10, j3: 10, j4: 0, j5: 10, j6: 0 },
    { id: '3', name: 'SprayEnd', x: 100, y: 200, z: 900, rx: -90, ry: 0, rz: 180, j1: -15, j2: -10, j3: 10, j4: 0, j5: -10, j6: 0 }
  ]);

  const [blocks, setBlocks] = useState<CodeBlock[]>([
    { id: 'b1', type: 'start', params: {} },
    { id: 'b2', type: 'safeskin', params: { safeSkinEnabled: true, obstacleAvoidEnabled: true } },
    { id: 'b3', type: 'movej', params: { pointName: 'InitialPose', speed: 50 } },
    { id: 'b4', type: 'loop', params: { loopCount: 5 } },
    { id: 'b5', type: 'movel', params: { dx: 30, dy: 0, dz: 0 } },
    { id: 'b6', type: 'set_io', params: { ioPort: 1, ioValue: 'HIGH' } }
  ]);

  // General States
  const [coordSystem, setCoordSystem] = useState<'USER' | 'TOOL'>('USER');
  const [jogMode, setJogMode] = useState<'POINT' | 'STEP'>('POINT'); // 点动 vs 寸动
  const [stepSize, setStepSize] = useState<number>(1); // 寸动步进: 0.1, 1, 5, 10
  const [running, setRunning] = useState<boolean>(false);
  const [runningBlockIdx, setRunningBlockIdx] = useState<number | null>(null);
  const [collisionWarning, setCollisionWarning] = useState<string | null>(null);

  // Spray / Process Config
  const [captureMode, setCaptureMode] = useState<string>('面中心');
  const [sprayDistance, setSprayDistance] = useState<number>(100); // 喷涂距离 (mm)
  const [suctionHeight, setSuctionHeight] = useState<number>(50); // 吸涂高度 (mm)
  const [sprayStatus, setSprayStatus] = useState<boolean>(false);

  // Enhanced simulation controls
  const [simSpeed, setSimSpeed] = useState<number>(1); // 仿真速度: 1, 2, 5, 10
  const [constructionTheme, setConstructionTheme] = useState<'Exterior' | 'Tunnel' | 'Prefab'>('Exterior');
  const [showScaffolding, setShowScaffolding] = useState<boolean>(true);
  const [manualSprayOverride, setManualSprayOverride] = useState<boolean>(false);

  // History for Undo/Redo of blocks
  const [historyStack, setHistoryStack] = useState<CodeBlock[][]>([]);
  const [redoStack, setRedoStack] = useState<CodeBlock[][]>([]);

  // Interactive Trajectory Trail in Physical 3D coordinates
  const [trail, setTrail] = useState<{ rx: number; ry: number; rz: number; density: number }[]>([]);

  // Camera Views Angle State Selector (Isometric, Front Elevation, Bird-Eye Overhead)
  const [viewAngle, setViewAngle] = useState<'isometric' | 'front' | 'top'>('isometric');

  // AI Tutor Integration
  const [chatInput, setChatInput] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatLogs, setChatLogs] = useState<{ role: 'user' | 'assistant'; text: string; time: string }[]>([
    {
      role: 'assistant',
      text: '***[码上建专家级系统导师上线]***\n\n欢迎同学进入实训仿真空间！无论是**机械臂末端示教**、**轨迹热力图优化**，还是**由图块转换为 Lua 底层代码**或安全配置，我都会在右侧全程为你护航。\n\n你可以随时点击底部的模板载入截图进行诊断，或者直接提问！',
      time: '07:54'
    }
  ]);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [generatedLua, setGeneratedLua] = useState<string>('');
  const [showLuaModal, setShowLuaModal] = useState<boolean>(false);

  // 3D Engine Isometric/Orthographic Vector projection model
  const project3D = (px: number, py: number, pz: number) => {
    if (viewAngle === 'isometric') {
      const cx = 250; // horizontal center
      const cy = 170; // vertical center
      
      const scaleX = 0.28; 
      const scaleY = 0.35; 
      const scaleZ = 0.165; 
      
      const rx = px * scaleX;
      const ry = py * scaleY;
      const rz = (pz - 600) * scaleZ;
      
      // Isometric transformations
      const u = cx + (ry - rx) * 0.866;
      const v = cy + (ry + rx) * 0.5 - rz;
      
      return { x: u, y: v };
    } else if (viewAngle === 'front') {
      // Front flat orthographic view: Horizontal is Y, Vertical is Z.
      const cx = 310;
      const cy = 145;
      
      const scaleY = 0.56;
      const scaleZ = 0.20;
      
      const u = cx + py * scaleY;
      const v = cy - (pz - 600) * scaleZ;
      
      return { x: u, y: v };
    } else {
      // Top down bird's eye view: Horizontal is Y, Vertical is X.
      const cx = 310;
      const cy = 145;
      
      const scaleY = 0.56;
      const scaleX = 0.44;
      
      const u = cx + py * scaleY;
      const v = cy - px * scaleX; 
      
      return { x: u, y: v };
    }
  };

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export progress states
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportType, setExportType] = useState<string>('');

  // --- 2. Action Helpers ---
  const saveStateToHistory = (newBlocks: CodeBlock[]) => {
    setHistoryStack(prev => [...prev, blocks]);
    setRedoStack([]); // Clear redo
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setRedoStack(r => [...r, blocks]);
    setBlocks(prev);
    setHistoryStack(prevStack => prevStack.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack(h => [...h, blocks]);
    setBlocks(next);
    setRedoStack(prevStack => prevStack.slice(0, -1));
  };

  // Storing point
  const handleSavePoint = () => {
    const name = `P${points.length + 1}`;
    const newPt: RobotPoint = {
      ...robot,
      id: String(Date.now()),
      name
    };
    setPoints([...points, newPt]);
    // Add success chat notification
    addNotification(`成功在示教存点列表记录坐标位置 [${name}]: X=${robot.x.toFixed(1)}, Y=${robot.y.toFixed(1)}, Z=${robot.z.toFixed(1)}`);
  };

  // Navigate to point
  const handleGotoPoint = (pt: RobotPoint) => {
    setRobot({ ...pt, id: 'cur', name: '当前点' });
    addNotification(`机械臂位置复现跳转至点位 ${pt.name}`);
    // Paint spray trail if status active
    if (sprayStatus) {
      appendTrail(pt.x, pt.y, pt.z);
    }
  };

  const appendTrail = (rx: number, ry: number, rz: number) => {
    setTrail(prev => {
      // Find matches in 3D physical workspace boundaries to accumulate thickness
      const index = prev.findIndex(t => Math.hypot(t.ry - ry, t.rz - rz) < 18);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = { ...copy[index], rx, ry, rz, density: Math.min(copy[index].density + 1.2, 5) };
        return copy;
      }
      return [...prev, { rx, ry, rz, density: 1 }];
    });
  };

  const addNotification = (text: string) => {
    setChatLogs(prev => [
      ...prev,
      { role: 'assistant', text: `📢 **操作提示：** ${text}`, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
    ]);
  };

  // Manual Jogging logic
  const handleJog = (axis: 'X' | 'Y' | 'Z' | 'J1' | 'J2' | 'J3' | 'J4' | 'J5' | 'J6', direction: '+' | '-') => {
    let delta = jogMode === 'STEP' ? stepSize : 5;
    if (direction === '-') delta = -delta;

    setRobot(prev => {
      const next = { ...prev };
      switch(axis) {
        case 'X': next.x += delta; break;
        case 'Y': next.y += delta; break;
        case 'Z': next.z += delta; break;
        case 'J1': next.j1 += delta; break;
        case 'J2': next.j2 += delta; break;
        case 'J3': next.j3 += delta; break;
        case 'J4': next.j4 += delta; break;
        case 'J5': next.j5 += delta; break;
        case 'J6': next.j6 += delta; break;
      }

      // Kinematic limit alarms
      if (next.z < 50) {
        setCollisionWarning('警告：检测到机械臂末端过低，有发生地面碰撞的危险！请抬高Z轴。');
      } else if (next.z > 1400) {
        setCollisionWarning('警告：坐标超过可达工作空间域最大值上限。');
      } else if (Math.abs(next.j1) > 170) {
        setCollisionWarning('安全干涉：1号旋转关节已接近硬件限位角 (±170°)。');
      } else {
        setCollisionWarning(null);
      }

      if (sprayStatus || manualSprayOverride) {
        appendTrail(next.x, next.y, next.z);
      }

      return next;
    });
  };

  // Run Blockly Program sequencer simulation
  const startSimulation = async () => {
    if (running) return;
    setRunning(true);
    setTrail([]); // Clear heatmap trail to record fresh path
    addNotification(`开始编译并复现图形化轨迹流 (速度倍率: ${simSpeed}x)...`);

    for (let i = 0; i < blocks.length; i++) {
      if (!running) break; // Allow stopping
      const b = blocks[i];
      setRunningBlockIdx(i);
      addNotification(`执行流程中：【${b.type.toUpperCase()}】指令块置为运行态`);
      
      // Execute simulated changes
      if (b.type === 'movej' && b.params.pointName) {
        const found = points.find(p => p.name === b.params.pointName);
        if (found) {
          setRobot({ ...found, id: 'cur', name: '当前点' });
          // simulation delay
          await new Promise(r => setTimeout(r, 600 / simSpeed));
        }
      } else if (b.type === 'movel') {
        const dx = b.params.dx || 0;
        const dy = b.params.dy || 0;
        const dz = b.params.dz || 0;
        
        // Stagger steps to draw trail beautifully
        for (let step = 1; step <= 5; step++) {
          if (!running) break;
          setRobot(prev => {
            const next = {
              ...prev,
              x: prev.x + dx/5,
              y: prev.y + dy/5,
              z: prev.z + dz/5,
            };
            appendTrail(next.x, next.y, next.z);
            return next;
          });
          await new Promise(r => setTimeout(r, 120 / simSpeed));
        }
      } else if (b.type === 'set_io') {
        setSprayStatus(b.params.ioValue === 'HIGH');
        await new Promise(r => setTimeout(r, 305 / simSpeed));
      } else if (b.type === 'safeskin') {
        await new Promise(r => setTimeout(r, 300 / simSpeed));
      } else {
        await new Promise(r => setTimeout(r, 400 / simSpeed));
      }
    }

    setRunningBlockIdx(null);
    setRunning(false);
    addNotification("🎉 全流程施工仿真轨迹绘制完毕！您的机械臂指令流已就绪。");
  };

  // --- 3. AI Service Calls ---
  const handleAiChat = async (userPromptText?: string) => {
    const promptToSend = userPromptText || chatInput;
    if (!promptToSend && !selectedImage) return;

    setAiLoading(true);
    const userMsg = {
      role: 'user' as const,
      text: promptToSend || "分析截图状态",
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    };
    setChatLogs(prev => [...prev, userMsg]);
    setChatInput('');

    try {
      const chatHistory = chatLogs.map(l => ({
        role: l.role,
        content: l.text
      }));

      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptToSend,
          image: selectedImage,
          history: chatHistory,
          robotState: {
            x: robot.x,
            y: robot.y,
            z: robot.z,
            rx: robot.rx,
            ry: robot.ry,
            rz: robot.rz,
            j1: robot.j1,
            j2: robot.j2,
            j3: robot.j3,
            j4: robot.j4,
            j5: robot.j5,
            j6: robot.j6,
            coordSystem: coordSystem === 'USER' ? '用户坐标系(0)' : '工具坐标系(0)',
            jogType: jogMode === 'POINT' ? '点动' : '寸动',
            stepSize: stepSize
          },
          blocks: blocks
        })
      });
      const data = await res.json();
      
      setChatLogs(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.text || "AI 老师无法给出正常的回答，请检查您的 API KEY。",
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (e: any) {
      setChatLogs(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `❌ 发送失败，请检查网络或配置。错误信息: ${e.message}`,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Perform quick state diagnosis
  const handleStateDiagnosis = async () => {
    setAiLoading(true);
    addNotification("正在打包当前的机器人位姿参数、图块编程矩阵并呈递给 AI 导师...");

    try {
      const response = await fetch('/api/tutor/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robotState: {
            x: robot.x,
            y: robot.y,
            z: robot.z,
            rx: robot.rx,
            ry: robot.ry,
            rz: robot.rz,
            j1: robot.j1,
            j2: robot.j2,
            j3: robot.j3,
            j4: robot.j4,
            j5: robot.j5,
            j6: robot.j6,
            coordSystem: coordSystem === 'USER' ? '用户坐标系(0)' : '工具坐标系(0)',
            jogType: jogMode === 'POINT' ? '点动' : '寸动',
            stepSize: stepSize
          },
          blocks: blocks,
          notes: "检查是否有奇异点死角或喷涂高度问题，推荐最佳喷涂距离和工艺参数。"
        })
      });
      const data = await response.json();
      setChatLogs(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.text,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (e: any) {
      addNotification(`诊断失败：${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Translate blocks matrix to standard Dobot Lua scripts
  const handleTranslateToLua = async () => {
    setAiLoading(true);
    addNotification("多模态编译器启动：正在根据图块堆叠关系生成标准 Lua 实体控制脚本...");

    try {
      const response = await fetch('/api/tutor/generate-lua', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: blocks,
          robotState: robot
        })
      });
      const data = await response.json();
      setGeneratedLua(data.luaCode || `-- Error compiling script`);
      setShowLuaModal(true);
    } catch (e: any) {
      addNotification(`生成失败: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Simulate local user screenshot file upload
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        addNotification("学员桌面本地截图加载完成！可基于该界面状态向 AI 导师提问。");
      };
      reader.readAsDataURL(file);
    }
  };

  // Loads templates for lesson guidelines
  const handleLoadLesson = (title: string, presetBlocks: CodeBlock[]) => {
    saveStateToHistory(blocks);
    setBlocks(presetBlocks);
    addNotification(`已载入工艺实训案例：【${title}】。点击 [开始运行] 观察喷涂枪的几何动作规律吧！`);
  };

  // --- 4. Simulated Result Export ---
  const triggerFileDownload = (filename: string, text: string) => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportProject = (type: 'lua' | 'project') => {
    setExportType(type === 'lua' ? 'Dobot Lua 脚本' : 'MASJ 仿真数据库工程打包');
    setExportProgress(1);
    
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setExportProgress(null);
            if (type === 'lua') {
              const fileContent = `-- Generated via 码上建智能教学系统\nSetSafeSkin(1)\nSetObstacleAvoid(1)\n` + 
                blocks.map(b => `-- ${JSON.stringify(b)}`).join('\n');
              triggerFileDownload("masj_construction_export.lua", fileContent);
            } else {
              const projDetails = JSON.stringify({ platform: "码上建 V1.0", robot, points, blocks }, null, 2);
              triggerFileDownload("architecture_simulation.masj", projDetails);
            }
            addNotification(`仿真成果导出成功！已妥善保存并下载至您本地设备。`);
          }, 300);
          return 100;
        }
        return prev + 12;
      });
    }, 100);
  };

  const handleExportMP4 = () => {
    setExportType('3D渲染模拟视频录屏 (MP4格式-1080P/60FPS)');
    setExportProgress(1);

    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setExportProgress(null);
            addNotification(`动画工程视频编码合成完毕！自动激活浏览器 MP4 文件导出通道。`);
            triggerFileDownload("simulate_animation_record.mp4", "Simulated MP4 Stream Data Header V1.0");
          }, 300);
          return 100;
        }
        return prev + 8;
      });
    }, 120);
  };

  // --- 5. Interactive Block modify action ---
  const addBlockToWorkspace = (type: CodeBlock['type']) => {
    saveStateToHistory(blocks);
    let newB: CodeBlock;
    if (type === 'movej') {
      newB = { id: String(Date.now()), type, params: { pointName: 'InitialPose', speed: 50 } };
    } else if (type === 'movel') {
      newB = { id: String(Date.now()), type, params: { dx: 30, dy: 0, dz: 0 } };
    } else if (type === 'set_io') {
      newB = { id: String(Date.now()), type, params: { ioPort: 1, ioValue: 'HIGH' } };
    } else if (type === 'loop') {
      newB = { id: String(Date.now()), type, params: { loopCount: 5 } };
    } else if (type === 'safeskin') {
      newB = { id: String(Date.now()), type, params: { safeSkinEnabled: true, obstacleAvoidEnabled: true } };
    } else {
      newB = { id: String(Date.now()), type, params: {} };
    }
    setBlocks([...blocks, newB]);
  };

  const deleteBlock = (id: string) => {
    saveStateToHistory(blocks);
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const updateBlockParam = (id: string, updates: Partial<CodeBlock['params']>) => {
    saveStateToHistory(blocks);
    setBlocks(blocks.map(b => b.id === id ? { ...b, params: { ...b.params, ...updates } } : b));
  };

  const moveBlock = (index: number, dir: 'up' | 'down') => {
    if (dir === 'up' && index === 0) return;
    if (dir === 'down' && index === blocks.length - 1) return;
    saveStateToHistory(blocks);
    const targetIdx = dir === 'up' ? index - 1 : index + 1;
    const nextList = [...blocks];
    const temp = nextList[index];
    nextList[index] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    setBlocks(nextList);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans antialiased overflow-hidden select-none">
      
      {/* 1. Header Toolbar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-1 px-2.5 bg-amber-500 rounded text-slate-950 font-bold text-xs tracking-wider uppercase">V1.0</div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-slate-100 flex items-center gap-1.5">
              <span>码上建</span>
              <span className="text-slate-400 text-xs font-normal">（建筑机器人编程仿真实验平台教学实训助手）</span>
            </h1>
          </div>
        </div>

        {/* Start / Stop Execution */}
        <div className="flex items-center space-x-2">
          <button 
            id="btn-start"
            onClick={startSimulation}
            disabled={running}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded text-xs font-medium transition-all ${
              running ? 'bg-emerald-950 text-emerald-400 animate-pulse border border-emerald-800' : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer hover:shadow-lg'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? '正轨迹仿真复现中' : '开始运行 (仿真轨迹)'}</span>
          </button>
          
          <button 
            id="btn-stop"
            onClick={() => {
              setRunning(false);
              setRunningBlockIdx(null);
              setSprayStatus(false);
              addNotification("仿真流程已被阻断。");
            }}
            className="flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium bg-red-800/40 hover:bg-red-800/80 hover:text-white text-red-200 transition-all border border-red-700/50"
          >
            <Square className="w-3.5 h-3.5" />
            <span>强行中止</span>
          </button>
        </div>

        {/* Save / Undo / Redo */}
        <div className="flex items-center space-x-1.5">
          <button 
            onClick={handleUndo} 
            disabled={historyStack.length === 0}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white"
            title="撤销 (Undo)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={handleRedo} 
            disabled={redoStack.length === 0}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white"
            title="恢复 (Redo)"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              addNotification("本地修改及指令流已被保存在云端仿真项目数据栈。");
            }} 
            className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-cyan-700/50 hover:bg-cyan-700 text-cyan-100 rounded transition-all ml-2"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存程序</span>
          </button>
        </div>
      </header>

      {/* Main workspace (Grid partition) */}
      <main className="flex flex-1 overflow-hidden">
        
        {/* 2. Left: Parts, Blocks and Editor Sidebar */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col shrink-0">
          
          {/* Preset Worksite Course Selector */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/50">
            <h3 className="text-xs font-semibold text-amber-500 uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>智能教学推荐：工艺实训关卡</span>
            </h3>
            <p className="text-[10px] text-slate-400 mb-2">快速载入经典的机器人涂装与施工预案：</p>
            <div className="grid grid-cols-1 gap-1">
              <button 
                onClick={() => handleLoadLesson("墙面高一致性喷涂巡航", [
                  { id: 'start', type: 'start', params: {} },
                  { id: 'safe', type: 'safeskin', params: { safeSkinEnabled: true, obstacleAvoidEnabled: true } },
                  { id: 'pts1', type: 'movej', params: { pointName: 'SprayStart', speed: 80 } },
                  { id: 'ioOn', type: 'set_io', params: { ioPort: 1, ioValue: 'HIGH' } },
                  { id: 'mvr1', type: 'movel', params: { dx: 180, dy: 0, dz: 0 } },
                  { id: 'ioOff', type: 'set_io', params: { ioPort: 1, ioValue: 'LOW' } }
                ])}
                className="text-left text-[11px] bg-slate-800/80 hover:bg-slate-700 p-1.5 rounded border border-slate-700/60 transition-all font-medium truncate"
              >
                🏫 第1关：墙面巡航喷涂
              </button>
              <button 
                onClick={() => handleLoadLesson("安全皮肤防撞干预训练", [
                  { id: 'start', type: 'start', params: {} },
                  { id: 'safe', type: 'safeskin', params: { safeSkinEnabled: true, obstacleAvoidEnabled: true } },
                  { id: 'loop', type: 'loop', params: { loopCount: 3 } },
                  { id: 'mv0', type: 'movel', params: { dx: 15, dy: 30, dz: -10 } }
                ])}
                className="text-left text-[11px] bg-slate-800/80 hover:bg-slate-700 p-1.5 rounded border border-slate-700/60 transition-all font-medium truncate"
              >
                🛡️ 第2关：安全避障协同
              </button>
            </div>
          </div>

          {/* Blockly Toolbox Panels */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <div>
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">1. 图块工具箱 / 快捷插入</span>
              <div className="grid grid-cols-1 gap-1.5 mt-2">
                <button 
                  onClick={() => addBlockToWorkspace('safeskin')} 
                  className="flex items-center space-x-2 p-2 rounded text-left text-xs bg-orange-700/30 hover:bg-orange-700/50 border border-orange-600/30 font-medium cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-orange-400" />
                  <div>
                    <div className="text-amber-300 font-semibold">【安全设置】</div>
                    <div className="text-[10px] text-slate-400">配置安全皮肤与防避障</div>
                  </div>
                </button>

                <button 
                  onClick={() => addBlockToWorkspace('movej')} 
                  className="flex items-center space-x-2 p-2 rounded text-left text-xs bg-indigo-700/30 hover:bg-indigo-700/50 border border-indigo-600/30 font-medium cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <div>
                    <div className="text-indigo-300 font-semibold">【关节运动】 MoveJ</div>
                    <div className="text-[10px] text-slate-400">快速移到存点库预设姿态</div>
                  </div>
                </button>

                <button 
                  onClick={() => addBlockToWorkspace('movel')} 
                  className="flex items-center space-x-2 p-2 rounded text-left text-xs bg-sky-700/30 hover:bg-sky-700/50 border border-sky-600/30 font-medium cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <div>
                    <div className="text-sky-300 font-semibold">【相对直线】 MoveL</div>
                    <div className="text-[10px] text-slate-400">设置三轴增量 dx dy dz 巡迹</div>
                  </div>
                </button>

                <button 
                  onClick={() => addBlockToWorkspace('set_io')} 
                  className="flex items-center space-x-2 p-2 rounded text-left text-xs bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-600/30 font-medium cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <div className="text-emerald-300 font-semibold">【设置数字 I/O】</div>
                    <div className="text-[10px] text-slate-400">控制喷枪压力 (高电平开启)</div>
                  </div>
                </button>

                <button 
                  onClick={() => addBlockToWorkspace('loop')} 
                  className="flex items-center space-x-2 p-2 rounded text-left text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <div className="text-slate-300 font-semibold">【重复执行循环】</div>
                    <div className="text-[10px] text-slate-400">让多段轨迹形成闭环施工</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Simulated Process parameters to change thickness & overlays */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Settings className="w-3 h-3 text-amber-500" />
                <span>施工工艺配置 (Process Params)</span>
              </span>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">工艺捕捉模式:</label>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    {['面中心', '边缘对齐', '任意点'].map(mode => (
                      <button 
                        key={mode} 
                        onClick={() => setCaptureMode(mode)}
                        className={`p-1 rounded text-center border ${captureMode === mode ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-800 text-slate-400 bg-slate-900'}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>喷涂距离 (Distance):</span>
                    <span className="text-amber-400 font-mono font-bold">{sprayDistance} mm</span>
                  </div>
                  <input 
                    type="range" min="50" max="250" value={sprayDistance} 
                    onChange={e => setSprayDistance(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <p className="text-[9px] text-slate-500">参数将反馈至轨迹热力图中线条覆盖的粗细与通透度度量</p>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>吸涂工作高度:</span>
                    <span className="text-amber-400 font-mono font-bold">{suctionHeight} mm</span>
                  </div>
                  <input 
                    type="range" min="20" max="150" value={suctionHeight} 
                    onChange={e => setSuctionHeight(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Export Menu Panel */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-400" />
                <span>工位仿真成果一键打包导出</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5 mt-2.5">
                <button 
                  onClick={() => handleExportProject('lua')}
                  className="flex items-center justify-between p-1.5 px-2 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 hover:bg-slate-800 active:scale-95 transition-all text-left"
                >
                  <span>导出底层 .lua 控制脚本</span>
                  <Download className="w-3 h-3 text-slate-400" />
                </button>
                <button 
                  onClick={() => handleExportProject('project')}
                  className="flex items-center justify-between p-1.5 px-2 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 hover:bg-slate-800 active:scale-95 transition-all text-left"
                >
                  <span>打包 .masj 金牌项目文件</span>
                  <Download className="w-3 h-3 text-slate-400" />
                </button>
                <button 
                  onClick={handleExportMP4}
                  className="flex items-center justify-between p-1.5 px-2 bg-amber-600 hover:gradient hover:bg-amber-500 text-slate-950 font-semibold rounded text-[11px] active:scale-95 transition-all text-left"
                >
                  <span>导出3D模拟动画 MP4 视频</span>
                  <Play className="w-3 h-3 text-slate-950" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Center: Immersive 3D Construction Digital Twin & Block Sequencing Stage (MAIN Interface) */}
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative">
          
          {/* Export Overlay Loader */}
          {exportProgress !== null && (
            <div className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center p-6 text-center">
              <div className="p-4 bg-slate-900 rounded-xl max-w-sm w-full border border-slate-800 shadow-2xl relative overflow-hidden">
                <h4 className="text-sm font-semibold tracking-wide text-amber-400">正在生成工艺导出成品...</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">{exportType}</p>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
                  <div className="bg-amber-500 h-full transition-all duration-100" style={{ width: `${exportProgress}%` }}></div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-300">{exportProgress}% 已合成</span>
              </div>
            </div>
          )}

          {/* Core Upper Workspace (60% Height) - Realtime 3D Digital Twin Construction Simulator Viewport */}
          <div className="flex-[1.4] min-h-[460px] bg-slate-950 flex overflow-hidden shrink-0 border-b border-slate-850">
            
            {/* 1. Left Chamber: Architectural Elements & Robotics Spray Cell */}
            <div className="flex-1 p-3.5 flex flex-col justify-between relative bg-slate-950/25">
              
              {/* Upper Control & Dashboard Header */}
              <div className="flex justify-between items-center z-10 shrink-0 gap-2 flex-wrap pb-1 border-b border-slate-900/60">
                <div className="flex items-center space-x-2">
                  <span className="p-1 px-1.5 bg-indigo-600 text-[9px] font-bold tracking-widest text-white uppercase rounded shadow">
                    3D 建筑构件立面喷涂智能仿真空间
                  </span>
                  {collisionWarning ? (
                    <span className="inline-flex items-center gap-1 p-1 bg-red-950 border border-red-700 text-red-300 text-[10px] rounded leading-none">
                      <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                      <span>{collisionWarning}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span>安全皮肤保护系统 NORMAL</span>
                    </span>
                  )}
                </div>

                {/* Simulated Environmental & Camera Controls Options Bar */}
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  
                  {/* Camera Views Selector */}
                  <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded">
                    <span className="text-[9px] text-slate-500 px-1 font-bold">视角:</span>
                    {[
                      { key: 'isometric' as const, label: '🧊 3D轴侧' },
                      { key: 'front' as const, label: '⏹️ 正视' },
                      { key: 'top' as const, label: '🔲 俯瞰' }
                    ].map(v => (
                      <button
                        key={v.key}
                        onClick={() => {
                          setViewAngle(v.key);
                          addNotification(`相机视角已成功切换至【${v.label}】模式，渲染空间投影重构。`);
                        }}
                        className={`p-0.5 px-2 rounded-[3px] text-[10px] font-semibold transition ${
                          viewAngle === v.key 
                            ? 'bg-amber-500 text-slate-950 shadow font-black' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {/* Theme Presets */}
                  <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded">
                    <span className="text-[9px] text-slate-500 px-1.5 select-none shrink-0 font-bold">工况:</span>
                    {[
                      { key: 'Exterior' as const, label: '🏨 住宅外墙' },
                      { key: 'Tunnel' as const, label: '🚇 地铁隧道' },
                      { key: 'Prefab' as const, label: '🏗️ 预制车间' }
                    ].map(t => (
                      <button
                        key={t.key}
                        onClick={() => {
                          setConstructionTheme(t.key);
                          addNotification(`施工工况已切换至【${t.label}】，模型加载匹配对应的工程基层结构与抹灰工艺。`);
                        }}
                        className={`p-0.5 px-2 rounded-[3px] text-[10px] font-semibold transition ${
                          constructionTheme === t.key 
                            ? 'bg-indigo-600 text-white shadow' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Scaffolding Toggle */}
                  <button
                    onClick={() => setShowScaffolding(!showScaffolding)}
                    className={`p-1 px-2 border rounded text-[10px] font-bold ${
                      showScaffolding 
                        ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-400' 
                        : 'border-slate-800 text-slate-500 bg-slate-900/60'
                    }`}
                    title="展示/隐藏建筑钢管脚手架及防护网辅助线"
                  >
                    🚧 脚手架:{showScaffolding ? '显' : '隐'}
                  </button>

                  {/* Speed Multiplier */}
                  <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded">
                    <span className="text-[9px] text-slate-500 px-1 font-bold">倍速:</span>
                    {[1, 2, 5, 10].map(sp => (
                      <button
                        key={sp}
                        onClick={() => {
                          setSimSpeed(sp);
                        }}
                        className={`w-5 py-0.5 text-center rounded-[3px] text-[9px] font-mono font-bold transition ${
                          simSpeed === sp 
                            ? 'bg-amber-500 text-slate-950 font-black' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3D-Isometric dynamic workshop simulation SVG */}
              <div className="flex-1 flex items-center justify-center min-h-0 bg-slate-950/20 border border-slate-900 rounded-lg overflow-hidden relative my-2">
                
                {/* Visual grid watermark background representing mechanical workcell */}
                <svg className="w-full h-full max-h-[350px]" viewBox="0 0 620 310" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <pattern id="grid-pattern-isometric-new" width="20" height="20" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="20" y2="0" stroke="#0e1726" strokeWidth="0.8" />
                      <line x1="0" y1="0" x2="0" y2="20" stroke="#0e1726" strokeWidth="0.8" />
                    </pattern>
                    <radialGradient id="nozzlePulse" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                    <filter id="paint-blur">
                      <feGaussianBlur stdDeviation="3.0" />
                    </filter>
                    
                    {/* Theme-specific vivid vapor gradient */}
                    <linearGradient id="sprayGradientDynamic" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={
                        constructionTheme === 'Exterior' ? '#f59e0b' :
                        constructionTheme === 'Tunnel' ? '#06b6d4' : '#10b981'
                      } stopOpacity="0.9" />
                      <stop offset="50%" stopColor={
                        constructionTheme === 'Exterior' ? '#ea580c' :
                        constructionTheme === 'Tunnel' ? '#2563eb' : '#059669'
                      } stopOpacity="0.6" />
                      <stop offset="100%" stopColor={
                        constructionTheme === 'Exterior' ? '#b45309' :
                        constructionTheme === 'Tunnel' ? '#4f46e5' : '#15803d'
                      } stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  <rect width="100%" height="100%" fill="url(#grid-pattern-isometric-new)" />

                  {/* 3D Dynamic Space Grid Overlay matches selected cameras */}
                  {viewAngle === 'isometric' && (
                    <g id="ground-grid-3d" opacity="0.32" stroke="#102e3c" strokeWidth="0.8">
                      {/* Grid lines along X axis */}
                      {[-240, -120, 0, 120, 240].map(y => {
                        const p1 = project3D(-150, y, 50);
                        const p2 = project3D(180, y, 50);
                        return <line key={`gx-${y}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
                      })}
                      {/* Grid lines along Y axis */}
                      {[-140, -70, 0, 70, 140].map(x => {
                        const p1 = project3D(x, -260, 50);
                        const p2 = project3D(x, 260, 50);
                        return <line key={`gy-${x}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
                      })}
                    </g>
                  )}

                  {viewAngle === 'front' && (
                    <g id="front-grid" opacity="0.15" stroke="#475569" strokeWidth="0.6">
                      {[-200, -100, 0, 100, 200].map(y => {
                        const p1 = project3D(0, y, 100);
                        const p2 = project3D(0, y, 1100);
                        return <line key={`gv-${y}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
                      })}
                      {[200, 400, 600, 800, 1000].map(z => {
                        const p1 = project3D(0, -240, z);
                        const p2 = project3D(0, 240, z);
                        return <line key={`gh-${z}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
                      })}
                    </g>
                  )}

                  {viewAngle === 'top' && (
                    <g id="top-grid" opacity="0.15" stroke="#475569" strokeWidth="0.6">
                      {[-240, -120, 0, 120, 240].map(y => {
                        const p1 = project3D(-150, y, 0);
                        const p2 = project3D(180, y, 0);
                        return <line key={`gty-${y}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
                      })}
                      {[-120, -40, 40, 120].map(x => {
                        const p1 = project3D(x, -260, 0);
                        const p2 = project3D(x, 260, 0);
                        return <line key={`gtx-${x}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
                      })}
                    </g>
                  )}

                  {/* Environment perspective background lines representing hangar */}
                  <g opacity="0.12" stroke="#475569" strokeWidth="1">
                    <line x1="20" y1="20" x2="600" y2="20" />
                    <line x1="600" y1="20" x2="600" y2="290" />
                    <line x1="20" y1="290" x2="600" y2="290" />
                    <line x1="20" y1="20" x2="20" y2="290" />
                  </g>

                  {/* 3D Construction Wall Geometry (Projected in physical 3D spaces) */}
                  {(() => {
                    // Geometry boundary vertices in real space mm
                    // Wall face at X = 100 (Forward offset closer to tool tip)
                    const wtl = project3D(100, -220, 1100);
                    const wtr = project3D(100, 220, 1100);
                    const wbr = project3D(100, 220, 100);
                    const wbl = project3D(100, -220, 100);

                    // Back depth face at X = 180
                    const wtl_b = project3D(180, -220, 1100);
                    const wtr_b = project3D(180, 220, 1100);
                    const wbr_b = project3D(180, 220, 100);
                    const wbl_b = project3D(180, -220, 100);

                    // Bilinear interpolation mapper to get points on the wall face
                    const getWallPoint = (u: number, v: number) => {
                      const topX = wtl.x * (1 - u) + wtr.x * u;
                      const topY = wtl.y * (1 - u) + wtr.y * u;
                      
                      const botX = wbl.x * (1 - u) + wbr.x * u;
                      const botY = wbl.y * (1 - u) + wbr.y * u;
                      
                      const px = topX * (1 - v) + botX * v;
                      const py = topY * (1 - v) + botY * v;
                      
                      return { x: px, y: py };
                    };

                    const brickPolys = [];
                    if (constructionTheme === 'Exterior') {
                      // Subdivided Red Masonry Terracotta Blocks
                      for (let r = 0; r < 8; r++) {
                        const v1 = r / 8;
                        const v2 = (r + 0.90) / 8;
                        const shift = (r % 2) * 0.08;
                        for (let c = -1; c < 5; c++) {
                          const u1 = Math.max(0, c * 0.22 + shift);
                          const u2 = Math.min(1, (c + 0.92) * 0.22 + shift);
                          if (u1 >= 1 || u2 <= 0) continue;
                          const p1 = getWallPoint(u1, v1);
                          const p2 = getWallPoint(u2, v1);
                          const p3 = getWallPoint(u2, v2);
                          const p4 = getWallPoint(u1, v2);
                          brickPolys.push(
                            <polygon 
                              key={`br-${r}-${c}`}
                              points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                              fill="#9a3412" 
                              stroke="#451a03" 
                              strokeWidth="0.8" 
                              opacity="0.9"
                            />
                          );
                        }
                      }
                    } else if (constructionTheme === 'Tunnel') {
                      // Metro concrete lining segments
                      for (let r = 0; r < 4; r++) {
                        const v1 = r / 4;
                        const v2 = (r + 0.94) / 4;
                        for (let c = 0; c < 3; c++) {
                          const u1 = c * 0.33;
                          const u2 = (c + 0.96) * 0.33;
                          const p1 = getWallPoint(u1, v1);
                          const p2 = getWallPoint(u2, v1);
                          const p3 = getWallPoint(u2, v2);
                          const p4 = getWallPoint(u1, v2);
                          brickPolys.push(
                            <g key={`tu-${r}-${c}`}>
                              <polygon 
                                points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                                fill="#475569" 
                                stroke="#1e293b" 
                                strokeWidth="1.2" 
                              />
                              {/* Anchor bolt highlights */}
                              <circle cx={p1.x * 0.8 + p2.x * 0.2} cy={p1.y * 0.8 + p4.y * 0.2} r="2" fill="#111827" />
                              <circle cx={p2.x * 0.8 + p1.x * 0.2} cy={p2.y * 0.8 + p3.y * 0.2} r="2" fill="#111827" />
                              <circle cx={p1.x * 0.8 + p2.x * 0.2} cy={p4.y * 0.8 + p1.y * 0.2} r="2" fill="#111827" />
                              <circle cx={p2.x * 0.8 + p1.x * 0.2} cy={p3.y * 0.8 + p2.y * 0.2} r="2" fill="#111827" />
                            </g>
                          );
                        }
                      }
                    } else {
                      // AAC Sand-Lime Building block
                      for (let r = 0; r < 5; r++) {
                        const v1 = r / 5;
                        const v2 = (r + 0.93) / 5;
                        const shift = (r % 2) * 0.12;
                        for (let c = -1; c < 4; c++) {
                          const u1 = Math.max(0, c * 0.28 + shift);
                          const u2 = Math.min(1, (c + 0.95) * 0.28 + shift);
                          if (u1 >= 1 || u2 <= 0) continue;
                          const p1 = getWallPoint(u1, v1);
                          const p2 = getWallPoint(u2, v1);
                          const p3 = getWallPoint(u2, v2);
                          const p4 = getWallPoint(u1, v2);
                          brickPolys.push(
                            <polygon 
                              key={`pr-${r}-${c}`}
                              points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                              fill="#5b697e" 
                              stroke="#2f3846" 
                              strokeWidth="0.8" 
                            />
                          );
                        }
                      }
                    }

                    return (
                      <g id="voxel-mesh-3d">
                        
                        {/* 1. Underlying wall backing structure panel */}
                        <polygon 
                          points={`${wbl_b.x},${wbl_b.y} ${wbr_b.x},${wbr_b.y} ${wtr_b.x},${wtr_b.y} ${wtl_b.x},${wtl_b.y}`} 
                          fill="#111827" 
                          stroke="#1e293b" 
                          strokeWidth="1.5" 
                        />

                        {/* 2. Top Slab Side thickness panel */}
                        {viewAngle !== 'front' && (
                          <polygon 
                            points={`${wtl.x},${wtl.y} ${wtr.x},${wtr.y} ${wtr_b.x},${wtr_b.y} ${wtl_b.x},${wtl_b.y}`} 
                            fill="#1e293b" 
                            stroke="#334155" 
                            strokeWidth="1" 
                          />
                        )}

                        {/* 3. Right Side Wall thickness panel */}
                        {viewAngle === 'isometric' && (
                          <polygon 
                            points={`${wtr.x},${wtr.y} ${wbr.x},${wbr.y} ${wbr_b.x},${wbr_b.y} ${wtr_b.x},${wtr_b.y}`} 
                            fill="#1e293b" 
                            stroke="#334155" 
                            strokeWidth="1" 
                          />
                        )}

                        {/* 4. Left Side Wall thickness panel */}
                        {viewAngle === 'isometric' && (
                          <polygon 
                            points={`${wtl.x},${wtl.y} ${wbl.x},${wbl.y} ${wbl_b.x},${wbl_b.y} ${wtl_b.x},${wtl_b.y}`} 
                            fill="#1e293b" 
                            stroke="#334155" 
                            strokeWidth="1" 
                          />
                        )}

                        {/* 5. Front Wall Face with volumetric bricks inside */}
                        <polygon 
                          points={`${wbl.x},${wbl.y} ${wbr.x},${wbr.y} ${wtr.x},${wtr.y} ${wtl.x},${wtl.y}`} 
                          fill="#334155" 
                          stroke="#1e293b" 
                          strokeWidth="2" 
                        />
                        
                        {/* Bricks rendering */}
                        {brickPolys}

                        {/* 6. Dynamic Paint Layers Layered Heatmap projected precisely on 3D Wall face */}
                        {trail.map((t, idx) => {
                          // rx range is roughly -200 to 200, ry [-220, 220], rz [100, 1100]
                          const u = (t.ry - (-220)) / 440;
                          const v = (1100 - t.rz) / 1000; // inverted Y center
                          const clampedU = Math.min(Math.max(0, u), 1);
                          const clampedV = Math.min(Math.max(0, v), 1);

                          // Bilinear interpolation provides perfect coordinates skew matching 3D perspective camera angles!
                          const screenPt = getWallPoint(clampedU, clampedV);

                          const dRadius = Math.max(7, 18 - (sprayDistance - 100) / 8);
                          // Scale display paint size depending on camera scale
                          const strokeRadius = dRadius * (viewAngle === 'isometric' ? 0.65 : (viewAngle === 'top' ? 0.2 : 0.85));

                          // Color schemes
                          let color = 'rgba(52, 211, 153, 0.78)';
                          if (constructionTheme === 'Exterior') {
                            if (t.density > 4) color = 'rgba(239, 68, 68, 0.88)'; // heavy terracotta coat
                            else if (t.density > 2.5) color = 'rgba(249, 115, 22, 0.85)'; // medium coat
                            else if (t.density > 1.25) color = 'rgba(245, 158, 11, 0.78)'; // primary gold
                            else color = 'rgba(254, 240, 138, 0.68)'; // yellow prime coat
                          } else if (constructionTheme === 'Tunnel') {
                            if (t.density > 4) color = 'rgba(79, 70, 229, 0.88)'; // heavy indigo
                            else if (t.density > 2.5) color = 'rgba(59, 130, 246, 0.85)'; // azure middle
                            else if (t.density > 1.25) color = 'rgba(56, 189, 248, 0.78)'; // soft mist
                            else color = 'rgba(224, 242, 254, 0.65)'; // ice priming
                          } else {
                            if (t.density > 4) color = 'rgba(15, 118, 110, 0.88)'; // heavy teal plaster base
                            else if (t.density > 2.5) color = 'rgba(20, 184, 166, 0.85)'; // mint putty
                            else if (t.density > 1.25) color = 'rgba(52, 211, 153, 0.78)'; // emerald primer
                            else color = 'rgba(209, 250, 229, 0.68)'; // tint putty layer
                          }

                          return (
                            <circle 
                              key={`wall-spray-${idx}`}
                              cx={screenPt.x}
                              cy={screenPt.y}
                              r={strokeRadius}
                              fill={color}
                              filter="url(#paint-blur)"
                              opacity="0.85"
                            />
                          );
                        })}

                        {/* 7. Scaffold overlay line columns (front physical lattice) */}
                        {showScaffolding && (
                          <g id="scaffolding-system-3d" opacity="0.6" className="pointer-events-none">
                            {/* Steel vertical support columns placed of front corners */}
                            {(() => {
                              const scL_bot = project3D(80, -240, 50);
                              const scL_top = project3D(80, -240, 1150);
                              const scR_bot = project3D(80, 240, 50);
                              const scR_top = project3D(80, 240, 1150);

                              const p_rail1 = project3D(80, -250, 300);
                              const p_rail2 = project3D(80, 250, 300);
                              const p_rail3 = project3D(80, -250, 750);
                              const p_rail4 = project3D(80, 250, 750);
                              const p_rail5 = project3D(80, -250, 1100);
                              const p_rail6 = project3D(80, 250, 1100);

                              return (
                                <>
                                  {/* Yellow striped barrier foot board */}
                                  <line x1={p_rail1.x} y1={p_rail1.y} x2={p_rail2.x} y2={p_rail2.y} stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                                  <line x1={p_rail1.x} y1={p_rail1.y} x2={p_rail2.x} y2={p_rail2.y} stroke="#0f172a" strokeWidth="4" strokeDasharray="5 5" opacity="0.4" strokeLinecap="round" />

                                  {/* Structural railings ledger */}
                                  <line x1={p_rail3.x} y1={p_rail3.y} x2={p_rail4.x} y2={p_rail4.y} stroke="#cbd5e1" strokeWidth="2.5" />
                                  <line x1={p_rail5.x} y1={p_rail5.y} x2={p_rail6.x} y2={p_rail6.y} stroke="#cbd5e1" strokeWidth="2" />

                                  {/* Vertical columns */}
                                  <line x1={scL_bot.x} y1={scL_bot.y} x2={scL_top.x} y2={scL_top.y} stroke="#94a3b8" strokeWidth="3" />
                                  <line x1={scR_bot.x} y1={scR_bot.y} x2={scR_top.x} y2={scR_top.y} stroke="#94a3b8" strokeWidth="3" />

                                  {/* Scaffold safety green shield barrier overlay */}
                                  <polygon 
                                    points={`${scL_bot.x},${scL_bot.y} ${scR_bot.x},${scR_bot.y} ${scR_top.x},${scR_top.y} ${scL_top.x},${scL_top.y}`}
                                    fill="none"
                                    stroke="#22c55e"
                                    strokeWidth="1.2"
                                    strokeDasharray="3 3"
                                    opacity="0.3"
                                  />
                                </>
                              );
                            })()}
                          </g>
                        )}

                      </g>
                    );
                  })()}

                  {/* 3D Sliding Mechanical Gantry & Articulated Robotics Arm Cell (Behind/Infront wall) */}
                  {(() => {
                    // Physical base track coords
                    const rTrack_A = project3D(-120, -260, 50);
                    const rTrack_B = project3D(-120, 260, 50);

                    // Motor guides and guides teeth
                    const guideTeeth_A = project3D(-120, -250, 48);
                    const guideTeeth_B = project3D(-120, 250, 48);

                    // Y sliding base carriage position
                    const yCar_3d = project3D(-120, robot.y, 50);

                    // Pillar mast vertical columns
                    const mast_top = project3D(-120, robot.y, 1150);

                    // Hoisting hoist elevator carriage
                    const zCar_3d = project3D(-120, robot.y, robot.z);

                    // Industrial Robot joint configurations coordinates (3D Kinematic links)
                    // Joint 1: Base pivot center
                    const J0 = { x: -120, y: robot.y, z: robot.z };
                    const J0_s = project3D(J0.x, J0.y, J0.z);

                    // Joint 2: Elbow connector
                    const J1 = { 
                      x: -120 + 130 * Math.sin(robot.j2 * Math.PI / 180), 
                      y: robot.y + 30 * Math.sin(robot.j1 * Math.PI / 180), 
                      z: robot.z + 130 * Math.cos(robot.j2 * Math.PI / 180) 
                    };
                    const J1_s = project3D(J1.x, J1.y, J1.z);

                    // Joint 3: Tool wrist
                    const J2 = { 
                      x: J1.x + 100 * Math.sin((robot.j2 + robot.j3) * Math.PI / 180), 
                      y: J1.y, 
                      z: J1.z + 100 * Math.cos((robot.j2 + robot.j3) * Math.PI / 180) 
                    };
                    const J2_s = project3D(J2.x, J2.y, J2.z);

                    // Tool end effector TCP nozzle spray tip
                    const J3_s = project3D(robot.x, robot.y, robot.z);

                    const isSprayingActive = sprayStatus || manualSprayOverride;

                    return (
                      <>
                        {/* 1. Base guides floor track */}
                        {viewAngle !== 'top' && (
                          <g id="gantry-rail-3d" opacity="0.85">
                            {/* Steel backing line */}
                            <line x1={rTrack_A.x} y1={rTrack_A.y} x2={rTrack_B.x} y2={rTrack_B.y} stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                            {/* Teeth pinion rack */}
                            <line x1={guideTeeth_A.x} y1={guideTeeth_A.y} x2={guideTeeth_B.x} y2={guideTeeth_B.y} stroke="#334155" strokeWidth="4.5" strokeDasharray="3 3.5" strokeLinecap="round" />
                            {/* Safety stop limit stoppers */}
                            {[-260, 260].map(pos => {
                              const pStop = project3D(-120, pos, 50);
                              return (
                                <g key={`st-${pos}`}>
                                  <circle cx={pStop.x} cy={pStop.y} r="5.5" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
                                  <circle cx={pStop.x} cy={pStop.y} r="2" fill="#ffffff" />
                                </g>
                              );
                            })}
                          </g>
                        )}

                        {/* 2. Slide Y-Car Base slide bed */}
                        {viewAngle !== 'top' && (
                          <g id="y-car-base" transform={`translate(${yCar_3d.x - 14}, ${yCar_3d.y - 10})`}>
                            <rect x="0" y="0" width="28" height="15" rx="3" fill="#334155" stroke="#475569" strokeWidth="1.2" />
                            <circle cx="14" cy="7" r="3" fill={isSprayingActive ? '#10b981' : '#f59e0b'} className={isSprayingActive ? 'animate-ping' : ''} />
                            <rect x="5" y="3" width="18" height="2" fill="#111827" />
                          </g>
                        )}

                        {/* 3. Pillar Mast vertical riser columns */}
                        {viewAngle !== 'top' && (
                          <g id="mast-column" opacity="0.9">
                            {/* Truss side-brace pipes */}
                            <line x1={yCar_3d.x} y1={yCar_3d.y} x2={mast_top.x} y2={mast_top.y} stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
                            <line x1={yCar_3d.x + 3} y1={yCar_3d.y} x2={mast_top.x + 3} y2={mast_top.y} stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                            <line x1={yCar_3d.x - 3} y1={yCar_3d.y} x2={mast_top.x - 3} y2={mast_top.y} stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
                          </g>
                        )}

                        {/* 4. Elevator Carriage box Z-Car (Tracking vertical slide) */}
                        {viewAngle !== 'top' && (
                          <g id="z-car-elevator">
                            <rect 
                              x={zCar_3d.x - 11} 
                              y={zCar_3d.y - 12} 
                              width="22" 
                              height="20" 
                              rx="2" 
                              fill="#94a3b8" 
                              stroke="#475569" 
                              strokeWidth="1.5" 
                            />
                            {/* SafeSkin logo watermark line */}
                            <rect x={zCar_3d.x - 7} y={zCar_3d.y - 4} width="14" height="6" fill="#1e293b" rx="1" />
                            <circle cx={zCar_3d.x} cy={zCar_3d.y - 1} r="2" fill="#fbbf24" />
                          </g>
                        )}

                        {/* 5. Articulated Robotic Arm Links */}
                        <g id="articulated-arm-cell">
                          {/* Shadow representation on floor (Perspective Depth helper) */}
                          {viewAngle === 'isometric' && (
                            <g opacity="0.22" stroke="#111827" strokeWidth="5" strokeLinecap="round">
                              {/* Projected shadow line from Shoulder to Elbow on floor */}
                              {(() => {
                                const sh_f = project3D(J0.x, J0.y, 50);
                                const el_f = project3D(J1.x, J1.y, 50);
                                const wr_f = project3D(J2.x, J2.y, 50);
                                const tip_f = project3D(robot.x, robot.y, 50);
                                return (
                                  <>
                                    <line x1={sh_f.x} y1={sh_f.y} x2={el_f.x} y2={el_f.y} />
                                    <line x1={el_f.x} y1={el_f.y} x2={wr_f.x} y2={wr_f.y} strokeWidth="3" />
                                    <line x1={wr_f.x} y1={wr_f.y} x2={tip_f.x} y2={tip_f.y} strokeWidth="2" />
                                  </>
                                );
                              })()}
                            </g>
                          )}

                          {/* Primary Link (Heavy metal tube between shoulder J0_s and elbow J1_s) */}
                          <line x1={J0_s.x} y1={J0_s.y} x2={J1_s.x} y2={J1_s.y} stroke="#f1f5f9" strokeWidth="8.5" strokeLinecap="round" />
                          <line x1={J0_s.x} y1={J0_s.y} x2={J1_s.x} y2={J1_s.y} stroke="#cbd5e1" strokeWidth="5.5" strokeLinecap="round" />
                          <circle cx={J1_s.x} cy={J1_s.y} r="6.5" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />

                          {/* Forearm Link (Elbow J1_s to Wrist J2_s) */}
                          <line x1={J1_s.x} y1={J1_s.y} x2={J2_s.x} y2={J2_s.y} stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
                          <line x1={J1_s.x} y1={J1_s.y} x2={J2_s.x} y2={J2_s.y} stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                          <circle cx={J2_s.x} cy={J2_s.y} r="5" fill="#f8fafc" stroke="#475569" strokeWidth="1.2" />

                          {/* Heavy Spray Nozzle Assembly tool body (Wrist J2_s to Tool TCP J3_s) */}
                          <line x1={J2_s.x} y1={J2_s.y} x2={J3_s.x} y2={J3_s.y} stroke="#ea580c" strokeWidth="4.5" strokeLinecap="square" />
                          <circle cx={J3_s.x} cy={J3_s.y} r="3.5" fill="#fb923c" />

                          {/* SafeSkin field dome around nozzle tip */}
                          <circle cx={J3_s.x} cy={J3_s.y} r="25" fill="none" stroke="#f97316" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.32" />

                          {/* Laser distance helper vector lines in 3D (Nozzle TCP to Wall face) */}
                          {(() => {
                            // Wall coordinates directly infront of nozzle: X = 100
                            const wallIntersect_s = project3D(100, robot.y, robot.z);
                            return (
                              <line 
                                x1={J3_s.x} y1={J3_s.y} x2={wallIntersect_s.x} y2={wallIntersect_s.y} 
                                stroke="#ef4444" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.75" 
                                title="激光测距传感器安全测速"
                              />
                            );
                          })()}

                          {/* Fluid spray mist cone stream towards the wall face */}
                          {isSprayingActive && (
                            <g id="spraying-mist">
                              {(() => {
                                // Expand limits on wall: X = 100
                                const wallCtr = project3D(100, robot.y, robot.z);
                                // Dynamic expansion radius based on spray distance config
                                const limitOffset = Math.max(15, (sprayDistance / 100) * 35);
                                const wallUpper = project3D(100, robot.y, robot.z + limitOffset);
                                const wallLower = project3D(100, robot.y, robot.z - limitOffset);

                                return (
                                  <>
                                    {/* High pressure radial mist gradient */}
                                    <polygon 
                                      points={`${J3_s.x},${J3_s.y} ${wallUpper.x},${wallUpper.y} ${wallLower.x},${wallLower.y}`}
                                      fill="url(#sprayGradientDynamic)"
                                      opacity="0.8"
                                      className="animate-pulse"
                                    />
                                    {/* Particle bounce-off sparks */}
                                    <circle cx={(J3_s.x + wallCtr.x)/2} cy={(J3_s.y + wallCtr.y)/2} r="2" fill="#ffffff" className="animate-pulse" />
                                    <circle cx={wallCtr.x} cy={wallCtr.y - 12} r="1.5" fill="#fef08a" />
                                    <circle cx={wallCtr.x} cy={wallCtr.y + 15} r="2.5" fill="#ffffff" />
                                    <circle cx={wallCtr.x} cy={wallCtr.y + 4} r="1.8" fill="#fef08a" />
                                  </>
                                );
                              })()}
                            </g>
                          )}

                          {/* Alerts trigger halos */}
                          {collisionWarning && (
                            <circle cx={J3_s.x} cy={J3_s.y} r="35" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" className="animate-ping" />
                          )}
                        </g>
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Status footer telemetry line with real signals details */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-900 leading-none shrink-0 select-none">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${sprayStatus || manualSprayOverride ? 'bg-emerald-500 animate-ping' : 'bg-slate-700'}`}></span>
                  <span>数字气动电磁信号 (DO_01): {sprayStatus || manualSprayOverride ? '【高压开放 HIGH】' : '【管网备压 CLOSED】'}</span>
                </span>
                <span className="font-mono text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                  原厂映射轨: X={robot.x.toFixed(0)} Y={robot.y.toFixed(0)} Z={robot.z.toFixed(0)} ({viewAngle === 'isometric' ? '3D轴侧空间' : viewAngle === 'front' ? '正向立面' : '俯瞰投影'})
                </span>
              </div>
            </div>

            {/* 2. Right Chamber: Immersive Process Quality Telemetry & Manual Override Panels */}
            <div className="w-[290px] p-3 py-3.5 bg-slate-900/50 border-l border-slate-800 flex flex-col justify-between shrink-0">
              
              <div className="space-y-3">
                <div>
                  <span className="p-0.5 px-1.5 bg-emerald-600/30 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase rounded tracking-wider">
                    施工质量实研反馈监测 / Telemetry
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 select-none">
                    对机械臂末端涂装覆盖率、料厚、匀称度及干稠度进行建模分析。
                  </p>
                </div>

                {/* Dashboard Stats Bento Deck */}
                <div className="grid grid-cols-2 gap-2">
                  
                  {/* Progress Block */}
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 flex flex-col justify-between h-[65px]">
                    <span className="text-[9px] text-slate-500 font-bold block select-none">涂层施工覆盖率</span>
                    <div className="flex items-baseline space-x-1 mt-0.5">
                      <span className="text-sm font-black font-mono text-emerald-400">
                        {Math.min(100, Math.floor(trail.length * 1.5))}%
                      </span>
                      <span className="text-[8px] text-slate-500 select-none">/ 100%</span>
                    </div>
                    {/* Tiny micro progress bar */}
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, Math.floor(trail.length * 1.5))}%` }}></div>
                    </div>
                  </div>

                  {/* Consumed Material Block */}
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 flex flex-col justify-between h-[65px]">
                    <span className="text-[9px] text-slate-500 font-bold block select-none">砂浆工艺料累计消耗</span>
                    <div className="flex items-baseline space-x-0.5 mt-0.5">
                      <span className="text-sm font-black font-mono text-amber-400">
                        {(trail.reduce((sum, t) => sum + t.density, 0) * 0.12).toFixed(1)}
                      </span>
                      <span className="text-[8px] text-slate-500 select-none">L (升)</span>
                    </div>
                    <span className="text-[8px] text-slate-500 leading-none truncate">配方: {
                      constructionTheme === 'Exterior' ? '真石金漆' :
                      constructionTheme === 'Tunnel' ? '防火隔热灰' : '轻骨料腻子'
                    }</span>
                  </div>

                  {/* Coated Square Area */}
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 flex flex-col justify-between h-[65px]">
                    <span className="text-[9px] text-slate-500 font-bold block select-none">累计涂料涂刷面积</span>
                    <div className="flex items-baseline space-x-0.5 mt-0.5">
                      <span className="text-sm font-black font-mono text-indigo-300">
                        {(trail.length * 0.04).toFixed(2)}
                      </span>
                      <span className="text-[8px] text-slate-500 select-none">m²</span>
                    </div>
                    <span className="text-[8px] text-slate-500 leading-none">实度 TCP 250mm/s</span>
                  </div>

                  {/* Uniformity metric */}
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 flex flex-col justify-between h-[65px]">
                    <span className="text-[9px] text-slate-500 font-bold block select-none">表面干成匀称稠度</span>
                    <div className="flex items-baseline space-x-0.5 mt-0.5">
                      <span className="text-sm font-black font-mono text-pink-400">
                        {(() => {
                          if (trail.length === 0) return '0.0%';
                          const overkillCount = trail.filter(t => t.density > 2.8).length;
                          const score = Math.max(55, Math.min(99, 97 - (overkillCount / trail.length) * 15));
                          return `${score.toFixed(1)}%`;
                        })()}
                      </span>
                    </div>
                    <span className="text-[8px] text-slate-500 leading-none truncate">{
                      trail.length === 0 ? '等待积木控制流启动' :
                      trail.filter(t => t.density > 2.8).length > 20 ? '⚠️ 注意：部分区域积泪' : '优质拉杆抹灰级别'
                    }</span>
                  </div>

                </div>

                {/* Plaster Paint Product Quality Adhesion indicator */}
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase select-none">实时拉伸粘结强度 (Plaster Bond Strength)</span>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="text-xs font-mono font-bold text-slate-200">
                      粘结度: <span className="text-emerald-400">{trail.length === 0 ? '0.00' : (1.15 + Math.sin(trail.length/10)*0.08).toFixed(2)} MPa</span>
                    </div>
                    <span className="p-0.5 px-1 bg-emerald-950/40 border border-emerald-900 text-emerald-400 font-mono text-[8px] rounded uppercase select-none">
                      GB/T 9755 合格
                    </span>
                  </div>
                </div>
              </div>

              {/* Debug Tools & Quick Actions directly on the simulated deck */}
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 select-none">手动强制气阀打靶测试:</span>
                  <span className={`px-1 rounded text-[8px] ${manualSprayOverride ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                    {manualSprayOverride ? '打靶测试中' : '自动电控'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      setManualSprayOverride(!manualSprayOverride);
                      addNotification(!manualSprayOverride ? "📢 强制触顶【气阀打靶测试点亮】！由于手动状态激发，喷雾流将一直开启，可自由寸动绘画。" : "📢 已收回电控，强制气动排气关闭。");
                    }}
                    className={`flex items-center justify-center space-x-1 p-1.5 py-2 rounded text-[11px] font-bold transition-all border ${
                      manualSprayOverride 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)] animate-pulse' 
                        : 'bg-slate-950 text-amber-500 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{manualSprayOverride ? '打靶枪: 打击中' : '手动气嘴打靶'}</span>
                  </button>

                  <button 
                    onClick={() => {
                      setTrail([]);
                      addNotification("操作：仿真轨迹已重新洗牌排空，工况构件恢复素墙状态。");
                    }}
                    className="w-full py-2 text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded border border-slate-700 hover:border-slate-600 transition"
                  >
                    恢复毛坯素墙
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Core Lower Workspace (40% Height) - Real-time Blockly block assembly timeline */}
          <div className="flex-[0.8] min-h-[220px] max-h-[350px] flex flex-col overflow-hidden bg-slate-950 border-t border-slate-850 p-4">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                📝 建筑机器人 Blockly 程序组装流水线
              </span>
              <span className="text-[10px] text-slate-500 text-right select-none">
                点击左侧添加图块，可使用上下箭头 ⇅ 微调执行时序，运行中对应积木高亮。
              </span>
            </div>

            {/* Infinite timeline stack */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 pb-2">
              {blocks.map((b, idx) => {
                const isActive = runningBlockIdx === idx;
                return (
                  <div 
                    key={b.id} 
                    className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                      isActive 
                        ? 'bg-emerald-950/60 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.15)] ring-1 ring-emerald-400' 
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 overflow-hidden">
                      {/* Left Block label icon */}
                      <span className="text-xs font-mono font-semibold text-slate-500 w-6">#{idx+1}</span>
                      
                      {/* Event Core block representations */}
                      {b.type === 'start' && (
                        <div className="flex items-center space-x-2">
                          <span className="p-1 px-2.5 bg-yellow-500 text-slate-950 text-[10px] font-black rounded uppercase select-none">【开始运行】</span>
                        </div>
                      )}

                      {b.type === 'safeskin' && (
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="p-0.5 px-2 bg-orange-600/30 text-orange-200 border border-orange-500/30 text-[10px] font-bold rounded flex items-center gap-1 leading-none select-none">
                            <Shield className="w-3 h-3 text-orange-400" />
                            <span>避障前哨 (SafeSkin)</span>
                          </span>
                          <span className="text-slate-500 text-[10px] select-none">模式:</span>
                          <select 
                            value={b.params.obstacleAvoidEnabled ? 'on' : 'off'}
                            onChange={e => updateBlockParam(b.id, { obstacleAvoidEnabled: e.target.value === 'on' })}
                            className="bg-slate-950 border border-slate-800 p-0.5 px-1 rounded text-slate-200 text-[10px] scale-95"
                          >
                            <option value="on">✅ 开启 (主动变轨安全防护)</option>
                            <option value="off">❌ 禁用</option>
                          </select>
                        </div>
                      )}

                      {b.type === 'movej' && (
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="p-0.5 px-2 bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold rounded leading-none select-none">关节示教 MoveJ</span>
                          <span className="text-slate-500 text-[10px] select-none">寻轨点:</span>
                          <select 
                            value={b.params.pointName}
                            onChange={e => updateBlockParam(b.id, { pointName: e.target.value })}
                            className="bg-slate-950 border border-slate-800 p-0.5 px-1.5 rounded text-amber-400 font-bold text-[10px] scale-95"
                          >
                            {points.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {b.type === 'movel' && (
                        <div className="flex items-center space-x-2 text-xs flex-wrap gap-1">
                          <span className="p-0.5 px-2 bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[10px] font-bold rounded leading-none select-none">直线工艺 MoveL</span>
                          
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-500 text-[10px]">Δx:</span>
                            <input 
                              type="number" value={b.params.dx} 
                              onChange={e => updateBlockParam(b.id, { dx: Number(e.target.value) })}
                              className="w-11 bg-slate-950 border border-slate-800 p-0.5 text-center rounded text-slate-100 font-bold text-[10px]"
                            />
                            <span className="text-slate-650 text-[8px]">mm</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <span className="text-slate-500 text-[10px]">Δy:</span>
                            <input 
                              type="number" value={b.params.dy} 
                              onChange={e => updateBlockParam(b.id, { dy: Number(e.target.value) })}
                              className="w-11 bg-slate-950 border border-slate-800 p-0.5 text-center rounded text-slate-100 font-bold text-[10px]"
                            />
                            <span className="text-slate-650 text-[8px]">mm</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <span className="text-slate-500 text-[10px]">Δz:</span>
                            <input 
                              type="number" value={b.params.dz} 
                              onChange={e => updateBlockParam(b.id, { dz: Number(e.target.value) })}
                              className="w-11 bg-slate-950 border border-slate-800 p-0.5 text-center rounded text-slate-100 font-bold text-[10px]"
                            />
                            <span className="text-slate-650 text-[8px]">mm</span>
                          </div>
                        </div>
                      )}

                      {b.type === 'set_io' && (
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="p-0.5 px-2 bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded leading-none select-none">数字 IO 配置</span>
                          <span className="text-slate-500 text-[10px] select-none">设置电磁阀输出口 [DO_01]:</span>
                          <select 
                            value={b.params.ioValue}
                            onChange={e => updateBlockParam(b.id, { ioValue: e.target.value as any })}
                            className="bg-slate-950 border border-slate-800 p-0.5 px-1.5 rounded text-amber-400 font-bold text-[10px] scale-95"
                          >
                            <option value="HIGH">高电平 HIGH (喷漆大开放)</option>
                            <option value="LOW">低电平 LOW (电控关闭)</option>
                          </select>
                        </div>
                      )}

                      {b.type === 'loop' && (
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="p-0.5 px-2 bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold rounded leading-none select-none">循环嵌套</span>
                          <span className="text-slate-500 text-[10px] select-none">循环执行:</span>
                          <input 
                            type="number" value={b.params.loopCount} 
                            onChange={e => updateBlockParam(b.id, { loopCount: Number(e.target.value) })}
                            className="w-11 bg-slate-950 border border-slate-800 p-0.5 text-center rounded text-amber-500 font-bold text-[10px]"
                          />
                          <span className="text-slate-400 text-[10px]">次工艺工段</span>
                        </div>
                      )}
                    </div>

                    {/* Block controller - sorting / deleting */}
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      <button 
                        onClick={() => moveBlock(idx, 'up')} 
                        disabled={idx === 0}
                        className="p-1 px-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:pointer-events-none transition text-[10px]"
                        title="上移"
                      >
                        ▲
                      </button>
                      <button 
                        onClick={() => moveBlock(idx, 'down')} 
                        disabled={idx === blocks.length - 1}
                        className="p-1 px-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:pointer-events-none transition text-[10px]"
                        title="下移"
                      >
                        ▼
                      </button>
                      {b.type !== 'start' && (
                        <button 
                          onClick={() => deleteBlock(b.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition ml-1"
                          title="移出积木"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Right: Real-time Coordinate Controller & Stored Points */}
        <div className="w-80 border-l border-slate-800 bg-slate-900/60 flex flex-col shrink-0">
          
          {/* Tabs for Coordinates & Stored points */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/70">
            <span className="text-xs font-bold text-slate-200 block uppercase">
              ⚙️ 实机示教存点控制台 (Teaching Jogger)
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              可在用户坐标系和关节系进行点动 (寸动)。
            </p>
          </div>

          <div className="p-3 border-b border-slate-800 bg-slate-950/20 grid grid-cols-2 gap-1.5 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block mb-1 uppercase">当前坐标系 (Coord)</span>
              <div className="grid grid-cols-2 gap-1">
                <button 
                  onClick={() => setCoordSystem('USER')}
                  className={`p-1.5 rounded transition bg-slate-800 text-[11px] font-semibold text-center border ${
                    coordSystem === 'USER' ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  用户
                </button>
                <button 
                  onClick={() => setCoordSystem('TOOL')}
                  className={`p-1.5 rounded transition bg-slate-800 text-[11px] font-semibold text-center border ${
                    coordSystem === 'TOOL' ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  工具
                </button>
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block mb-1 uppercase">点进模式 (Mode)</span>
              <div className="grid grid-cols-2 gap-1">
                <button 
                  onClick={() => setJogMode('POINT')}
                  className={`p-1.5 rounded transition bg-slate-800 text-[11px] font-semibold text-center border ${
                    jogMode === 'POINT' ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  点动
                </button>
                <button 
                  onClick={() => setJogMode('STEP')}
                  className={`p-1.5 rounded transition bg-slate-800 text-[11px] font-semibold text-center border ${
                    jogMode === 'STEP' ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  寸动
                </button>
              </div>
            </div>

            {jogMode === 'STEP' && (
              <div className="col-span-2 mt-1 bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-1 font-bold">寸动步进值设置 (Step Size mm/deg):</span>
                <div className="grid grid-cols-4 gap-1">
                  {[0.1, 1, 5, 10].map(val => (
                    <button 
                      key={val} 
                      onClick={() => setStepSize(val)}
                      className={`p-1 rounded text-center text-xs font-mono font-bold border ${stepSize === val ? 'bg-amber-600 text-slate-950 border-amber-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coordinate axis controllers list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">1. 用户基轴末端位姿 (Cartesian Axis)</span>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {[
                  { key: 'X', val: robot.x, unit: 'mm' },
                  { key: 'Y', val: robot.y, unit: 'mm' },
                  { key: 'Z', val: robot.z, unit: 'mm' },
                  { key: 'RX', val: robot.rx, unit: '°' },
                  { key: 'RY', val: robot.ry, unit: '°' },
                  { key: 'RZ', val: robot.rz, unit: '°' }
                ].map(axis => (
                  <div key={axis.key} className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded border border-slate-850">
                    <div className="w-14 text-center select-all shrink-0">
                      <span className="text-xs font-bold text-slate-300 block leading-tight">{axis.key}</span>
                      <span className="text-[9px] text-slate-500 font-mono scale-90">{axis.unit}</span>
                    </div>

                    <span className="font-mono font-bold text-xs text-amber-500 min-w-16 text-right">
                      {axis.val.toFixed(3)}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => handleJog(axis.key as any, '-')}
                        className="p-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-mono font-bold active:scale-90 select-none"
                      >
                        -
                      </button>
                      <button 
                        onClick={() => handleJog(axis.key as any, '+')}
                        className="p-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-mono font-bold active:scale-90 select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">2. 关节角度配置 (Joints State)</span>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {[
                  { key: 'J1', val: robot.j1 },
                  { key: 'J2', val: robot.j2 },
                  { key: 'J3', val: robot.j3 },
                  { key: 'J4', val: robot.j4 },
                  { key: 'J5', val: robot.j5 },
                  { key: 'J6', val: robot.j6 }
                ].map(joint => (
                  <div key={joint.key} className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded border border-slate-850">
                    <div className="w-14 text-center shrink-0">
                      <span className="text-xs font-bold text-slate-300 block leading-tight">{joint.key}</span>
                      <span className="text-[9px] text-slate-500 font-mono">deg</span>
                    </div>

                    <span className="font-mono font-bold text-xs text-slate-300 min-w-16 text-right">
                      {joint.val.toFixed(3)}°
                    </span>

                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => handleJog(joint.key as any, '-')}
                        className="p-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-mono font-bold active:scale-95"
                      >
                        -
                      </button>
                      <button 
                        onClick={() => handleJog(joint.key as any, '+')}
                        className="p-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-mono font-bold active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Teaching storage points list */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">3. 存点坐标库 (Stored Poses)</span>
                <button 
                  onClick={handleSavePoint}
                  className="flex items-center space-x-1 p-1 px-2 text-[10px] bg-amber-500 text-slate-950 font-bold tracking-wider rounded uppercase hover:bg-amber-400 active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>记录当前点</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {points.map(pt => (
                  <div key={pt.id} className="flex items-center justify-between bg-slate-950/50 hover:bg-slate-950 p-2 rounded text-xs border border-slate-850">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-slate-200 font-bold truncate">{pt.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        X:{pt.x.toFixed(0)} Y:{pt.y.toFixed(0)} Z:{pt.z.toFixed(0)}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => handleGotoPoint(pt)}
                        className="p-1 px-2 bg-slate-800 hover:bg-indigo-900 border border-slate-750 rounded text-[9px] font-medium text-slate-300"
                      >
                        复现
                      </button>
                      {points.length > 1 && (
                        <button 
                          onClick={() => {
                            setPoints(points.filter(p => p.id !== pt.id));
                            addNotification(`删除点位记录 ${pt.name}`);
                          }}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Extreme Right: AI Tutor Floating Tablet (Expert Assistant Panel) */}
        <div className="w-96 border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 overflow-hidden">
          
          {/* Header */}
          <div className="p-3 border-b border-indigo-950 bg-gradient-to-r from-indigo-950 to-slate-950 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-amber-400 animate-pulse" />
              <div>
                <h2 className="text-xs font-bold text-indigo-200 tracking-wider">码上建 AI 实体教学导师</h2>
                <div className="flex items-center space-x-1 leading-none text-[9px] text-indigo-400">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                  <span>专家模型已就绪 (gemini-3.5-flash)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button 
                onClick={handleStateDiagnosis}
                title="一键诊断当前参数"
                className="p-1.5 text-xs font-bold leading-none bg-amber-500 text-slate-950 rounded uppercase hover:bg-amber-400 transition-all cursor-pointer active:scale-95"
              >
                智能一键诊断
              </button>
              <button 
                onClick={handleTranslateToLua}
                title="转换积木程序到标准 Lua 代码"
                className="p-1.5 text-xs font-bold leading-none bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded uppercase transition-all cursor-pointer active:scale-95"
              >
                转换 LUA
              </button>
            </div>
          </div>

          {/* Chat message content box */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
            {chatLogs.map((log, index) => {
              const isAi = log.role === 'assistant';
              return (
                <div key={index} className={`flex ${isAi ? 'justify-start' : 'justify-end'} text-xs`}>
                  <div className={`p-3 max-w-[85%] rounded-xl shadow border ${
                    isAi 
                      ? 'bg-slate-900 border-indigo-950/60 text-slate-200 rounded-tl-none' 
                      : 'bg-indigo-600/35 border-indigo-700/50 text-slate-100 rounded-tr-none'
                  }`}>
                    
                    {/* Raw formatted render to support bold headings and checklists */}
                    <div className="space-y-1.5 whitespace-pre-wrap leading-relaxed">
                      {log.text.split('\n').map((line, lIdx) => {
                        // Custom markup translating markdown headings and bullets beautifully
                        if (line.startsWith('###')) {
                          return <h4 key={lIdx} className="text-sm font-bold text-amber-400 border-b border-slate-800 pb-1 mt-3 mb-1.5">{line.replace('###', '')}</h4>;
                        }
                        if (line.startsWith('**所处模块**：') || line.startsWith('**核心参数/状态**：') || line.startsWith('**工艺避坑**：') || line.startsWith('**常见报错**：')) {
                          const [label, content] = line.split('：');
                          return (
                            <div key={lIdx} className="my-1 text-xs">
                              <span className="text-pink-400 font-bold">{label}：</span>
                               {content}
                            </div>
                          );
                        }
                        if (line.trim().startsWith('* ')) {
                          return <li key={lIdx} className="list-disc list-inside text-slate-300 ml-1.5">{line.replace('* ', '')}</li>;
                        }
                        if (line.includes('[') && line.includes(']')) {
                          // highlights items like coordinates in state diagnoses
                          return (
                            <p key={lIdx} className="text-slate-300">
                              {line.split(' ').map((term, tIdx) => term.startsWith('[') ? <strong key={tIdx} className="text-amber-300 bg-slate-950 p-0.5 px-1 rounded mx-0.5">{term}</strong> : term + ' ')}
                            </p>
                          );
                        }
                        return <p key={lIdx} className="text-xs text-slate-300 leading-relaxed">{line}</p>;
                      })}
                    </div>

                    <span className="block text-[8px] text-slate-500 font-mono mt-1.5 text-right uppercase">
                      {log.time} • {isAi ? 'SYSTEM TUTOR' : 'STUDENT'}
                    </span>
                  </div>
                </div>
              );
            })}

            {aiLoading && (
              <div className="flex justify-start text-xs">
                <div className="p-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl rounded-tl-none animate-pulse flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span>AI 导师正在细致地审阅当前的拼装逻辑参数...</span>
                </div>
              </div>
            )}
          </div>

          {/* Screenshot workflow guidelines references */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/80">
            <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase block mb-1">
              📷 软件界面截图参考匹配 (多模态教学)
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {AI_SCREENSHOT_TEMPLATES.map(snap => (
                <button 
                  key={snap.id}
                  onClick={() => {
                    setSelectedImage(snap.url);
                    addNotification(`已为您匹配软件原版 【${snap.title}】 指南截图！`);
                    // Populate suggested input question for easier play-through
                    setChatInput(snap.prompt);
                  }}
                  className={`relative aspect-video rounded overflow-hidden border transition bg-slate-900 group ${
                    selectedImage === snap.url ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-800 hover:border-slate-600'
                  }`}
                  title={snap.description}
                >
                  <img src={snap.url} alt={snap.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-1 text-[9px] text-center font-bold text-slate-100 select-none">
                    {snap.title}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom user screenshot upload slot */}
          <div className="px-3 py-1 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1 p-1 hover:bg-slate-800 rounded border border-slate-700 text-[10px] text-slate-300"
                title="上传自制的软件报错截图或工艺界面进行问诊"
              >
                <ImageIcon className="w-3 h-3 text-amber-500" />
                <span>载入学员自由截图</span>
              </button>
              <input 
                type="file" ref={fileInputRef} onChange={handleLocalImageUpload} 
                accept="image/*" className="hidden" 
              />
            </div>

            {selectedImage && (
              <div className="flex items-center space-x-1">
                <span className="text-[9px] text-emerald-400 font-mono">已挂载截图资产</span>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="text-xs text-red-500 hover:text-red-400 px-1 hover:bg-slate-800 rounded font-semibold"
                >
                  清除
                </button>
              </div>
            )}
          </div>

          {/* User input keyboard message */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex gap-1.5">
            <input 
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAiChat();
              }}
              placeholder="向 AI 导师提问：如何解决干涉、奇异点超限..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 font-medium"
            />
            <button 
              onClick={() => handleAiChat()}
              className="p-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg active:scale-95 transition-all text-xs font-semibold"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>

      {/* 6. Dobot Lua Scripting Code compiled viewer modal */}
      {showLuaModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-text">
          <div className="bg-slate-900 border border-indigo-950 rounded-xl w-full max-w-4xl max-h-[85vh] h-[650px] flex flex-col overflow-hidden shadow-2xl">
            
            <div className="p-4 bg-gradient-to-r from-indigo-950 to-slate-950 border-b border-indigo-900 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">底层工业 Lua 控制脚本输出 (V1.0 建筑机器人对接)</h3>
                  <p className="text-[10px] text-slate-400">已自动完成工业赋能，包含了安全皮肤 SetSafeSkin 及自动避障配置</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLuaModal(false)}
                className="p-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold leading-none"
              >
                关闭预览
              </button>
            </div>

            {/* Compiled code area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs text-emerald-400 leading-relaxed whitespace-pre select-all border-b border-slate-900 scrollbar-thin">
              {generatedLua}
            </div>

            {/* Exporter Footer */}
            <div className="p-4 bg-slate-900/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold">
                提示：全选上面代码 (Ctrl+A / Cmd+A) 或点击右侧按钮直接下载可得到 .lua 输入到真实的物理机器人！
              </span>
              <button 
                onClick={() => {
                  triggerFileDownload("masj_dobot_construction.lua", generatedLua);
                  addNotification("已成功打包并下载 Lua 控制脚本到您的计算机！");
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 font-bold text-xs text-slate-950 rounded-lg active:scale-95 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>立即下载该 .lua 脚本文件</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
