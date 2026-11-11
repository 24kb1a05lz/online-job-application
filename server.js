
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// Use a new port to avoid the old server
const PORT = 3002;

// Create uploads folder
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'online_job_portal'
});

db.connect((err) => {
    if (err) {
        console.log('Database connection failed:', err.message);
        return;
    }

    console.log('MySQL Database Connected Successfully!');
});

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const uniqueName = crypto.randomUUID() + extension;
        cb(null, uniqueName);
    }
});

// Resume upload settings
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const allowed = ['.pdf', '.doc', '.docx'];

        if (allowed.includes(extension)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and Word files are allowed.'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Test route
app.get('/route-check', (req, res) => {
    res.send('Correct server.js is running!');
});

// Registration route
app.post('/register', async (req, res) => {

    const { full_name, email, mobile, password, confirm_password } = req.body;

    if (!full_name || !email || !mobile || !password || !confirm_password) {
        return res.status(400).send('Please fill in all fields.');
    }

    if (password !== confirm_password) {
        return res.status(400).send('Passwords do not match.');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (full_name, email, mobile, password)
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [full_name, email, mobile, hashedPassword], (err, result) => {

            if (err) {
                console.log('Registration error:', err.message);

                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).send('Email already registered.');
                }

                return res.status(500).send('Registration failed.');
            }

            res.send('Registration successful! Your details have been saved.');
        });

    } catch (error) {
        console.log(error);
        res.status(500).send('Registration error.');
    }
});

// Admin dashboard statistics
app.get('/admin/stats', (req, res) => {

    const sql = 'SELECT COUNT(*) AS totalUsers FROM users';

    db.query(sql, (err, results) => {

        if (err) {
            console.log(err.message);
            return res.status(500).json({
                message: 'Unable to load dashboard.'
            });
        }

        res.json({
            totalUsers: results[0].totalUsers
        });
    });
});

 // Display all submitted applications
app.get('/admin/applications', (req, res) => {

    const sql = `
        SELECT *
        FROM applications
        ORDER BY applied_at DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.log('Applications error:', err.message);

            return res.status(500).json({
                message: 'Unable to load applications.'
            });
        }

        res.json(results);
    });

});


// Job application submission route
app.post('/apply', upload.single('resume'), (req, res) => {

    const {
        full_name,
        email,
        mobile,
        job_position,
        qualification,
        experience,
        introduction
    } = req.body;

    if (!full_name || !email || !mobile ||
        !job_position || !qualification || !introduction) {
        return res.status(400).send('Please fill in all required fields.');
    }

    if (!req.file) {
        return res.status(400).send('Please upload your resume.');
    }

    const resumeFilename = req.file.filename;

    const sql = `
        INSERT INTO applications
        (full_name, email, mobile, job_position,
         qualification, experience, introduction, resume_filename)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        full_name,
        email,
        mobile,
        job_position,
        qualification,
        experience || '',
        introduction,
        resumeFilename
    ], (err, result) => {

        if (err) {
            console.log('Application error:', err.message);
            fs.unlink(req.file.path, () => {});
            return res.status(500).send('Unable to save your application.');
        }

        res.send('Your job application has been submitted successfully!');
    });
});

// Handle upload errors
app.use((err, req, res, next) => {
    console.log('Upload error:', err.message);
    res.status(400).send(err.message || 'Something went wrong.');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
