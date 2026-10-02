# Learner Assessment Report Contracts

สถานะ: Contract สำหรับรายงานผู้เรียน Version 1.0
ขอบเขต: รายงานผลตรวจความพร้อม จุดแข็ง และข้อจำกัดพร้อมแนวทางพัฒนา

## Authority

- Backend เป็นเจ้าของผลตรวจเกณฑ์ สถานะความพร้อม คะแนน ขอบเขตเวลา Availability และ Evidence labels
- LLM อธิบายผลตรวจ วิเคราะห์จุดแข็ง/ข้อจำกัด และแนะนำการพัฒนาจากหลักฐานที่ Backend ส่งให้
- Finding ทุกข้อมีเหตุผลไทย/อังกฤษและ Evidence References อย่างน้อยหนึ่งรายการ
- รายงานไม่ใช่การอนุมัติสิทธิ์ไปสหกิจ

## Scope Identity

Learner report key คือ `enrollment_curriculum_id + semester` โดย Backend resolve จาก authenticated user เท่านั้น ไม่รับ learner/enrollment identity จาก request body ตัวตนของ Job ต้องเชื่อมกับ scope เดียวกันและตรวจ ownership ซ้ำทุกครั้งที่อ่าน

ภาคเรียนรองรับ `1` และ `2`; target academic year คำนวณจาก entry year ตาม CooperativeReadiness เดิม รายงานวิชาใช้ข้อมูลก่อนเทอมที่เลือก รวม Summer กิจกรรมใช้ข้อมูลล่าสุดทั้งหมดและ Snapshot แสดงเวลาที่รวบรวม

## Generation State

`generation_state` แยกจากความครบข้อมูล (`completeness`):

| State | ความหมาย |
|---|---|
| `current` | รายงานล่าสุดตรงกับ Source Hash ปัจจุบัน |
| `missing` | ยังไม่มีรายงานและยังไม่มีงานสร้าง |
| `queued` | รับงานแล้ว รอ Worker |
| `generating` | Worker กำลังสร้าง |
| `failed` | งานจบด้วยข้อผิดพลาดที่แสดงแก่ผู้ใช้และลองใหม่ได้ตามเวลา |
| `insufficient_data` | ไม่มี Evidence ใช้วิเคราะห์ จึงไม่ส่งงานให้ Provider |
| `context_exceeded` | หลังสรุป Evidence ตามกฎแล้ว Input ยังเกิน Context ที่ตั้งค่า จึงไม่เรียก Provider |

`completeness` เป็น `full` หรือ `partial` สำหรับรายงานที่สำเร็จเท่านั้น สถานะ Readiness เช่น ready/not_ready/not_configured มาจาก Backend เดิมและไม่เปลี่ยนตาม LLM

## Learner API

Base path: `/api/v1`.

- `GET /learner/assessment-report?semester={1|2}` อ่านรายงานปัจจุบัน สถานะ Availability และสถานะ Job เท่านั้น ไม่สร้างงาน
- `POST /learner/assessment-report/generate` ขอสร้างเมื่อไม่มี/ล้าสมัย หรือ force ด้วยการกดของผู้เรียน
- `GET /learner/assessment-report/jobs/{job_id}` อ่านสถานะเฉพาะ Job ของ scope เจ้าของ

Request POST รับเฉพาะ `semester` และ `force`; ไม่รับ user, enrollment, curriculum, cohort, readiness verdict, evidence หรือ career IDs ที่จะใช้เป็นแหล่งความจริง

Response ใช้ envelope ของ API เดิม โดย data มี `generation_state`, `completeness`, `semester`, `target_year_be`, `readiness` จาก Backend, `availability[]` พร้อม `reason_code`, `job` (ถ้ามี), `retry_after_seconds` (เมื่อต้องรอ), และ `report` เฉพาะฉบับที่แสดงได้ รายงานมี `source_hash`, เวลาสร้าง/เก็บหลักฐาน, model/prompt/schema version, bilingual findings และ evidence snapshot สำหรับ render เมื่อ `generation_state=context_exceeded` อาจมี `context_diagnostics` เป็นตัวเลขงบ token และขนาดข้อมูลแต่ละส่วนเท่านั้น

HTTP behavior:

- `200`: current report หรือ informational `insufficient_data`
- `202`: Job queued/generating; ส่ง `job_id` และสถานะ
- `400`: semester/body ไม่ถูกต้อง
- `401/403`: authentication หรือ role ไม่ผ่าน
- `404`: Job ไม่อยู่ใน scope ของผู้เรียก ใช้รูปแบบเดียวกับไม่พบเพื่อไม่เปิดเผยข้อมูลผู้อื่น
- `409`: concurrency/version conflict ที่ client ต้องอ่านสถานะล่าสุด
- `429`: success cooldown หรือ failure wait ยังไม่หมด ส่ง `retry_after_seconds` และ `Retry-After`

รายงาน stale ห้ามส่งเป็น `report` ที่ UI ใช้ render; รายงานเดิมที่ยัง current อาจแสดงระหว่าง force regeneration ได้ เมื่อฉบับใหม่ล้มเหลว รายงานเดิมที่ stale คงเก็บไว้แต่ไม่แสดง

## Evidence and Output

Evidence refs เป็น opaque IDs ภายใน Snapshot เช่น `course:<id>`, `activity:<id>`, `competency:<id>` ซึ่ง map กลับ source record ที่ตรวจสอบได้ Backend ตรวจทุก ref กับชุดที่ส่ง Provider จริง ชื่อ/คะแนน/เกณฑ์/availability render จาก Snapshot ไม่รับค่าตัวเลขใหม่จาก LLM

Output Version 1.0 มี `readiness_explanation`, `strengths[]`, `limitations[]`; ข้อความทุก field มี `{th,en}`. Strength/limitation มี title, reason, evidence_refs; limitation มี development advice. ไม่มีคำแนะนำสายงานใน Schema หรือรายงาน Version 1.0

หนึ่ง Evidence ที่ใช้ได้เพียงพอให้วิเคราะห์เฉพาะส่วนที่รองรับ ไม่กำหนดจำนวนขั้นต่ำรวม และไม่อนุมานด้านที่ไม่มีหลักฐาน

ข้อมูลเกินงบ Context ให้ Backend จัดสรุปแบบ deterministic พร้อม provenance map; คะแนนวิชา/กิจกรรมอ้างกลับไปยังรายการหลักฐานกลางด้วย Evidence Ref แทนการทำซ้ำชื่อ เกรด และวันที่ในแต่ละ Competency. ถ้ายังเกินให้ `context_exceeded`, ไม่เรียก LLM, ไม่ retry input เดิมอัตโนมัติ และไม่ตัดข้อมูลเงียบ ๆ

Ollama `num_ctx` ต้องใช้ค่าเดียวกับ `LEARNER_ASSESSMENT_CONTEXT_TOKENS`; `num_predict` ใช้ `LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS`. Diagnostics ระบุ estimated input/total tokens, input/output budget, safety margin และ byte size ราย section โดยห้ามบันทึกเนื้อหาหลักฐานลง log

## Freshness, Retry and Cooldown

- Source hash ครอบคลุมเฉพาะข้อมูลที่มีผลต่อรายงาน Version 1.0 และ model/prompt/schema/pipeline settings; ไม่รวม career catalogue, เวลาปัจจุบัน หรือ UI language
- Stale auto-generation เริ่มเมื่อผู้เรียนเปิดเทอมนั้น; source change ไม่ trigger งานทันที
- งานสำเร็จที่ใช้ข้อมูลเดิม force ได้หลัง 5 นาที; source hash เปลี่ยนไม่ติด success cooldown
- Job ที่กำลังทำอยู่ deduplicate ต่อ learner scope/semester
- ค่าเริ่มต้นเชิงปฏิบัติการที่เสนอ: สูงสุด 3 attempts รวมครั้งแรกต่อ Job และ 60 วินาที failure wait ต่อ scope/semester; configurable และต้องวัดก่อน Production
- Failure wait บังคับที่ Backend และใช้กับทั้ง force/auto request; permanent errors เช่น context exceeded/invalid output ไม่ retry แบบ network error
- Worker completion ต้องผ่าน generation token/lease และ source freshness check; เฉพาะผลที่ validate แล้วเท่านั้นเขียนทับ latest report

## Career Catalogue Authority (Version 2.0)

Career Path แยก owner ตาม Faculty. Officer จัดการ Faculty ของตน Admin จัดการ Faculty ที่เลือกได้; Backend ตรวจ curriculum อยู่ใน Faculty เดียวกันและ competency IDs จริงทุกครั้ง. Draft/published เป็นคนละ revision; Import แก้ draft. Version 1.0 เก็บและจัดการ Catalogue ได้ แต่ไม่อ่านหรือส่งข้อมูลสายงานให้รายงาน การนำ Catalogue กลับมาใช้ต้องออกแบบ Contract และ Algorithm สำหรับ Version 2.0 แยกต่างหาก.

## Decision Gates

คุณภาพเชิงความหมายและระยะเก็บข้อมูล Job/payload เป็น Release Gates ที่ยังต้องได้รับการยืนยันก่อนเปิดใช้งานจริง รายละเอียดอยู่ใน `release-gates.md`.
