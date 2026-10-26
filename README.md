# Sporting Goods Store Management System

Built from the sporting goods ER diagram (Discount, Customer, Product, Inventory, Order, Payment, Return), following the Lab 4 and Lab 5 & 6 formats.

## Work split (6 segments)

| # | Segment | Owner | Files | Lab ref | Deliverable |
|---|---|---|---|---|---|
| 1 | Schema & table creation (DDL) | ________ | `sql/01_schema.sql` | Lab 5 & 6, Step 1 | 9 tables with PKs, FKs and UNIQUE indexes; Schema Navigator screenshot |
| 2 | Data population & verification (DML) | ________ | `sql/02_data_and_queries.sql` | Lab 5 & 6, Steps 2-3 | INSERTs in dependency order; SELECT and JOIN result grids |
| 3 | Indexing, catalog & secure views | ________ | `sql/03_indexes_views_catalog.sql` | Lab 4 | Indexes, `information_schema` queries, restricted views; Table Inspector and EER screenshots |
| 4 | Backend API | ________ | `server.js`, `package.json` | Login app | Express + MySQL: login, list, add/update, delete, reports |
| 5 | Frontend | ________ | `public/index.html`, `dashboard.html`, `update.html`, `app.js`, `styles.css` | Login app | Login, dashboard (View / Update / Delete), update form |
| 6 | Automation (triggers & setup) | ________ | `sql/04_automation.sql`, `scripts/setup.js` | Lab 4 (catalog) | Stored procedure + triggers, one-command setup |

Hand-off order: 1 -> 2 -> 3 -> 6 -> 4 -> 5.

## Run it (3 steps)

1. Copy `.env.example` to `.env` and put your MySQL password in `DB_PASSWORD`.
2. `npm install`
3. `npm run setup` (creates the database, sample data, indexes, views and triggers), then `npm start`

Open http://localhost:3000. Click "Create an account" to sign up as a customer, or log in with the demo admin account `admin` / `admin123`.

Other commands: `npm run reset` wipes the database and rebuilds it from the SQL files; `npm run dev` restarts the server when you edit code.
You can still run the four SQL files by hand in MySQL Workbench, in order 01 -> 04.

## What is automated

| Before | Now |
|---|---|
| Typing every ID by hand | IDs are auto-numbered (leave the ID blank when adding) |
| Typing order date, total, status | Date = today, status = Processing, total = product price minus the customer's best discount |
| Checking stock by eye | An order is refused if the product is sold out; each order takes 1 unit from `Inventory` |
| Fixing stock after cancels/returns | Cancelling an order, or approving a return, puts the unit back (un-approving removes it again) |
| Keeping `Products.Quantity` and `Inventory.Quantity_Available` equal | `Inventory` is the source of truth; `Products.Quantity` follows it |
| Typing the payment amount | Defaults to the order total |
| Typing the product on a return | Filled in from the order, and rejected if it does not belong to that order |
| Writing the Inventory `Records` note | Written automatically on every stock change |
| Re-entering every field to edit a record | Type an ID and the record loads; blank fields stay unchanged |
| Giving loyal customers discounts | Loyalty ladder in the `Discount_Tiers` table (default: 3 orders = 5%, 6 = 10%, 10 = 15%). A trigger raises the customer's discount after each order; it applies from the next order. Edit the ladder from the dashboard. A bigger manual discount is never lowered, and cancelled orders do not count |
| Spotting low stock | Dashboard shows totals and a low-stock alert (`LOW_STOCK_THRESHOLD` in `.env`, default 10) |
| `set DB_PASSWORD=...` every session | Read from `.env` |
| Connection dying after MySQL idles | Connection pool reconnects by itself |

## Notes:

- Table names are plural because `Order` and `Return` are reserved words in MySQL.
- `Users` is not in the ER diagram; it only supports the login screen.
- Each order is for one unit of one product (as in the ER diagram), so every automatic stock change is 1 unit.
- The sample data in `02` is loaded before the triggers exist, so it is left exactly as written; only new records are handled automatically.
- Each product has one `Inventory` row (enforced by a UNIQUE index added to `01_schema.sql`).
- There are two roles. **Admin** gets the dashboard (view, add, edit and delete every table, totals, low-stock alert). **User** gets the shop screen: browse products, order, cancel an order that is still processing, and request a return on a delivered order.
- Signing up needs a full name, email, phone, a username (3-50 letters, numbers, . _ -) and a password of at least 8 characters. It also creates the customer record, so the customer's discount applies automatically to their orders.
- A user can only see and change their own orders; the server checks this, not just the screen. The API refuses every admin route for a normal user.
- Placing an order creates the order and a Pending payment together. Cancelling cancels the pending payment and returns the stock. An admin approves returns from the dashboard (Returns -> Update -> Status = Approved).
- Every new sign up is a user. To make someone an admin, run in MySQL: `UPDATE sporting_goods_store.Users SET Role = 'admin' WHERE Username = 'their_username';`
- Passwords are stored as salted scrypt hashes. The demo `admin` password is plain text in `02_data_and_queries.sql`; it is converted to a hash the first time admin logs in.
- Every API route except login and sign up needs a logged-in session (HttpOnly cookie, 8 hours). Sessions are kept in memory, so restarting the server logs everyone out.
- Not included: password reset by email (the "Forgot Password" form is still a demo), login attempt limits, and HTTPS. Add those before using this outside coursework.
