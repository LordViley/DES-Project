// ---------- Login / Forgot password ----------

// Show one of the three forms on the login page
function showForm(formId) {
    ['loginForm', 'signupForm', 'forgotForm'].forEach((id) => {
        const form = document.getElementById(id);
        if (form) form.style.display = id === formId ? 'block' : 'none';
    });
}

function toggleForgotPass(showForgot) {
    showForm(showForgot ? 'forgotForm' : 'loginForm');
}

// Sign up: create the account, then go straight to the dashboard
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;

        if (password !== document.getElementById('confirmPassword').value) {
            alert('Passwords do not match.');
            return;
        }

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    fullName: document.getElementById('fullName').value,
                    email: document.getElementById('signupEmail').value,
                    phone: document.getElementById('signupPhone').value
                })
            });
            const result = await response.json();

            if (result.success) {
                window.location.href = 'shop.html';
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error during sign up:', error);
            alert('Server error. Ensure Node server is running.');
        }
    });
}

// Handle login form submission via API
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });

            const result = await response.json();

            if (result.success) {
                window.location.href = result.role === 'admin' ? 'dashboard.html' : 'shop.html';
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('Server error. Ensure Node server is running.');
        }
    });
}

// Forgot password is a demo: no email service is connected
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
    forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        alert('If this email is registered, a reset link will be sent. (Demo only: no email service connected.)');
        toggleForgotPass(false);
    });
}

// ---------- Shared helpers ----------

async function fetchSchema() {
    const response = await fetch('/api/schema');
    return response.json();
}

function hasTable(schema, tableName) {
    return Object.prototype.hasOwnProperty.call(schema, tableName);
}

function makeButton(label, onClick, extraClass) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (extraClass) button.className = extraClass;
    button.addEventListener('click', onClick);
    return button;
}

// ---------- Dashboard ----------

// Totals and low-stock alert, refreshed whenever the dashboard opens
async function loadSummary() {
    const box = document.getElementById('summary');
    if (!box) return;

    try {
        const response = await fetch('/api/reports/summary');
        const data = await response.json();

        const stats = [
            ['Customers', data.customers],
            ['Products', data.products],
            ['Orders', data.orders],
            ['Revenue (paid)', Number(data.revenue).toLocaleString()],
            ['Pending payments', data.pendingPayments],
            ['Pending returns', data.pendingReturns]
        ];

        const grid = document.createElement('div');
        grid.className = 'summary-grid';
        stats.forEach(([label, value]) => {
            const stat = document.createElement('div');
            stat.className = 'stat';
            const strong = document.createElement('strong');
            strong.textContent = value;
            const span = document.createElement('span');
            span.textContent = label;
            stat.appendChild(strong);
            stat.appendChild(span);
            grid.appendChild(stat);
        });
        box.appendChild(grid);

        if (data.lowStock.length > 0) {
            const alertBox = document.createElement('div');
            alertBox.className = 'alert-box';
            alertBox.textContent = `Low stock (${data.lowStockThreshold} or fewer units):`;
            const ul = document.createElement('ul');
            data.lowStock.forEach((item) => {
                const li = document.createElement('li');
                li.textContent = `${item.Product_Name}: ${item.Quantity_Available} left`;
                ul.appendChild(li);
            });
            alertBox.appendChild(ul);
            box.appendChild(alertBox);
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// Build one card per table, each with View, Update and Delete actions
async function loadDashboard() {
    const list = document.getElementById('tableList');
    if (!list) return;

    try {
        const schema = await fetchSchema();

        Object.keys(schema).forEach((tableName) => {
            const card = document.createElement('div');
            card.className = 'table-card';

            const title = document.createElement('strong');
            title.textContent = tableName;

            const actions = document.createElement('div');
            actions.className = 'actions';
            actions.appendChild(makeButton('View', () => viewTable(tableName)));
            actions.appendChild(makeButton('Update', () => goToUpdate(tableName)));
            actions.appendChild(makeButton('Delete', () => deleteTableRecord(tableName), 'btn-danger'));

            card.appendChild(title);
            card.appendChild(actions);
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Server error. Ensure Node server is running.');
    }
}

// Show all records of a table in the results area
async function viewTable(tableName) {
    const results = document.getElementById('results');

    try {
        const response = await fetch(`/api/${encodeURIComponent(tableName)}`);
        if (!response.ok) {
            const failure = await response.json();
            alert(failure.message);
            return;
        }
        const rows = await response.json();

        results.innerHTML = '';

        const heading = document.createElement('h3');
        heading.textContent = `${tableName} (${rows.length} record${rows.length === 1 ? '' : 's'})`;
        results.appendChild(heading);

        if (rows.length === 0) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';

        const table = document.createElement('table');
        table.className = 'data-table';

        const headRow = table.createTHead().insertRow();
        Object.keys(rows[0]).forEach((column) => {
            const th = document.createElement('th');
            th.textContent = column;
            headRow.appendChild(th);
        });

        const body = table.createTBody();
        rows.forEach((row) => {
            const tr = body.insertRow();
            Object.values(row).forEach((value) => {
                tr.insertCell().textContent = value;
            });
        });

        wrapper.appendChild(table);
        results.appendChild(wrapper);
    } catch (error) {
        console.error('Error loading records:', error);
        alert('Server error. Ensure Node server is running.');
    }
}

// Redirect to update.html with the selected table parameter
function goToUpdate(tableName) {
    window.location.href = `update.html?table=${encodeURIComponent(tableName)}`;
}

// Delete one record, chosen by its primary key
async function deleteTableRecord(tableName) {
    try {
        const schema = await fetchSchema();
        const pk = schema[tableName].pk;

        const id = prompt(`Enter the ${pk} of the ${tableName} record to delete:`);
        if (!id || id.trim() === '') return;

        if (!confirm(`Delete ${tableName} record with ${pk} = ${id.trim()}? This cannot be undone.`)) return;

        const response = await fetch(
            `/api/${encodeURIComponent(tableName)}/${encodeURIComponent(id.trim())}`,
            { method: 'DELETE' }
        );
        const result = await response.json();
        alert(result.message);
        document.getElementById('summary').innerHTML = '';
        loadSummary();
    } catch (error) {
        console.error('Error deleting record:', error);
        alert('Server error. Ensure Node server is running.');
    }
}

// ---------- Update form ----------

// Generate form inputs from the selected table's schema
async function loadUpdateForm() {
    const form = document.getElementById('updateForm');
    const dynamicFields = document.getElementById('dynamicFields');
    const updateTitle = document.getElementById('updateTitle');
    if (!form || !dynamicFields) return;

    const tableName = new URLSearchParams(window.location.search).get('table');

    let schema;
    try {
        schema = await fetchSchema();
    } catch (error) {
        console.error('Error loading schema:', error);
        alert('Server error. Ensure Node server is running.');
        return;
    }

    if (!tableName || !hasTable(schema, tableName)) {
        updateTitle.innerText = 'Table not found';
        return;
    }

    const { pk, columns, optional } = schema[tableName];
    updateTitle.innerText = `Add / Update ${tableName}`;

    columns.forEach((field) => {
        const div = document.createElement('div');
        div.className = 'form-group';

        const label = document.createElement('label');
        label.innerText = field;

        const input = document.createElement('input');
        input.type = field.toLowerCase().includes('date') ? 'date' : 'text';
        input.name = field;

        const note = document.createElement('div');
        note.className = 'field-note';

        if (field === pk) {
            input.placeholder = 'Leave blank for a new record';
            note.textContent = 'Auto-numbered when blank.';
        } else if (optional.includes(field)) {
            input.placeholder = 'Filled in automatically';
            note.textContent = 'Optional: the system fills this in if left blank.';
        } else {
            input.placeholder = `Enter ${field}`;
        }

        div.appendChild(label);
        div.appendChild(input);
        if (note.textContent) div.appendChild(note);
        dynamicFields.appendChild(div);
    });

    const pkInput = form.elements[pk];

    // Typing an existing ID loads that record so you can edit just what changed
    pkInput.addEventListener('change', async function () {
        const id = pkInput.value.trim();
        if (id === '') return;
        try {
            const response = await fetch(`/api/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`);
            if (!response.ok) {
                alert(`No ${tableName} record with ${pk} = ${id}. Clear the ID to add a new record.`);
                return;
            }
            const record = await response.json();
            columns.forEach((field) => {
                if (field !== pk) form.elements[field].value = record[field] ?? '';
            });
        } catch (error) {
            console.error('Error loading record:', error);
        }
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const data = {};
        new FormData(form).forEach((value, key) => {
            data[key] = value;
        });

        const id = (data[pk] || '').trim();
        const url = id === ''
            ? `/api/${encodeURIComponent(tableName)}`
            : `/api/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`;

        try {
            const response = await fetch(url, {
                method: id === '' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            alert(result.message);
            if (result.success) form.reset();
        } catch (error) {
            console.error('Error saving record:', error);
            alert('Server error. Ensure Node server is running.');
        }
    });
}

// Dashboard and update pages: send visitors who are not logged in back to the login screen
async function requireLogin() {
    const response = await fetch('/api/me');
    if (!response.ok) {
        window.location.href = 'index.html';
        return false;
    }
    const me = await response.json();
    if (me.role !== 'admin') {
        window.location.href = 'shop.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async function () {
    const isInnerPage = document.getElementById('tableList') || document.getElementById('updateForm');
    if (!isInnerPage) return;
    if (!(await requireLogin())) return;

    const logout = document.getElementById('logoutLink');
    if (logout) {
        logout.addEventListener('click', async function (e) {
            e.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = 'index.html';
        });
    }

    loadSummary();
    loadDashboard();
    loadUpdateForm();
});
