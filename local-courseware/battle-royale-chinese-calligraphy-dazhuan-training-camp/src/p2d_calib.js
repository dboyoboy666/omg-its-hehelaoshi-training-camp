/* =====================================================================
   p2d_calib.js —— 【真机校准产物】由 tools/calibrate.js 生成于 10/6/2026, 11:54:25 AM
   证据：/tmp/dg/calib.json（真实 Chrome file:// 探针，勿手改）
   · L/N：bronze 字形骨架实测（描红判定与限时模型 timeOf 的数据源）
   · lv：规则 C=L+80×(N-1)（rule）
   · TRACE_POOL：自洽分≥95 且 4px 偏移分≥90 的字才进描红池（排除 0 字）
   · SIMILAR：全对 mask IoU Top-3（辨铭出题依据）
   ===================================================================== */
const CHARS = ["一","二","三","上","下","十","口","刀","弓","土","小","中","石","王","日","子","八","七","木","目","耳","手","心","田","水","山","立","贝","从","好","林","明","家","鸟","鱼"];
Object.assign(DZINFO["一"], {L:379,N:3,lv:1,self:100});
Object.assign(DZINFO["二"], {L:589,N:2,lv:1,self:100});
Object.assign(DZINFO["三"], {L:856,N:6,lv:2,self:100});
Object.assign(DZINFO["上"], {L:795,N:3,lv:1,self:100});
Object.assign(DZINFO["下"], {L:593,N:2,lv:1,self:100});
Object.assign(DZINFO["十"], {L:322,N:1,lv:1,self:100});
Object.assign(DZINFO["口"], {L:1231,N:5,lv:2,self:100});
Object.assign(DZINFO["刀"], {L:614,N:3,lv:1,self:100});
Object.assign(DZINFO["弓"], {L:737,N:2,lv:1,self:100});
Object.assign(DZINFO["土"], {L:642,N:3,lv:1,self:100});
Object.assign(DZINFO["小"], {L:268,N:3,lv:1,self:100});
Object.assign(DZINFO["中"], {L:1277,N:8,lv:2,self:100});
Object.assign(DZINFO["石"], {L:1103,N:3,lv:1,self:100});
Object.assign(DZINFO["王"], {L:1285,N:5,lv:2,self:100});
Object.assign(DZINFO["日"], {L:911,N:5,lv:2,self:100});
Object.assign(DZINFO["子"], {L:660,N:2,lv:1,self:100});
Object.assign(DZINFO["八"], {L:791,N:4,lv:1,self:100});
Object.assign(DZINFO["七"], {L:602,N:3,lv:1,self:100});
Object.assign(DZINFO["木"], {L:660,N:5,lv:1,self:100});
Object.assign(DZINFO["目"], {L:1041,N:7,lv:2,self:100});
Object.assign(DZINFO["耳"], {L:1154,N:5,lv:2,self:100});
Object.assign(DZINFO["手"], {L:768,N:7,lv:2,self:100});
Object.assign(DZINFO["心"], {L:861,N:4,lv:2,self:100});
Object.assign(DZINFO["田"], {L:1464,N:5,lv:2,self:100});
Object.assign(DZINFO["水"], {L:676,N:5,lv:1,self:100});
Object.assign(DZINFO["山"], {L:891,N:2,lv:1,self:100});
Object.assign(DZINFO["立"], {L:1172,N:6,lv:2,self:100});
Object.assign(DZINFO["贝"], {L:1468,N:9,lv:3,self:100});
Object.assign(DZINFO["从"], {L:931,N:5,lv:2,self:100});
Object.assign(DZINFO["好"], {L:1370,N:8,lv:3,self:100});
Object.assign(DZINFO["林"], {L:1194,N:9,lv:2,self:100});
Object.assign(DZINFO["明"], {L:1309,N:7,lv:2,self:100});
Object.assign(DZINFO["家"], {L:1435,N:9,lv:3,self:100});
Object.assign(DZINFO["鸟"], {L:1019,N:5,lv:2,self:100});
Object.assign(DZINFO["鱼"], {L:1508,N:14,lv:3,self:100});
const SIMILAR = {"一":["七","口","明"],"二":["下","上","日"],"三":["上","田","鸟"],"上":["田","日","鸟"],"下":["二","鸟","贝"],"十":["七","土","木"],"口":["田","山","日"],"刀":["木","土","十"],"弓":["子","刀","手"],"土":["十","王","七"],"小":["十","七","木"],"中":["鱼","子","心"],"石":["田","上","子"],"王":["土","田","七"],"日":["上","口","山"],"子":["手","弓","耳"],"八":["从","林","家"],"七":["十","土","王"],"木":["刀","十","七"],"目":["子","弓","刀"],"耳":["子","心","土"],"手":["子","弓","刀"],"心":["鱼","从","耳"],"田":["口","家","土"],"水":["七","十","土"],"山":["土","田","口"],"立":["土","田","水"],"贝":["田","家","口"],"从":["田","心","家"],"好":["从","贝","口"],"林":["家","八","上"],"明":["日","二","石"],"家":["田","贝","上"],"鸟":["上","家","田"],"鱼":["心","中","上"]};
const TRACE_POOL = ["一","二","三","上","下","十","口","刀","弓","土","小","中","石","王","日","子","八","七","木","目","耳","手","心","田","水","山","立","贝","从","好","林","明","家","鸟","鱼"];
