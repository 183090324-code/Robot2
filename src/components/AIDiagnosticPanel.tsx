import React, { useState, useRef } from "react";
import { 
  Bot, 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  Send, 
  RotateCcw, 
  HelpCircle, 
  CheckCircle, 
  User, 
  Cpu,
  Loader2,
  FileMinus,
  AlertCircle
} from "lucide-react";
import { PRESET_SCENARIOS, PresetScenario } from "../types";

// Prefer react-markdown as stated in guidelines, let's render structured text cleanly since we want perfect visual representation
interface AIDiagnosticPanelProps {
  onAskWithLuaCode: string | null;
  onClearLuaCode: () => void;
}

export default function AIDiagnosticPanel({
  onAskWithLuaCode,
  onClearLuaCode
}: AIDiagnosticPanelProps) {
  // Preset scenarios list
  const [selectedScenario, setSelectedScenario] = useState<string>("lua_error");
  const [customImage, setCustomImage] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [diagnoseQuery, setDiagnoseQuery] = useState(
    "老师，为什么我的脚本运行时会报错出错？请给出具体修复方法与避坑建议。"
  );
  
  // General Chat values
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "你好！我是《码上建（建筑机器人编程仿真实验平台）》智能实训导师。我可以帮你:\n1. 示教点位 X-Y-Z 坐标变换分析与求值\n2. 诊断 Lua 脚本中的拼写重复（如 ObstacleAvoid）、编译与卡死问题\n3. 工艺审查：喷涂、砌筑的捕捉模式与过度平滑比率设定\n\n请在上面任选一个【实训场景截图】触发一键宏观评估，或直接在聊天框向我发问。"
    }
  ]);

  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"diagnose" | "chat">("diagnose");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger file click
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Convert uploaded image to base64 helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("仅支持上传图片进行仿真界面分析！");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomImage({
        base64: reader.result as string,
        mimeType: file.type,
        name: file.name
      });
      setSelectedScenario(""); // Deselect scenario to prefer uploaded image
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Call diagnoses API (Full Stack Proxy!)
  const handleDiagnose = async () => {
    setIsLoading(true);
    setDiagnosisResult(null);

    const payload = {
      message: diagnoseQuery,
      presetScenario: selectedScenario || undefined,
      customImageBase64: customImage?.base64 || undefined,
      customImageMimeType: customImage?.mimeType || undefined
    };

    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setDiagnosisResult(data.diagnosis);
        pushToChatLog(diagnoseQuery, data.diagnosis);
      } else {
        setDiagnosisResult(`⚠️ 诊断失败，原因: ${data.error || "未配置有效服务接口"}`);
      }
    } catch (err: any) {
      setDiagnosisResult(`⚠️ API请求异常: ${err.message || "后端控制器无法连接"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Call general Chat API
  const handleSendChat = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || chatPrompt;
    if (!textToSend.trim()) return;

    const userMsg = { role: "user" as const, text: textToSend };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!overridePrompt) setChatPrompt("");
    
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend })
      });
      const data = await res.json();

      if (data.success) {
        setChatMessages((prev) => [...prev, { role: "assistant", text: data.text }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", text: `⚠️ 教师大脑无法呼应: ${data.error}` }]);
      }
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { role: "assistant", text: `⚠️ 网络异常: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Synergize diagnosing logs to normal chat stream for transparency
  const pushToChatLog = (userTxt: string, aiTxt: string) => {
    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: `【仿真一键诊断】${userTxt}` },
      { role: "assistant", text: aiTxt }
    ]);
  };

  // Reset diagnosis
  const handleResetDiagnosis = () => {
    setDiagnosisResult(null);
    setCustomImage(null);
    setSelectedScenario("lua_error");
    setDiagnoseQuery("老师，为什么我的脚本运行时会报错出错？请给出具体修复方法与避坑建议。");
    onClearLuaCode();
  };

  // If code was pushed from Lua editor, auto-fill query
  React.useEffect(() => {
    if (onAskWithLuaCode) {
      setActiveTab("diagnose");
      setSelectedScenario("");
      setDiagnoseQuery(`老师，帮我看一下这段我正在编写的《码上建》施工Lua行代码，是否有干涉碰撞、卡死或者拼写语病，能教一下我相关的参数设置吗？:\n\n${onAskWithLuaCode}`);
    }
  }, [onAskWithLuaCode]);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-4 text-slate-200 shadow-2xl" id="ai-diagnostic-panel">
      {/* Tab Selectors */}
      <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-850">
        <button
          onClick={() => setActiveTab("diagnose")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-sans font-medium transition ${activeTab === "diagnose" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-slate-200"}`}
          id="tab-diagnose"
        >
          <Sparkles className="w-3.5 h-3.5" />
          多模态实训一键智能评估
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-sans font-medium transition ${activeTab === "chat" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-slate-200"}`}
          id="tab-chat"
        >
          <Bot className="w-3.5 h-3.5" />
          AI 导师实操技术交流
        </button>
      </div>

      {activeTab === "diagnose" ? (
        // DIAGNOSE MODE TAB CODE
        <div className="flex flex-col gap-3.5" id="tab-diagnose-content">
          {/* Preset Images header */}
          <div className="flex flex-col gap-1 text-xs text-slate-350">
            <span className="font-semibold text-slate-100 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
              1. 选择您要在实训中进行诊断的平台界面
            </span>
            <span className="text-[10px] text-slate-500">点击选中预置的软件仿真抓图，一键映射关键参数到后台评估：</span>
          </div>

          {/* Grid of presets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {PRESET_SCENARIOS.map((scen) => {
              const itemSelected = selectedScenario === scen.screenshotKey;
              return (
                <div
                  key={scen.id}
                  onClick={() => {
                    setSelectedScenario(scen.screenshotKey);
                    setCustomImage(null);
                    // Update default prompt matched for typical issues
                    if (scen.screenshotKey === "scenario_lua_error") {
                      setDiagnoseQuery("老师，我的Lua编译报错 'syntax error near SetObstacleAvoid(1)' 怎么解决？");
                    } else if (scen.screenshotKey === "scenario_blockly_motion") {
                      setDiagnoseQuery("老师，相对直线运动积木进行砖层累加循环怎么规划？我的关节角J5报警极值了。");
                    } else if (scen.screenshotKey === "scenario_blockly_char") {
                      setDiagnoseQuery("老师，如何使用寸动示教微调抓手到面中心？请问X=-0,Y=-247.5,Z=1050代表离筑墙体多远？");
                    } else {
                      setDiagnoseQuery("老师，如何从这个菜单恢复我历史的‘砌筑编程代码脚本’项目并启动外部示教通信？");
                    }
                  }}
                  className={`cursor-pointer p-2 rounded-xl flex flex-col gap-1 border transition text-left h-24 relative select-none ${
                    itemSelected 
                      ? "bg-slate-950 border-sky-450 ring-2 ring-sky-500/20" 
                      : "bg-slate-950/40 border-slate-850 hover:bg-slate-950/80"
                  }`}
                  id={`preset-card-${scen.id}`}
                >
                  <span className="text-[10.5px] font-sans font-bold text-slate-200 line-clamp-1">{scen.name}</span>
                  <p className="text-[9px] text-slate-500 line-clamp-2 leading-tight">{scen.description}</p>
                  
                  <span className="mt-auto text-[8px] font-mono text-slate-600 block line-clamp-1 truncate border-t border-slate-900/60 pt-1">
                    {scen.imageLabel}
                  </span>

                  {itemSelected && (
                    <span className="absolute bottom-1 right-2 w-2 h-2 rounded-full bg-sky-400" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom image upload option */}
          <div className="flex flex-col gap-1 border-t border-slate-800/80 pt-3">
            <span className="text-xs font-semibold text-slate-300">或者：现场上传新的实验操作报错、轨迹红区截图配合诊断</span>
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-xs ${
                isDragOver 
                  ? "border-sky-400 bg-sky-500/5 text-sky-300" 
                  : customImage 
                  ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-300" 
                  : "border-slate-800 bg-slate-950/20 hover:bg-slate-950/50 hover:border-slate-750 text-slate-400"
              }`}
              id="drag-and-drop-container"
            >
              <Upload className="w-5 h-5 shrink-0" />
              {customImage ? (
                <div className="text-center font-mono text-[10.5px]">
                  <span className="text-emerald-400 font-bold">✔ 成功装载：{customImage.name} </span>
                  <span className="block text-[8px] text-slate-500 mt-0.5">多模态引擎自动替换预置场景图片</span>
                </div>
              ) : (
                <div className="text-center select-none">
                  <span>拖拽平台操作截图至此，或 <span className="text-sky-400 font-medium underline">点击浏览本地文件</span></span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">支持 PNG, JPG, BMP 自动压缩提取</span>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
                id="file-input-upload"
              />
            </div>
          </div>

          {/* Query prompt text-area */}
          <div className="flex flex-col gap-1 border-t border-slate-800/80 pt-3">
            <label className="text-xs font-semibold text-slate-100 flex items-center justify-between" htmlFor="ai-query-textarea">
              <span>2. 描述您当前卡关点、参数疑问或诉求</span>
              <span className="text-[9px] text-slate-500 font-mono">支持 Lua 代码审查与 IO 测试反馈</span>
            </label>
            <textarea
              id="ai-query-textarea"
              value={diagnoseQuery}
              onChange={(e) => setDiagnoseQuery(e.target.value)}
              placeholder="请输入您在 码上建 仿真平台上遇到的报错或者示教阻碍..."
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs leading-relaxed text-slate-200 outline-none h-18 resize-none focus:border-sky-500/50"
            />
          </div>

          {/* Diagnosis Action Action */}
          <div className="flex gap-2.5">
            <button
              onClick={handleDiagnose}
              disabled={isLoading || (!selectedScenario && !customImage)}
              className="flex-1 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-sans font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none"
              id="btn-active-diagnose"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>老师正在拿着手电筒分析截图坐标与代码结构...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>开始多模态实训状态 AI 一键诊断评估</span>
                </>
              )}
            </button>

            {(diagnosisResult || customImage) && (
              <button
                onClick={handleResetDiagnosis}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 p-2 rounded-lg text-xs"
                title="清空重置"
                id="btn-reset-diagnose"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Diagnosis Render markdown results */}
          {diagnosisResult && (
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col gap-3 font-sans text-xs text-slate-300 leading-relaxed max-h-[400px] overflow-y-auto" id="diagnosis-result-holder">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-2 mb-1" id="diagnosis-result-header">
                <Bot className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-100">实训诊断报告 (AI Advisor Output)</span>
                <span className="ml-auto text-[9px] text-slate-500 font-mono">校验等级: 精密工艺级</span>
              </div>

              {/* Splitting sections by headings or render literally with gorgeous design details */}
              <div className="flex flex-col gap-4 font-sans text-xs">
                {diagnosisResult.split("###").map((section, idx) => {
                  if (!section.trim()) return null;
                  
                  // Check if this partition is diagnosis, core answer or safety precautions
                  const isDiagnosis = section.includes("当前状态诊断");
                  const isSolution = section.includes("核心解答") || section.includes("操作指引");
                  const isPrecaution = section.includes("注意事项") || section.includes("排错提示");

                  return (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-xl border ${
                        isDiagnosis ? "bg-slate-900/60 border-sky-500/15" :
                        isSolution ? "bg-slate-900/40 border-emerald-500/10" :
                        isPrecaution ? "bg-amber-500/5 border-amber-500/10" :
                        "bg-slate-900/20 border-slate-850"
                      }`}
                    >
                      {/* Section Title rendering */}
                      <h4 className="font-bold text-slate-100 mb-2 underline decoration-sky-500/40 underline-offset-4 flex items-center gap-1">
                        {isDiagnosis && <Cpu className="w-3.5 h-3.5 text-sky-400" />}
                        {isSolution && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                        {isPrecaution && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                        {section.split("\n")[0].trim()}
                      </h4>
                      
                      {/* Body section text */}
                      <div className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
                        {section.split("\n").slice(1).join("\n").trim()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        // GENERAL CHAT MODE TAB CODE
        <div className="flex flex-col gap-3.5 h-[550px]" id="tab-chat-content">
          <div className="flex-1 overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-3 max-h-[460px]">
            {chatMessages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex gap-2 px-3 py-2.5 rounded-xl border max-w-[90%] leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-slate-900 border-sky-500/15 text-slate-200 self-end ml-10" 
                    : "bg-slate-950 border-slate-850 text-slate-300 self-start mr-10"
                }`}
                id={`chat-msg-${i}`}
              >
                <div className="shrink-0 mt-0.5">
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-sky-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="text-[11px] whitespace-pre-wrap select-all">
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 bg-slate-950 border border-slate-850 px-3 py-2.5 rounded-xl self-start max-w-[80%]" id="loading-advisor-msg">
                <Loader2 className="w-4 h-4 text-emerald-450 animate-spin" />
                <span className="text-[10.5px] text-slate-500">老师正在编写最佳操作步骤，请稍候...</span>
              </div>
            )}
          </div>

          {/* Quick Suggestions buttons */}
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 font-sans mt-1">快速实操咨询:</span>
            {[
              "如何抓取面中心？",
              "吸涂高度和喷涂距离的区别？",
              "什么是轨迹热力图？",
              "关节奇异点如何发生和预防？"
            ].map((q) => (
              <button
                key={q}
                onClick={() => handleSendChat(q)}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] px-2 py-0.5 rounded-full text-slate-400 hover:text-slate-200 transition"
                id={`suggest-btn-${q}`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Send Area */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="向 AI 实训导师询问关于《码上建》平台、运动规划、或者砖墙示教逻辑等知识..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500/50"
              id="chat-input"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={isLoading || !chatPrompt.trim()}
              className="bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-3 flex items-center justify-center transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              id="btn-send-chat"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
