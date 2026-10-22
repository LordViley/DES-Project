-- =====================================================================
-- SEGMENT 3: Indexing, System Catalog Inspection & Secure Views
-- Ref: Lab 4 (Steps 1, 3, 4, 5)
-- Also owns the report screenshots: Table Inspector (Columns, Indexes,
-- Foreign Keys tabs) and the Workbench Reverse Engineer / EER diagram.
-- =====================================================================

USE sporting_goods_store;

-- ---------------------------------------------------------------------
-- Performance indexes on foreign key columns
-- ---------------------------------------------------------------------
CREATE INDEX idx_orders_customer ON Orders(Customer_No);
CREATE INDEX idx_orders_product  ON Orders(Product_ID);
CREATE INDEX idx_payments_order  ON Payments(Order_No);
CREATE INDEX idx_returns_order   ON Returns(Order_No);

-- ---------------------------------------------------------------------
-- Exploring the system catalog (data dictionary)
-- ---------------------------------------------------------------------

-- All tables in the schema
SELECT table_name, table_type, engine
FROM information_schema.tables
WHERE table_schema = 'sporting_goods_store';

-- Column metadata and data types for Customers
SELECT column_name, data_type, is_nullable, column_key
FROM information_schema.columns
WHERE table_schema = 'sporting_goods_store' AND table_name = 'Customers';

-- Indexes on Orders
SELECT index_name, column_name, non_unique
FROM information_schema.statistics
WHERE table_schema = 'sporting_goods_store' AND table_name = 'Orders';

-- Foreign key relationships across the schema
SELECT table_name, column_name, referenced_table_name, referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'sporting_goods_store' AND referenced_table_name IS NOT NULL;

-- ---------------------------------------------------------------------
-- Secure data abstraction using restricted views
-- ---------------------------------------------------------------------

-- Masks customer contact details (Email, Phone)
CREATE VIEW Public_Customer_View AS
    SELECT Customer_No, Customer_Name
    FROM Customers;

-- Joined, read-only summary of orders
CREATE VIEW Order_Summary_View AS
    SELECT o.Order_No, c.Customer_Name, p.Product_Name,
           o.Order_date, o.Total_Amount, o.Package_status
    FROM Orders o
    JOIN Customers c ON o.Customer_No = c.Customer_No
    JOIN Products  p ON o.Product_ID  = p.Product_ID;

-- Test data retrieval from the views (Email and Phone are excluded)
SELECT * FROM Public_Customer_View;
SELECT * FROM Order_Summary_View;

-- Verify view structure in the system catalog
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'sporting_goods_store';
