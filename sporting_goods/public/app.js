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
            const sideNav = document.getElementById('sideNav');
            if (sideNav) {
                sideNav.appendChild(makeButton(tableName, () => viewTable(tableName), 'side-link'));
}
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Server error. Ensure Node server is running.');
    }
}

// Count boxes at the top of the dashboard
async function loadSummary() {
    const box = document.getElementById('summary');
    if (!box) return;

    try {
        const get = async (table) => (await fetch(`/api/${table}`)).json();
        const [customers, products, orders, payments] = await Promise.all([
            get('Customers'), get('Products'), get('Orders'), get('Payments')
        ]);

        const pending = payments.filter((p) => p.Status === 'Pending').length;

        const stats = [
            ['Customers', customers.length],
            ['Products', products.length],
            ['Orders', orders.length],
            ['Pending payments', pending]
        ];

        stats.forEach(([label, value]) => {
            const stat = document.createElement('div');
            stat.className = 'stat';

            const number = document.createElement('span');
            number.className = 'stat-number';
            number.textContent = value;

            const text = document.createElement('span');
            text.className = 'stat-label';
            text.textContent = label;

            stat.appendChild(number);
            stat.appendChild(text);
            box.appendChild(stat);
        });
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}
// Sidebar links on the Update page (the dashboard builds its own in loadDashboard)
async function loadSideNav() {
    const nav = document.getElementById('sideNav');
    if (!nav || document.getElementById('tableList')) return;

    const current = new URLSearchParams(window.location.search).get('table');

    try {
        const schema = await fetchSchema();
        Object.keys(schema).forEach((tableName) => {
            const link = document.createElement('a');
            link.className = 'side-link' + (tableName === current ? ' active' : '');
            link.href = `update.html?table=${encodeURIComponent(tableName)}`;
            link.textContent = tableName;
            nav.appendChild(link);
        });
    } catch (error) {
        console.error('Error loading sidebar:', error);
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
        const totalLabel = `${rows.length} record${rows.length === 1 ? '' : 's'}`;

        results.innerHTML = '';

        // Header bar: title, count badge, search box, close button
        const bar = document.createElement('div');
        bar.className = 'results-bar';

        const heading = document.createElement('h3');
        heading.textContent = tableName;

        const count = document.createElement('span');
        count.className = 'count-badge';
        count.textContent = totalLabel;

        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'results-search';
        search.placeholder = `Search ${tableName.toLowerCase()}...`;

        const close = makeButton('Close', () => { results.innerHTML = ''; }, 'results-close');

        bar.appendChild(heading);
        bar.appendChild(count);
        bar.appendChild(search);
        bar.appendChild(close);
        results.appendChild(bar);
        results.scrollIntoView({ behavior: 'smooth' });

        if (rows.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'no-match';
            empty.textContent = 'No records in this table yet.';
            results.appendChild(empty);
            return;
        }

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
            Object.entries(row).forEach(([column, value]) => {
                const cell = tr.insertCell();
                if (column === 'Package_status' || column === 'Status') {
                    const badge = document.createElement('span');
                    badge.className = 'badge badge-' + String(value).toLowerCase();
                    badge.textContent = value;
                    cell.appendChild(badge);
                } else {
                    cell.textContent = value;
                }
            });
        });

        wrapper.appendChild(table);
        results.appendChild(wrapper);

        const noMatch = document.createElement('p');
        noMatch.className = 'no-match';
        noMatch.style.display = 'none';
        noMatch.textContent = 'No records match your search.';
        results.appendChild(noMatch);

        // Filter rows as the user types
        search.addEventListener('input', () => {
            const query = search.value.trim().toLowerCase();
            let shown = 0;

            Array.from(body.rows).forEach((tr) => {
                const match = tr.textContent.toLowerCase().includes(query);
                tr.style.display = match ? '' : 'none';
                if (match) shown++;
            });

            count.textContent = query ? `${shown} of ${rows.length}` : totalLabel;
            noMatch.style.display = shown === 0 ? 'block' : 'none';
        });
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
function addOption(select, value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    select.appendChild(opt);
}


async function buildInput(field, rule, schema) {
    let input;

    if (rule.type === 'select') {
        input = document.createElement('select');
        addOption(input, '', `Select ${field}`);
        rule.options.forEach((o) => addOption(input, o, o));
    } else if (rule.type === 'ref') {
        input = document.createElement('select');
        addOption(input, '', `Select ${field}`);
        const rows = await (await fetch(`/api/${encodeURIComponent(rule.table)}`)).json();
        const parent = schema[rule.table];
        rows.forEach((r) => addOption(input, r[parent.pk], `${r[parent.pk]} - ${r[parent.columns[1]]}`));
    } else {
        input = document.createElement('input');
        input.type = rule.type || (field.toLowerCase().includes('date') ? 'date' : 'text');
        if (rule.min !== undefined) input.min = rule.min;
        if (rule.max !== undefined) input.max = rule.max;
        if (rule.step !== undefined) input.step = rule.step;
        if (rule.pattern) input.pattern = rule.pattern;
        if (field.endsWith('_ID') || field.endsWith('_No')) { input.type = 'number'; input.min = 1; input.step = 1; }
        input.title = rule.hint || '';
        input.placeholder = rule.hint || `Enter ${field}`;
    }

    input.name = field;
    input.required = true;
    return input;
}



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
    
        for (const field of schema[tableName].columns) {
    const rule = schema[tableName].fields[field] || {};

    const div = document.createElement('div');
    div.className = 'form-group';
    const label = document.createElement('label');
    label.innerText = field;

    div.appendChild(label);
    div.appendChild(await buildInput(field, rule, schema));
    dynamicFields.appendChild(div);
}
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
    loadSummary();
    loadDashboard();
    loadSideNav();
    loadUpdateForm();
});

