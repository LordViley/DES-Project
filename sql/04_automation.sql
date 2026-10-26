-- =====================================================================
-- SEGMENT 6 (new): Business-rule automation (stored procedure + triggers)
-- Run AFTER 01-03, so the sample data in 02 is loaded untouched and only
-- NEW rows added from now on are handled automatically.
--
-- What this automates:
--   Orders    : price taken from Products, customer's best discount applied,
--               stock checked (order refused if sold out), stock reduced,
--               stock put back if the order is set to 'Cancelled'
--   Payments  : amount defaults to the order total
--   Returns   : product filled in from the order and checked against it,
--               stock put back when a return becomes 'Approved'
--   Discounts : loyalty discount raised automatically as a customer places more orders
--               (ladder in Discount_Tiers; applies from the NEXT order)
--   Inventory : Records note written automatically, Products.Quantity kept
--               in step with Inventory.Quantity_Available
--
-- Each order is for one unit of one product (that is how the ER diagram
-- models it), so every stock movement below is 1 unit.
--
-- In MySQL Workbench run the whole file as normal. The DELIMITER lines are
-- needed for trigger bodies; scripts/setup.js understands them too.
-- =====================================================================

USE sporting_goods_store;

DROP PROCEDURE IF EXISTS sp_adjust_stock;
DROP PROCEDURE IF EXISTS sp_update_loyalty;
DROP TRIGGER IF EXISTS trg_orders_bi;
DROP TRIGGER IF EXISTS trg_orders_ai;
DROP TRIGGER IF EXISTS trg_orders_au;
DROP TRIGGER IF EXISTS trg_payments_bi;
DROP TRIGGER IF EXISTS trg_returns_bi;
DROP TRIGGER IF EXISTS trg_returns_ai;
DROP TRIGGER IF EXISTS trg_returns_au;
DROP TRIGGER IF EXISTS trg_inventory_bi;
DROP TRIGGER IF EXISTS trg_inventory_bu;
DROP TRIGGER IF EXISTS trg_inventory_ai;
DROP TRIGGER IF EXISTS trg_inventory_au;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Helper: move stock for one product (+ adds stock, - removes it)
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_adjust_stock(IN p_product_id INT, IN p_delta INT, IN p_note VARCHAR(200))
BEGIN
    UPDATE Inventory
    SET Quantity_Available = GREATEST(Quantity_Available + p_delta, 0),
        Records = LEFT(CONCAT(p_note, ' on ', CURRENT_DATE), 255)
    WHERE Product_ID = p_product_id;
END$$

-- ---------------------------------------------------------------------
-- Helper: give a customer the best loyalty discount their order count has earned.
-- Only ever raises the discount: a bigger manual discount is never replaced.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_update_loyalty(IN p_customer_no INT)
BEGIN
    DECLARE v_orders  INT;
    DECLARE v_tier    DECIMAL(5, 2);
    DECLARE v_current DECIMAL(5, 2);

    SELECT COUNT(*) INTO v_orders
    FROM Orders WHERE Customer_No = p_customer_no AND Package_status <> 'Cancelled';

    SELECT COALESCE(MAX(Percentage), 0) INTO v_tier
    FROM Discount_Tiers WHERE Min_Orders <= v_orders;

    SELECT COALESCE(MAX(Discount_Percentage), 0) INTO v_current
    FROM Discounts WHERE Customer_No = p_customer_no;

    IF v_tier > v_current THEN
        IF EXISTS (SELECT 1 FROM Discounts WHERE Customer_No = p_customer_no AND Source = 'loyalty') THEN
            UPDATE Discounts SET Discount_Percentage = v_tier
            WHERE Customer_No = p_customer_no AND Source = 'loyalty';
        ELSE
            INSERT INTO Discounts (Customer_No, Discount_Percentage, Source)
            VALUES (p_customer_no, v_tier, 'loyalty');
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_orders_bi BEFORE INSERT ON Orders
FOR EACH ROW
BEGIN
    DECLARE v_price DECIMAL(10, 2);
    DECLARE v_stock INT;
    DECLARE v_pct   DECIMAL(5, 2);

    SELECT Price INTO v_price FROM Products WHERE Product_ID = NEW.Product_ID;

    -- Unknown product: leave it to the foreign key to reject with its own message
    IF v_price IS NOT NULL THEN
        IF NEW.Package_status IS NULL OR NEW.Package_status <> 'Cancelled' THEN
            SELECT COALESCE(SUM(Quantity_Available), 0) INTO v_stock
            FROM Inventory WHERE Product_ID = NEW.Product_ID;
            IF v_stock < 1 THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Out of stock: this product has no units available.';
            END IF;
        END IF;

        -- Total_Amount left empty (or 0) = price minus the customer's best discount
        IF NEW.Total_Amount IS NULL OR NEW.Total_Amount = 0 THEN
            SELECT COALESCE(MAX(Discount_Percentage), 0) INTO v_pct
            FROM Discounts WHERE Customer_No = NEW.Customer_No;
            SET NEW.Total_Amount = ROUND(v_price * (1 - v_pct / 100), 2);
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_orders_ai AFTER INSERT ON Orders
FOR EACH ROW
BEGIN
    IF NEW.Package_status <> 'Cancelled' THEN
        CALL sp_adjust_stock(NEW.Product_ID, -1, CONCAT('Sold 1 unit (order ', NEW.Order_No, ')'));
    END IF;
    CALL sp_update_loyalty(NEW.Customer_No);
END$$

CREATE TRIGGER trg_orders_au AFTER UPDATE ON Orders
FOR EACH ROW
BEGIN
    IF NEW.Package_status = 'Cancelled' AND OLD.Package_status <> 'Cancelled' THEN
        CALL sp_adjust_stock(NEW.Product_ID, 1, CONCAT('Order ', NEW.Order_No, ' cancelled, 1 unit returned to stock'));
    END IF;
END$$

-- ---------------------------------------------------------------------
-- PAYMENTS: amount defaults to the order total
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_payments_bi BEFORE INSERT ON Payments
FOR EACH ROW
BEGIN
    IF NEW.Amount IS NULL THEN
        SET NEW.Amount = (SELECT Total_Amount FROM Orders WHERE Order_No = NEW.Order_No);
    END IF;
END$$

-- ---------------------------------------------------------------------
-- RETURNS
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_returns_bi BEFORE INSERT ON Returns
FOR EACH ROW
BEGIN
    DECLARE v_order_product INT;

    SELECT Product_ID INTO v_order_product FROM Orders WHERE Order_No = NEW.Order_No;

    IF v_order_product IS NOT NULL THEN
        IF NEW.Product_ID IS NULL THEN
            SET NEW.Product_ID = v_order_product;
        ELSEIF NEW.Product_ID <> v_order_product THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That product is not part of the given order.';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_returns_ai AFTER INSERT ON Returns
FOR EACH ROW
BEGIN
    IF NEW.Status = 'Approved' THEN
        CALL sp_adjust_stock(NEW.Product_ID, 1, CONCAT('Return ', NEW.Return_No, ' approved, 1 unit restocked'));
    END IF;
END$$

CREATE TRIGGER trg_returns_au AFTER UPDATE ON Returns
FOR EACH ROW
BEGIN
    IF NEW.Status = 'Approved' AND OLD.Status <> 'Approved' THEN
        CALL sp_adjust_stock(NEW.Product_ID, 1, CONCAT('Return ', NEW.Return_No, ' approved, 1 unit restocked'));
    ELSEIF OLD.Status = 'Approved' AND NEW.Status <> 'Approved' THEN
        CALL sp_adjust_stock(NEW.Product_ID, -1, CONCAT('Return ', NEW.Return_No, ' no longer approved, 1 unit removed'));
    END IF;
END$$

-- ---------------------------------------------------------------------
-- INVENTORY: automatic note, and Products.Quantity mirrors the stock level
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_inventory_bi BEFORE INSERT ON Inventory
FOR EACH ROW
BEGIN
    IF NEW.Records IS NULL OR NEW.Records = '' THEN
        SET NEW.Records = CONCAT('Stock recorded on ', CURRENT_DATE);
    END IF;
END$$

CREATE TRIGGER trg_inventory_bu BEFORE UPDATE ON Inventory
FOR EACH ROW
BEGIN
    -- Quantity edited by hand without a new note: write one
    IF NEW.Quantity_Available <> OLD.Quantity_Available AND NEW.Records = OLD.Records THEN
        SET NEW.Records = CONCAT('Stock adjusted on ', CURRENT_DATE);
    END IF;
END$$

CREATE TRIGGER trg_inventory_ai AFTER INSERT ON Inventory
FOR EACH ROW
BEGIN
    UPDATE Products SET Quantity = NEW.Quantity_Available WHERE Product_ID = NEW.Product_ID;
END$$

CREATE TRIGGER trg_inventory_au AFTER UPDATE ON Inventory
FOR EACH ROW
BEGIN
    IF NEW.Quantity_Available <> OLD.Quantity_Available THEN
        UPDATE Products SET Quantity = NEW.Quantity_Available WHERE Product_ID = NEW.Product_ID;
    END IF;
END$$

DELIMITER ;

-- Check the automation objects exist
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'sporting_goods_store'
ORDER BY event_object_table, action_timing, event_manipulation;
