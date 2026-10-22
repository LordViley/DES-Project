// ---------- Login / Forgot password ----------

// Toggle Login vs Forgot Password UI
function toggleForgotPass(showForgot) {
    const loginForm = document.getElementById('loginForm');
    const forgotForm = document.getElementById('forgotForm');

    if (showForgot) {
        loginForm.style.display = 'none';
        forgotForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        forgotForm.style.display = 'none';
    }
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
                window.location.href = 'dashboard.html';
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

    updateTitle.innerText = `Update ${tableName}`;

    schema[tableName].columns.forEach((field) => {
        const div = document.createElement('div');
        div.className = 'form-group';

        const label = document.createElement('label');
        label.innerText = field;

        const input = document.createElement('input');
        input.type = field.toLowerCase().includes('date') ? 'date' : 'text';
        input.name = field;
        input.required = true;
        input.placeholder = `Enter ${field}`;

        div.appendChild(label);
        div.appendChild(input);
        dynamicFields.appendChild(div);
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const data = {};
        new FormData(form).forEach((value, key) => {
            data[key] = value;
        });

        try {
            const response = await fetch(`/api/${encodeURIComponent(tableName)}`, {
                method: 'POST',
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

document.addEventListener('DOMContentLoaded', function () {
    loadDashboard();
    loadUpdateForm();
});
