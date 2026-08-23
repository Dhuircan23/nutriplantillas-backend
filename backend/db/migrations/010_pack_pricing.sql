-- Ajuste de precios y contenido de los packs.
-- Estudiante baja a $19.990 (más accesible) y Profesional pasa a ser
-- superconjunto del Estudiante (9 archivos) a $32.990.
-- Los precios del carrito salen de products.price_clp, así que este archivo es
-- la fuente de verdad del cobro; Packages.dc.html solo lo refleja en pantalla.
UPDATE products
SET price_clp = 19990,
    bundle_items = ARRAY['nmx01','nmx13','nmxp1','nmx21','nmx14m','nmx12','nmx36']
WHERE id = 'pack-estudiante';

UPDATE products
SET price_clp = 32990,
    bundle_items = ARRAY['nmx01','nmx21','nmx12','nmx36','nmx13','nmx14m','nmxp1','nmx11','nmx43']
WHERE id = 'pack-profesional';
