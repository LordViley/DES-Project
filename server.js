require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 10;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve only the public folder, so server.js and its settings are never downloadable
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection pool: reconnects by itself if MySQL restarts or drops an idle connection.
// Settings come from the .env file (copy .env.example to .env).
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'sporting_goods_store',
    dateStrings: true // return DATE columns as 'YYYY-MM-DD' text, avoiding timezone shifts
});

db.query('SELECT 1', (err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        console.error('Run "npm run setup" once to create the database, and check DB_PASSWORD in .env');
        return;
    }
    console.log('Connected to MySQL Database: sporting_goods_store');
});

// Tables the dashboard can manage. Only names listed here ever reach a query.
// pk        : auto-numbered by MySQL when left blank
// optional  : may be left blank; the database fills them (defaults and triggers in sql/04_automation.sql)
const TABLES = {
    Customers: { pk: 'Customer_No',  columns: ['Customer_No', 'Customer_Name', 'Email', 'Phone'], optional: [] },
    Products:  { pk: 'Product_ID',   columns: ['Product_ID', 'Product_Name', 'Category', 'Price', 'Quantity'], optional: [] },
    Inventory: { pk: 'Inventory_No', columns: ['Inventory_No', 'Product_ID', 'Quantity_Available', 'Records'], optional: ['Records'] },
    Discounts: { pk: 'Discount_ID',  columns: ['Discount_ID', 'Customer_No', 'Discount_Percentage', 'Discount_Amount', 'Source'], optional: ['Discount_Amount', 'Source'] },
    Discount_Tiers: { pk: 'Tier_ID', columns: ['Tier_ID', 'Min_Orders', 'Percentage'], optional: [] },
    Orders:    { pk: 'Order_No',     columns: ['Order_No', 'Product_ID', 'Customer_No', 'Order_date', 'Total_Amount', 'Package_status'], optional: ['Order_date', 'Total_Amount', 'Package_status'] },
    Payments:  { pk: 'Payment_ID',   columns: ['Payment_ID', 'Order_No', 'Amount', 'Payment_Date', 'Payment_Method', 'Status'], optional: ['Amount', 'Payment_Date', 'Status'] },
    Returns:   { pk: 'Return_No',    columns: ['Return_No', 'Order_No', 'Product_ID', 'Return_Date', 'Reason', 'Status'], optional: ['Product_ID', 'Return_Date', 'Status'] }
};

function isValidTable(name) {
    return Object.prototype.hasOwnProperty.call(TABLES, name);
}

function sendDbError(res, err) {
    console.error('Database error:', err.code, err.message);
    // Business rules raised by the database triggers (out of stock, wrong product for a return, ...)
    if (err.code === 'ER_SIGNAL_EXCEPTION') {
        return res.status(409).json({ success: false, message: err.sqlMessage });
    }
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({ success: false, message: 'Cannot delete: other records still reference this one.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ success: false, message: 'Invalid reference: the related record does not exist.' });
    }
    const badValue = ['ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_TRUNCATED_WRONG_VALUE', 'ER_WRONG_VALUE',
                      'ER_DATA_TOO_LONG', 'ER_WARN_DATA_OUT_OF_RANGE'];
    if (badValue.includes(err.code)) {
        return res.status(400).json({ success: false, message: 'One of the values is invalid for its column.' });
    }
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A record with that unique value already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
}

// ---------- Accounts and sessions ----------

// Passwords are stored as salted scrypt hashes ("scrypt$salt$hash").
// A plain-text password from the old lab data still works once, then is upgraded to a hash.
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 32).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

function safeEqual(a, b) {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verifyPassword(password, stored) {
    if (!stored.startsWith('scrypt$')) return safeEqual(password, stored);
    const [, salt, hash] = stored.split('$');
    return safeEqual(crypto.scryptSync(password, salt, 32).toString('hex'), hash);
}

// Sessions live in memory: restarting the server logs everyone out.
const SESSION_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

function getSessionId(req) {
    const match = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
    return match ? match[1] : null;
}

function currentSession(req) {
    const id = getSessionId(req);
    const session = id && sessions.get(id);
    if (!session) return null;
    if (session.expires < Date.now()) {
        sessions.delete(id);
        return null;
    }
    return session;
}

function startSession(res, user) {
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, { username: user.username, role: user.role, customerNo: user.customerNo, expires: Date.now() + SESSION_MS });
    res.setHeader('Set-Cookie', `sid=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`);
}

// SIGN UP: creates a customer record and a 'user' account linked to it, then logs the new user in
app.post('/api/signup', (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim();
    const phone = String(req.body.phone || '').trim();

    const fail = (message) => res.status(400).json({ success: false, message });
    if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) return fail('Username must be 3-50 characters: letters, numbers, . _ -');
    if (password.length < 8) return fail('Password must be at least 8 characters.');
    if (fullName.length < 2 || fullName.length > 100) return fail('Please enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) return fail('Please enter a valid email address.');
    if (!/^[0-9+() -]{7,20}$/.test(phone)) return fail('Please enter a valid phone number.');

    db.getConnection((connErr, conn) => {
        if (connErr) return sendDbError(res, connErr);

        const abort = (err) => conn.rollback(() => {
            conn.release();
            if (err.code === 'ER_DUP_ENTRY') {
                const message = /Email/i.test(err.sqlMessage)
                    ? 'An account with that email already exists.'
                    : 'That username is already taken.';
                return res.status(409).json({ success: false, message });
            }
            sendDbError(res, err);
        });

        conn.beginTransaction((txErr) => {
            if (txErr) { conn.release(); return sendDbError(res, txErr); }
            conn.query('INSERT INTO Customers (Customer_Name, Email, Phone) VALUES (?, ?, ?)', [fullName, email, phone], (err, customer) => {
                if (err) return abort(err);
                conn.query('INSERT INTO Users (Username, Password, Role, Customer_No) VALUES (?, ?, ?, ?)',
                    [username, hashPassword(password), 'user', customer.insertId], (err2) => {
                        if (err2) return abort(err2);
                        conn.commit((commitErr) => {
                            if (commitErr) return abort(commitErr);
                            conn.release();
                            startSession(res, { username, role: 'user', customerNo: customer.insertId });
                            res.json({ success: true, role: 'user', message: 'Account created.' });
                        });
                    });
            });
        });
    });
});

// LOGIN
app.post('/api/login', (req, res) => {
    const username = String(req.body.username || '');
    const password = String(req.body.password || '');

    db.query('SELECT User_ID, Password, Role, Customer_No FROM Users WHERE Username = ?', [username], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        const user = results[0];
        if (!user || !verifyPassword(password, user.Password)) {
            return res.status(401).json({ success: false, message: 'Invalid Username or Password' });
        }
        if (!user.Password.startsWith('scrypt$')) {
            db.query('UPDATE Users SET Password = ? WHERE User_ID = ?', [hashPassword(password), user.User_ID]);
        }
        startSession(res, { username, role: user.Role, customerNo: user.Customer_No });
        res.json({ success: true, role: user.Role, message: 'Login successful' });
    });
});

app.post('/api/logout', (req, res) => {
    sessions.delete(getSessionId(req));
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ success: true });
});

// Who is logged in? The pages use this to send visitors back to the login screen.
app.get('/api/me', (req, res) => {
    const session = currentSession(req);
    if (!session) return res.status(401).json({ success: false, message: 'Please log in.' });
    res.json({ success: true, username: session.username, role: session.role });
});

// Everything below this line needs a logged-in user
app.use('/api', (req, res, next) => {
    if (!currentSession(req)) {
        return res.status(401).json({ success: false, message: 'Please log in first.' });
    }
    next();
});

// ---------- Shop: what a normal (customer) user can do ----------
// Every query below is tied to the customer record of the logged-in user,
// so a user can only ever see or change their own orders.

function requireCustomer(req, res, next) {
    const session = currentSession(req);
    if (!session.customerNo) {
        return res.status(403).json({ success: false, message: 'This account has no customer record. Admins use the dashboard.' });
    }
    req.customerNo = session.customerNo;
    next();
}

const PAYMENT_METHODS = ['M-Pesa', 'Card', 'Cash'];

app.get('/api/shop/profile', requireCustomer, (req, res) => {
    db.query(`SELECT c.Customer_Name AS name, COALESCE(MAX(d.Discount_Percentage), 0) AS discount,
                     (SELECT COUNT(*) FROM Orders o WHERE o.Customer_No = c.Customer_No AND o.Package_status <> 'Cancelled') AS orders
              FROM Customers c LEFT JOIN Discounts d ON d.Customer_No = c.Customer_No
              WHERE c.Customer_No = ? GROUP BY c.Customer_No`, [req.customerNo], (err, rows) => {
        if (err) return sendDbError(res, err);
        const profile = rows[0];
        // The next step of the loyalty ladder, so the screen can say how close they are
        db.query('SELECT Min_Orders, Percentage FROM Discount_Tiers WHERE Min_Orders > ? AND Percentage > ? ORDER BY Min_Orders LIMIT 1',
            [profile.orders, profile.discount], (err2, tiers) => {
                if (err2) return sendDbError(res, err2);
                const next = tiers[0] ? { ordersToGo: tiers[0].Min_Orders - profile.orders, percentage: Number(tiers[0].Percentage) } : null;
                res.json({ ...profile, nextTier: next, paymentMethods: PAYMENT_METHODS });
            });
    });
});

app.get('/api/shop/products', requireCustomer, (req, res) => {
    db.query('SELECT Product_ID, Product_Name, Category, Price, Quantity FROM Products ORDER BY Category, Product_Name', (err, rows) => {
        if (err) return sendDbError(res, err);
        res.json(rows);
    });
});

app.get('/api/shop/orders', requireCustomer, (req, res) => {
    const sql = `SELECT o.Order_No, p.Product_Name, o.Order_date, o.Total_Amount, o.Package_status,
        (SELECT pay.Status FROM Payments pay WHERE pay.Order_No = o.Order_No ORDER BY pay.Payment_ID DESC LIMIT 1) AS Payment_Status,
        (SELECT r.Status FROM Returns r WHERE r.Order_No = o.Order_No ORDER BY r.Return_No DESC LIMIT 1) AS Return_Status
        FROM Orders o JOIN Products p ON p.Product_ID = o.Product_ID
        WHERE o.Customer_No = ? ORDER BY o.Order_No DESC`;
    db.query(sql, [req.customerNo], (err, rows) => {
        if (err) return sendDbError(res, err);
        res.json(rows);
    });
});

// Place an order: the order and its payment record are created together.
// Price, discount and stock are handled by the database triggers.
app.post('/api/shop/orders', requireCustomer, (req, res) => {
    const productId = parseInt(req.body.Product_ID, 10);
    const method = req.body.Payment_Method;
    if (!Number.isInteger(productId)) return res.status(400).json({ success: false, message: 'Choose a product.' });
    if (!PAYMENT_METHODS.includes(method)) return res.status(400).json({ success: false, message: 'Choose a payment method.' });

    db.getConnection((connErr, conn) => {
        if (connErr) return sendDbError(res, connErr);
        const abort = (err) => conn.rollback(() => { conn.release(); sendDbError(res, err); });

        conn.beginTransaction((txErr) => {
            if (txErr) { conn.release(); return sendDbError(res, txErr); }
            conn.query('INSERT INTO Orders (Product_ID, Customer_No) VALUES (?, ?)', [productId, req.customerNo], (err, order) => {
                if (err) return abort(err);
                conn.query('INSERT INTO Payments (Order_No, Payment_Method) VALUES (?, ?)', [order.insertId, method], (err2) => {
                    if (err2) return abort(err2);
                    conn.commit((commitErr) => {
                        if (commitErr) return abort(commitErr);
                        conn.release();
                        res.json({ success: true, message: `Order ${order.insertId} placed. Payment is pending.` });
                    });
                });
            });
        });
    });
});

// Cancel an order that has not shipped yet: stock is returned and the pending payment is cancelled
app.post('/api/shop/orders/:id/cancel', requireCustomer, (req, res) => {
    db.query("UPDATE Orders SET Package_status = 'Cancelled' WHERE Order_No = ? AND Customer_No = ? AND Package_status = 'Processing'",
        [req.params.id, req.customerNo], (err, result) => {
            if (err) return sendDbError(res, err);
            if (result.affectedRows === 0) {
                return res.status(409).json({ success: false, message: 'Only your own orders that are still processing can be cancelled.' });
            }
            db.query("UPDATE Payments SET Status = 'Cancelled' WHERE Order_No = ? AND Status = 'Pending'", [req.params.id], (err2) => {
                if (err2) return sendDbError(res, err2);
                res.json({ success: true, message: 'Order cancelled.' });
            });
        });
});

// Request a return for a delivered order (an admin approves it from the dashboard)
app.post('/api/shop/returns', requireCustomer, (req, res) => {
    const orderNo = parseInt(req.body.Order_No, 10);
    const reason = String(req.body.Reason || '').trim();
    if (!Number.isInteger(orderNo)) return res.status(400).json({ success: false, message: 'Choose an order.' });
    if (reason.length < 3 || reason.length > 255) return res.status(400).json({ success: false, message: 'Please give a reason (3-255 characters).' });

    db.query(`SELECT o.Package_status, (SELECT COUNT(*) FROM Returns r WHERE r.Order_No = o.Order_No) AS returns
              FROM Orders o WHERE o.Order_No = ? AND o.Customer_No = ?`, [orderNo, req.customerNo], (err, rows) => {
        if (err) return sendDbError(res, err);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });
        if (rows[0].Package_status !== 'Delivered') return res.status(409).json({ success: false, message: 'Only delivered orders can be returned.' });
        if (rows[0].returns > 0) return res.status(409).json({ success: false, message: 'A return was already requested for this order.' });

        db.query('INSERT INTO Returns (Order_No, Reason) VALUES (?, ?)', [orderNo, reason], (err2) => {
            if (err2) return sendDbError(res, err2);
            res.json({ success: true, message: 'Return requested. It is now pending approval.' });
        });
    });
});

// Everything below this line is the admin dashboard
app.use('/api', (req, res, next) => {
    if (currentSession(req).role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admins only.' });
    }
    next();
});

// SCHEMA: lets the frontend build its forms from this single definition
app.get('/api/schema', (req, res) => {
    res.json(TABLES);
});

// REPORTS: numbers for the dashboard header and the low-stock alert
app.get('/api/reports/summary', (req, res) => {
    const totals = `SELECT
        (SELECT COUNT(*) FROM Customers) AS customers,
        (SELECT COUNT(*) FROM Products) AS products,
        (SELECT COUNT(*) FROM Orders) AS orders,
        (SELECT COALESCE(SUM(Amount), 0) FROM Payments WHERE Status = 'Completed') AS revenue,
        (SELECT COUNT(*) FROM Payments WHERE Status = 'Pending') AS pendingPayments,
        (SELECT COUNT(*) FROM Returns WHERE Status = 'Pending') AS pendingReturns`;
    const lowStock = `SELECT p.Product_ID, p.Product_Name, i.Quantity_Available
        FROM Inventory i JOIN Products p ON p.Product_ID = i.Product_ID
        WHERE i.Quantity_Available <= ? ORDER BY i.Quantity_Available, p.Product_Name`;

    db.query(totals, (err, totalRows) => {
        if (err) return sendDbError(res, err);
        db.query(lowStock, [LOW_STOCK_THRESHOLD], (err2, lowRows) => {
            if (err2) return sendDbError(res, err2);
            res.json({ ...totalRows[0], lowStockThreshold: LOW_STOCK_THRESHOLD, lowStock: lowRows });
        });
    });
});

// READ: list all records in a table
app.get('/api/:table', (req, res) => {
    const table = req.params.table;
    if (!isValidTable(table)) {
        return res.status(404).json({ success: false, message: 'Unknown table' });
    }
    db.query('SELECT * FROM ?? ORDER BY ??', [table, TABLES[table].pk], (err, rows) => {
        if (err) return sendDbError(res, err);
        res.json(rows);
    });
});

// READ ONE: lets the update form pre-fill itself when an ID is typed
app.get('/api/:table/:id', (req, res) => {
    const table = req.params.table;
    if (!isValidTable(table)) {
        return res.status(404).json({ success: false, message: 'Unknown table' });
    }
    db.query('SELECT * FROM ?? WHERE ?? = ?', [table, TABLES[table].pk, req.params.id], (err, rows) => {
        if (err) return sendDbError(res, err);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'No record found with that ID.' });
        res.json(rows[0]);
    });
});

// Keep only the columns the client actually filled in
function filledValues(table, body) {
    const values = {};
    for (const col of TABLES[table].columns) {
        const value = body[col];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            values[col] = String(value).trim();
        }
    }
    return values;
}

// CREATE: the primary key is auto-numbered unless the client supplies one;
// optional columns are filled in by the database
app.post('/api/:table', (req, res) => {
    const table = req.params.table;
    if (!isValidTable(table)) {
        return res.status(404).json({ success: false, message: 'Unknown table' });
    }
    const { pk, columns, optional } = TABLES[table];
    const values = filledValues(table, req.body);

    for (const col of columns) {
        if (col !== pk && !optional.includes(col) && values[col] === undefined) {
            return res.status(400).json({ success: false, message: `${col} is required` });
        }
    }

    const cols = Object.keys(values);
    db.query('INSERT INTO ?? (??) VALUES (?)', [table, cols, cols.map((c) => values[c])], (err, result) => {
        if (err) return sendDbError(res, err);
        res.json({ success: true, id: values[pk] || result.insertId, message: `Record saved. ${pk} = ${values[pk] || result.insertId}.` });
    });
});

// UPDATE: changes only the columns that were filled in
app.put('/api/:table/:id', (req, res) => {
    const table = req.params.table;
    if (!isValidTable(table)) {
        return res.status(404).json({ success: false, message: 'Unknown table' });
    }
    const { pk } = TABLES[table];
    const values = filledValues(table, req.body);
    delete values[pk];

    const cols = Object.keys(values);
    if (cols.length === 0) {
        return res.status(400).json({ success: false, message: 'Nothing to update: fill in at least one field.' });
    }

    const assignments = cols.map(() => '?? = ?').join(', ');
    const params = [table];
    cols.forEach((c) => params.push(c, values[c]));
    params.push(pk, req.params.id);

    db.query(`UPDATE ?? SET ${assignments} WHERE ?? = ?`, params, (err, result) => {
        if (err) return sendDbError(res, err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No record found with that ID.' });
        }
        res.json({ success: true, message: 'Record updated successfully.' });
    });
});

// DELETE: remove one record by primary key
app.delete('/api/:table/:id', (req, res) => {
    const table = req.params.table;
    if (!isValidTable(table)) {
        return res.status(404).json({ success: false, message: 'Unknown table' });
    }
    db.query('DELETE FROM ?? WHERE ?? = ?', [table, TABLES[table].pk, req.params.id], (err, result) => {
        if (err) return sendDbError(res, err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No record found with that ID.' });
        }
        res.json({ success: true, message: 'Record deleted.' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
