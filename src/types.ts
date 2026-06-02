export interface SavedPoint {
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
  timestamp: string;
}

export type CoordinateSystem = "user" | "tool";
export type ControlMode = "step" | "continuous"; // 寸动 or 点动

export interface BlocklyBlock {
  id: string;
  type: "start" | "repeat" | "move_joint" | "move_linear_relative" | "joint_offset" | "set_skin" | "io_output" | "wait";
  params: {
    loopCount?: number;
    targetPoint?: string;
    dx?: number;
    dy?: number;
    dz?: number;
    dj1?: number;
    dj2?: number;
    dj3?: number;
    dj4?: number;
    dj5?: number;
    dj6?: number;
    skinOn?: boolean;
    ioPort?: number;
    ioVal?: number;
    waitSec?: number;
  };
}

export interface PresetScenario {
  id: string;
  name: string;
  description: string;
  screenshotKey: "scenario_main_menu" | "scenario_blockly_char" | "scenario_blockly_motion" | "scenario_lua_error";
  imageLabel: string;
  hint: string;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: "main_menu",
    name: "主菜单：进入脚本编程工程引导",
    description: "如何在平台主页找回已删除或新建砌筑/喷涂脚本仿真项目",
    screenshotKey: "scenario_main_menu",
    imageLabel: "【Dobot系统主界面 欢迎来到桌面】",
    hint: "点击进入‘脚本编程’红色引导框"
  },
  {
    id: "blockly_state",
    name: "示教器：末端位姿与零位校准读取",
    description: "提取J1-J6零点或Y、Z偏置数值，分析点动与步长微调",
    screenshotKey: "scenario_blockly_char",
    imageLabel: "【Blockly图形编程 - 字符与示教面板】",
    hint: "查看右下角示教器 J1-J6=0, Z=1050.5, Y=-247.5"
  },
  {
    id: "blockly_motion",
    name: "运动逻辑：相对直线步进拼装问题",
    description: "重复弓字形施工作业拼块报错，相对位移Δx叠加机制诊断",
    screenshotKey: "scenario_blockly_motion",
    imageLabel: "【运动积木块组装 - 相对直线运动Δx配置】",
    hint: "积木重复执行中的相对运动步径设置"
  },
  {
    id: "lua_error",
    name: "Lua异常：安全避障 SetSafeSkin 词法编译错误",
    description: "代码第四行连打崩溃：SetObstacleAvoid(1)SetObstacleAvoid(1)",
    screenshotKey: "scenario_lua_error",
    imageLabel: "【脚本编程 src0.lua 错误行高亮】",
    hint: "第四行安全避障开关函数发生重复打字错误"
  }
];

export const LUA_TEMPLATES = [
  {
    name: "1. 砌筑施工 - 底座循环平铺",
    code: `-- 码上建：砌筑循环平铺Lua底稿
-- 初始速度与平滑配置
AccelS(30)
SetCollisionLevel(3)
SetSafeSkin(1)
SetObstacleAvoid(1)

-- 移动机器人返回初始安全位姿
MoveJoint(InitialPose)

-- 开始筑墙，采用增量定位
local startX = 0
local startY = -247.52
local startZ = 1050.50

for i = 1, 5 do
  -- 每块砖相对位移 120mm
  local xOffset = (i - 1) * 120
  local targetX = startX + xOffset
  
  -- 示教点直线移动
  MoveLinearRelative(0, 0, 50) -- 抬升3D刀头至吸涂高度
  SetDigitalOut(1, 1) -- 开启建筑吸盘
  Wait(1.0)
  
  MoveLinearRelative(xOffset, 0, -50) -- 到达落砖高度
  SetDigitalOut(1, 0) -- 释放
  Wait(0.5)
end

MoveJoint(InitialPose)
`
  },
  {
    name: "2. 喷涂作业 - 弓字轨迹生成",
    code: `-- 码上建：高耸混凝土面喷涂施工轨迹
-- 工艺参数：喷嘴靶距 350mm
AccelS(50)
SetSafeSkin(1)

local startY = -247.52
local startZ = 1050.50

MoveJoint(InitialPose)

for row = 1, 3 do
  -- Z轴高度依次递增进行弓字往复
  local currentZ = startZ + (row - 1) * 100
  
  -- 正向喷涂一排
  MoveLinearRelative(250, 0, (row - 1) * 100)
  SetDigitalOut(2, 1) -- 开启喷嘴(呈现绿色渐变热力轨迹)
  Wait(2.0)
  
  -- 换行上提
  SetDigitalOut(2, 0)
  MoveLinearRelative(0, 0, 100)
  
  -- 逆向喷涂
  SetDigitalOut(2, 1)
  MoveLinearRelative(-250, 0, 0)
  SetDigitalOut(2, 0)
end

MoveJoint(InitialPose)
`
  },
  {
    name: "3. 复杂异常案例 - 包含安全避障错误 (用于练习排错)",
    code: `-- 错误示例：Lua 脚本编辑现场练习稿
Version: Lua 5.3.5 -- 缺少注释前缀!
AccelS(20)
SetSafeSkin(1)
SetObstacleAvoid(1)SetObstacleAvoid(1) -- [拼写拼合连打错误!]

-- 尝试在未返回初始姿态下使用高速关节偏移
ΔJ1(30) -- 命名格式非法，应使用关节偏置块
`
  }
];
