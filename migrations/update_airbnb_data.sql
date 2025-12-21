-- Script SQL pour mettre à jour les données Airbnb des propriétés
-- À exécuter sur la base de données de production

-- Wazemmes
UPDATE property SET 
    airbnb_url = 'airbnb.fr/h/roaming',
    airbnb_rating = 4.44,
    airbnb_reviews_count = 94
WHERE slug = 'wazemmes';

-- Lambersart
UPDATE property SET 
    airbnb_url = 'airbnb.fr/h/roamingllambrsart',
    airbnb_rating = 4.42,
    airbnb_reviews_count = 19
WHERE slug = 'lambersart';

-- Appartement Marcq-en-Baroeul
UPDATE property SET 
    airbnb_url = 'airbnb.fr/h/roamingmarcq1',
    airbnb_rating = 5.0,
    airbnb_reviews_count = 4
WHERE slug = 'appartement-marcq-en-baroeul';

-- Maison Marcq-en-Baroeul
UPDATE property SET 
    airbnb_url = 'airbnb.fr/h/marcq2',
    airbnb_rating = 5.0,
    airbnb_reviews_count = 3
WHERE slug = 'maison-marcq-en-baroeul';

-- Vérification
SELECT slug, title, airbnb_url, airbnb_rating, airbnb_reviews_count FROM property;
