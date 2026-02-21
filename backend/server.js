// ============================================================
// PawLenx — Backend API Server
// Receives job application PDFs and stores them
// ============================================================

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Ensure applications folder exists ───
const APPLICATIONS_DIR = path.join(__dirname, 'applications');
if (!fs.existsSync(APPLICATIONS_DIR)) {
  fs.mkdirSync(APPLICATIONS_DIR, { recursive: true });
  console.log(`📁 Created applications folder: ${APPLICATIONS_DIR}`);
}

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// ─── Multer storage config ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, APPLICATIONS_DIR);
  },
  filename: (req, file, cb) => {
    // Use the original filename from the client (FirstName_LastName_Application.pdf)
    // Sanitize to prevent path traversal
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_{2,}/g, '_');
    
    // Add timestamp to avoid overwrites
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    const finalName = `${base}_${timestamp}${ext}`;
    
    cb(null, finalName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'), false);
    }
  }
});

// ─── Routes ───

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'pawlenx-backend', timestamp: new Date().toISOString() });
});

// Submit application (receive PDF)
app.post('/api/applications/submit', upload.single('application'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file received' });
    }

    const { applicantName, jobTitle, email } = req.body;

    console.log('─────────────────────────────────────────');
    console.log('📄 New Application Received');
    console.log(`   Applicant: ${applicantName || 'Unknown'}`);
    console.log(`   Position:  ${jobTitle || 'Not specified'}`);
    console.log(`   Email:     ${email || 'Not provided'}`);
    console.log(`   File:      ${req.file.filename}`);
    console.log(`   Size:      ${(req.file.size / 1024).toFixed(1)} KB`);
    console.log(`   Saved to:  ${req.file.path}`);
    console.log('─────────────────────────────────────────');

    res.json({
      success: true,
      message: 'Application received successfully',
      data: {
        fileName: req.file.filename,
        applicantName,
        jobTitle,
        receivedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error processing application:', err);
    res.status(500).json({ error: 'Failed to process application' });
  }
});

// List applications (admin endpoint)
app.get('/api/applications', (req, res) => {
  try {
    const files = fs.readdirSync(APPLICATIONS_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const stats = fs.statSync(path.join(APPLICATIONS_DIR, f));
        return {
          fileName: f,
          size: `${(stats.size / 1024).toFixed(1)} KB`,
          receivedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    res.json({ total: files.length, applications: files });
  } catch (err) {
    console.error('Error listing applications:', err);
    res.status(500).json({ error: 'Failed to list applications' });
  }
});

// Error handling for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// ─── Start server ───
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🐾 ═══════════════════════════════════════');
  console.log(`🐾  PawLenx Backend API`);
  console.log(`🐾  Running on port ${PORT}`);
  console.log(`🐾  Applications folder: ${APPLICATIONS_DIR}`);
  console.log('🐾 ═══════════════════════════════════════');
  console.log('');
});
