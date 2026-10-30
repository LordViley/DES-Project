USE sporting_goods_store;
ALTER TABLE Products ADD COLUMN Image_URL VARCHAR(255) NULL;

UPDATE Products SET Image_URL = 'images/football.jpg'      WHERE Product_ID = 1;
UPDATE Products SET Image_URL = 'images/running-shoes.jpg' WHERE Product_ID = 2;
UPDATE Products SET Image_URL = 'images/tennis-racket.jpg' WHERE Product_ID = 3;
UPDATE Products SET Image_URL = 'images/yoga-mat.jpg'      WHERE Product_ID = 4;
UPDATE Products SET Image_URL = 'images/basketball.jpg'    WHERE Product_ID = 5;
UPDATE Products SET Image_URL = 'images/dumbbells.jpg'     WHERE Product_ID = 6;