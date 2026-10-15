# Sporting Goods Store Management System

Built from the sporting goods ER diagram (Discount, Customer, Product, Inventory, Order, Payment, Return), following the Lab 4 and Lab 5 & 6 formats.

## Work split (5 segments)

| # | Segment | Owner | Files | Lab ref | Deliverable |
|---|---|---|---|---|---|
| 1 | Schema & table creation (DDL) | ________ | `sql/01_schema.sql` | Lab 5 & 6, Step 1 | 8 tables with PKs, FKs and UNIQUE indexes; Schema Navigator screenshot |
| 2 | Data population & verification (DML) | ________ | `sql/02_data_and_queries.sql` | Lab 5 & 6, Steps 2-3 | INSERTs in dependency order; SELECT and JOIN result grids |
| 3 | Indexing, catalog & secure views | ________ | `sql/03_indexes_views_catalog.sql` | Lab 4 | Indexes, `information_schema` queries, restricted views; Table Inspector and EER screenshots |
| 4 | Backend API | ________ | `server.js`, `package.json` | Login app | Express + MySQL: login, list, add/update, delete |
| 5 | Frontend | ________ | `public/index.html`, `dashboard.html`, `update.html`, `app.js`, `styles.css` | Login app | Login, dashboard (View / Update / Delete), update form |

Hand-off order: 1 -> 2 -> 3 -> 4 -> 5. Segments 4 and 5 need the database from segments 1 and 2 to test.

## Run it

1. In MySQL Workbench, run `01_schema.sql`, then `02_data_and_queries.sql`, then `03_indexes_views_catalog.sql`.
2. In this folder run `npm install`.
3. Set your MySQL password for the session, then start the server:
   - Windows (Command Prompt): `set DB_PASSWORD=your_password` then `node server.js`
   - Windows (PowerShell): `$env:DB_PASSWORD="your_password"; node server.js`
   - Mac/Linux: `DB_PASSWORD=your_password node server.js`
4. Open http://localhost:3000 and log in with `admin` / `admin123`.

## Notes

- Table names are plural because `Order` and `Return` are reserved words in MySQL.
- `Users` is not in the ER diagram; it only supports the login screen.
- Passwords are stored as plain text, as in the lab. Fine for coursework, not for a real system.
- The API itself has no login check, so anyone who knows the URLs can call it.
