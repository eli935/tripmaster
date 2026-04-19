-- =====================================================================
-- Migration 013: Vendors seed — AI-suggested (NOT VERIFIED)
-- =====================================================================
-- Seeds the public.vendors table with publicly-available, Jewish/kosher-
-- traveler-relevant vendor info for 3 destinations: Rome, Athens, Kotor/Budva.
--
-- IMPORTANT:
--   * Every row below is verified=false, verified_by='ai-suggestion'.
--   * Phone numbers are intentionally NULL unless they appear on the vendor's
--     own official website or on Chabad.org. Admin (Eli) must verify & fill in.
--   * All INSERTs are idempotent via WHERE NOT EXISTS on (country_code, name).
--
-- Sources used (all public): official vendor websites, chabad.org,
-- chabad.gr, chabad-montenegro.com, chabadpbrome.com, dukleyhotels.com,
-- gostijo.gr, baghetto.com, bellacarne.it, casalinoosteriakosher.it,
-- theacropolismuseum.gr, turismoroma.it, italia.it, montenegro.travel,
-- jewishrometours.com, romanjews.com, jewstravelrome.com.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROME, ITALY (country_code='IT')
-- ---------------------------------------------------------------------

-- 1. Chabad Piazza Bologna (primary Chabad in Rome)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'chabad',
  'בית חב"ד פיאצה בולוניה, רומא',
  'Chabad Piazza Bologna, Rome',
  'https://chabadpbrome.com',
  'Viale di Villa Massimo 39, 00161 Rome RM, Italy',
  'Rabbi Menachem Lazar. Main Chabad house in Rome, Bologna neighborhood. Shabbat meals, minyan, tourist services.',
  ARRAY['hebrew-speaking','family-friendly','shabbat-meals','minyan'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='בית חב"ד פיאצה בולוניה, רומא');

-- 2. Great Synagogue of Rome (Tempio Maggiore)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'chabad',
  'בית הכנסת הגדול של רומא',
  'Great Synagogue of Rome (Tempio Maggiore)',
  'https://www.romaebraica.it',
  'Lungotevere de'' Cenci, 00186 Rome, Italy',
  'Historic main synagogue of the Jewish Community of Rome (Orthodox). Houses the Jewish Museum of Rome. Next to the old Ghetto.',
  ARRAY['orthodox','historic','museum','ghetto'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='בית הכנסת הגדול של רומא');

-- 3. BaGhetto (kosher meat, Jewish Ghetto)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'restaurant',
  'Ba''Ghetto',
  'BaGhetto Kosher Restaurant',
  'https://www.baghetto.com',
  'Via del Portico d''Ottavia, 57, 00186 Rome, Italy',
  'Strictly kosher meat restaurant. Jewish-Roman and Middle Eastern cuisine. Multiple locations in Rome (Portico d''Ottavia, Milky branch).',
  ARRAY['kosher','meat','jewish-ghetto','family-friendly'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Ba''Ghetto');

-- 4. BaGhetto Milky (kosher dairy)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'restaurant',
  'Ba''Ghetto Milky',
  'BaGhetto Milky (Dairy)',
  'https://www.baghetto.com',
  'Via del Portico d''Ottavia, 2/A, 00186 Rome, Italy',
  'Kosher dairy (milky) restaurant — Italian cheeses, pizza, pasta. Jewish Ghetto location.',
  ARRAY['kosher','dairy','jewish-ghetto'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Ba''Ghetto Milky');

-- 5. Bellacarne (kosher meat)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'restaurant',
  'Bellacarne',
  'Bellacarne Kosher Restaurant',
  'https://www.bellacarne.it',
  'Via del Portico d''Ottavia, 51, 00186 Rome, Italy',
  'Kosher meat restaurant in the heart of the Roman Ghetto. Traditional Jewish-Roman cuisine.',
  ARRAY['kosher','meat','jewish-ghetto'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Bellacarne');

-- 6. Casalino Osteria Kosher
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'restaurant',
  'Casalino Osteria Kosher',
  'Casalino Osteria Kosher',
  'https://casalinoosteriakosher.it',
  'Via del Portico d''Ottavia, 1e, 00186 Rome, Italy',
  'Kosher osteria in Palazzo di Lorenzo Manili, Jewish Ghetto.',
  ARRAY['kosher','jewish-ghetto'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Casalino Osteria Kosher');

-- 7. Renato al Ghetto (kosher)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'restaurant',
  'Renato al Ghetto',
  'Renato al Ghetto',
  'Via del Portico d''Ottavia, 5, 00186 Rome, Italy',
  'Kosher restaurant in Jewish Ghetto. Website not confirmed on official sources — verify before listing.',
  ARRAY['kosher','jewish-ghetto'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Renato al Ghetto');

-- 8. Jewish Rome Tours (Marco Misano) — licensed guide
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'guide',
  'Marco Misano — Roman Jews Tours',
  'Marco Misano (RomanJews)',
  'https://romanjews.com',
  'Licensed regional tour guide, member of Rome Jewish community, studied at Yeshiva of Rome. Jewish Rome & general Rome tours.',
  ARRAY['jewish-tours','licensed-guide','hebrew-speaking-possible'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Marco Misano — Roman Jews Tours');

-- 9. Jews Travel Rome (tour group)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'tour',
  'Jews Travel Rome',
  'Jews Travel Rome',
  'https://www.jewstravelrome.com',
  'Licensed native Italian tour guides, members of Rome Jewish community. Tours in English, French, Spanish, Hebrew upon request.',
  ARRAY['jewish-tours','hebrew-speaking','licensed-guide','family-friendly'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Jews Travel Rome');

-- 10. Jewish Roma Walking Tours (Micaela Pavoncello)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'guide',
  'Micaela Pavoncello — Jewish Roma Walking Tours',
  'Jewish Roma Walking Tours',
  'https://www.jewishroma.com',
  'Founded 2003 by Micaela Pavoncello, Art History background, archive research. Jewish Ghetto walking tours.',
  ARRAY['jewish-tours','walking-tour','licensed-guide'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='Micaela Pavoncello — Jewish Roma Walking Tours');

-- 11. Bioparco di Roma (zoo)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'activity',
  'ביופארקו — גן החיות של רומא',
  'Bioparco di Roma',
  'https://www.bioparco.it',
  'Piazzale del Giardino Zoologico, 1, 00197 Rome, Italy (Villa Borghese)',
  'Largest zoo in Italy. 1,100+ animals, 220+ species. Children''s Bioparco section for young kids.',
  ARRAY['family-friendly','kids','zoo','villa-borghese'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='ביופארקו — גן החיות של רומא');

-- 12. Zoomarine Italy (theme park)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'IT', 'Rome', 'activity',
  'זומרין רומא',
  'Zoomarine Italy',
  'https://www.zoomarine.it',
  'Via dei Romagnoli, Torvaianica (Pomezia), approx. 40 min from Rome by car',
  'Edutainment theme park — dolphins, seals, water slides, pools, tropical beach, diving shows. Great for families.',
  ARRAY['family-friendly','kids','theme-park','water-park'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='IT' AND name='זומרין רומא');

-- ---------------------------------------------------------------------
-- ATHENS, GREECE (country_code='GR')
-- ---------------------------------------------------------------------

-- 13. Chabad Lubavitch of Athens
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'chabad',
  'בית חב"ד אתונה',
  'Chabad Lubavitch of Athens, Greece',
  'https://www.chabad.gr',
  '10 Aisopou Street, Athens 10554, Greece (Psiri neighborhood)',
  'Rabbi Mendel & Nechama Hendel. Co-located with Gostijo kosher restaurant and a kosher grocery. Central Athens (Psiri).',
  ARRAY['hebrew-speaking','family-friendly','shabbat-meals','minyan','kosher-grocery'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='בית חב"ד אתונה');

-- 14. Gostijo — only kosher restaurant in Athens
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'restaurant',
  'Gostijo',
  'Gostijo Kosher Restaurant',
  'https://gostijo.gr',
  '10 Aisopou Street, Psiri, Athens 10554, Greece',
  'Glatt Kosher. Only kosher restaurant in Athens. Sephardic-Mediterranean menu. Under supervision of Rabbi Mendel Hendel (Chabad).',
  ARRAY['kosher','glatt','meat','mediterranean','sephardic'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='Gostijo');

-- 15. Jewish Community of Athens (Beth Shalom Synagogue)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'chabad',
  'בית הכנסת בית שלום, אתונה',
  'Beth Shalom Synagogue — Jewish Community of Athens',
  'https://www.athensjewishcommunity.gr',
  '5 Melidoni Street, Thiseio, Athens 10553, Greece',
  'Main Romaniote/Sephardic synagogue of the Jewish Community of Athens. Historic community building.',
  ARRAY['historic','community','synagogue'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='בית הכנסת בית שלום, אתונה');

-- 16. Acropolis Museum
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'activity',
  'מוזיאון האקרופוליס',
  'Acropolis Museum',
  'https://www.theacropolismuseum.gr/en',
  'Dionysiou Areopagitou 15, 11742 Athens, Greece',
  'Official museum. Family services: stroller loan, parents'' room, free family audio guide & backpacks. Timed e-tickets.',
  ARRAY['family-friendly','museum','historic','kids-program'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='מוזיאון האקרופוליס');

-- 17. Allou! Fun Park
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'activity',
  'Allou! Fun Park',
  'Allou! Fun Park',
  'https://www.allou.gr',
  'Kifisou Avenue & Petrou Ralli, Agios Ioannis Rentis, 18233 Athens, Greece',
  'Largest amusement park in Greece. "Kidom" section for younger kids, bigger rides for older kids/teens.',
  ARRAY['family-friendly','kids','amusement-park','theme-park'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='Allou! Fun Park');

-- 18. Attica Zoological Park
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'activity',
  'Attica Zoological Park',
  'Attica Zoological Park',
  'https://www.atticapark.com',
  'Yalou, Spata 19004, Greece',
  'Zoo east of Athens near the airport. Educational programs, wide range of species. Family-friendly.',
  ARRAY['family-friendly','kids','zoo'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='Attica Zoological Park');

-- 19. National Garden of Athens
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, address, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'activity',
  'הגן הלאומי של אתונה',
  'National Garden of Athens',
  'Leoforos Vasilissis Amalias, 10557 Athens (next to Syntagma Square)',
  'Free public garden with playground, small zoo, duck pond, Children''s Library, Botanical Museum. 500+ plants.',
  ARRAY['free','family-friendly','kids','park','walking'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='הגן הלאומי של אתונה');

-- 20. Kosher Greece (travel portal)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'GR', 'Athens', 'tour',
  'Kosher Greece',
  'Kosher Greece — Jewish Travel Portal',
  'https://koshergreece.com',
  'Portal with kosher & Jewish travel info for Greece (Athens, islands). Operated in coordination with Chabad Greece.',
  ARRAY['kosher','jewish-tours','portal'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='GR' AND name='Kosher Greece');

-- ---------------------------------------------------------------------
-- KOTOR / BUDVA, MONTENEGRO (country_code='ME')
-- ---------------------------------------------------------------------

-- 21. Chabad of Budva (Ehrenfeld)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'ME', 'Budva', 'chabad',
  'בית חב"ד בודבה, מונטנגרו',
  'Chabad of Budva Montenegro',
  'https://chabad-montenegro.com/bud/en/',
  'Dukley Hotel & Resort, Jadranski Put, Zavala Peninsula, Budva 85310, Montenegro',
  'Rabbi Leizer & Rebbetzin Mushki Ehrenfeld. Synagogue (capacity ~100), library, kitchen, co-located with Shalom kosher restaurant.',
  ARRAY['hebrew-speaking','family-friendly','shabbat-meals','minyan','dukley'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='בית חב"ד בודבה, מונטנגרו');

-- 22. Lubavitch of Montenegro (Podgorica - main)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'ME', 'Podgorica', 'chabad',
  'חב"ד מונטנגרו (פודגוריצה)',
  'Lubavitch of Montenegro — Podgorica',
  'https://www.chabad.org/jewish-centers/3829725/Podgorica/Synagogue/Lubavitch-of-Montenegro',
  'Vaka Djurovica 5, Podgorica 81000, Montenegro',
  'Chief Rabbi Ari Edelkopf — first resident rabbi in Montenegro in 100+ years. Main country center.',
  ARRAY['main-center','shabbat-meals','minyan','chief-rabbi'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='חב"ד מונטנגרו (פודגוריצה)');

-- 23. Shalom Kosher Restaurant (Dukley, Budva)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'ME', 'Budva', 'restaurant',
  'Shalom Kosher Restaurant',
  'Shalom Kosher Restaurant — Dukley',
  'https://www.dukleyhotels.com/en/dining/shalom',
  'Dukley Hotel & Resort, Jadranski Put, Zavala Peninsula, Budva 85310, Montenegro',
  'Glatt Kosher, Pat Yisrael, Bishul Yisrael, Chalav Yisrael. Under Chabad Chief Rabbi supervision. Sea views. Reservations recommended.',
  ARRAY['kosher','glatt','meat','mediterranean','luxury','sea-view'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='Shalom Kosher Restaurant');

-- 24. Dukley Hotel & Resort (lodging w/ JCC)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'ME', 'Budva', 'other',
  'Dukley Hotel & Resort',
  'Dukley Hotel & Resort Budva',
  'https://www.dukleyhotels.com',
  'Jadranski Put, Zavala Peninsula, Budva 85310, Montenegro',
  'Luxury resort hosting the Jewish Community Center, Chabad, and Shalom kosher restaurant. Private beach. Family suites.',
  ARRAY['hotel','resort','kosher-on-site','jewish-community','beach'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='Dukley Hotel & Resort');

-- 25. Bay of Kotor (official tourism)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'ME', 'Kotor', 'activity',
  'מפרץ קוטור',
  'Bay of Kotor — Official Tourism',
  'https://www.montenegro.travel/en/unique-montenegro/jewels-of-the-adriatic/bay-of-kotor',
  'UNESCO World Heritage bay. Official Montenegro tourism board portal — info on sights, old towns (Kotor, Perast), Our Lady of the Rocks island.',
  ARRAY['unesco','official-tourism','family-friendly','sightseeing'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='מפרץ קוטור');

-- 26. Kotor Boat Tours
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'ME', 'Kotor', 'tour',
  'Kotor Boat Cruise',
  'Kotor Boat Cruise',
  'https://kotorboatcruise.com',
  'Boat tour operator in Bay of Kotor. Vessels certified annually by Montenegro Coast Guard; licensed Merchant Marine captains. Blue Cave, Perast, Lady of the Rocks routes.',
  ARRAY['boat-tour','family-friendly','blue-cave','perast','licensed'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='Kotor Boat Cruise');

-- 27. Aquaholic Kotor (Blue Cave tours)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'ME', 'Kotor', 'tour',
  'Aquaholic Kotor',
  'Aquaholic Kotor — Blue Cave Tours',
  'https://www.bluecavekotor.com',
  'Boat excursion operator: Blue Cave, Mamula Island, submarine base, Lady of the Rocks. Multiple daily departures from Kotor.',
  ARRAY['boat-tour','family-friendly','blue-cave','swimming'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='Aquaholic Kotor');

-- 28. Miro & Sons Kotor Tours (land tours)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, notes, tags, verified, verified_by)
SELECT 'ME', 'Kotor', 'tour',
  'Miro & Sons Kotor Tours',
  'Miro & Sons Tours',
  'https://www.miroandsons.com',
  'Award-winning tour agency — private land tours in Montenegro (Lovcen, Cetinje, Ostrog, Lake Skadar, Durmitor). Family-friendly.',
  ARRAY['private-tour','land-tour','family-friendly','licensed'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='Miro & Sons Kotor Tours');

-- 29. Old Town of Kotor (Stari Grad)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'ME', 'Kotor', 'activity',
  'העיר העתיקה של קוטור',
  'Old Town of Kotor (Stari Grad)',
  'https://www.montenegro.travel',
  'Kotor Old Town, 85330 Kotor, Montenegro',
  'UNESCO World Heritage fortified medieval old town. Walk to St. John''s Fortress (1,350 steps) — great for active families.',
  ARRAY['unesco','historic','walking','family-friendly','free'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='העיר העתיקה של קוטור');

-- 30. Porto Montenegro (Tivat)
INSERT INTO public.vendors (country_code, destination, vendor_type, name, name_en, website, address, notes, tags, verified, verified_by)
SELECT 'ME', 'Tivat', 'activity',
  'Porto Montenegro',
  'Porto Montenegro',
  'https://www.portomontenegro.com',
  'Obala bb, 85320 Tivat, Montenegro',
  'Luxury marina and lifestyle village in Bay of Kotor. Restaurants, shops, museum, pool club. 15 min drive from Kotor.',
  ARRAY['luxury','marina','family-friendly','shopping','dining'],
  false, 'ai-suggestion'
WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE country_code='ME' AND name='Porto Montenegro');

-- =====================================================================
-- SUMMARY (as of this migration)
-- =====================================================================
-- Rome (IT):         12 vendors  (1 Chabad + 1 synagogue + 5 restaurants
--                                 + 3 guides/tours + 2 activities)
-- Athens (GR):        8 vendors  (1 Chabad + 1 synagogue + 1 restaurant
--                                 + 1 tour-portal + 4 activities)
-- Montenegro (ME):   10 vendors  (2 Chabad + 1 restaurant + 1 hotel
--                                 + 4 tours + 2 activities)
-- -----
-- TOTAL:             30 AI-suggested vendors, all verified=false.
--
-- Fields frequently left NULL (Eli should verify these first):
--   * phone / whatsapp     — never filled, per data-integrity rule.
--                            Pull from official websites on verification.
--   * hours                — never filled; hours change seasonally, especially
--                            in Montenegro (Shalom, Chabad Budva) and
--                            Rome kosher restaurants (Shabbat-dependent).
--   * maps_url             — never filled; generate from address during verify.
--   * lat / lng            — never filled; geocode during verify.
--   * trusted_since        — left NULL by design (only set on verification).
--
-- Destinations where info was easiest to find:
--   Rome    — rich ecosystem, many official kosher sites.
--   Athens  — small but well-documented via Chabad.gr / Gostijo.gr.
--
-- Destinations where info was harder:
--   Montenegro — small Jewish community, most info flows through
--                chabad-montenegro.com + Dukley; Kotor itself has no
--                dedicated Chabad (nearest is Budva, 25 km).
--                Hebrew-speaking guides in Montenegro are not publicly
--                listed on any official source — none seeded; Eli
--                should ask Rabbi Ehrenfeld for referrals.
--
-- Notes for admin (Eli) before promoting to verified=true:
--   1. Confirm phone via each vendor's current official website.
--   2. For kosher restaurants — re-check kashrut certification dates.
--   3. For Chabad houses — Shabbat times & meal reservation policy vary.
--   4. For Montenegro boat tours — season runs ~May-October only.
-- =====================================================================
