-- Custom SQL migration file, put your code below! --
-- Ensure PayTR is not left in test mode: real payments should be taken
-- unless an admin explicitly re-enables "Test Modu" from the
-- Ödeme Sağlayıcıları admin panel.
UPDATE `payment_provider_settings`
SET `test_mode` = 0
WHERE `provider` = 'paytr';
