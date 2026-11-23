# 代表案例：旧输出的逐行复核

以下角色为审计依据标注，不是旧模型输入中的 snapshotRole；原模型输入没有该角色。原响应仅存解析后的JSON，HTTP字节与finish_reason无法复核。

## 1. s11-w34-q191 / NowPast
这回怎么安排呀：截至2026-11-25，星河1134班《交互系统研习11号34》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-25", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号34-2026-12-10", "classId": "星河1134班", "course": "交互系统研习11号34", "fields": ["room", "time"]}
CacheKey重建一致：True；261635a15fd1fb09ed56d9fc80e344eec3310ddfea21aac7bc606333329c7abe

金标：[{"id": "s11-w34-n3", "field": "room", "value": "H528"}, {"id": "s11-w34-n2", "field": "time", "value": "08:00–09:40"}]
直接旧链接：['s11-w34-n1']；全部祖先：['s11-w34-n1']

- E1 / s11-w34-n2 / gold-current / 虚构s11-w34普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E2 / s11-w34-n3 / gold-current / 虚构s11-w34调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起教室改至H528；替代旧安排【s11-w34-n1】。
- E3 / s11-w34-n1 / gold-ancestor / 虚构s11-w34普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起教室安排为D362。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E3"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 2. s11-w50-q44 / NowPast
同学说改过了：截至2026-11-25，星河1150班《交互系统研习11号50》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-25", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号50-2026-12-10", "classId": "星河1150班", "course": "交互系统研习11号50", "fields": ["room", "time"]}
CacheKey重建一致：True；c4b347109f6fb0f4177d34e97e398449a3c17ea19a0b66046fefa6f58839853f

金标：[{"id": "s11-w50-n3", "field": "room", "value": "C689"}, {"id": "s11-w50-n2", "field": "time", "value": "08:00–09:40"}]
直接旧链接：['s11-w50-n1']；全部祖先：['s11-w50-n1']

- E1 / s11-w50-n2 / gold-current / 虚构s11-w50普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1150班《交互系统研习11号50》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E2 / s11-w50-n3 / gold-current / 虚构s11-w50调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1150班《交互系统研习11号50》2026-12-10课程，自2026-11-01起教室改至C689；替代旧安排【s11-w50-n1】。
- E3 / s11-w50-n1 / gold-ancestor / 虚构s11-w50普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1150班《交互系统研习11号50》2026-12-10课程，自2026-11-01起教室安排为C658。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1",
      "E2",
      "E3"
    ],
    "time": [
      "E1",
      "E2",
      "E3"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E1",
    "E2"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0.3333333333333333, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 3. s23-w55-q65 / NowPast
我拿着旧截图：截至2026-11-25，星河2355班《交互系统研习23号55》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-25", "lessonDate": "2026-12-10", "activityId": "交互系统研习23号55-2026-12-10", "classId": "星河2355班", "course": "交互系统研习23号55", "fields": ["room", "time"]}
CacheKey重建一致：True；d11335d5fb734e06c051de93f67c6daec1607e81d76391259edb8fcf18ae24bf

金标：[{"id": "s23-w55-n3", "field": "room", "value": "G532"}, {"id": "s23-w55-n2", "field": "time", "value": "08:00–09:40"}]
直接旧链接：['s23-w55-n1']；全部祖先：['s23-w55-n1']

- E1 / s23-w55-n2 / gold-current / 虚构s23-w55普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河2355班《交互系统研习23号55》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E2 / s23-w55-n3 / gold-current / 虚构s23-w55调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河2355班《交互系统研习23号55》2026-12-10课程，自2026-11-01起教室改至G532；替代旧安排【s23-w55-n1】。
- E3 / s23-w55-n1 / gold-ancestor / 虚构s23-w55普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河2355班《交互系统研习23号55》2026-12-10课程，自2026-11-01起教室安排为A155。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1",
      "E2",
      "E3"
    ],
    "time": [
      "E1",
      "E2",
      "E3"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E3",
    "E3"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0.3333333333333333, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 4. s11-w41-q25 / NowPast
这回怎么安排呀：截至2026-11-27，星河1141班《交互系统研习11号41》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-27", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号41-2026-12-10", "classId": "星河1141班", "course": "交互系统研习11号41", "fields": ["room", "time"]}
CacheKey重建一致：True；861b30c3d3ad5e5b88566e4efafb58c325d1ce0417f1a7a48c6ee95b44ecd934

金标：[{"id": "s11-w41-n5", "field": "room", "value": "B707"}, {"id": "s11-w41-n4", "field": "time", "value": "10:00–11:40"}]
直接旧链接：['s11-w41-n3', 's11-w41-n2']；全部祖先：['s11-w41-n3', 's11-w41-n1', 's11-w41-n2']

- E1 / s11-w41-n5 / gold-current / 虚构s11-w41再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室改至B707；替代旧安排【s11-w41-n3】。
- E2 / s11-w41-n4 / gold-current / 虚构s11-w41调时间通知4 / 公布2026-11-26 / 导入2026-11-26 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起上课时间改至10:00–11:40；替代旧安排【s11-w41-n2】。
- E3 / s11-w41-n1 / gold-ancestor / 虚构s11-w41普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室安排为F105。
- E4 / s11-w41-n2 / gold-ancestor / 虚构s11-w41普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E5 / s11-w41-n3 / gold-ancestor / 虚构s11-w41调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室改至B168；替代旧安排【s11-w41-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E4",
      "E5"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E4",
    "E5",
    "E3"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0.5, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 5. s11-w56-q88 / NowPast
我记不清了：截至2026-11-27，星河1156班《交互系统研习11号56》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-27", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号56-2026-12-10", "classId": "星河1156班", "course": "交互系统研习11号56", "fields": ["room", "time"]}
CacheKey重建一致：True；650c7024c7c5116a7ab07aaa194b17d18b916d01dddd672b8d749af3a409df50

金标：[{"id": "s11-w56-n5", "field": "room", "value": "A870"}, {"id": "s11-w56-n4", "field": "time", "value": "10:00–11:40"}]
直接旧链接：['s11-w56-n3', 's11-w56-n2']；全部祖先：['s11-w56-n3', 's11-w56-n1', 's11-w56-n2']

- E1 / s11-w56-n5 / gold-current / 虚构s11-w56再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1156班《交互系统研习11号56》2026-12-10课程，自2026-11-01起教室改至A870；替代旧安排【s11-w56-n3】。
- E2 / s11-w56-n4 / gold-current / 虚构s11-w56调时间通知4 / 公布2026-11-26 / 导入2026-11-26 / 生效2026-11-01
  原文：星河1156班《交互系统研习11号56》2026-12-10课程，自2026-11-01起上课时间改至10:00–11:40；替代旧安排【s11-w56-n2】。
- E3 / s11-w56-n1 / gold-ancestor / 虚构s11-w56普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1156班《交互系统研习11号56》2026-12-10课程，自2026-11-01起教室安排为E304。
- E4 / s11-w56-n2 / gold-ancestor / 虚构s11-w56普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1156班《交互系统研习11号56》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E5 / s11-w56-n3 / gold-ancestor / 虚构s11-w56调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1156班《交互系统研习11号56》2026-12-10课程，自2026-11-01起教室改至A211；替代旧安排【s11-w56-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E3"
    ],
    "time": [
      "E3",
      "E2",
      "E4",
      "E5"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0.2, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 6. s23-w11-q109 / NowPast
这回怎么安排呀：截至2026-11-27，星河2311班《交互系统研习23号11》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-27", "lessonDate": "2026-12-10", "activityId": "交互系统研习23号11-2026-12-10", "classId": "星河2311班", "course": "交互系统研习23号11", "fields": ["room", "time"]}
CacheKey重建一致：True；36932b753a6e582af3803b638f7789739dfb61ea6e58ad842b04691f6a0d7fd9

金标：[{"id": "s23-w11-n5", "field": "room", "value": "C246"}, {"id": "s23-w11-n4", "field": "time", "value": "10:00–11:40"}]
直接旧链接：['s23-w11-n3', 's23-w11-n2']；全部祖先：['s23-w11-n3', 's23-w11-n1', 's23-w11-n2']

- E1 / s23-w11-n5 / gold-current / 虚构s23-w11再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河2311班《交互系统研习23号11》2026-12-10课程，自2026-11-01起教室改至C246；替代旧安排【s23-w11-n3】。
- E2 / s23-w11-n4 / gold-current / 虚构s23-w11调时间通知4 / 公布2026-11-26 / 导入2026-11-26 / 生效2026-11-01
  原文：星河2311班《交互系统研习23号11》2026-12-10课程，自2026-11-01起上课时间改至10:00–11:40；替代旧安排【s23-w11-n2】。
- E3 / s23-w11-n1 / gold-ancestor / 虚构s23-w11普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河2311班《交互系统研习23号11》2026-12-10课程，自2026-11-01起教室安排为A684。
- E4 / s23-w11-n2 / gold-ancestor / 虚构s23-w11普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河2311班《交互系统研习23号11》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E5 / s23-w11-n3 / gold-ancestor / 虚构s23-w11调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河2311班《交互系统研习23号11》2026-12-10课程，自2026-11-01起教室改至C656；替代旧安排【s23-w11-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E4",
      "E5"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E4",
    "E5",
    "E3"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0.5, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 7. s11-w44-q47 / NowPast
同学说改过了：截至2026-11-28，星河1144班《交互系统研习11号44》2026-12-10的课，在哪上？

条件：{"asOf": "2026-11-28", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号44-2026-12-10", "classId": "星河1144班", "course": "交互系统研习11号44", "fields": ["room"]}
CacheKey重建一致：True；55a1302852fa6669d95afaf3ec2d31e778d96bf62237177ff6e945848444a776

金标：[{"id": "s11-w44-n5", "field": "room", "value": "G676"}, {"id": "s11-w44-n6", "field": "room", "value": "C560"}]
直接旧链接：['s11-w44-n3']；全部祖先：['s11-w44-n3', 's11-w44-n1']

- E1 / s11-w44-n5 / gold-current / 虚构s11-w44再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室改至G676；替代旧安排【s11-w44-n3】。
- E2 / s11-w44-n6 / gold-current / 虚构s11-w44并行通知6 / 公布2026-11-28 / 导入2026-11-28 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室独立安排为C560；本安排取代原安排【s11-w44-n3】。
- E3 / s11-w44-n1 / gold-ancestor / 虚构s11-w44普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室安排为C222。
- E4 / s11-w44-n3 / gold-ancestor / 虚构s11-w44调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室改至B816；替代旧安排【s11-w44-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1",
      "E2",
      "E3",
      "E4"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E4",
    "E1"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '冲突漏方', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": false, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": false, "missingAbstention": null, "coverage": 1}

## 8. s11-w59-q110 / NowPast
这回怎么安排呀：截至2026-11-28，星河1159班《交互系统研习11号59》2026-12-10的课，在哪上？

条件：{"asOf": "2026-11-28", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号59-2026-12-10", "classId": "星河1159班", "course": "交互系统研习11号59", "fields": ["room"]}
CacheKey重建一致：True；fedfe05ebe792d294d2dc77d0801a6c07de80b0692c689c99d9c55bcd3485694

金标：[{"id": "s11-w59-n5", "field": "room", "value": "H652"}, {"id": "s11-w59-n6", "field": "room", "value": "C589"}]
直接旧链接：['s11-w59-n3']；全部祖先：['s11-w59-n3', 's11-w59-n1']

- E1 / s11-w59-n6 / gold-current / 虚构s11-w59并行通知6 / 公布2026-11-28 / 导入2026-11-28 / 生效2026-11-01
  原文：星河1159班《交互系统研习11号59》2026-12-10课程，自2026-11-01起教室独立安排为C589；本安排取代原安排【s11-w59-n3】。
- E2 / s11-w59-n5 / gold-current / 虚构s11-w59再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1159班《交互系统研习11号59》2026-12-10课程，自2026-11-01起教室改至H652；替代旧安排【s11-w59-n3】。
- E3 / s11-w59-n1 / gold-ancestor / 虚构s11-w59普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1159班《交互系统研习11号59》2026-12-10课程，自2026-11-01起教室安排为B644。
- E4 / s11-w59-n3 / gold-ancestor / 虚构s11-w59调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1159班《交互系统研习11号59》2026-12-10课程，自2026-11-01起教室改至D511；替代旧安排【s11-w59-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1",
      "E2",
      "E3",
      "E4"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E4",
    "E1"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '冲突漏方', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": false, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": false, "missingAbstention": null, "coverage": 1}

## 9. s23-w14-q131 / NowPast
同学说改过了：截至2026-11-28，星河2314班《交互系统研习23号14》2026-12-10的课，在哪上？

条件：{"asOf": "2026-11-28", "lessonDate": "2026-12-10", "activityId": "交互系统研习23号14-2026-12-10", "classId": "星河2314班", "course": "交互系统研习23号14", "fields": ["room"]}
CacheKey重建一致：True；3fbdf0cb54aabc8e1bc086ec79856596a2b0548d295642f200dc7885bc452f08

金标：[{"id": "s23-w14-n5", "field": "room", "value": "H432"}, {"id": "s23-w14-n6", "field": "room", "value": "A655"}]
直接旧链接：['s23-w14-n3']；全部祖先：['s23-w14-n3', 's23-w14-n1']

- E1 / s23-w14-n5 / gold-current / 虚构s23-w14再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河2314班《交互系统研习23号14》2026-12-10课程，自2026-11-01起教室改至H432；替代旧安排【s23-w14-n3】。
- E2 / s23-w14-n6 / gold-current / 虚构s23-w14并行通知6 / 公布2026-11-28 / 导入2026-11-28 / 生效2026-11-01
  原文：星河2314班《交互系统研习23号14》2026-12-10课程，自2026-11-01起教室独立安排为A655；本安排取代原安排【s23-w14-n3】。
- E3 / s23-w14-n1 / gold-ancestor / 虚构s23-w14普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河2314班《交互系统研习23号14》2026-12-10课程，自2026-11-01起教室安排为D501。
- E4 / s23-w14-n3 / gold-ancestor / 虚构s23-w14调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河2314班《交互系统研习23号14》2026-12-10课程，自2026-11-01起教室改至H502；替代旧安排【s23-w14-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1",
      "E2",
      "E3",
      "E4"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E4",
    "E1"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '冲突漏方', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": false, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": false, "missingAbstention": null, "coverage": 1}

## 10. s11-w34-q191 / Vector
这回怎么安排呀：截至2026-11-25，星河1134班《交互系统研习11号34》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-25", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号34-2026-12-10", "classId": "星河1134班", "course": "交互系统研习11号34", "fields": ["room", "time"]}
CacheKey重建一致：True；d83cb805a0f8c3f0972524de37e9478cabf3336ae77dbe716119c5b21e960ad4

金标：[{"id": "s11-w34-n3", "field": "room", "value": "H528"}, {"id": "s11-w34-n2", "field": "time", "value": "08:00–09:40"}]
直接旧链接：['s11-w34-n1']；全部祖先：['s11-w34-n1']

- E1 / s11-w36-n14 / other / 虚构s11-w36晚公布通知14 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1136班《交互系统研习11号36》2026-11-29课程，自2026-11-01起上课时间安排为14:00–15:40。
- E2 / s11-w52-n22 / other / 虚构s11-w52未来生效通知22 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1152班《交互系统研习11号52》2026-12-04课程，自2026-12-05起上课时间安排为13:00–14:40。
- E3 / s11-w35-n14 / other / 虚构s11-w35晚公布通知14 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1135班《交互系统研习11号35》2026-11-29课程，自2026-11-01起上课时间安排为14:00–15:40。
- E4 / s11-w33-n14 / other / 虚构s11-w33晚公布通知14 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1133班《交互系统研习11号33》2026-11-29课程，自2026-11-01起上课时间安排为14:00–15:40。
- E5 / s11-w47-n22 / other / 虚构s11-w47未来生效通知22 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1147班《交互系统研习11号47》2026-12-04课程，自2026-12-05起上课时间安排为13:00–14:40。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E3",
      "E4",
      "E5"
    ]
  },
  "previous": []
}
```
原错误：None
新审计标签：['正确证据未召回', '字段混淆', '跨范围', '旧链接选择/定义']；互斥首因：正确证据未召回
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": false, "rangeError": true, "citationPrecision": 0, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 11. s11-w34-q191 / NowPast
这回怎么安排呀：截至2026-11-25，星河1134班《交互系统研习11号34》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-25", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号34-2026-12-10", "classId": "星河1134班", "course": "交互系统研习11号34", "fields": ["room", "time"]}
CacheKey重建一致：True；261635a15fd1fb09ed56d9fc80e344eec3310ddfea21aac7bc606333329c7abe

金标：[{"id": "s11-w34-n3", "field": "room", "value": "H528"}, {"id": "s11-w34-n2", "field": "time", "value": "08:00–09:40"}]
直接旧链接：['s11-w34-n1']；全部祖先：['s11-w34-n1']

- E1 / s11-w34-n2 / gold-current / 虚构s11-w34普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E2 / s11-w34-n3 / gold-current / 虚构s11-w34调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起教室改至H528；替代旧安排【s11-w34-n1】。
- E3 / s11-w34-n1 / gold-ancestor / 虚构s11-w34普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起教室安排为D362。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E3"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 12. s11-w34-q191 / Vector-filtered
这回怎么安排呀：截至2026-11-25，星河1134班《交互系统研习11号34》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-25", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号34-2026-12-10", "classId": "星河1134班", "course": "交互系统研习11号34", "fields": ["room", "time"]}
CacheKey重建一致：True；9518deaa2018db821b9eb54b96eb2ad9928e80c65a743cdb24774257a2014a34

金标：[{"id": "s11-w34-n3", "field": "room", "value": "H528"}, {"id": "s11-w34-n2", "field": "time", "value": "08:00–09:40"}]
直接旧链接：['s11-w34-n1']；全部祖先：['s11-w34-n1']

- E1 / s11-w34-n2 / gold-current / 虚构s11-w34普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E2 / s11-w34-n1 / gold-ancestor / 虚构s11-w34普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起教室安排为D362。
- E3 / s11-w34-n3 / gold-current / 虚构s11-w34调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1134班《交互系统研习11号34》2026-12-10课程，自2026-11-01起教室改至H528；替代旧安排【s11-w34-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E3"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 13. s11-w41-q25 / Vector
这回怎么安排呀：截至2026-11-27，星河1141班《交互系统研习11号41》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-27", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号41-2026-12-10", "classId": "星河1141班", "course": "交互系统研习11号41", "fields": ["room", "time"]}
CacheKey重建一致：True；fce72ae2d6ea63cfa9e61d8ab4975ec795c370d6c931ea887aedc53bbff31277

金标：[{"id": "s11-w41-n5", "field": "room", "value": "B707"}, {"id": "s11-w41-n4", "field": "time", "value": "10:00–11:40"}]
直接旧链接：['s11-w41-n3', 's11-w41-n2']；全部祖先：['s11-w41-n3', 's11-w41-n1', 's11-w41-n2']

- E1 / s11-w52-n22 / other / 虚构s11-w52未来生效通知22 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1152班《交互系统研习11号52》2026-12-04课程，自2026-12-05起上课时间安排为13:00–14:40。
- E2 / s11-w47-n22 / other / 虚构s11-w47未来生效通知22 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1147班《交互系统研习11号47》2026-12-04课程，自2026-12-05起上课时间安排为13:00–14:40。
- E3 / s11-w36-n14 / other / 虚构s11-w36晚公布通知14 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1136班《交互系统研习11号36》2026-11-29课程，自2026-11-01起上课时间安排为14:00–15:40。
- E4 / s11-w32-n14 / other / 虚构s11-w32晚公布通知14 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1132班《交互系统研习11号32》2026-11-29课程，自2026-11-01起上课时间安排为14:00–15:40。
- E5 / s11-w20-n22 / other / 虚构s11-w20未来生效通知22 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1120班《交互系统研习11号20》2026-12-04课程，自2026-12-05起上课时间安排为13:00–14:40。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E3",
      "E4",
      "E5"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5"
  ]
}
```
原错误：None
新审计标签：['正确证据未召回', '字段混淆', '跨范围', '旧链接选择/定义']；互斥首因：正确证据未召回
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": false, "rangeError": true, "citationPrecision": 0, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 14. s11-w41-q25 / NowPast
这回怎么安排呀：截至2026-11-27，星河1141班《交互系统研习11号41》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-27", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号41-2026-12-10", "classId": "星河1141班", "course": "交互系统研习11号41", "fields": ["room", "time"]}
CacheKey重建一致：True；861b30c3d3ad5e5b88566e4efafb58c325d1ce0417f1a7a48c6ee95b44ecd934

金标：[{"id": "s11-w41-n5", "field": "room", "value": "B707"}, {"id": "s11-w41-n4", "field": "time", "value": "10:00–11:40"}]
直接旧链接：['s11-w41-n3', 's11-w41-n2']；全部祖先：['s11-w41-n3', 's11-w41-n1', 's11-w41-n2']

- E1 / s11-w41-n5 / gold-current / 虚构s11-w41再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室改至B707；替代旧安排【s11-w41-n3】。
- E2 / s11-w41-n4 / gold-current / 虚构s11-w41调时间通知4 / 公布2026-11-26 / 导入2026-11-26 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起上课时间改至10:00–11:40；替代旧安排【s11-w41-n2】。
- E3 / s11-w41-n1 / gold-ancestor / 虚构s11-w41普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室安排为F105。
- E4 / s11-w41-n2 / gold-ancestor / 虚构s11-w41普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E5 / s11-w41-n3 / gold-ancestor / 虚构s11-w41调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室改至B168；替代旧安排【s11-w41-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1"
    ],
    "time": [
      "E2",
      "E4",
      "E5"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E4",
    "E5",
    "E3"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '字段混淆', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0.5, "questionExact": false, "temporalError": true, "rangeError": true, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 1}

## 15. s11-w41-q25 / Vector-filtered
这回怎么安排呀：截至2026-11-27，星河1141班《交互系统研习11号41》2026-12-10的课，在哪上、什么时候上？

条件：{"asOf": "2026-11-27", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号41-2026-12-10", "classId": "星河1141班", "course": "交互系统研习11号41", "fields": ["room", "time"]}
CacheKey重建一致：True；3e37abb6e47404ac8397c0f5a524bf61ac13b4b1a73641751f5f3c02bec777d9

金标：[{"id": "s11-w41-n5", "field": "room", "value": "B707"}, {"id": "s11-w41-n4", "field": "time", "value": "10:00–11:40"}]
直接旧链接：['s11-w41-n3', 's11-w41-n2']；全部祖先：['s11-w41-n3', 's11-w41-n1', 's11-w41-n2']

- E1 / s11-w41-n2 / gold-ancestor / 虚构s11-w41普通通知2 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起上课时间安排为08:00–09:40。
- E2 / s11-w41-n1 / gold-ancestor / 虚构s11-w41普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室安排为F105。
- E3 / s11-w41-n4 / gold-current / 虚构s11-w41调时间通知4 / 公布2026-11-26 / 导入2026-11-26 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起上课时间改至10:00–11:40；替代旧安排【s11-w41-n2】。
- E4 / s11-w41-n3 / gold-ancestor / 虚构s11-w41调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室改至B168；替代旧安排【s11-w41-n1】。
- E5 / s11-w41-n5 / gold-current / 虚构s11-w41再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1141班《交互系统研习11号41》2026-12-10课程，自2026-11-01起教室改至B707；替代旧安排【s11-w41-n3】。

原始解析输出：
```json
null
```
原错误：The operation was aborted due to timeout
新审计标签：['运行失败/结构错误']；互斥首因：运行失败/结构错误
新指标：{"runtimeFailure": true, "fieldExact": 0, "questionExact": false, "temporalError": null, "rangeError": null, "citationPrecision": null, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 0}

## 16. s11-w44-q47 / Vector
同学说改过了：截至2026-11-28，星河1144班《交互系统研习11号44》2026-12-10的课，在哪上？

条件：{"asOf": "2026-11-28", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号44-2026-12-10", "classId": "星河1144班", "course": "交互系统研习11号44", "fields": ["room"]}
CacheKey重建一致：True；08c4505e72d211ead8ed64da37ef80460eda1ebc80aaa0d37043344e6fa4190a

金标：[{"id": "s11-w44-n5", "field": "room", "value": "G676"}, {"id": "s11-w44-n6", "field": "room", "value": "C560"}]
直接旧链接：['s11-w44-n3']；全部祖先：['s11-w44-n3', 's11-w44-n1']

- E1 / s11-w47-n22 / other / 虚构s11-w47未来生效通知22 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1147班《交互系统研习11号47》2026-12-04课程，自2026-12-05起上课时间安排为13:00–14:40。
- E2 / s11-w46-n24 / other / 虚构s11-w46已公布未来课通知24 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1146班《交互系统研习11号46》2026-12-06课程，自2026-12-05起教室改至D898；替代旧安排【s11-w46-n23】。
- E3 / s11-w47-n3 / other / 虚构s11-w47调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1147班《交互系统研习11号47》2026-12-10课程，自2026-11-01起教室改至F195；替代旧安排【s11-w47-n1】。
- E4 / s11-w45-n24 / other / 虚构s11-w45已公布未来课通知24 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-12-05
  原文：星河1145班《交互系统研习11号45》2026-12-06课程，自2026-12-05起教室改至F688；替代旧安排【s11-w45-n23】。
- E5 / s11-w36-n14 / other / 虚构s11-w36晚公布通知14 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1136班《交互系统研习11号36》2026-11-29课程，自2026-11-01起上课时间安排为14:00–15:40。

原始解析输出：
```json
null
```
原错误：The operation was aborted due to timeout
新审计标签：['运行失败/结构错误', '正确证据未召回']；互斥首因：运行失败/结构错误
新指标：{"runtimeFailure": true, "fieldExact": 0, "questionExact": false, "temporalError": null, "rangeError": null, "citationPrecision": null, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": null, "missingAbstention": null, "coverage": 0}

## 17. s11-w44-q47 / NowPast
同学说改过了：截至2026-11-28，星河1144班《交互系统研习11号44》2026-12-10的课，在哪上？

条件：{"asOf": "2026-11-28", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号44-2026-12-10", "classId": "星河1144班", "course": "交互系统研习11号44", "fields": ["room"]}
CacheKey重建一致：True；55a1302852fa6669d95afaf3ec2d31e778d96bf62237177ff6e945848444a776

金标：[{"id": "s11-w44-n5", "field": "room", "value": "G676"}, {"id": "s11-w44-n6", "field": "room", "value": "C560"}]
直接旧链接：['s11-w44-n3']；全部祖先：['s11-w44-n3', 's11-w44-n1']

- E1 / s11-w44-n5 / gold-current / 虚构s11-w44再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室改至G676；替代旧安排【s11-w44-n3】。
- E2 / s11-w44-n6 / gold-current / 虚构s11-w44并行通知6 / 公布2026-11-28 / 导入2026-11-28 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室独立安排为C560；本安排取代原安排【s11-w44-n3】。
- E3 / s11-w44-n1 / gold-ancestor / 虚构s11-w44普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室安排为C222。
- E4 / s11-w44-n3 / gold-ancestor / 虚构s11-w44调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室改至B816；替代旧安排【s11-w44-n1】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1",
      "E2",
      "E3",
      "E4"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E4",
    "E1"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '冲突漏方', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": false, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": false, "missingAbstention": null, "coverage": 1}

## 18. s11-w44-q47 / Vector-filtered
同学说改过了：截至2026-11-28，星河1144班《交互系统研习11号44》2026-12-10的课，在哪上？

条件：{"asOf": "2026-11-28", "lessonDate": "2026-12-10", "activityId": "交互系统研习11号44-2026-12-10", "classId": "星河1144班", "course": "交互系统研习11号44", "fields": ["room"]}
CacheKey重建一致：True；732ef1a167af2a56618d038ba8312ecea35df403350ae038559ed3f884b85d92

金标：[{"id": "s11-w44-n5", "field": "room", "value": "G676"}, {"id": "s11-w44-n6", "field": "room", "value": "C560"}]
直接旧链接：['s11-w44-n3']；全部祖先：['s11-w44-n3', 's11-w44-n1']

- E1 / s11-w44-n3 / gold-ancestor / 虚构s11-w44调教室通知3 / 公布2026-11-25 / 导入2026-11-25 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室改至B816；替代旧安排【s11-w44-n1】。
- E2 / s11-w44-n1 / gold-ancestor / 虚构s11-w44普通通知1 / 公布2026-11-01 / 导入2026-11-01 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室安排为C222。
- E3 / s11-w44-n6 / gold-current / 虚构s11-w44并行通知6 / 公布2026-11-28 / 导入2026-11-28 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室独立安排为C560；本安排取代原安排【s11-w44-n3】。
- E4 / s11-w44-n5 / gold-current / 虚构s11-w44再次换室通知5 / 公布2026-11-27 / 导入2026-11-27 / 生效2026-11-01
  原文：星河1144班《交互系统研习11号44》2026-12-10课程，自2026-11-01起教室改至G676；替代旧安排【s11-w44-n3】。

原始解析输出：
```json
{
  "answers": {
    "room": [
      "E1",
      "E2",
      "E3",
      "E4"
    ]
  },
  "previous": [
    "E1",
    "E2",
    "E3",
    "E4",
    "E1"
  ]
}
```
原错误：None
新审计标签：['旧值作为当前', '冲突漏方', '旧链接选择/定义']；互斥首因：旧值作为当前
新指标：{"runtimeFailure": false, "fieldExact": 0, "questionExact": false, "temporalError": true, "rangeError": false, "citationPrecision": 0.5, "directLinkExact": 0, "transitiveLinkExact": 0, "oldLinkNonempty": true, "conflictRetention": false, "missingAbstention": null, "coverage": 1}
