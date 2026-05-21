ALTER TABLE `orders` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `cart_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `products` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment` text;--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_cart_id_idx` ON `orders` (`cart_id`);