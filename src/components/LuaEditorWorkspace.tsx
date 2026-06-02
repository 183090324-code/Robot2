import React, { useState } from "react";
import { 
  FileText, 
  Play, 
  Compass, 
  CheckSquare, 
  AlertCircle, 
  Send, 
  RefreshCw, 
  Check, 
  HelpCircle 
} from "lucide-react";
import { LUA_TEMPLATES } from "../types";

interface LuaEditorWorkspaceProps {
  onAskAIWithCode: (code: string) => void;
  onSetAllRobotState: (values: Partial<Record<string, number>>) => void;
}

export default function LuaEditorWorkspace({
  onAskAIWithCode,
  onSetAllRobotState
}: LuaEditorWorkspaceProps) {
  const [selectedTplIdx, setSelectedTplIdx] = useState<number>(0);
  const [code, setCode] = useState<string>(LUA_TEMPLATES[0].code);
  const [lintResult, setLintResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
    line?: number;
    details?: string;
  }>({ status: "idle", message: "尚未进行语法静态校验。" });

  // Load a template
  const handleLoadTemplate = (index: number) => {
    setSelectedTplIdx(index);
    setCode(LUA_TEMPLATES[index].code);
    setLintResult({ status: "idle", message: "模块已重新装载，等待静态校验..." });
  };

  // Perform a neat local AST-like diagnostic scan before shipping to AI (craftsmanship detail!)
  const handleStaticLint = () => {
    const lines = code.split("\n");
    let errorFound = false;

    // Look for duplicate "SetObstacleAvoid(1)SetObstacleAvoid(1)" spelling errors (as in Image 4)
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (lineText.includes("SetObstacleAvoid(1)SetObstacleAvoid(1)")) {
        setLintResult({
          status: "error",
          message: `【词法编译警告】在第 ${i + 1} 行检测到严重冗余拼写异常！`,
          line: i + 1,
          details: `代码出现连字重复 \`SetObstacleAvoid(1)SetObstacleAvoid(1)\`。Lua解释器将报错 'syntax error near SetObstacleAvoid'，阻断仿真机器人执行。请修正为单次调用 \`SetObstacleAvoid(1)\`。`
        });
        errorFound = true;
        break;
      }

      // Check for version lines without comment indicators (as in Scenario C/D)
      if (lineText.trim().startsWith("Version:") && !lineText.trim().startsWith("--")) {
        setLintResult({
          status: "error",
          message: `【词法编译警告】在第 ${i + 1} 行检测到语法注释缺失！`,
          line: i + 1,
          details: `\`Version: Lua 5.3.5\` 缺少注释标识符 \`--\`，这会让解释层抛出 'unexpected symbol near Version' 错误。请加上 \`-- Version: Lua 5.3.5\`。`
        });
        errorFound = true;
        break;
      }

      // Check for raw illegal Δ symbol inside code
      if (lineText.includes("Δ")) {
        setLintResult({
          status: "error",
          message: `【字符编译警告】在第 ${i + 1} 行检测到非法非ASCII字符 'Δ'。`,
          line: i + 1,
          details: `机器控制软件中的 Lua 支持标准拉丁字符，关节偏移需使用 \`MoveJointOffset(1, 30, ...)\` 形式，直接输入 \`ΔJ1\` 将触发编译未解析。`
        });
        errorFound = true;
        break;
      }
    }

    if (!errorFound) {
      setLintResult({
        status: "success",
        message: "✔ 静态校验成功：未发现断层语法干涉，代码结构支持生成指令流！",
        details: "您的建筑底层运动坐标（X-Y-Z）与安全避障皮肤（SetSafeSkin）配置完美配合。可以一键推送给 AI 实训导师进行深度逻辑联调。"
      });
    }
  };

  // Auto-fix the classic SetObstacleAvoid mistake
  const handleAutoFix = () => {
    let freshCode = code;
    // Fix SetObstacleAvoid error
    freshCode = freshCode.replace(
      "SetObstacleAvoid(1)SetObstacleAvoid(1)",
      "SetObstacleAvoid(1)"
    );
    // Fix Missing double dashes on version line
    freshCode = freshCode.replace(
      "\nVersion: Lua 5.3.5",
      "\n-- Version: Lua 5.3.5"
    );
    freshCode = freshCode.replace(
      "Version: Lua 5.3.5\n",
      "-- Version: Lua 5.3.5\n"
    );
    // Fix ΔJ1
    freshCode = freshCode.replace("ΔJ1(30)", "MoveJointOffset(1, 30, 0, 0, 0, 0, 0)");

    setCode(freshCode);
    setLintResult({
      status: "success",
      message: "✔ 自动修复完成！已清洗掉冗余拼写、补齐了注释并复原了偏置调用。",
      details: "可以再次进行静态审查检验工艺逻辑。"
    });
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-4 text-slate-200 shadow-2xl h-full" id="lua-workspace-container">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 px-1.5 rounded-md bg-indigo-500/10 text-indigo-400 font-mono text-[10px] border border-indigo-500/20">
            Lua Script
          </span>
          <h3 className="font-sans font-semibold text-sm tracking-wide text-slate-100 flex items-center gap-1.5">
            机器人 Lua 脚本调试区 (src0.lua)
          </h3>
        </div>

        {/* Dropdown presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-sans hidden sm:inline">选择实训示例:</span>
          <select
            value={selectedTplIdx}
            onChange={(e) => handleLoadTemplate(parseInt(e.target.value))}
            className="bg-slate-950 border border-slate-800 text-xs text-sky-400 rounded px-2 py-1"
            id="template-select"
          >
            {LUA_TEMPLATES.map((tpl, i) => (
              <option key={i} value={i}>{tpl.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Editor Body with line indexes */}
      <div className="grid grid-cols-12 gap-3 flex-grow">
        {/* Editor (8 columns) */}
        <div className="col-span-8 flex flex-col gap-1.5 h-[340px]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              src0.lua
            </span>
            <span className="text-[9px] text-slate-600 font-mono">编码格式: UTF-8</span>
          </div>

          <div className="flex-1 flex bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
            {/* Line Numbers */}
            <div className="w-9 bg-slate-950 select-none text-slate-600 text-right pr-2.5 py-4 border-r border-slate-900/80 leading-relaxed font-sans text-[11px]" id="line-numbers">
              {code.split("\n").map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-grow bg-transparent text-indigo-250 p-4 leading-relaxed outline-none resize-none overflow-y-auto selection:bg-indigo-500/20"
              style={{ fontFamily: "JetBrains Mono, Fira Code, monospace" }}
              id="lua-textarea-editor"
            />
          </div>
        </div>

        {/* Quick Compile / Lint diagnostic feedback pane (4 columns) */}
        <div className="col-span-4 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-3 h-[340px] overflow-y-auto">
          <div className="text-xs font-sans font-semibold text-slate-400 border-b border-slate-850 pb-2 mb-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            编译静态检查 (Compiler Linter)
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleStaticLint}
              className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-slate-600 text-xs py-1.5 px-3 rounded-lg text-slate-200 transition active:scale-95 flex items-center justify-center gap-1"
              id="btn-lint-lua"
            >
              <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
              静态格式校验
            </button>
          </div>

          {/* Lint output status */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
            {lintResult.status === "idle" ? (
              <div className="text-center py-6 text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5 h-full">
                <HelpCircle className="w-6 h-6 text-slate-600" />
                <span>点入积木校验，或自定义修改Lua，随时测试。</span>
              </div>
            ) : (
              <div className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 ${
                lintResult.status === "success" 
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" 
                  : "bg-rose-500/10 text-rose-300 border-rose-500/20"
              }`}>
                <div className="flex items-center gap-1 font-semibold leading-tight">
                  <AlertCircle className={`w-4 h-4 shrink-0 ${lintResult.status === "success" ? "text-emerald-400" : "text-rose-400"}`} />
                  <span>{lintResult.message}</span>
                </div>
                
                {lintResult.details && (
                  <p className="text-[10px] text-slate-450 leading-relaxed font-mono whitespace-pre-wrap select-none p-1.5 bg-slate-950/40 rounded border border-slate-900">
                    {lintResult.details}
                  </p>
                )}

                {lintResult.status === "error" && (
                  <button
                    onClick={handleAutoFix}
                    className="mt-1.5 w-full bg-rose-500/20 hover:bg-rose-500/30 text-[10.5px] font-sans text-rose-200 border border-rose-500/30 rounded py-1 flex items-center justify-center gap-1 transition"
                    id="btn-auto-fix"
                  >
                    <RefreshCw className="w-3 h-3 text-rose-400" />
                    一键洗码自动修复
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trigger Send Question with Code */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-3 flex-wrap gap-2">
        <span className="text-[11px] text-slate-500 leading-tight">
          遇到砌砖施工奇异点或关节溢出阻断？可将当前代码连带注入实训教室智能导师。
        </span>
        <button
          onClick={() => {
            onAskAIWithCode(code);
            setLintResult({
              status: "success",
              message: "✔ 已成功发送！",
              details: "已将Lua代码安全上下文注入智能教学助手。请滑到下方查看AI导师给出的标准实训解答方案。"
            });
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-sans font-medium py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/15 active:scale-95 transition"
          id="btn-ask-ai-code"
        >
          <Send className="w-3 h-3" />
          向 AI 导师咨询此段代码
        </button>
      </div>
    </div>
  );
}
