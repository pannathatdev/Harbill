# หารบิล — Setup Guide

## โครงสร้างไฟล์
```
billsplit/
├── backend/          ← ไฟล์สำหรับติดตั้งใน Laravel project
│   ├── migrations/   → copy ไปที่ database/migrations/
│   ├── Controllers/  → copy ไปที่ app/Http/Controllers/
│   ├── Models.php    → แยกเป็น 4 ไฟล์ใน app/Models/
│   └── routes/       → เพิ่มใน routes/api.php
└── frontend/
    └── index.html    ← เปิดในบราวเซอร์ได้เลย
```

---

## ขั้นตอนติดตั้ง Laravel (Laragon)

### 1. สร้าง Laravel Project
```bash
# ใน Laragon terminal
cd C:\laragon\www
composer create-project laravel/laravel billsplit-api
cd billsplit-api
```

### 2. ตั้งค่า Database
เปิดไฟล์ `.env` แก้ไข:
```env
DB_DATABASE=billsplit
DB_USERNAME=root
DB_PASSWORD=
```
แล้วสร้าง database ชื่อ `billsplit` ใน phpMyAdmin

### 3. Copy ไฟล์
```
backend/migrations/create_friends_table.php  →  database/migrations/
backend/Controllers/FriendController.php     →  app/Http/Controllers/
backend/Controllers/RoundController.php      →  app/Http/Controllers/
```

แยก `Models.php` เป็น 4 ไฟล์:
- `app/Models/Friend.php`
- `app/Models/Round.php`
- `app/Models/Expense.php`
- `app/Models/Transfer.php`

### 4. อัปเดต routes/api.php
เอาเนื้อหาจาก `backend/routes/api.php` ใส่เพิ่มใน `routes/api.php`

### 5. เปิด CORS
แก้ไฟล์ `config/cors.php`:
```php
'allowed_origins' => ['*'],
'allowed_methods' => ['*'],
'allowed_headers' => ['*'],
```

### 6. Migrate
```bash
php artisan migrate
```

### 7. Run Server
```bash
php artisan serve
# จะได้ http://localhost:8000
```

---

## เปิด Frontend
เปิดไฟล์ `frontend/index.html` ในบราวเซอร์ได้เลย
ถ้า DB เชื่อมต่อสำเร็จ จะเห็น **"DB เชื่อมต่อแล้ว"** มุมขวาบน

> ถ้า DB ไม่เชื่อมต่อ แอปจะทำงานแบบ offline ด้วย localStorage แทน
> และซิงค์ขึ้น DB อัตโนมัติเมื่อเชื่อมต่อได้

---

## API Endpoints

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | /api/friends | ดึงรายชื่อเพื่อน |
| POST | /api/friends | เพิ่มเพื่อน |
| PUT | /api/friends/{id} | แก้ไขเพื่อน |
| DELETE | /api/friends/{id} | ลบเพื่อน |
| GET | /api/rounds | ดูประวัติรอบ |
| POST | /api/rounds | บันทึกรอบใหม่ |
| GET | /api/rounds/{id} | ดูรอบเดียว |
| DELETE | /api/rounds/{id} | ลบรอบ |
| PATCH | /api/transfers/{id}/paid | มาร์คว่าโอนแล้ว |
