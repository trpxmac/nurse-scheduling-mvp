# 📋 Nurse Scheduling MVP — LocalStorage Schema Reference

เอกสารนี้สำหรับทีมพัฒนา เพื่อใช้ในการทำความเข้าใจโครงสร้างข้อมูลที่จัดเก็บใน LocalStorage
Base URL: `N/A` (Client-side Application)
Database: `LocalStorage`
Content-Type: `application/json`

---

## 🗄️ Storage Keys

1. **Global Keys**
   - `nss_active_department`: เก็บข้อมูลตึก/วอร์ดที่กำลังใช้งานอยู่
   - `nss_departments`: เก็บรายการตึก/วอร์ดทั้งหมดในระบบ
   - `nss_active_view_month`: เก็บข้อมูลเดือนที่กำลังดูข้อมูลอยู่ (YYYY-MM)

2. **Scoped Keys** (แยกตามตึก/วอร์ด)
   - `nss_config_{deptId}`: การตั้งค่าทั่วไปและกฎการจัดเวร
   - `nss_shift_types_{deptId}`: ประเภทเวรทั้งหมด
   - `nss_staff_list_{deptId}`: รายชื่อบุคลากร
   - `nss_monthly_roster_{deptId}_{yearMonth}`: ข้อมูลตารางเวรรายเดือน
   - `nss_ai_roster_{deptId}`: ข้อมูลตารางเวรที่ AI สร้างขึ้นล่าสุด

---

## 💾 Data Structures

### 1. Staff (ข้อมูลบุคลากร)
จัดเก็บเป็น Array ของ Object ใน Key `nss_staff_list_{deptId}`

| Column | Type | Nullable | คำอธิบาย |
| :--- | :---: | :---: | :--- |
| `id` | String | ❌ | รหัสอ้างอิงของพนักงาน (เช่น S01) |
| `employeeId` | String | ❌ | รหัสพนักงาน (รหัสประจำตัวของโรงพยาบาล) |
| `firstName` | String | ❌ | ชื่อจริง |
| `lastName` | String | ❌ | นามสกุล |
| `nickname` | String | ❌ | ชื่อเล่น |
| `position` | String | ❌ | ตำแหน่งการทำงาน (เช่น RN, PN, PA) |
| `level` | String | ❌ | ระดับการทำงาน (เช่น RN1, RN2, RN3) |
| `active` | Boolean | ❌ | สถานะการปฏิบัติงาน (true = ทำงานปกติ) |
| `avoid_staff` | Array | ✅ | รายชื่อ ID พนักงานที่ไม่ต้องการอยู่เวรด้วย |
| `avoid_levels` | Array | ✅ | ระดับพนักงานที่ไม่ต้องการอยู่เวรด้วย (เช่น RN1) |
| `avoid_shifts` | Array | ✅ | ประเภทเวรที่ไม่ต้องการขึ้น (เช่น M, E) |

### 2. Shift Type (ประเภทเวร)
จัดเก็บเป็น Array ของ Object ใน Key `nss_shift_types_{deptId}`

| Column | Type | Nullable | คำอธิบาย |
| :--- | :---: | :---: | :--- |
| `id` | String | ❌ | รหัสอ้างอิงของประเภทเวร (เช่น M, E, N8) |
| `code` | String | ❌ | รหัสเวรที่ใช้แสดงผล |
| `name` | String | ❌ | ชื่อเรียกของเวร (เช่น เช้า, บ่าย) |
| `start` | String | ✅ | เวลาเริ่มเวร (HH:mm) |
| `end` | String | ✅ | เวลาสิ้นสุดเวร (HH:mm) |
| `hours` | Number | ❌ | จำนวนชั่วโมงที่นับเป็นชั่วโมงทำงาน |
| `category` | String | ❌ | หมวดหมู่เวร (DAY, NIGHT, OFF, LEAVE, OTHER) |
| `active` | Boolean | ❌ | สถานะการเปิดใช้งานเวรนี้ |
| `hex` | String | ❌ | โค้ดสีประจำเวร (เช่น #90EE90) |

### 3. Config (การตั้งค่า)
จัดเก็บเป็น Object ใน Key `nss_config_{deptId}`

| Column | Type | Nullable | คำอธิบาย |
| :--- | :---: | :---: | :--- |
| `unit_name` | String | ❌ | ชื่อหน่วยงาน/ตึก |
| `hospital_name` | String | ❌ | ชื่อโรงพยาบาล |
| `month` | String | ❌ | เดือนที่จัดการล่าสุด (YYYY-MM) |
| `shift_mode` | String | ❌ | รูปแบบการจัดเวร (8HR, 12HR, MIXED) |
| `max_weekly_hours` | Number | ❌ | จำนวนชั่วโมงทำงานสูงสุดต่อสัปดาห์ |
| `min_rest_hours` | Number | ❌ | จำนวนชั่วโมงพักผ่อนขั้นต่ำระหว่างเวร |
| `max_daily_hours` | Number | ❌ | จำนวนชั่วโมงทำงานสูงสุดต่อวัน |
| `max_consecutive_nights` | Number | ❌ | จำนวนคืนที่ขึ้นเวรดึกติดต่อกันได้สูงสุด |
| `required_*_coverage` | Number | ❌ | ความต้องการบุคลากรในแต่ละเวร (เช่น required_M_coverage) |
| `incompatible_levels` | Array | ✅ | กฎส่วนกลาง: รายการจับคู่ระดับที่ห้ามขึ้นเวรด้วยกัน (เช่น `["RN1-RN1"]`) |

### 4. Monthly Roster (ตารางเวร)
จัดเก็บเป็น Object แบบ Nested ใน Key `nss_monthly_roster_{deptId}_{yearMonth}`

```json
{
  "staffId": {
    "dayOfMonth": "shiftCode"
  }
}
```

| Field | Type | คำอธิบาย |
| :--- | :---: | :--- |
| `staffId` | Key (String) | รหัสอ้างอิงของพนักงานที่เป็นเจ้าของตารางเวร |
| `dayOfMonth` | Key (String) | วันที่ในเดือนนั้นๆ (เช่น "1", "2", ..., "31") |
| `shiftCode` | Value (String) | รหัสเวรที่พนักงานคนนั้นต้องขึ้นในวันนั้น (เช่น "M", "E", "OFF") |
