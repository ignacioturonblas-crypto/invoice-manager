-- Seed: 32 Interior Design Studios in Barcelona (scraped via Google Places, May 2026)
-- Run AFTER migration 010_outreach.sql

-- Create a seed search record
INSERT INTO searches (id, query, category, city, country, total_found, imported_count)
VALUES ('00000000-0000-0000-0000-000000000001', 'estudio interiorismo', 'interior_studio', 'Barcelona', 'ES', 32, 32)
ON CONFLICT DO NOTHING;

-- Insert contacts (upsert on google_place_id to allow re-running safely)
INSERT INTO contacts (name, category, address, city, country, phone, website, google_place_id, status, source_search_id)
VALUES
  ('118 Studio', 'interior_studio', 'Carrer de la Selva de Mar, 5-7, Sant Martí, 08019 Barcelona', 'Barcelona', 'ES', '930 38 53 27', 'https://118studio.es/', 'ChIJaSHdLc6jpBIR2wnGve3DMBs', 'new', '00000000-0000-0000-0000-000000000001'),
  ('INDAStudio', 'interior_studio', 'Carrer de Cartagena, 243, Eixample, 08025 Barcelona', 'Barcelona', 'ES', '931 69 24 54', 'https://www.indastudiobcn.com/', 'ChIJ3abiBLyjpBIRgRKWHnx6MOo', 'new', '00000000-0000-0000-0000-000000000001'),
  ('ETNA STUDIO', 'interior_studio', 'Carrer de Copèrnic, 15, Sarrià-Sant Gervasi, 08021 Barcelona', 'Barcelona', 'ES', '931 27 03 27', 'http://www.etnastudio.com/', 'ChIJn-MsOQyYpBIRuvkkO4DwZP4', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Estudio Miriam Barrio', 'interior_studio', 'Carrer de Ruiz de Padrón, 71, Sant Martí, 08026 Barcelona', 'Barcelona', 'ES', '936 79 54 08', 'http://miriambarrio.com/', 'ChIJ-S5_z7yipBIRA_fD8tcstWI', 'new', '00000000-0000-0000-0000-000000000001'),
  ('SEZAM STUDIO', 'interior_studio', 'Carrer de París, 151-155, Eixample, 08036 Barcelona', 'Barcelona', 'ES', '628 26 68 23', 'http://www.sezam.es/', 'ChIJiW02iruipBIRk_7cBMwspws', 'new', '00000000-0000-0000-0000-000000000001'),
  ('THE ROOM STUDIO', 'interior_studio', 'Travessera de les Corts, 318, Les Corts, 08029 Barcelona', 'Barcelona', 'ES', '932 00 28 30', 'https://theroom-studio.com/', 'ChIJpSf1GZuipBIRABFZtEj3p9g', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Futur2 studio', 'interior_studio', 'Carrer de Llull, 51, Sant Martí, 08005 Barcelona', 'Barcelona', 'ES', '647 73 59 80', 'http://www.futur-2.com/', 'ChIJXScu1xWjpBIR_5lAhmVZo2I', 'new', '00000000-0000-0000-0000-000000000001'),
  ('DD Design Studio', 'interior_studio', 'Carrer de Londres, 65, Eixample, 08036 Barcelona', 'Barcelona', 'ES', '644 40 44 70', 'https://www.dddesignstudio.com/', 'ChIJpb7ywbijpBIR9UvqmXzQKO4', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Los Dos Studio', 'interior_studio', 'Carrer d''Enric Granados, 43, Eixample, 08008 Barcelona', 'Barcelona', 'ES', '646 47 83 40', 'http://los2studio.com/', 'ChIJ4QcU5j6jpBIRZ5nPWWUh1_4', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Ebae Interiorisme', 'interior_studio', 'Avinguda dels Quinze, 8, Nou Barris, 08016 Barcelona', 'Barcelona', 'ES', '932 43 11 53', 'http://www.ebae.es/', 'ChIJZxsE2C29pBIR85ZQi38vOHY', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Estudio Dott', 'interior_studio', 'Carrer de Tànger, 48, Sant Martí, 08018 Barcelona', 'Barcelona', 'ES', '653 72 99 15', 'https://estudiodott.es/', 'ChIJAQC0phijpBIR_jW7qnL2yt4', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Ferruz Studio', 'interior_studio', 'Carrer de Beethoven, 16, Sarrià-Sant Gervasi, 08021 Barcelona', 'Barcelona', 'ES', '934 18 87 15', 'https://www.ferruzstudio.com/', 'ChIJa0nKOneYpBIRcQb7wMMUSgQ', 'new', '00000000-0000-0000-0000-000000000001'),
  ('C&I Interior Design', 'interior_studio', 'Rda. de Sant Pere, 47, Eixample, 08010 Barcelona', 'Barcelona', 'ES', '692 83 26 15', 'https://comfortandinterior.com/', 'ChIJcQOyahKjpBIR5U1Jvix-RTs', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Lobo Studio', 'interior_studio', 'Rambla de Catalunya, 18, Eixample, 08007 Barcelona', 'Barcelona', 'ES', '935 95 99 86', 'https://www.lobostudio.es/', 'ChIJxw6qwZ2jpBIRcLp7HPpRuQQ', 'new', '00000000-0000-0000-0000-000000000001'),
  ('HENKA Interiorismo', 'interior_studio', 'Passatge de Vilaret, 1, Eixample, 08013 Barcelona', 'Barcelona', 'ES', '673 98 44 33', 'http://henka-studio.es/', 'ChIJSx5smIGjpBIRFqCYbSeakzc', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Estudio Romanelli', 'interior_studio', 'Carrer d''Enric Granados, 135, Eixample, 08008 Barcelona', 'Barcelona', 'ES', '931 26 90 20', 'https://estudioromanelli.es/', 'ChIJoSRUzZiipBIRO-HElkcIYfo', 'new', '00000000-0000-0000-0000-000000000001'),
  ('estudio galata', 'interior_studio', 'Carrer del Doctor Trueta, 173, Sant Martí, 08005 Barcelona', 'Barcelona', 'ES', '655 71 14 65', 'http://estudiogalata.com/', 'ChIJV9WI7Z2jpBIRB_bLaMfKlmg', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Studio Alis', 'interior_studio', 'Carrer de Pallars, 235, Sant Martí, 08005 Barcelona', 'Barcelona', 'ES', '933 68 58 93', 'http://www.studioalis.es/', 'ChIJ7yKxJJiipBIR6yndJberDdg', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Egue y Seta', 'interior_studio', 'Carrer de la Diputació, 211, Eixample, 08011 Barcelona', 'Barcelona', 'ES', '930 26 85 67', 'https://www.egueyseta.com/', 'ChIJTUtM7u-ipBIRo2dsb0KBZ6c', 'new', '00000000-0000-0000-0000-000000000001'),
  ('SOL interiores ESTUDIO', 'interior_studio', 'Carrer de Londres, 1, Eixample, 08029 Barcelona', 'Barcelona', 'ES', '722 41 86 91', 'https://www.solinteriores.com/', 'ChIJqyXHsjSZpBIRQL3lwsLHIRk', 'new', '00000000-0000-0000-0000-000000000001'),
  ('BON - Arquitectura de Interiores', 'interior_studio', 'Carrer de Pallars, 350, Sant Martí, 08019 Barcelona', 'Barcelona', 'ES', '932 66 40 87', 'https://www.interioristabarcelona.com/', 'ChIJJe4E2QBWimURcTXST6ispdY', 'new', '00000000-0000-0000-0000-000000000001'),
  ('PPT Interiorismo', 'interior_studio', 'Carrer de Sant Gabriel, 24, Gràcia, 08012 Barcelona', 'Barcelona', 'ES', '630 42 72 96', 'https://pptinteriorismo.com/', 'ChIJ4SfFPpKipBIR9ekFFCuCwlQ', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Adela Cabré & Son', 'interior_studio', 'Carrer de Sant Gervasi de Cassoles, 95, Sarrià, 08022 Barcelona', 'Barcelona', 'ES', '934 53 33 31', 'https://www.adelacabre.com/', 'ChIJhWTo8oyipBIRxoQczT13-rI', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Cassàinteriors', 'interior_studio', 'Carrer de Fluvià, 71, Sant Martí, 08019 Barcelona', 'Barcelona', 'ES', '648 25 18 99', 'http://www.cassainteriors.com/', 'ChIJ44hWbEOjpBIRDmOnQ54AvSI', 'new', '00000000-0000-0000-0000-000000000001'),
  ('DIEDRIC DESIGN', 'interior_studio', 'Carrer del Clot, 176, Sant Martí, 08026 Barcelona', 'Barcelona', 'ES', '655 05 89 93', 'https://www.diedricdesign.com/', 'ChIJSzHWa-YvoEURhpx_1sRH8sc', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Marta Bueno / NORDICROOM STUDIO', 'interior_studio', 'Grant de Sant Andreu, 2, Sant Andreu, 08030 Barcelona', 'Barcelona', 'ES', NULL, 'http://www.nordicroom.es/', 'ChIJVWEH8O69pBIRMSCet9a3T8E', 'new', '00000000-0000-0000-0000-000000000001'),
  ('A Space About', 'interior_studio', 'Plaça de Sant Josep Oriol, 4, Ciutat Vella, 08002 Barcelona', 'Barcelona', 'ES', '676 54 62 12', 'http://www.aspaceabout.com/', 'ChIJxc73MgejpBIRKhiVjfEwGp8', 'new', '00000000-0000-0000-0000-000000000001'),
  ('ANNA PUIG Interiorismo', 'interior_studio', 'Carrer de Villarroel, 231, Eixample, 08036 Barcelona', 'Barcelona', 'ES', '699 72 98 55', 'http://www.annapuig.es/', 'ChIJi86R8ZuipBIRAnyitAPo3hU', 'new', '00000000-0000-0000-0000-000000000001'),
  ('BRÁKARA STUDIO', 'interior_studio', 'Carrer de Ramón y Cajal, 116, Gràcia, 08024 Barcelona', 'Barcelona', 'ES', '638 27 08 19', 'http://www.brakarastudio.com/', 'ChIJu2BJg3yjpBIRqbT8lCZmeg8', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Dstudio Bcn', 'interior_studio', 'Carrer de Pere IV, 483, Sant Martí, 08020 Barcelona', 'Barcelona', 'ES', '655 91 24 96', 'http://dstudiobcn.com/', 'ChIJaZiKK3OjpBIRq9tYL1TL8BA', 'new', '00000000-0000-0000-0000-000000000001'),
  ('Coblonal', 'interior_studio', 'Plaça de Tetuan, 9, Eixample, 08010 Barcelona', 'Barcelona', 'ES', '932 18 09 99', 'https://coblonal.com/', 'ChIJ1QQru6CipBIRcD3NX0750Tw', 'new', '00000000-0000-0000-0000-000000000001'),
  ('HOMEVICE ESTUDIO DE INTERIORISMO', 'interior_studio', 'Carrer de Llull, 47, Sant Martí, 08005 Barcelona', 'Barcelona', 'ES', '699 73 76 24', 'http://www.home-vice.com/', 'ChIJJzGt9PyipBIRhM15O3JS4jM', 'new', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (google_place_id) DO NOTHING;
