// ============================================================
// PawLenx — Backend API Server
// Receives job application PDFs and stores them
// Pushes PDFs to GitHub repo (pawlenex/webpage)
// ============================================================

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── GitHub config ───
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'pawlenex';
const GITHUB_REPO = process.env.GITHUB_REPO || 'webpage';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const JWT_SECRET = process.env.JWT_SECRET || 'pawlenx-premium-secret-5522';

/**
 * Enhanced GitHub API Helper using Axios
 */
const ghApi = axios.create({
  baseURL: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
  headers: {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'PawLenx-Backend/1.0',
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

/**
 * Read a file from GitHub
 */
async function readGhFile(path) {
  try {
    const res = await ghApi.get(`/contents/${path}?ref=${GITHUB_BRANCH}`);
    const content = Buffer.from(res.data.content, 'base64').toString('utf8');
    return { data: JSON.parse(content), sha: res.data.sha };
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

/**
 * Write/Update a file on GitHub
 */
async function writeGhFile(path, contentObj, message, sha = null) {
  const contentBase64 = Buffer.from(JSON.stringify(contentObj, null, 2)).toString('base64');
  const body = {
    message,
    content: contentBase64,
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  const res = await ghApi.put(`/contents/${path}`, body);
  return res.data;
}

/**
 * List contents of a GitHub folder
 */
async function listGhFolder(path) {
  try {
    const res = await ghApi.get(`/contents/${path}?ref=${GITHUB_BRANCH}`);
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) return [];
    throw err;
  }
}

/**
 * Upload a file to GitHub using the Contents API
 * PUT /repos/{owner}/{repo}/contents/{path}
 */
function uploadToGitHub(filePath, githubPath) {
  return new Promise((resolve, reject) => {
    if (!GITHUB_TOKEN) {
      console.warn('⚠️  GITHUB_TOKEN not set — skipping GitHub upload');
      return resolve({ skipped: true });
    }

    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');

    const body = JSON.stringify({
      message: `📄 New file: ${githubPath}`,
      content: base64Content,
      branch: GITHUB_BRANCH
    });

    const encodedPath = githubPath.split('/').map(encodeURIComponent).join('/');
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedPath}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'PawLenx-Backend/1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log(`✅ Uploaded to GitHub: ${githubPath}`);
          resolve(JSON.parse(data));
        } else {
          console.error(`❌ GitHub upload failed (${res.statusCode}): ${data}`);
          reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ GitHub upload error:', err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

// ─── Ensure applications folder exists ───
const APPLICATIONS_DIR = path.join(__dirname, 'applications');
if (!fs.existsSync(APPLICATIONS_DIR)) {
  fs.mkdirSync(APPLICATIONS_DIR, { recursive: true });
  console.log(`📁 Created applications folder: ${APPLICATIONS_DIR}`);
}

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// ─── Multer storage config — per-applicant folders ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // We'll set the real destination after parsing form fields
    // For now, use a temp dir; we'll move files in the route handler
    cb(null, APPLICATIONS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_{2,}/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'), false);
    }
  }
});

// Accept both 'application' and 'resume' fields
const uploadFields = upload.fields([
  { name: 'application', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]);

// ─── Routes ───

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'pawlenx-backend', timestamp: new Date().toISOString() });
});

// ─── AUTHENTICATION ROUTES ───

// Utility to generate folder name based on name + password
const getFolderName = (name, password) => {
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const passHash = Buffer.from(password).toString('hex').slice(0, 8); // simplified combination
  return `${safeName}_${passHash}`;
};

// SIGN UP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing name, email or password' });

    const folderName = getFolderName(name, password);
    const userPath = `users/${folderName}/profile.json`;

    // Check if user already exists
    const existing = await readGhFile(userPath);
    if (existing) return res.status(400).json({ error: 'User already exists with this combination' });

    // Hash password for actual storage
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userProfile = {
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      pets: []
    };

    // Save to GitHub
    await writeGhFile(userPath, userProfile, `User sign up: ${name}`);

    // Create empty pets.json
    await writeGhFile(`users/${folderName}/pets.json`, [], `Init pets for: ${name}`);

    const token = jwt.sign({ folderName, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, name });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed. Please check GITHUB_TOKEN permissions.' });
  }
});

// LOG IN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Missing name or password' });

    // The logic requested: login with name/pass which combine into folder name
    const folderName = getFolderName(name, password);
    const profilePath = `users/${folderName}/profile.json`;

    const userProfile = await readGhFile(profilePath);
    if (!userProfile) return res.status(401).json({ error: 'Invalid name or password' });

    // Verify hashed password inside
    const isMatch = await bcrypt.compare(password, userProfile.data.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid name or password' });

    const token = jwt.sign({ folderName, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, name: userProfile.data.name });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── USER DASHBOARD DATA ───

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// GET User Dashboard
app.get('/api/user/dashboard', authMiddleware, async (req, res) => {
  try {
    const folder = req.user.folderName;
    const profile = await readGhFile(`users/${folder}/profile.json`);
    const petsData = await readGhFile(`users/${folder}/pets.json`);

    res.json({
      name: profile.data.name,
      email: profile.data.email,
      createdAt: profile.data.createdAt || null,
      pets: petsData ? petsData.data : []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ADD PET
app.post('/api/user/pets', authMiddleware, async (req, res) => {
  try {
    const folder = req.user.folderName;
    const { petName, petBreed, petAge, petType, petWeight } = req.body;

    const petsFilePath = `users/${folder}/pets.json`;
    const existingPets = await readGhFile(petsFilePath);

    const newPet = {
      id: Date.now(),
      name: petName,
      breed: petBreed,
      age: petAge,
      type: petType,
      weight: petWeight || null,
      addedAt: new Date().toISOString()
    };

    const updatedPets = [newPet, ...(existingPets ? existingPets.data : [])];
    await writeGhFile(petsFilePath, updatedPets, `Add pet: ${petName}`, existingPets ? existingPets.sha : null);

    res.json({ success: true, pet: newPet });
  } catch (err) {
    console.error('Add pet error:', err);
    res.status(500).json({ error: 'Failed to add pet' });
  }
});

// Submit application (receive Application PDF + Resume PDF)
app.post('/api/applications/submit', uploadFields, async (req, res) => {
  try {
    const appFile = req.files && req.files['application'] ? req.files['application'][0] : null;
    const resumeFile = req.files && req.files['resume'] ? req.files['resume'][0] : null;

    if (!appFile) {
      return res.status(400).json({ error: 'No application PDF received' });
    }

    const { applicantName, jobTitle, email } = req.body;

    // Create per-applicant folder: FirstName_LastName_YYYYMMDD-HHMMSS
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const safeName = (applicantName || 'Unknown')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '_');
    const folderName = `${safeName}_${timestamp}`;
    const applicantDir = path.join(APPLICATIONS_DIR, folderName);
    fs.mkdirSync(applicantDir, { recursive: true });

    // Move application PDF into applicant folder
    const appDest = path.join(applicantDir, `${safeName}_Application.pdf`);
    fs.renameSync(appFile.path, appDest);

    // Move resume PDF into applicant folder
    let resumeDest = null;
    if (resumeFile) {
      const resumeExt = path.extname(resumeFile.originalname) || '.pdf';
      resumeDest = path.join(applicantDir, `${safeName}_Resume${resumeExt}`);
      fs.renameSync(resumeFile.path, resumeDest);
    }

    console.log('─────────────────────────────────────────');
    console.log('📄 New Application Received');
    console.log(`   Applicant: ${applicantName || 'Unknown'}`);
    console.log(`   Position:  ${jobTitle || 'Not specified'}`);
    console.log(`   Email:     ${email || 'Not provided'}`);
    console.log(`   Folder:    ${folderName}/`);
    console.log(`   App PDF:   ${safeName}_Application.pdf`);
    if (resumeDest) {
      console.log(`   Resume:    ${safeName}_Resume.pdf`);
    }
    console.log('─────────────────────────────────────────');

    // Upload both files to GitHub repo
    let githubUploaded = false;
    try {
      // Upload application PDF
      const ghAppPath = `applications/${folderName}/${safeName}_Application.pdf`;
      await uploadToGitHub(appDest, ghAppPath);

      // Upload resume PDF
      if (resumeDest) {
        const ghResumePath = `applications/${folderName}/${safeName}_Resume.pdf`;
        await uploadToGitHub(resumeDest, ghResumePath);
      }

      githubUploaded = true;
    } catch (ghErr) {
      console.error('⚠️  GitHub upload failed, but local copies saved:', ghErr.message);
    }

    res.json({
      success: true,
      message: 'Application received successfully',
      data: {
        folder: folderName,
        applicationFile: `${safeName}_Application.pdf`,
        resumeFile: resumeDest ? `${safeName}_Resume.pdf` : null,
        applicantName,
        jobTitle,
        receivedAt: new Date().toISOString(),
        githubUploaded
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
    const entries = fs.readdirSync(APPLICATIONS_DIR, { withFileTypes: true });
    const applicants = entries
      .filter(e => e.isDirectory())
      .map(dir => {
        const dirPath = path.join(APPLICATIONS_DIR, dir.name);
        const files = fs.readdirSync(dirPath).map(f => {
          const stats = fs.statSync(path.join(dirPath, f));
          return {
            fileName: f,
            size: `${(stats.size / 1024).toFixed(1)} KB`,
          };
        });
        const stats = fs.statSync(dirPath);
        return {
          folder: dir.name,
          files,
          receivedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    res.json({ total: applicants.length, applications: applicants });
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
