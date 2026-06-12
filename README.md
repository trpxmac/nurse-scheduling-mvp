# 🏥 Nurse Scheduling MVP (ระบบจัดเวรพยาบาลอัจฉริยะ)

ระบบเว็บแอปพลิเคชันต้นแบบสำหรับช่วยจัดตารางเวรพยาบาลรายเดือนอัตโนมัติ โดยคำนึงถึงเงื่อนไข ข้อจำกัด และโควตาเวรต่าง ๆ เพื่อความสะดวกรวดเร็วในการทำงานของหัวหน้าตึกพยาบาล

## ✨ ฟีเจอร์หลัก (Key Features)
- **จัดการข้อมูลเจ้าหน้าที่ (Staff Management):** เพิ่ม แก้ไข ลบ รายชื่อและข้อมูลพยาบาลในตึก
- **ตั้งค่าประเภทเวร (Shift Types):** กำหนดช่วงเวลาเวร เช่น เวรเช้า, เวรบ่าย, เวรดึก, และวันหยุด
- **ระบบจัดเวรด้วย AI (AI Auto-Scheduling):** คำนวณจัดเวรรายเดือนอัตโนมัติตามกฎเกณฑ์พื้นฐาน
- **ปฏิทินตารางเวร (Monthly Roster View):** แสดงตารางเวรรายเดือนและสถิติเวรของพยาบาลแต่ละคน
- **พิมพ์ตารางเวร (Print & Export):** จัดรูปแบบสวยงามสำหรับการสั่งพิมพ์ออกเป็นกระดาษหรือบันทึกเป็น PDF

## 🚀 วิธีการติดตั้งและรันโปรเจกต์ (Getting Started)

### 1. ติดตั้ง Library/Dependencies
```bash
npm install
```

### 2. รันระบบในโหมดพัฒนา (Development)
```bash
npm run dev
```

### 3. บิลด์โปรเจกต์สำหรับใช้งานจริง (Production Build)
```bash
npm run build
```

## 💾 โครงสร้างข้อมูล (Data Schema)

ระบบเก็บข้อมูลใน `localStorage` โดยมีโครงสร้างหลักดังนี้:

### 1. Staff (ข้อมูลบุคลากร)
- `id`: String (เช่น S01)
- `employeeId`: String (รหัสพนักงาน)
- `firstName`, `lastName`, `nickname`: String (ชื่อ, นามสกุล, ชื่อเล่น)
- `position`: String (ตำแหน่ง เช่น RN, PN, PA)
- `level`: String (ระดับ เช่น RN1, RN2)
- `active`: Boolean (สถานะการทำงาน)

### 2. Shift Type (ประเภทเวร)
- `id`, `code`: String (เช่น M, E, N8)
- `name`: String (ชื่อเรียกเวร)
- `start`, `end`: String (เวลาเริ่ม-สิ้นสุด เช่น 07:00, 15:00)
- `hours`: Number (จำนวนชั่วโมงทำงาน)
- `category`: String (DAY, NIGHT, OFF, LEAVE, OTHER)
- `active`: Boolean (เปิดใช้งาน)
- `hex`: String (โค้ดสีประจำเวร)

### 3. Config (การตั้งค่า)
- `unit_name`, `hospital_name`: String (ชื่อตึกและโรงพยาบาล)
- `month`: String (เดือนที่จัดตาราง YYYY-MM)
- `shift_mode`: String (รูปแบบเวร 8HR, 12HR, MIXED)
- `max_weekly_hours`, `min_rest_hours`, `max_daily_hours`, `max_consecutive_nights`: Number (กฎการจัดเวร)
- `required_*_coverage`: Number (ความต้องการพยาบาลในแต่ละเวร)

### 4. Monthly Roster (ตารางเวร)
เป็น Object ที่ใช้ `staffId` เป็น Key และเก็บข้อมูลเวรในแต่ละวันเป็น Value
```json
{
  "S01": { "1": "M", "2": "E", "3": "OFF", "4": "M" },
  "S02": { "1": "N8", "2": "N8", "3": "OFF", "4": "OFF" }
}
```

---
พัฒนาด้วย **React + Vite + Vanilla CSS**
