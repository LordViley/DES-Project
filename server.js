const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve only the public folder, so server.js and its settings are never downloadable
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection. Set DB_PASSWORD in your terminal instead of typing it in this file.
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'sporting_goods_store',
    dateStrings: true // return DATE columns as 'YYYY-MM-DD' text, avoiding timezone shifts
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }
    console.log('Connected to MySQL Database: sporting_goods_store');
});

// Tables the dashboard can manage. Only names listed here ever reach a query.
const TABLES = {
    Customers: { pk: 'Customer_No',  columns: ['Customer_No', 'Customer_Name', 'Email', 'Phone'] },
    Products:  { pk: 'Product_ID',   columns: ['Product_ID', 'Product_Name', 'Category', 'Price', 'Quantity'] },
    Inventory: { pk: 'Inventory_No', columns: ['Inventory_No', 'Product_ID', 'Quantity_Available', 'Records'] },
    Discounts: { pk: 'Discount_ID',  columns: ['Discount_ID', 'Customer_No', 'Discount_Percentage', 'Discount_Amount'] },
    Orders:    { pk: 'Order_No',     columns: ['Order_No', 'Product_ID', 'Customer_No', 'Order_date', 'Total_Amount', 'Package_status'] },
    Payments:  { pk: 'Payment_ID',   columns: ['Payment_ID', 'Order_No', 'Amount', 'Payment_Date', 'Payment_Method', 'Status'] },
    Returns:   { pk: 'Return_No',    columns: ['Return_No', 'Order_No', 'Product_ID', 'Return_Date', 'Reason', 'Status'] }
};

function isValidTable(name) {
    return Object.prototype.hasOwnProperty.call(TABLES, name);
}

function sendDbError(res, err) {
    console.error('Database error:', err.code, err.message);
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

// LOGIN
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM Users WHERE Username = ? AND Password = ?';

    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (results.length > 0) {
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Username or Password' });
        }
    });
});

// SCHEMA: lets the frontend build its forms from this single definition
app.get('/api/schema', (req, res) => {
    res.json(TABLES);
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

// CREATE / UPDATE: adds the record, or updates it if the primary key already exists
app.post('/api/:table', (req, res) => {
    const table = req.params.table;
    if (!isValidTable(table)) {
        return res.status(404).json({ success: false, message: 'Unknown table' });
    }
    const { pk, columns } = TABLES[table];

    const values = [];
    for (const col of columns) {
        const value = req.body[col];
        if (value === undefined || String(value).trim() === '') {
            return res.status(400).json({ success: false, message: `${col} is required` });
        }
        values.push(String(value).trim());
    }

    const updates = columns
        .filter((col) => col !== pk)
        .map((col) => `${mysql.escapeId(col)} = VALUES(${mysql.escapeId(col)})`)
        .join(', ');

    const sql = `INSERT INTO ?? (??) VALUES (?) ON DUPLICATE KEY UPDATE ${updates}`;

    db.query(sql, [table, columns, values], (err) => {
        if (err) return sendDbError(res, err);
        res.json({ success: true, message: 'Record saved successfully.' });
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
