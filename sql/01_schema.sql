-- =====================================================================
-- SEGMENT 1: Schema & Table Creation (DDL)       Ref: Lab 5 & 6, Step 1
-- Sporting Goods Store Management System
-- Run order: 01_schema.sql -> 02_data_and_queries.sql -> 03_indexes_views_catalog.sql
--
-- ER entity -> table name:
--   Customer->Customers, Product->Products, Inventory->Inventory,
--   Discount->Discounts, Order->Orders, Payment->Payments, Return->Returns
-- (Order and Return are reserved words in MySQL, so every table uses a plural name.)
--
-- Automation changes (see 04_automation.sql): primary keys are AUTO_INCREMENT, and
-- date / status columns have defaults, so the app no longer asks for them.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS sporting_goods_store;
USE sporting_goods_store;

-- Table 1: Customers
CREATE TABLE Customers (
    Customer_No   INT NOT NULL AUTO_INCREMENT,
    Customer_Name VARCHAR(100) NOT NULL,
    Email         VARCHAR(100) NOT NULL,
    Phone         VARCHAR(20)  NOT NULL,
    PRIMARY KEY (Customer_No),
    UNIQUE INDEX Email_UNIQUE (Email ASC) VISIBLE
);

-- Table 2: Products
CREATE TABLE Products (
    Product_ID   INT NOT NULL AUTO_INCREMENT,
    Product_Name VARCHAR(100) NOT NULL,
    Category     VARCHAR(50)  NOT NULL,
    Price        DECIMAL(10, 2) NOT NULL,
    Quantity     INT NOT NULL,
    PRIMARY KEY (Product_ID)
);

-- Table 3: Inventory (references Products)
CREATE TABLE Inventory (
    Inventory_No       INT NOT NULL AUTO_INCREMENT,
    Product_ID         INT NOT NULL,
    Quantity_Available INT NOT NULL,
    Records            VARCHAR(255) NOT NULL,
    PRIMARY KEY (Inventory_No),
    UNIQUE INDEX Inventory_Product_UNIQUE (Product_ID ASC) VISIBLE,
    CONSTRAINT FK_Inventory_Products FOREIGN KEY (Product_ID) REFERENCES Products (Product_ID)
);

-- Table 4: Discounts (references Customers)
CREATE TABLE Discounts (
    Discount_ID         INT NOT NULL AUTO_INCREMENT,
    Customer_No         INT NOT NULL,
    Discount_Percentage DECIMAL(5, 2)  NOT NULL,
    Discount_Amount     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    Source              VARCHAR(10)    NOT NULL DEFAULT 'manual',   -- 'loyalty' rows are managed by the triggers
    PRIMARY KEY (Discount_ID),
    CONSTRAINT FK_Discounts_Customers FOREIGN KEY (Customer_No) REFERENCES Customers (Customer_No)
);

-- Table 5: Orders (references Products and Customers)
CREATE TABLE Orders (
    Order_No       INT NOT NULL AUTO_INCREMENT,
    Product_ID     INT NOT NULL,
    Customer_No    INT NOT NULL,
    Order_date     DATE NOT NULL DEFAULT (CURRENT_DATE),
    Total_Amount   DECIMAL(10, 2) NOT NULL,
    Package_status VARCHAR(20) NOT NULL DEFAULT 'Processing',
    PRIMARY KEY (Order_No),
    CONSTRAINT FK_Orders_Products  FOREIGN KEY (Product_ID)  REFERENCES Products (Product_ID),
    CONSTRAINT FK_Orders_Customers FOREIGN KEY (Customer_No) REFERENCES Customers (Customer_No)
);

-- Table 6: Payments (references Orders)
CREATE TABLE Payments (
    Payment_ID     INT NOT NULL AUTO_INCREMENT,
    Order_No       INT NOT NULL,
    Amount         DECIMAL(10, 2) NOT NULL,
    Payment_Date   DATE NOT NULL DEFAULT (CURRENT_DATE),
    Payment_Method VARCHAR(30) NOT NULL,
    Status         VARCHAR(20) NOT NULL DEFAULT 'Pending',
    PRIMARY KEY (Payment_ID),
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (Order_No) REFERENCES Orders (Order_No)
);

-- Table 7: Returns (references Orders and Products)
CREATE TABLE Returns (
    Return_No   INT NOT NULL AUTO_INCREMENT,
    Order_No    INT NOT NULL,
    Product_ID  INT NOT NULL,
    Return_Date DATE NOT NULL DEFAULT (CURRENT_DATE),
    Reason      VARCHAR(255) NOT NULL,
    Status      VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    PRIMARY KEY (Return_No),
    CONSTRAINT FK_Returns_Orders   FOREIGN KEY (Order_No)   REFERENCES Orders (Order_No),
    CONSTRAINT FK_Returns_Products FOREIGN KEY (Product_ID) REFERENCES Products (Product_ID)
);

-- Table 8: Users (supports the login screen; not part of the ER diagram)
CREATE TABLE Users (
    User_ID  INT NOT NULL AUTO_INCREMENT,
    Username VARCHAR(50)  NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Role        VARCHAR(10) NOT NULL DEFAULT 'user',   -- 'admin' sees the dashboard, 'user' sees the shop
    Customer_No INT NULL,                              -- the customer record created at sign up
    PRIMARY KEY (User_ID),
    UNIQUE INDEX Username_UNIQUE (Username ASC) VISIBLE,
    CONSTRAINT FK_Users_Customers FOREIGN KEY (Customer_No) REFERENCES Customers (Customer_No)
);

-- Table 9: Discount_Tiers (loyalty ladder: orders placed -> automatic discount; not in the ER diagram)
CREATE TABLE Discount_Tiers (
    Tier_ID    INT NOT NULL AUTO_INCREMENT,
    Min_Orders INT NOT NULL,
    Percentage DECIMAL(5, 2) NOT NULL,
    PRIMARY KEY (Tier_ID),
    UNIQUE INDEX Min_Orders_UNIQUE (Min_Orders ASC) VISIBLE
);
