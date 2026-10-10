# Learner Assessment API LLM: Configuration and Verification

วันที่: 2026-10-10

## สถานะ

เตรียมระบบตาม Architecture ใน `learner-assessment-report-api-llm-v1.md` แล้วบน branch `feat/learner-assessment-report-api-llm` ยังไม่เปิด API จริง ไม่ใส่ Key ไม่รัน Migration และยังไม่ยืนยันคุณภาพความเรียงจากโมเดลจริง

## ก่อนเปิดใช้งาน

1. สำรองฐานข้อมูลและตรวจว่าตารางรายงานและ Job พร้อมแล้ว รวม Migration ของ progress ที่ใช้อยู่เดิม
2. รันไฟล์ใหม่ `apps/backend/db/20261010_add_assessment_api_drafts_and_limits.sql` ด้วยมือบนฐานข้อมูลที่เลือกเอง ไม่ต้องรัน SQL Fixture ใดเพื่อเปิดฟีเจอร์นี้
3. ตรวจว่ามีตาราง `ai_report_drafts`, `ai_api_daily_usage`, `ai_api_calls`, `ai_api_gate` และ gate แถว `gate_id = 1`
4. เพิ่มเฉพาะค่าที่เกี่ยวกับ Assessment จาก `apps/backend/.env.example` ลงใน `.env` ส่วนตัว อย่าเขียนทับค่าของ DB/JWT เดิม
5. เลือก Provider และ Model ที่รองรับรูปแบบ Output ของ Adapter ใส่ Key ฝั่ง Backend เท่านั้น แล้วเปิด `LEARNER_ASSESSMENT_API_ENABLED=true`
6. Restart Backend API และ Assessment Worker ให้ใช้ Environment ชุดเดียวกัน
7. ตรวจนโยบายข้อมูลและการเก็บข้อมูลของผู้ให้บริการ รวมข้อกำหนดของมหาวิทยาลัย ก่อนส่งผลการเรียนจริงออกนอกระบบ

Migration ใหม่ตรวจตารางหลักผ่าน `information_schema` และตรวจชนิด ID เป็น BIGINT UNSIGNED โดยไม่อิง display width จึงรองรับรูปแบบ `bigint(20) unsigned` ด้วย มี `CREATE TABLE IF NOT EXISTS` และ Postflight สำหรับคอลัมน์/ดัชนีที่จำเป็น หากพบโครงสร้างบางส่วนไม่ตรงกันต้องตรวจและซ่อมด้วยมือ ห้ามตีความว่า DDL rollback ทั้งหมด เพราะ MySQL อาจ auto-commit

ไม่ได้เปลี่ยน SQL Migration เดิมที่ค้างใน worktree ตารางรายงานเดิมรับชื่อ Provider/Model และ digest ว่างของ API ได้ โดยยังบังคับ digest สำหรับ Ollama ที่ Repository

## Environment

| ค่า | ความหมาย |
|---|---|
| `LEARNER_ASSESSMENT_PROVIDER` | `deepseek`, `openai`, `gemini`, `ollama`; เมื่อไม่ได้กำหนดจะคง Ollama เพื่อรักษาระบบเดิม ส่วน `.env.example` แนะนำ DeepSeek |
| `LEARNER_ASSESSMENT_API_ENABLED` | ค่าเริ่มต้น `false`; ต้องเปิดชัดเจนก่อนสร้างรายงานผ่าน API |
| `LEARNER_ASSESSMENT_DEEPSEEK_API_KEY`, `LEARNER_ASSESSMENT_DEEPSEEK_MODEL` | Key/Model สำหรับ DeepSeek ไม่กำหนดค่าเริ่มต้น |
| `LEARNER_ASSESSMENT_OPENAI_API_KEY`, `LEARNER_ASSESSMENT_OPENAI_MODEL` | Key/Model สำหรับ OpenAI ไม่กำหนดค่าเริ่มต้น |
| `LEARNER_ASSESSMENT_GEMINI_API_KEY`, `LEARNER_ASSESSMENT_GEMINI_MODEL` | Key/Model สำหรับ Gemini ไม่กำหนดค่าเริ่มต้น |
| `LEARNER_ASSESSMENT_CONTEXT_TOKENS` | ค่าเริ่มต้น API `12288`; Ollama `4096` เมื่อไม่ได้กำหนดเอง |
| `LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS` | ค่าเริ่มต้น API `3072`; Ollama `1024` |
| `LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN` | ค่าเริ่มต้น `128` |
| `LEARNER_ASSESSMENT_API_TIMEOUT_SECONDS` | ค่าเริ่มต้น `240` |
| `LEARNER_ASSESSMENT_API_IDLE_TIMEOUT_SECONDS` | ค่าเริ่มต้น `60` |
| `LEARNER_ASSESSMENT_API_DAILY_LIMIT` | ค่าเริ่มต้น `20` รวมทั้งระบบต่อวัน UTC ไม่ใช่ต่อผู้เรียน |

ค่าขีดจำกัด Context เป็นงบของแอปและการประมาณ ไม่ใช่การรับรองขีดจำกัดของทุก Model ต้องตรวจความสามารถของ Model ที่เลือก ไม่มี Model/API Key ที่ฝังในโค้ด และไม่มีการเปลี่ยน Provider อัตโนมัติเมื่อเกิด Error

API Server ยังเริ่มให้บริการโมดูลอื่นได้เมื่อ Assessment ยังไม่พร้อม หน้า Learner จะได้ `generation_available=false` และไม่ส่งงานอัตโนมัติ Worker จะหยุดพร้อมข้อความ Config ที่ขาดโดยไม่แสดง Key

หากกลับไปใช้ Ollama ให้เลือก Provider เป็น `ollama` และตั้งค่าที่ใช้เดิม รวม `LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST` ที่ผ่านการทดสอบ ไม่ต้องตั้ง API Key และควรทบทวนค่าขนาด Context ที่กำหนดใน Environment ด้วย

## คำสั่ง Worker

รันจาก `apps/backend`:

```powershell
go run ./cmd/assessment-worker
```

Frontend ไม่เรียก Provider โดยตรง API จัดคิวให้ Worker แล้วเว็บ Poll สถานะเดิมทุก 2.5 วินาทีเฉพาะขณะงานทำงาน ไม่แสดง tokens ดิบหรือ reasoning จาก Stream

## Adapter และหลักฐาน

- DeepSeek: Chat Completions + JSON object mode; Schema และ Business Rules ตรวจใน Backend
- OpenAI: Responses API + Structured Outputs, `store=false`; ไม่ส่ง reasoning ให้ผู้เรียน
- Gemini: REST `streamGenerateContent` + `responseJsonSchema`; ข้ามส่วน `thought`
- ใช้ Schema ของ API ที่มี 3 ฟิลด์คงที่ `strengths`, `development`, `observations` แล้วแปลง envelope เข้า Validator เดิม ไม่ซ่อมหรือทิ้งประโยคที่ผิดเพื่อให้ผ่าน
- ขอ 2-3 ประโยคที่เชื่อมกันต่อหมวดเมื่อมีหลักฐาน แต่ข้อมูลน้อยย่อมมีข้อความสั้นหรือหมวดว่างได้ คุณภาพจริงต้องตรวจอีกครั้ง
- JSON มีหลักสูตร เทอม ผลตรวจรายเกณฑ์ รายวิชา/เกรด คะแนนแยกแหล่ง กิจกรรมล่าสุด และ Availability; ใช้ `null` เมื่อแหล่งคะแนนไม่พร้อม
- รายวิชาใช้ขอบเขตก่อนเทอมเป้าหมายรวม Summer และกฎเกรดดีที่สุดของ Source Builder เดิม กิจกรรมใช้ข้อมูลล่าสุดทั้งหมด
- ไม่ส่งชื่อ/รหัสผู้เรียนหรือ ID เจ้าของข้อมูล ไม่เพิ่ม Career Recommendations ในรุ่นนี้
- Validator ยังห้ามตัวเลข/เกรดในความเรียง อนุมัติสิทธิ์ อ้าง Observation ผิดหมวด ประโยคซ้ำ และข้อห้ามเดิม ค่าเกรด/คะแนนยังส่งเป็นหลักฐานตัวเลขได้
- Provider/Model/Prompt/Schema/Budget/Timeout อยู่ใน Fingerprint ที่ใช้ Source Hash; Key ไม่อยู่ใน Hash

## โควตาและ Error

ใช้ gate แถวเดียวใน DB พร้อม `SELECT ... FOR UPDATE` จองสิทธิ์ก่อนส่ง HTTP แต่ละครั้ง ทั้ง Worker และ Synthetic Evaluator ใช้ gate/โควตาเดียวกัน จึงมีคำขอ API ฝั่งแอปพร้อมกันสูงสุดหนึ่งรายการต่อฐานข้อมูลที่ใช้ร่วมกัน

โควตานับการจองก่อนเรียก Provider รวม Retry และไม่คืนเมื่อ Provider ล้มเหลว เป็นเพดานควบคุมคำขอ ไม่ใช่ยอดค่าใช้จ่ายที่รับรองกับ Billing การจองที่ซ้ำ Job/Attempt ไม่ถูกนับเพิ่ม และ quota reset ตามวัน UTC

Worker เลื่อนงานที่ gate ไม่ว่างโดยไม่ใช้จำนวนความพยายามเพิ่ม รองรับ `Retry-After` จาก 429 และ Retry เฉพาะ Error ชั่วคราวภายในจำนวนสูงสุดเดิม ไม่มี Retry ซ้อนใน Adapter เมื่อ Auth/Request/Refusal ผิดจะไม่เปลี่ยนไป Provider อื่น

gate มีเวลาหมดอายุที่ครอบคลุม timeout และช่วงเผื่อ หาก Worker ปิดก่อน Finish ระบบรอจน gate หมดอายุแทนการค้างถาวร Token usage ที่ไม่ทราบเก็บเป็น NULL ไม่เดาเป็นศูนย์

## ผลร่างที่ไม่ผ่าน

- เก็บเฉพาะฉบับล่าสุดต่อเจ้าของหลักสูตรผู้เรียนและเทอม แยกจาก `ai_learner_reports`
- บันทึกผลร่างและสถานะ Job ล้มเหลวใน Transaction เดียวกัน ตรวจ Lease/Owner/Semester/Hash ก่อนเขียน
- ผลใหม่ที่ผ่านบันทึกรายงานและล้าง Draft ใน Transaction เดียวกัน ผลใหม่ที่ไม่ผ่านแทน Draft เดิมโดยไม่ทับรายงานที่ผ่าน
- เมื่อ Provider ล้มเหลวโดยไม่มี Output ร่างเก่าคงอยู่และระบุว่ามาจากความพยายามก่อนหน้า ไม่มีอายุลบอัตโนมัติ
- ร่างที่ Hash ล้าสมัยไม่ส่งเนื้อหาให้เว็บ ผลร่างไม่มีสถานะ `current`
- แสดงเฉพาะข้อผิดพลาดแรกที่ Validator พบ พร้อมชื่อกฎ/หมวด/ตำแหน่ง ไทย/อังกฤษ ไม่อ้างว่าเป็นข้อผิดพลาดทั้งหมด
- Preview ไม่เกิน 8000 ตัวอักษร; Response Stream ไม่เกิน 256 KiB; Validator ยังคงขีดจำกัด Output เดิม 64 KiB
- JSON ที่อ่านได้แยกเฉพาะข้อความประโยคในฟิลด์ที่รู้จัก JSON เสียแสดงเป็น plain text ที่ Escape แล้ว พับ/เปิดได้ ไม่มีการ Execute HTML/Markdown
- ปกปิดรูปแบบ Email/โทรศัพท์/เลขประจำตัวและ Credential ที่ตรวจพบก่อนจำกัดขนาด เมื่อ Validator แจ้ง PII จะซ่อนทั้งเนื้อหา การตรวจด้วยรูปแบบไม่ใช่การรับรองว่าจับข้อมูลส่วนบุคคลได้ทุกชนิด จึงยังต้องตรวจข้อมูลและนโยบายก่อนใช้งานจริง
- Log มีเฉพาะรหัสสาเหตุ ตำแหน่ง Job/Attempt และ Usage ไม่มี Prompt หรือ Output ดิบ Key หรือชื่อผู้เรียน

## Tests ที่รันแล้ว

```powershell
# apps/backend
go test ./...

# apps/frontend
npm run test:learner-assessment
npm run test:assessment-draft-ui
npm run build
```

Backend Tests ผ่าน: HTTP จำลองสำหรับ Adapter ทั้งสาม, Stream/Usage, Auth/429/Idle/Refusal/Truncation, ไม่มีข้อมูลจริงใน Log, DTO/Normalizer, Worker, Mock SQL Lease/Quota/Idempotency/Rollback และ Transaction บันทึกรายงาน API

Frontend Tests ผ่าน 17 รายการ; Browser Harness ใช้ Component และ CSS จริง ผ่าน 32 กรณี: TH/EN x Light/Dark x Desktop/Mobile x ร่างปกติ/JSON เสีย/ร่างล้าสมัย/ร่างความพยายามก่อนหน้า ตรวจไม่มี Script Execution ไม่มี horizontal overflow และตรวจค่าสีพื้นหลังจริง Screenshots ตรวจด้วยสายตาแล้ว Build และ Lint เฉพาะไฟล์ UI ที่แก้ผ่าน

ข้อจำกัดการตรวจ: ไม่ได้รัน Migration จริง ไม่ได้ทดสอบ SQL race บน MySQL จริง ไม่ได้เรียก LLM API จริง และไม่ได้รับรองคุณภาพความเรียงหรือ Semantic Correctness

`go vet ./...` ยังไม่ผ่านจากปัญหาเดิม `services/student_cohort_service.go:332` self-assignment ของ `row.RowNumber` ไม่ได้แก้ในชุดงานนี้ Vite พบ Translation Keys ซ้ำเดิม `courses`/`select_category_label` ซึ่งไม่ใช่ Keys ที่เพิ่ม npm install รายงาน Dependency Vulnerabilities ของชุด dependencies เดิม/ปัจจุบัน ไม่ได้แก้ด้วย `npm audit fix` ที่อาจกระทบส่วนอื่น

## ทดลอง API จริงภายหลัง

คำสั่งนี้มีค่าใช้จ่ายและไม่ได้รันในงานเตรียมระบบ:

```powershell
# apps/backend; หลังตั้ง Key/Model/DB และรัน Migration แล้ว
$env:LEARNER_ASSESSMENT_API_EVAL = '1'
go run ./cmd/assessment-api-eval --max-calls 1
```

อ่านเฉพาะ Synthetic Fixture ใต้ `testdata/learner_assessment/api` ไม่อ่านข้อมูลผู้เรียน แต่ใช้ DB สำหรับบันทึกโควตาร่วมกับ Worker ต้องตรวจ Fixture และนโยบายก่อนเรียก เป็น Opt-in แยกจาก Unit Tests จำกัดจำนวนเรียกต่อการทดลองด้วย `--max-calls` และไม่มี Retry อัตโนมัติ

การผ่าน Validator ไม่เท่ากับผ่าน Human Review ต้องอ่านทั้งสองภาษา ตรวจว่าคำอธิบาย/แนวทางพัฒนาเชื่อมกับหลักฐาน ไม่ตอบห้วนหรือสรุปความสามารถเกินข้อมูล ก่อนเปิดใช้กับข้อมูลจริง

## เอกสาร API ที่ใช้อ้างอิง

- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Gemini Generate Content REST API](https://ai.google.dev/api/generate-content?hl=en)
