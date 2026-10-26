-- =====================================================================
-- SEGMENT 2: Data Population (DML) & Verification Queries
-- Ref: Lab 5 & 6, Steps 2 and 3
-- Inserts follow dependency order so every foreign key finds its parent row.
-- =====================================================================

USE sporting_goods_store;

-- Insert Data: Customers
INSERT INTO Customers (Customer_No, Customer_Name, Email, Phone) VALUES
(1, 'Wanjiru Kamau', 'wanjiru.kamau@example.com', '+254711111111'),
(2, 'Brian Otieno',  'brian.otieno@example.com',  '+254722222222'),
(3, 'Amina Hassan',  'amina.hassan@example.com',  '+254733333333'),
(4, 'Kevin Mwangi',  'kevin.mwangi@example.com',  '+254744444444');

-- Insert Data: Products
INSERT INTO Products (Product_ID, Product_Name, Category, Price, Quantity) VALUES
(1, 'Adidas Match Football',     'Balls',          3500.00, 40),
(2, 'Nike Running Shoes',        'Footwear',       9800.00, 25),
(3, 'Wilson Tennis Racket',      'Racquet Sports', 12500.00, 10),
(4, 'Non-Slip Yoga Mat',         'Fitness',        2200.00, 60),
(5, 'Spalding Basketball',       'Balls',          4200.00, 30),
(6, 'Adjustable Dumbbell Set',   'Fitness',        15000.00, 8);

-- Insert Data: Inventory
INSERT INTO Inventory (Inventory_No, Product_ID, Quantity_Available, Records) VALUES
(1001, 1, 40, 'Restocked 2026-01-15'),
(1002, 2, 25, 'Restocked 2026-02-10'),
(1003, 3, 10, 'Restocked 2026-02-10'),
(1004, 4, 60, 'Restocked 2026-02-28'),
(1005, 5, 30, 'Restocked 2026-03-01'),
(1006, 6, 8,  'Restocked 2026-03-05');

-- Insert Data: Discounts
INSERT INTO Discounts (Discount_ID, Customer_No, Discount_Percentage, Discount_Amount) VALUES
(201, 1, 10.00, 350.00),
(202, 3, 5.00,  625.00);

-- Insert Data: Discount_Tiers (loyalty ladder; editable from the dashboard)
INSERT INTO Discount_Tiers (Min_Orders, Percentage) VALUES
(3, 5.00),
(6, 10.00),
(10, 15.00);

-- Insert Data: Orders
INSERT INTO Orders (Order_No, Product_ID, Customer_No, Order_date, Total_Amount, Package_status) VALUES
(5001, 1, 1, '2026-03-02', 3150.00,  'Delivered'),
(5002, 2, 2, '2026-03-05', 9800.00,  'Shipped'),
(5003, 3, 3, '2026-03-08', 11875.00, 'Processing'),
(5004, 4, 4, '2026-03-10', 2200.00,  'Delivered'),
(5005, 5, 2, '2026-03-12', 4200.00,  'Shipped');

-- Insert Data: Payments
INSERT INTO Payments (Payment_ID, Order_No, Amount, Payment_Date, Payment_Method, Status) VALUES
(9001, 5001, 3150.00,  '2026-03-02', 'M-Pesa', 'Completed'),
(9002, 5002, 9800.00,  '2026-03-05', 'Card',   'Completed'),
(9003, 5003, 11875.00, '2026-03-08', 'M-Pesa', 'Pending'),
(9004, 5004, 2200.00,  '2026-03-10', 'Cash',   'Completed'),
(9005, 5005, 4200.00,  '2026-03-12', 'Card',   'Completed');

-- Insert Data: Returns
INSERT INTO Returns (Return_No, Order_No, Product_ID, Return_Date, Reason, Status) VALUES
(7001, 5004, 4, '2026-03-15', 'Item not as described', 'Approved'),
(7002, 5001, 1, '2026-03-14', 'Defective valve',       'Pending');

-- Insert Data: Users (demo login for the web app; plain text is for lab use only)
INSERT INTO Users (Username, Password, Role) VALUES
('admin', 'admin123', 'admin');

-- ---------------------------------------------------------------------
-- Verification & Query Scripts
-- ---------------------------------------------------------------------

-- View all customers
SELECT * FROM sporting_goods_store.Customers;

-- View all products
SELECT * FROM sporting_goods_store.Products;

-- View orders with customer and product details
SELECT
    o.Order_No,
    c.Customer_Name,
    p.Product_Name,
    o.Order_date,
    o.Total_Amount,
    o.Package_status
FROM sporting_goods_store.Orders o
JOIN sporting_goods_store.Customers c ON o.Customer_No = c.Customer_No
JOIN sporting_goods_store.Products  p ON o.Product_ID  = p.Product_ID;

-- View current stock levels for products
SELECT
    p.Product_Name,
    p.Category,
    i.Quantity_Available,
    i.Records
FROM sporting_goods_store.Inventory i
JOIN sporting_goods_store.Products p ON i.Product_ID = p.Product_ID;

-- View payments with the order they belong to
SELECT
    pay.Payment_ID,
    pay.Order_No,
    c.Customer_Name,
    pay.Amount,
    pay.Payment_Method,
    pay.Status
FROM sporting_goods_store.Payments pay
JOIN sporting_goods_store.Orders    o ON pay.Order_No = o.Order_No
JOIN sporting_goods_store.Customers c ON o.Customer_No = c.Customer_No;

-- View returns with order and product details
SELECT
    r.Return_No,
    r.Order_No,
    p.Product_Name,
    r.Return_Date,
    r.Reason,
    r.Status
FROM sporting_goods_store.Returns r
JOIN sporting_goods_store.Products p ON r.Product_ID = p.Product_ID;

-- View customers with their discounts
SELECT
    c.Customer_Name,
    d.Discount_Percentage,
    d.Discount_Amount
FROM sporting_goods_store.Discounts d
JOIN sporting_goods_store.Customers c ON d.Customer_No = c.Customer_No;
