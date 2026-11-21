# Issue #12 · PR #10 运行评审修复

修复前引擎对应远端 `74e45fc`。修复后本地受验提交为 `8688583`，GitHub 交付提交以 PR 中的 SHA 为准，二者通过报告的 source.files 和 source.sourceDigest 核对运行源码。以下均由 answer 正常入口实际运行，完整输出保存在 validation/review-before.json 和 review-after.json。

## B组11/14-11/15的验收地点有变化吗？

修复前

```json
{
  "date": "2026-11-14",
  "status": "conflict",
  "summary": "B组 · 验收地点：仍有互不相容的有效记载：工程楼 305 [R21]；科学楼 108 [R22]。现有材料无法裁定，请向课程组确认。 沿明确替代关系回查，旧记录为：理工楼 204 [M03]。",
  "sections": [
    {
      "topic": "验收地点",
      "status": "conflict",
      "evidence": [
        {
          "id": "R21",
          "role": "冲突依据"
        },
        {
          "id": "R22",
          "role": "冲突依据"
        },
        {
          "id": "M03",
          "role": "已被替代"
        }
      ]
    }
  ]
}
```

修复后

```json
{
  "date": "2026-11-15",
  "status": "compare",
  "summary": "B组 · 验收地点：2026-11-14：工程楼 305 [R21]；科学楼 108 [R22]。2026-11-15：科学楼 108 [R30]。前一日的材料互相冲突。",
  "sections": [
    {
      "topic": "验收地点",
      "status": "compare",
      "evidence": [
        {
          "id": "R21",
          "role": "前一日期"
        },
        {
          "id": "R22",
          "role": "前一日期"
        },
        {
          "id": "R30",
          "role": "后一日期"
        }
      ]
    }
  ]
}
```

## B组11月8日至12日的融合方式有变化吗？

修复前

```json
{
  "date": "2026-11-08",
  "status": "ok",
  "summary": "B组 · 融合方式：使用 Hadamard 逐元素乘积 [F01]。 未找到该范围内明确的旧版本关系。 已公布待生效：2026-11-10 起，拼接 Past 与 Now 后做线性投影 [B13]。",
  "sections": [
    {
      "topic": "融合方式",
      "status": "ok",
      "evidence": [
        {
          "id": "F01",
          "role": "当前依据"
        },
        {
          "id": "B13",
          "role": "已公布待生效"
        }
      ]
    }
  ]
}
```

修复后

```json
{
  "date": "2026-11-12",
  "status": "compare",
  "summary": "B组 · 融合方式：2026-11-08：使用 Hadamard 逐元素乘积 [F01]。2026-11-12：拼接 Past 与 Now 后做线性投影 [B13]。",
  "sections": [
    {
      "topic": "融合方式",
      "status": "compare",
      "evidence": [
        {
          "id": "F01",
          "role": "前一日期"
        },
        {
          "id": "B13",
          "role": "后一日期"
        }
      ]
    }
  ]
}
```

## B组融合方式和设备费用各是什么？

修复前

```json
{
  "date": "2026-11-20",
  "status": "ok",
  "summary": "B组 · 融合方式：拼接 Past 与 Now 后做线性投影 [B13]。",
  "sections": [
    {
      "topic": "融合方式",
      "status": "ok",
      "evidence": [
        {
          "id": "B13",
          "role": "当前依据"
        },
        {
          "id": "F01",
          "role": "已被替代"
        }
      ]
    }
  ]
}
```

修复后

```json
{
  "date": "2026-11-20",
  "status": "unknown",
  "summary": "B组 · 融合方式：拼接 Past 与 Now 后做线性投影 [B13]。\nB组 · 待补证的问题：“设备费用各是什么”缺少直接回答该事项的资料。",
  "sections": [
    {
      "topic": "融合方式",
      "status": "ok",
      "evidence": [
        {
          "id": "B13",
          "role": "当前依据"
        },
        {
          "id": "F01",
          "role": "已被替代"
        }
      ]
    },
    {
      "topic": "待补证的问题",
      "status": "unknown",
      "evidence": []
    }
  ]
}
```

## B组用什么融合方式，设备费用是多少？

修复前

```json
{
  "date": "2026-11-20",
  "status": "unknown",
  "summary": "B组 · 融合方式：拼接 Past 与 Now 后做线性投影 [B13]。\nB组 · 待补证的问题：“设备费用是多少”缺少直接回答该事项的资料。",
  "sections": [
    {
      "topic": "融合方式",
      "status": "ok",
      "evidence": [
        {
          "id": "B13",
          "role": "当前依据"
        },
        {
          "id": "F01",
          "role": "已被替代"
        }
      ]
    },
    {
      "topic": "待补证的问题",
      "status": "unknown",
      "evidence": []
    }
  ]
}
```

修复后

```json
{
  "date": "2026-11-20",
  "status": "unknown",
  "summary": "B组 · 融合方式：拼接 Past 与 Now 后做线性投影 [B13]。\nB组 · 待补证的问题：“设备费用是多少”缺少直接回答该事项的资料。",
  "sections": [
    {
      "topic": "融合方式",
      "status": "ok",
      "evidence": [
        {
          "id": "B13",
          "role": "当前依据"
        },
        {
          "id": "F01",
          "role": "已被替代"
        }
      ]
    },
    {
      "topic": "待补证的问题",
      "status": "unknown",
      "evidence": []
    }
  ]
}
```

## B组使用融合方式需要多少元？

修复前

```json
{
  "date": "2026-11-20",
  "status": "ok",
  "summary": "B组 · 融合方式：拼接 Past 与 Now 后做线性投影 [B13]。",
  "sections": [
    {
      "topic": "融合方式",
      "status": "ok",
      "evidence": [
        {
          "id": "B13",
          "role": "当前依据"
        },
        {
          "id": "F01",
          "role": "已被替代"
        }
      ]
    }
  ]
}
```

修复后

```json
{
  "date": "2026-11-20",
  "status": "unknown",
  "summary": "未找到能回答此问题的依据。可在资料库核查已有条款，或补充原文。",
  "sections": []
}
```

## 验收与来源

新增 5 组回归首次运行 1/5 通过，修复后 5/5 通过，合计开发回归 18/18。另有一条自编 20 元费用通知作为金额正例。冻结题 38/38、GNP 证据角色 9/9、研究来源 4/4、原有行为 22/22 分列在完整验收报告。

`node service/verify-delivery.mjs --ref HEAD` 从提交导出源码，报告 source.mode=commit、source.commit、文件散列、源码集合摘要、运行命令和服务/模型输入。默认工作区模式明确记录 dirty、状态和补丁摘要，补丁输出到 validation/delivery-source.patch。已有模型时加 --model。
